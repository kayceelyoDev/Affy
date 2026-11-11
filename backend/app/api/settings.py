from typing import Optional, Union, Dict, Any
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

class TestServiceRequest(BaseModel):
    credential: Optional[Union[str, Dict[str, Any]]] = None
    folder_id: Optional[str] = None

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
        save_val = req.value
        if key == "GOOGLE_DRIVE_FOLDER_ID" and save_val:
            import re
            match = re.search(r'folders/([a-zA-Z0-9_-]+)', save_val)
            save_val = match.group(1) if match else save_val.strip()

        stmt = select(Setting).where(Setting.key == key)
        record = (await db.execute(stmt)).scalar_one_or_none()
        if record:
            record.value = save_val
            record.description = req.description or record.description
        else:
            record = Setting(key=key, value=save_val, is_secret=False, description=req.description)
            db.add(record)
        
        audit = AuditLog(action="SETTING_UPDATED", actor=current_user.username, details_json=f'{{"key": "{key}"}}')
        db.add(audit)
        await db.commit()
        return {"ok": True, "key": key, "value": save_val}

@router.post("/test/{service}")
async def test_connection(
    service: str,
    req_body: Optional[TestServiceRequest] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user)
):
    service = service.lower()
    if service == "telegram":
        token = req_body.credential if (req_body and req_body.credential) else await vault_service.get_secret(db, "TELEGRAM_BOT_TOKEN")
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
        api_key = req_body.credential if (req_body and req_body.credential) else await vault_service.get_secret(db, "GEMINI_API_KEY")
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
        token = req_body.credential if (req_body and req_body.credential) else await vault_service.get_secret(db, "BUFFER_ACCESS_TOKEN")
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
        import json
        from backend.app.services.storage.drive_api import test_drive_connection as run_test_drive

        sa_info = None
        raw_sa = None

        if req_body and req_body.credential:
            if isinstance(req_body.credential, dict):
                sa_info = req_body.credential
            else:
                raw_sa = str(req_body.credential).strip()
        else:
            raw_sa = await vault_service.get_secret(db, "GOOGLE_DRIVE_SERVICE_ACCOUNT")
            if raw_sa:
                raw_sa = raw_sa.strip()

        if raw_sa and not sa_info:
            try:
                if raw_sa.startswith("{"):
                    sa_info = json.loads(raw_sa)
                else:
                    sa_info = {"private_key": raw_sa}
            except Exception as je:
                return {
                    "ok": False,
                    "service": "google_drive",
                    "message": f"Could not parse credentials JSON: {str(je)}",
                }

        if not sa_info:
            return {
                "ok": False,
                "service": "google_drive",
                "message": "GOOGLE_DRIVE_SERVICE_ACCOUNT not configured in vault. Enter credentials first.",
            }

        raw_fid = ""
        if req_body and req_body.folder_id:
            raw_fid = req_body.folder_id.strip()
        else:
            folder_stmt = select(Setting).where(Setting.key == "GOOGLE_DRIVE_FOLDER_ID")
            folder_rec = (await db.execute(folder_stmt)).scalar_one_or_none()
            raw_fid = folder_rec.value.strip() if folder_rec and folder_rec.value else ""

        import re
        match = re.search(r'folders/([a-zA-Z0-9_-]+)', raw_fid)
        folder_id = match.group(1) if match else raw_fid

        try:
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

    elif service == "cloudinary":
        cloud_name = None
        api_key = None
        api_secret = None

        if req_body and req_body.credential:
            if isinstance(req_body.credential, dict):
                cloud_name = req_body.credential.get("cloud_name")
                api_key = req_body.credential.get("api_key")
                api_secret = req_body.credential.get("api_secret")
            else:
                raw_cred = str(req_body.credential).strip()
                if raw_cred.startswith("cloudinary://"):
                    import re
                    m = re.match(r"cloudinary://([^:]+):([^@]+)@(.+)", raw_cred)
                    if m:
                        api_key, api_secret, cloud_name = m.groups()
                elif "{" in raw_cred:
                    import json
                    try:
                        c_dict = json.loads(raw_cred)
                        cloud_name = c_dict.get("cloud_name")
                        api_key = c_dict.get("api_key")
                        api_secret = c_dict.get("api_secret")
                    except Exception:
                        pass

        if not cloud_name:
            cloud_name = await vault_service.get_secret(db, "CLOUDINARY_CLOUD_NAME")
            if not cloud_name:
                stmt_cn = select(Setting).where(Setting.key == "CLOUDINARY_CLOUD_NAME")
                rec_cn = (await db.execute(stmt_cn)).scalar_one_or_none()
                if rec_cn and rec_cn.value:
                    cloud_name = rec_cn.value.strip()

        if not api_key:
            api_key = await vault_service.get_secret(db, "CLOUDINARY_API_KEY")
        if not api_secret:
            api_secret = await vault_service.get_secret(db, "CLOUDINARY_API_SECRET")

        if not cloud_name or not api_key or not api_secret:
            c_url = await vault_service.get_secret(db, "CLOUDINARY_URL")
            if c_url and c_url.startswith("cloudinary://"):
                import re
                m = re.match(r"cloudinary://([^:]+):([^@]+)@(.+)", c_url)
                if m:
                    api_key, api_secret, cloud_name = m.groups()

        if not cloud_name or not api_key or not api_secret:
            return {
                "ok": False,
                "service": "cloudinary",
                "message": "Cloudinary credentials (cloud_name, api_key, api_secret) not configured in vault.",
            }

        import httpx
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(
                    f"https://api.cloudinary.com/v1_1/{cloud_name}/ping",
                    auth=(api_key, api_secret),
                )
                if res.status_code == 200:
                    return {
                        "ok": True,
                        "service": "cloudinary",
                        "message": f"Cloudinary connected successfully (Cloud: {cloud_name})",
                    }
                else:
                    return {
                        "ok": False,
                        "service": "cloudinary",
                        "message": f"HTTP {res.status_code}: {res.text}",
                    }
        except Exception as e:
            return {"ok": False, "service": "cloudinary", "message": f"Connection error: {str(e)}"}

    return {"ok": False, "service": service, "message": f"No test harness implemented for service '{service}'."}

