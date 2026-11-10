from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.app.core.database import get_db
from backend.app.models.models import Setting, SecretVault, User, AuditLog
from backend.app.services.vault import vault_service
from backend.app.api.auth import get_current_user

router = APIRouter(prefix="/settings", tags=["settings"])

class SettingItem(BaseModel):
    key: str
    value: str
    is_secret: bool
    description: Optional[str] = None

class UpdateSettingRequest(BaseModel):
    value: str
    is_secret: bool = False
    description: Optional[str] = None

@router.get("", response_model=list[SettingItem])
async def list_settings(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user)
):
    items: list[SettingItem] = []
    
    # Non-secret settings from settings table
    stmt = select(Setting)
    settings_records = (await db.execute(stmt)).scalars().all()
    for s in settings_records:
        items.append(SettingItem(
            key=s.key,
            value=s.value,
            is_secret=s.is_secret,
            description=s.description
        ))

    # Secret settings from secrets_vault table (NEVER raw plaintext, always masked)
    vault_stmt = select(SecretVault)
    vault_records = (await db.execute(vault_stmt)).scalars().all()
    for v in vault_records:
        # Decrypt internally only to generate safe masked display string
        raw_val = vault_service.decrypt(v.ciphertext, v.nonce, v.tag)
        masked_val = vault_service.mask_secret(raw_val)
        items.append(SettingItem(
            key=v.key,
            value=masked_val,
            is_secret=True,
            description=f"Encrypted Secret ({v.key})"
        ))

    return items

@router.put("/{key}")
async def update_setting(
    key: str,
    req: UpdateSettingRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if req.is_secret:
        # Encrypt and store in vault
        await vault_service.set_secret(db, key, req.value, actor=current_user.username)
        return {"ok": True, "key": key, "masked": vault_service.mask_secret(req.value)}
    else:
        stmt = select(Setting).where(Setting.key == key)
        record = (await db.execute(stmt)).scalar_one_or_none()
        if record:
            record.value = req.value
            record.description = req.description or record.description
        else:
            record = Setting(key=key, value=req.value, is_secret=False, description=req.description)
            db.add(record)
        
        audit = AuditLog(action="SETTING_UPDATED", actor=current_user.username, details_json=f'{{"key": "{key}"}}')
        db.add(audit)
        await db.commit()
        return {"ok": True, "key": key, "value": req.value}

@router.post("/test/{service}")
async def test_connection(
    service: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user)
):
    service = service.lower()
    if service == "telegram":
        token = await vault_service.get_secret(db, "TELEGRAM_BOT_TOKEN")
        if not token:
            return {"ok": False, "service": "telegram", "message": "TELEGRAM_BOT_TOKEN not configured in vault."}
        import httpx
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(f"https://api.telegram.org/bot{token}/getMe")
                data = res.json()
                if data.get("ok"):
                    return {"ok": True, "service": "telegram", "message": f"Connected as @{data['result'].get('username')}"}
                return {"ok": False, "service": "telegram", "message": data.get("description", "Error")}
        except Exception as e:
            return {"ok": False, "service": "telegram", "message": str(e)}

    elif service == "gemini":
        api_key = await vault_service.get_secret(db, "GEMINI_API_KEY")
        if not api_key:
            return {"ok": False, "service": "gemini", "message": "GEMINI_API_KEY not configured in vault."}
        import httpx
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}")
                if res.status_code == 200:
                    return {"ok": True, "service": "gemini", "message": "Gemini API connection validated successfully."}
                return {"ok": False, "service": "gemini", "message": f"HTTP {res.status_code}: {res.text}"}
        except Exception as e:
            return {"ok": False, "service": "gemini", "message": str(e)}

    elif service == "buffer":
        token = await vault_service.get_secret(db, "BUFFER_ACCESS_TOKEN")
        if not token:
            return {"ok": False, "service": "buffer", "message": "BUFFER_ACCESS_TOKEN not configured in vault."}
        import httpx
        try:
            query = "query { user { id email } }"
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(
                    "https://api.buffer.com",
                    json={"query": query},
                    headers={"Authorization": f"Bearer {token}"}
                )
                if res.status_code == 200:
                    return {"ok": True, "service": "buffer", "message": "Buffer API connection verified."}
                return {"ok": False, "service": "buffer", "message": f"HTTP {res.status_code}: {res.text}"}
        except Exception as e:
            return {"ok": False, "service": "buffer", "message": str(e)}

    elif service in ("gdrive", "google_drive", "drive"):
        raw_sa = await vault_service.get_secret(db, "GOOGLE_DRIVE_SERVICE_ACCOUNT")
        if not raw_sa:
            return {
                "ok": False,
                "service": "google_drive",
                "message": "GOOGLE_DRIVE_SERVICE_ACCOUNT not configured in vault.",
            }

        folder_stmt = select(Setting).where(Setting.key == "GOOGLE_DRIVE_FOLDER_ID")
        folder_rec = (await db.execute(folder_stmt)).scalar_one_or_none()
        folder_id = folder_rec.value if folder_rec else None

        import json
        from backend.app.services.storage.drive_api import test_drive_connection as run_test_drive
        try:
            sa_info = json.loads(raw_sa)
            test_res = await run_test_drive(sa_info, folder_id=folder_id)
            folder_info = ""
            if test_res.get("folder"):
                f = test_res["folder"]
                if f.get("accessible"):
                    folder_info = f" | Folder: '{f.get('name')}' ({f.get('item_count')} items)"
                else:
                    folder_info = f" | Folder Check Warning: {f.get('error', 'Inaccessible')}"
            return {
                "ok": True,
                "service": "google_drive",
                "account": test_res.get("account"),
                "message": f"Connected to Google Drive as {test_res.get('account')}{folder_info}",
                "details": test_res,
            }
        except Exception as e:
            return {
                "ok": False,
                "service": "google_drive",
                "message": f"Google Drive validation failed: {str(e)}",
            }

    return {"ok": False, "service": service, "message": f"No test harness implemented for service '{service}'."}
