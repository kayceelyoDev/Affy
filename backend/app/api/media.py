import os
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse
from backend.app.services.publisher.media_host import get_tunnel_token_file

router = APIRouter(prefix="/media", tags=["media"])

@router.get("/temp/{token}")
async def serve_temp_media(token: str):
    """
    Public endpoint for TunnelMediaHostProvider to allow Buffer to fetch
    the video via an expiring, tokenized URL without open access to storage.
    """
    file_path = get_tunnel_token_file(token)
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Media token has expired or is invalid."
        )
    return FileResponse(file_path, media_type="video/mp4")
