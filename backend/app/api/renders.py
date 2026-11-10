import os
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from backend.app.core.database import get_db
from backend.app.models.models import RenderJob, Product, Clip, PlanSlot
from backend.app.services.render.engine import RenderEngine

router = APIRouter(prefix="/api/renders", tags=["Renders & Video Queue"])
engine = RenderEngine()

class StartRenderRequest(BaseModel):
    product_id: int
    plan_slot_id: Optional[int] = None
    style_id: str = "classic_hook"
    title: str
    subtitle: str = ""

@router.get("")
async def list_renders(db: AsyncSession = Depends(get_db)) -> List[Dict[str, Any]]:
    stmt = select(RenderJob).order_by(RenderJob.id.desc()).limit(50)
    jobs = (await db.execute(stmt)).scalars().all()
    return [
        {
            "id": j.id,
            "product_id": j.product_id,
            "plan_slot_id": j.plan_slot_id,
            "style_id": j.style_id,
            "title": j.title,
            "subtitle": j.subtitle,
            "status": j.status,
            "progress_pct": j.progress_pct,
            "duration": j.duration,
            "output_path": j.output_path,
            "error_message": j.error_message,
            "created_at": j.created_at.isoformat(),
        }
        for j in jobs
    ]

@router.post("/start")
async def start_render(
    req: StartRenderRequest,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    # Check product and clips
    prod = await db.get(Product, req.product_id)
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")

    clip_stmt = select(Clip).where(Clip.product_id == prod.id, Clip.status == "usable")
    clips = (await db.execute(clip_stmt)).scalars().all()
    if len(clips) < 2:
        raise HTTPException(status_code=400, detail="Product needs at least 2 usable clips to render")

    # Create render job
    job = RenderJob(
        product_id=prod.id,
        plan_slot_id=req.plan_slot_id,
        style_id=req.style_id,
        title=req.title,
        subtitle=req.subtitle,
        status="pending",
        clips_count=len(clips),
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    # If linked to a plan slot, update slot
    if req.plan_slot_id:
        slot = await db.get(PlanSlot, req.plan_slot_id)
        if slot:
            slot.render_id = job.id
            slot.status = "rendering"
            await db.commit()

    return {"message": "Render job queued", "job_id": job.id}

@router.get("/{job_id}")
async def get_render_job(job_id: int, db: AsyncSession = Depends(get_db)):
    job = await db.get(RenderJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Render job not found")
    return {
        "id": job.id,
        "product_id": job.product_id,
        "style_id": job.style_id,
        "status": job.status,
        "progress_pct": job.progress_pct,
        "duration": job.duration,
        "error_message": job.error_message,
        "log_tail": job.log_tail,
    }

@router.get("/{job_id}/video")
async def stream_rendered_video(job_id: int, db: AsyncSession = Depends(get_db)):
    job = await db.get(RenderJob, job_id)
    if not job or not job.output_path or not Path(job.output_path).exists():
        raise HTTPException(status_code=404, detail="Rendered video not found")
    return FileResponse(job.output_path, media_type="video/mp4")
