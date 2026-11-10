import base64
import json
import time
from pathlib import Path
from typing import Optional, List, Dict, Any
import httpx
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.serialization import load_pem_private_key
from backend.app.core.logging import logger

def _b64_url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")

async def get_drive_access_token(sa_info: dict) -> str:
    """Exchange Google Service Account credentials for an OAuth2 Bearer token."""
    client_email = sa_info.get("client_email")
    private_key_pem = sa_info.get("private_key")
    token_uri = sa_info.get("token_uri", "https://oauth2.googleapis.com/token")

    if not client_email or not private_key_pem:
        raise ValueError("Invalid Service Account JSON: client_email and private_key are required.")

    header = {"alg": "RS256", "typ": "JWT"}
    now = int(time.time())
    payload = {
        "iss": client_email,
        "scope": "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive",
        "aud": token_uri,
        "exp": now + 3600,
        "iat": now,
    }

    h_b64 = _b64_url(json.dumps(header).encode("utf-8"))
    p_b64 = _b64_url(json.dumps(payload).encode("utf-8"))
    signing_input = f"{h_b64}.{p_b64}".encode("utf-8")

    priv_key = load_pem_private_key(private_key_pem.encode("utf-8"), password=None)
    signature = priv_key.sign(signing_input, padding.PKCS1v15(), hashes.SHA256())
    sig_b64 = _b64_url(signature)
    jwt_token = f"{h_b64}.{p_b64}.{sig_b64}"

    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.post(
            token_uri,
            data={
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                "assertion": jwt_token,
            },
        )
        if res.status_code != 200:
            raise RuntimeError(f"Google OAuth token request failed ({res.status_code}): {res.text}")
        data = res.json()
        return data["access_token"]

async def test_drive_connection(sa_info: dict, folder_id: Optional[str] = None) -> dict:
    """Test connection to Google Drive API v3 and verify folder access."""
    token = await get_drive_access_token(sa_info)
    headers = {"Authorization": f"Bearer {token}"}

    async with httpx.AsyncClient(timeout=15.0) as client:
        # 1. Fetch Drive About info
        about_res = await client.get(
            "https://www.googleapis.com/drive/v3/about?fields=user,storageQuota",
            headers=headers,
        )
        if about_res.status_code != 200:
            raise RuntimeError(f"Failed to query Drive info ({about_res.status_code}): {about_res.text}")

        about_data = about_res.json()
        user_info = about_data.get("user", {})
        sa_email = user_info.get("emailAddress", sa_info.get("client_email"))
        quota = about_data.get("storageQuota", {})
        usage_bytes = int(quota.get("usage", 0))
        limit_bytes = int(quota.get("limit", 15 * 1024 * 1024 * 1024))

        folder_result: Optional[Dict[str, Any]] = None
        if folder_id:
            clean_id = folder_id.strip()
            if "/folders/" in clean_id:
                clean_id = clean_id.split("/folders/")[1].split("?")[0]

            f_res = await client.get(
                f"https://www.googleapis.com/drive/v3/files/{clean_id}?fields=id,name,mimeType,parents",
                headers=headers,
            )
            if f_res.status_code == 200:
                f_data = f_res.json()
                # Count children inside folder
                q = f"'{clean_id}' in parents and trashed = false"
                c_res = await client.get(
                    f"https://www.googleapis.com/drive/v3/files?q={httpx.URL('', params={'q': q}).params}&fields=files(id,name,mimeType)",
                    headers=headers,
                )
                child_count = len(c_res.json().get("files", [])) if c_res.status_code == 200 else 0
                folder_result = {
                    "id": clean_id,
                    "name": f_data.get("name"),
                    "item_count": child_count,
                    "accessible": True,
                }
            else:
                folder_result = {
                    "id": clean_id,
                    "accessible": False,
                    "error": f"HTTP {f_res.status_code}: {f_res.text}",
                }

        return {
            "ok": True,
            "account": sa_email,
            "quota_used_bytes": usage_bytes,
            "quota_total_bytes": limit_bytes,
            "folder": folder_result,
        }

async def list_drive_subfolders_and_clips(sa_info: dict, root_folder_id: str) -> List[dict]:
    """List product subfolders and video files in Google Drive root folder."""
    token = await get_drive_access_token(sa_info)
    headers = {"Authorization": f"Bearer {token}"}
    clean_id = root_folder_id.strip()
    if "/folders/" in clean_id:
        clean_id = clean_id.split("/folders/")[1].split("?")[0]

    async with httpx.AsyncClient(timeout=30.0) as client:
        # Get all subfolders
        q = f"'{clean_id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
        res = await client.get(
            f"https://www.googleapis.com/drive/v3/files?q={q}&fields=files(id,name)&pageSize=100",
            headers=headers,
        )
        folders = res.json().get("files", []) if res.status_code == 200 else []

        results = []
        for folder in folders:
            fid = folder["id"]
            fname = folder["name"]
            # List video files inside subfolder
            clip_q = f"'{fid}' in parents and trashed = false and (mimeType contains 'video/' or name contains '.mp4' or name contains '.mov')"
            c_res = await client.get(
                f"https://www.googleapis.com/drive/v3/files?q={clip_q}&fields=files(id,name,size,modifiedTime)&pageSize=100",
                headers=headers,
            )
            clips = c_res.json().get("files", []) if c_res.status_code == 200 else []
            results.append({
                "folder_id": fid,
                "folder_name": fname,
                "clips": clips,
            })
        return results

async def download_file_from_drive(sa_info: dict, file_id: str, dest_path: Path) -> Path:
    """Download binary file from Google Drive directly to destination."""
    token = await get_drive_access_token(sa_info)
    headers = {"Authorization": f"Bearer {token}"}
    dest_path.parent.mkdir(parents=True, exist_ok=True)

    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream(
            "GET",
            f"https://www.googleapis.com/drive/v3/files/{file_id}?alt=media",
            headers=headers,
        ) as resp:
            if resp.status_code != 200:
                raise RuntimeError(f"Drive download failed ({resp.status_code})")
            with open(dest_path, "wb") as f_out:
                async for chunk in resp.aiter_bytes(chunk_size=1024 * 1024):
                    f_out.write(chunk)
    return dest_path