@router.post("/reset-data")
async def reset_catalog_data(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Safely resets generated video catalog content, render jobs, and plan slots.
    STRICTLY PRESERVES:
    - SecretVault (all credentials & API keys for Telegram, Buffer, Cloudinary, Gemini, GDrive)
    - Setting (all configs, folder IDs, default style preferences)
    - Product & Clip (all imported TikTok product catalogs & Google Drive synced clip metadata)
    - Track (all music library audio tracks)
    - User (authentication accounts)
    """
    from sqlalchemy import delete
    from backend.app.models.models import Post, RenderJob, PlanSlot, Plan

    # 1. Clear database rows for posts, renders, and slots
    await db.execute(delete(Post))
    await db.execute(delete(RenderJob))
    await db.execute(delete(PlanSlot))
    await db.execute(delete(Plan))

    # Audit log
    audit = AuditLog(
        action="CONTENT_DATA_RESET",
        actor=current_user.username,
        details_json='{"status": "success", "preserved": "credentials, settings, products, clips, tracks"}',
    )
    db.add(audit)
    await db.commit()

    # 2. Clean temporary preview and render video files from disk
    from pathlib import Path
    cleared_files = 0
    for pdir in [Path("data/previews"), Path("/app/data/previews"), Path("data/renders"), Path("/app/data/renders")]:
        if pdir.exists():
            for f in pdir.rglob("*.mp4"):
                try:
                    f.unlink()
                    cleared_files += 1
                except Exception:
                    pass

    return {
        "ok": True,
        "message": "Content posts and render jobs successfully reset. All API keys, drive connections, products, and clips remain securely preserved.",
        "cleared_temp_videos": cleared_files,
    }
