import os
import shutil
from pathlib import Path
from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from fastapi.responses import FileResponse, StreamingResponse
from backend.app.services.storage.local import LocalStorageProvider
from backend.app.services.storage.sync import storage_sync_service
from backend.app.services.storage.cache import lru_cache
from backend.app.api.auth import get_current_user
from backend.app.models.models import User
from backend.app.core.config import settings

router = APIRouter(prefix="/storage", tags=["storage"])
local_storage = LocalStorageProvider()

class StorageMetersResponse(BaseModel):
    local_total_bytes: int
    local_free_bytes: int
    local_used_bytes: int
    cache_used_bytes: int
    cache_max_bytes: int
    drive_quota_bytes: Optional[int] = None
    drive_used_bytes: Optional[int] = None
    last_sync: Optional[str] = None

@router.get("/meters", response_model=StorageMetersResponse)
async def get_storage_meters(_: User = Depends(get_current_user)):
    usage = shutil.disk_usage(settings.DATA_DIR)
    cache_used = lru_cache.get_current_size()
    last_sync_iso = storage_sync_service.last_sync_time.isoformat() if storage_sync_service.last_sync_time else None

    return StorageMetersResponse(
        local_total_bytes=usage.total,
        local_free_bytes=usage.free,
        local_used_bytes=usage.used,
        cache_used_bytes=cache_used,
        cache_max_bytes=lru_cache.max_bytes,
        drive_quota_bytes=15 * 1024 * 1024 * 1024, # 15 GB Google Drive standard quota
        drive_used_bytes=cache_used,
        last_sync=last_sync_iso,
    )

@router.get("/files")
async def list_storage_files(
    path: str = Query(default="", description="Subdirectory path within storage"),
    _: User = Depends(get_current_user)
):
    try:
        files = await local_storage.list(path)
        return files
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/sync")
async def trigger_storage_sync(_: User = Depends(get_current_user)):
    result = await storage_sync_service.sync_now()
    return result

@router.get("/preview/{file_path:path}")
async def preview_video_file(file_path: str, request: Request, _: User = Depends(get_current_user)):
    """Stream media file with HTTP Range support for fast in-browser preview."""
    try:
        full_path = local_storage._resolve_safe(file_path)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid path")

    if not full_path.exists() or not full_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    file_size = full_path.stat().st_size
    range_header = request.headers.get("range")

    if not range_header:
        return FileResponse(full_path, media_type="video/mp4")

    # Handle Range header
    byte_range = range_header.replace("bytes=", "").split("-")
    start = int(byte_range[0])
    end = int(byte_range[1]) if byte_range[1] else file_size - 1
    chunk_length = (end - start) + 1

    def iter_chunk():
        with open(full_path, "rb") as f:
            f.seek(start)
            remaining = chunk_length
            while remaining > 0:
                chunk = f.read(min(remaining, 64 * 1024))
                if not chunk:
                    break
                remaining -= len(chunk)
                yield chunk

    headers = {
        "Content-Range": f"bytes {start}-{end}/{file_size}",
        "Accept-Ranges": "bytes",
        "Content-Length": str(chunk_length),
    }
    return StreamingResponse(iter_chunk(), status_code=206, headers=headers, media_type="video/mp4")
