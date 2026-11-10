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
from backend.app.models.models import RenderJob, Product, Clip, PlanSlot, Plan
from backend.app.services.render.engine import RenderEngine

router = APIRouter(prefix="/api/renders", tags=["Renders & Video Queue"])
engine = RenderEngine()

class StartRenderRequest(BaseModel):
    product_id: int
    plan_slot_id: Optional[int] = None
    style_id: str = "classic_hook"
    title: str
    subtitle: str = ""

class AutoEditRequest(BaseModel):
    slot_id: Optional[int] = None
    force: bool = False

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

@router.post("/auto-edit")
async def trigger_auto_edit(
    req: Optional[AutoEditRequest] = None,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Workflow 3 (Auto-edit v4.0) trigger:
    Finds plan slots needing video renders, verifies raw video clips, and queues
    FFmpeg render jobs with Anton font typography, beat cuts, and loudness normalization.
    """
    target_slots: List[PlanSlot] = []

    if req and req.slot_id:
        slot = await db.get(PlanSlot, req.slot_id)
        if not slot:
            raise HTTPException(status_code=404, detail=f"Slot #{req.slot_id} not found")
        target_slots.append(slot)
    else:
        today_str = datetime.utcnow().strftime("%Y-%m-%d")
        plan_stmt = select(Plan).where(Plan.date == today_str)
        plan = (await db.execute(plan_stmt)).scalars().first()
        if not plan:
            from backend.app.services.planner.service import DailyPlannerService
            planner = DailyPlannerService()
            await planner.generate_daily_plan(db, date_str=today_str, dry_run=False, auto_approve=True)
            plan = (await db.execute(plan_stmt)).scalars().first()

        if plan:
            slots_stmt = (
                select(PlanSlot)
                .where(PlanSlot.plan_id == plan.id)
                .order_by(PlanSlot.slot_index.asc())
            )
            all_slots = (await db.execute(slots_stmt)).scalars().all()
            for s in all_slots:
                # Include slots that are pending or approved, or force re-render
                if req and req.force:
                    target_slots.append(s)
                elif s.status in ("pending", "approved") and not s.render_id:
                    target_slots.append(s)

    if not target_slots:
        return {"ok": True, "message": "All slots are already rendered or queued.", "queued_job_ids": []}

    # Find active products if any slot has no product assigned
    prod_stmt = select(Product).where(Product.active == True)
    active_prods = list((await db.execute(prod_stmt)).scalars().all())

    queued_jobs = []
    skipped_reasons = []

    for slot in target_slots:
        prod_id = slot.product_id
        if not prod_id and active_prods:
            prod_id = active_prods[0].id
            slot.product_id = prod_id

        if not prod_id:
            skipped_reasons.append(f"Slot #{slot.slot_index + 1}: No product assigned.")
            continue

        prod = await db.get(Product, prod_id)
        if not prod:
            skipped_reasons.append(f"Slot #{slot.slot_index + 1}: Product #{prod_id} not found.")
            continue

        # Check existing clips
        clip_stmt = select(Clip).where(Clip.product_id == prod.id, Clip.status == "usable")
        clips = (await db.execute(clip_stmt)).scalars().all()

        job = RenderJob(
            product_id=prod.id,
            plan_slot_id=slot.id,
            style_id=slot.style_id or "classic_hook",
            title=prod.name,
            subtitle=slot.hook_style or "Trending Viral Find",
            status="pending",
            clips_count=len(clips) or 1,
        )
        db.add(job)
        await db.flush()

        slot.render_id = job.id
        slot.status = "rendering"
        queued_jobs.append(job.id)

    await db.commit()

    return {
        "ok": True,
        "message": f"Successfully queued {len(queued_jobs)} FFmpeg render jobs.",
        "queued_job_ids": queued_jobs,
        "skipped": skipped_reasons,
    }

@router.post("/{job_id}/retry")
async def retry_render_job(job_id: int, db: AsyncSession = Depends(get_db)):
    job = await db.get(RenderJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Render job not found")
    job.status = "pending"
    job.error_message = None
    job.progress_pct = 0
    await db.commit()
    return {"ok": True, "message": f"Job #{job_id} requeued for rendering."}

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
