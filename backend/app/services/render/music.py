import os
import json
import subprocess
import tempfile
from pathlib import Path
from typing import Dict, Any, List, Optional, Union
import structlog
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.app.core.config import settings
from backend.app.models.models import Track
from backend.app.services.render.beat import analyse_beats

logger = structlog.get_logger("music_service")

class MusicService:
    def __init__(self, music_dir: Optional[Path] = None):
        self.music_dir = music_dir or (settings.DATA_DIR / "music")
        self.music_dir.mkdir(parents=True, exist_ok=True)
        self.enable_tiktok_audio = os.environ.get("ENABLE_TIKTOK_AUDIO", "false").lower() in ("true", "1", "yes")

    def normalize_audio(self, in_path: Path, out_path: Path, target_lufs: float = -14.0):
        """Extracts audio, trims leading silence, and applies EBU R128 loudness normalization."""
        cmd = [
            "ffmpeg", "-y", "-v", "error", "-i", str(in_path),
            "-vn", "-af", f"silenceremove=start_periods=1:start_duration=0.1:start_threshold=-50dB,loudnorm=I={target_lufs}:TP=-1.5:LRA=11",
            "-c:a", "libmp3lame", "-b:a", "192k", str(out_path)
        ]
        subprocess.run(cmd, check=True)

    async def register_audio_file(
        self,
        db: AsyncSession,
        source_path: Path,
        title: str,
        source_url: Optional[str] = None,
        safe_to_use: bool = True,
        tags: Optional[str] = None,
        license_note: Optional[str] = None,
    ) -> Track:
        """Processes an audio file: normalizes loudness, analyzes beats/BPM with librosa, saves to music/ directory."""
        filename = f"{title.lower().replace(' ', '_')[:40]}_{os.urandom(4).hex()}.mp3"
        dest_path = self.music_dir / filename

        # Loudness normalize and convert to standard MP3
        self.normalize_audio(source_path, dest_path)

        # Analyze beats and BPM
        tempo, beats, duration = analyse_beats(dest_path)

        track = Track(
            title=title,
            filename=filename,
            storage_path=str(dest_path),
            duration=round(duration, 2),
            bpm=round(tempo, 1),
            beats_count=len(beats),
            beats_json=json.dumps(beats[:120]),  # Store first 120 beats
            tags=tags or "tiktok,trending",
            safe_to_use=safe_to_use,
            source_url=source_url,
            license_note=license_note or "Royalty-free or creator audio",
        )
        db.add(track)
        await db.commit()
        await db.refresh(track)
        return track

    async def download_track_from_url(
        self,
        db: AsyncSession,
        url: str,
        title: Optional[str] = None,
        safe_to_use: bool = False,  # User downloaded TikTok sounds default to not safe
    ) -> Track:
        """Downloads audio using yt-dlp if ENABLE_TIKTOK_AUDIO is true."""
        if not self.enable_tiktok_audio:
            raise PermissionError("TikTok audio downloader is disabled. Enable ENABLE_TIKTOK_AUDIO in settings or .env.")

        with tempfile.TemporaryDirectory() as td:
            temp_out = Path(td) / "audio.%(ext)s"
            cmd = [
                "yt-dlp",
                "--no-playlist",
                "-x",
                "--audio-format", "mp3",
                "-o", str(temp_out),
                url
            ]
            r = subprocess.run(cmd, capture_output=True, text=True)
            if r.returncode != 0:
                raise RuntimeError(f"yt-dlp download failed: {r.stderr[-400:]}")

            downloaded_files = list(Path(td).glob("audio.*"))
            if not downloaded_files:
                raise RuntimeError("No audio file extracted by yt-dlp")

            downloaded_file = downloaded_files[0]
            track_title = title or f"Track {url.split('/')[-1][:20]}"

            return await self.register_audio_file(
                db=db,
                source_path=downloaded_file,
                title=track_title,
                source_url=url,
                safe_to_use=safe_to_use,
                tags="tiktok_download",
                license_note="Downloaded TikTok audio (caution: potential commercial copyright)",
            )

    async def list_tracks(self, db: AsyncSession, safe_only: bool = False) -> List[Track]:
        stmt = select(Track).order_by(Track.id.desc())
        if safe_only:
            stmt = stmt.where(Track.safe_to_use == True)
        res = await db.execute(stmt)
        return list(res.scalars().all())
