import os
import shutil
import tempfile
from pathlib import Path
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from backend.app.core.database import get_db
from backend.app.services.render.music import MusicService
from backend.app.models.models import Track

router = APIRouter(prefix="/api/music", tags=["Music Library"])
music_service = MusicService()

class DownloadTrackRequest(BaseModel):
    url: str
    title: Optional[str] = None
    safe_to_use: bool = False

@router.get("")
async def list_tracks(
    safe_only: bool = False,
    db: AsyncSession = Depends(get_db),
) -> List[Dict[str, Any]]:
    tracks = await music_service.list_tracks(db, safe_only=safe_only)
    return [
        {
            "id": t.id,
            "title": t.title,
            "filename": t.filename,
            "duration": t.duration,
            "bpm": t.bpm,
            "beats_count": t.beats_count,
            "tags": t.tags,
            "safe_to_use": t.safe_to_use,
            "source_url": t.source_url,
            "license_note": t.license_note,
            "created_at": t.created_at.isoformat(),
        }
        for t in tracks
    ]

@router.post("/upload")
async def upload_track(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    safe_to_use: bool = Form(True),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    track_title = title or Path(file.filename or "upload").stem
    
    with tempfile.NamedTemporaryFile(suffix=Path(file.filename or "audio.mp3").suffix, delete=False) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = Path(tmp.name)

    try:
        track = await music_service.register_audio_file(
            db=db,
            source_path=tmp_path,
            title=track_title,
            safe_to_use=safe_to_use,
            tags="manual_upload",
        )
        return {
            "message": "Track processed and added to library",
            "track": {
                "id": track.id,
                "title": track.title,
                "bpm": track.bpm,
                "duration": track.duration,
                "safe_to_use": track.safe_to_use,
            }
        }
    finally:
        if tmp_path.exists():
            tmp_path.unlink()

@router.post("/download")
async def download_track(
    req: DownloadTrackRequest,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Downloads audio from TikTok or social URL with yt-dlp."""
    try:
        track = await music_service.download_track_from_url(
            db=db,
            url=req.url,
            title=req.title,
            safe_to_use=req.safe_to_use,
        )
        return {
            "message": "Track downloaded and analyzed",
            "track": {
                "id": track.id,
                "title": track.title,
                "bpm": track.bpm,
                "duration": track.duration,
                "safe_to_use": track.safe_to_use,
            }
        }
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Download failed: {str(e)}")

@router.get("/{track_id}/audio")
async def stream_audio(track_id: int, db: AsyncSession = Depends(get_db)):
    track = await db.get(Track, track_id)
    if not track or not Path(track.storage_path).exists():
        raise HTTPException(status_code=404, detail="Audio track not found")
    return FileResponse(track.storage_path, media_type="audio/mpeg")
