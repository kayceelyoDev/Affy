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
    """Exchange Google Service Account credentials or OAuth2 refresh token for a Bearer token."""
    # Handle nested Google OAuth client JSONs
    if "installed" in sa_info and isinstance(sa_info["installed"], dict):
        sa_info = {**sa_info, **sa_info["installed"]}
    elif "web" in sa_info and isinstance(sa_info["web"], dict):
        sa_info = {**sa_info, **sa_info["web"]}

    # Direct access token fallback
    if sa_info.get("access_token") and not sa_info.get("refresh_token") and not sa_info.get("private_key"):
        return sa_info["access_token"]

    token_uri = sa_info.get("token_uri", "https://oauth2.googleapis.com/token")

    # MODE 1: OAuth2 with Client ID + Client Secret + Refresh Token (n8n style)
    if sa_info.get("refresh_token") and sa_info.get("client_id"):
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(
                token_uri,
                data={
                    "grant_type": "refresh_token",
                    "client_id": sa_info["client_id"].strip(),
                    "client_secret": (sa_info.get("client_secret") or "").strip(),
                    "refresh_token": sa_info["refresh_token"].strip(),
                },
            )
            if res.status_code != 200:
                raise RuntimeError(f"Google OAuth2 refresh token failed ({res.status_code}): {res.text}")
            return res.json()["access_token"]

    # MODE 2: Google Service Account (Field-by-field: client_email + private_key)
    client_email = (sa_info.get("client_email") or "").strip()
    raw_key = (sa_info.get("private_key") or "").strip()

    if not client_email:
        raise ValueError("Missing 'client_email' (Service Account Email) or 'client_id' (OAuth).")
    if not raw_key:
        raise ValueError("Missing 'private_key' (Service Account Private Key) or 'refresh_token'.")

    # Normalize private key (replace literal \n with real newlines, format PEM headers)
    normalized_key = raw_key.replace("\\n", "\n")
    if "-----BEGIN PRIVATE KEY-----" not in normalized_key:
        normalized_key = f"-----BEGIN PRIVATE KEY-----\n{normalized_key}\n-----END PRIVATE KEY-----"

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

    try:
        priv_key = load_pem_private_key(normalized_key.encode("utf-8"), password=None)
    except Exception as e:
        raise ValueError(f"Invalid RSA Private Key format: {str(e)}")

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
            raise RuntimeError(f"Google Service Account authorization failed ({res.status_code}): {res.text}")
        data = res.json()
        return data["access_token"]
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
                f"https://www.googleapis.com/drive/v3/files/{clean_id}?supportsAllDrives=true&fields=id,name,mimeType,parents",
                headers=headers,
            )
            if f_res.status_code == 200:
                f_data = f_res.json()
                q = f"'{clean_id}' in parents and trashed = false"
                c_res = await client.get(
                    f"https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&includeItemsFromAllDrives=true&q={q}&fields=files(id,name,mimeType)&pageSize=100",
                    headers=headers,
                )
                child_count = len(c_res.json().get("files", [])) if c_res.status_code == 200 else 0
                folder_result = {
                    "id": clean_id,
                    "name": f_data.get("name"),
                    "item_count": child_count,
                    "accessible": True,
                }
            elif f_res.status_code == 404:
                folder_result = {
                    "id": clean_id,
                    "accessible": False,
                    "error": f"Folder not found or not shared. Please open Google Drive -> Share this folder with '{sa_email}'.",
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
        # Check root folder access
        root_res = await client.get(
            f"https://www.googleapis.com/drive/v3/files/{clean_id}?supportsAllDrives=true&fields=id,name,mimeType",
            headers=headers,
        )
        if root_res.status_code == 404:
            sa_email = sa_info.get("client_email", "your Service Account email")
            raise FileNotFoundError(
                f"Google Drive folder '{clean_id}' was not found. Please open Google Drive -> Share folder -> add '{sa_email}' as Viewer or Editor."
            )
        elif root_res.status_code != 200:
            raise RuntimeError(f"Google Drive API returned HTTP {root_res.status_code}: {root_res.text}")

        root_name = root_res.json().get("name", "Product")

        # 1. Query subfolders inside root folder
        q = f"'{clean_id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
        res = await client.get(
            f"https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&includeItemsFromAllDrives=true&q={q}&fields=files(id,name)&pageSize=100",
            headers=headers,
        )
        folders = res.json().get("files", []) if res.status_code == 200 else []

        results = []
        # For each subfolder, list its videos
        for folder in folders:
            fid = folder["id"]
            fname = folder["name"]
            clip_q = f"'{fid}' in parents and trashed = false and (mimeType contains 'video/' or name contains '.mp4' or name contains '.mov' or name contains '.mkv' or name contains '.webm')"
            c_res = await client.get(
                f"https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&includeItemsFromAllDrives=true&q={clip_q}&fields=files(id,name,size,modifiedTime)&pageSize=100",
                headers=headers,
            )
            clips = c_res.json().get("files", []) if c_res.status_code == 200 else []
            if clips:
                results.append({
                    "folder_id": fid,
                    "folder_name": fname,
                    "clips": clips,
                })

        # 2. ALSO query direct video files in the root folder itself!
        direct_clip_q = f"'{clean_id}' in parents and trashed = false and (mimeType contains 'video/' or name contains '.mp4' or name contains '.mov' or name contains '.mkv' or name contains '.webm')"
        direct_res = await client.get(
            f"https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&includeItemsFromAllDrives=true&q={direct_clip_q}&fields=files(id,name,size,modifiedTime)&pageSize=100",
            headers=headers,
        )
        direct_clips = direct_res.json().get("files", []) if direct_res.status_code == 200 else []
        if direct_clips:
            results.append({
                "folder_id": clean_id,
                "folder_name": root_name,
                "clips": direct_clips,
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
