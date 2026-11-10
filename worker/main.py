import asyncio
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

import structlog
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from backend.app.core.config import settings
from backend.app.core.database import AsyncSessionLocal
from backend.app.models.models import RenderJob, PlanSlot, Product, Clip, Track
from backend.app.services.render.engine import RenderEngine

logger = structlog.get_logger("worker")

class RenderWorker:
    def __init__(self):
        self.engine = RenderEngine()
        self.session_factory = AsyncSessionLocal
        self.running = True

    async def get_next_job(self, db: AsyncSession) -> Optional[RenderJob]:
        stmt = (
            select(RenderJob)
            .where(RenderJob.status == "pending")
            .order_by(RenderJob.created_at.asc())
            .limit(1)
        )
        return (await db.execute(stmt)).scalars().first()

    async def process_job(self, db: AsyncSession, job: RenderJob):
        logger.info("processing_render_job", job_id=job.id, product_id=job.product_id, style=job.style_id)
        
        # 1. Update status to rendering
        job.status = "rendering"
        job.progress_pct = 15
        await db.commit()

        # 2. Gather product clips
        clip_stmt = select(Clip).where(Clip.product_id == job.product_id, Clip.status == "usable")
        clips = (await db.execute(clip_stmt)).scalars().all()
        
        clip_paths = [Path(settings.DATA_DIR) / c.file_path for c in clips if (Path(settings.DATA_DIR) / c.file_path).exists()]
        if not clip_paths:
            # Fallback check relative path or directly under data/clips
            clip_paths = [Path(c.file_path) for c in clips if Path(c.file_path).exists()]

        if len(clip_paths) < 2:
            job.status = "failed"
            job.error_message = f"Product has only {len(clip_paths)} accessible usable clips (minimum 2 required)"
            await db.commit()
            return

        # 3. Gather music track
        track_stmt = select(Track).where(Track.safe_to_use == True).order_by(Track.id.desc()).limit(1)
        track = (await db.execute(track_stmt)).scalars().first()
        
        music_path = None
        if track and Path(track.storage_path).exists():
            music_path = Path(track.storage_path)
        else:
            # Check legacy music or default
            legacy_music = list(Path("legacy_private/video-editor/music").glob("*.mp3"))
            if legacy_music:
                music_path = legacy_music[0]

        if not music_path:
            job.status = "failed"
            job.error_message = "No background music track available in library"
            await db.commit()
            return

        # 4. Render output
        out_filename = f"video_{job.product_id}_{job.id}_{os.urandom(3).hex()}.mp4"
        out_dir = settings.DATA_DIR / "renders" / datetime.utcnow().strftime("%Y-%m-%d")
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / out_filename

        try:
            job.progress_pct = 40
            await db.commit()

            render_info = self.engine.render_video(
                clip_paths=clip_paths,
                music_path=music_path,
                title=job.title,
                subtitle=job.subtitle,
                style_id=job.style_id,
                out_path=out_path,
            )

            job.status = "completed"
            job.progress_pct = 100
            job.output_path = str(out_path)
            job.duration = render_info.get("duration")
            job.completed_at = datetime.utcnow()
            job.log_tail = f"Render succeeded in {render_info.get('attempts', 1)} attempts. Duration: {job.duration}s."
            
            # If linked to a plan slot, update slot
            if job.plan_slot_id:
                slot = await db.get(PlanSlot, job.plan_slot_id)
                if slot:
                    slot.status = "rendered"
                    slot.render_id = job.id

            await db.commit()
            logger.info("render_job_completed", job_id=job.id, duration=job.duration, out_path=str(out_path))

        except Exception as e:
            logger.error("render_job_failed", job_id=job.id, error=str(e))
            job.status = "failed"
            job.error_message = str(e)
            job.log_tail = f"Failed with error: {str(e)}"
            await db.commit()

    async def run_loop(self):
        logger.info("Render worker started and polling for jobs...")
        while self.running:
            try:
                async with self.session_factory() as db:
                    job = await self.get_next_job(db)
                    if job:
                        await self.process_job(db, job)
                    else:
                        await asyncio.sleep(2)
            except Exception as e:
                logger.error("worker_loop_error", error=str(e))
                await asyncio.sleep(5)

def main():
    worker = RenderWorker()
    asyncio.run(worker.run_loop())

if __name__ == "__main__":
    main()
