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
    product_id: Optional[int] = None
    force: bool = False
    style_id: Optional[str] = None  # "classic_hook", "clean_showcase", "promo_pop", "punchy_zoom", "smooth_flow", "random", "default"

VALID_BUILTIN_STYLES = [
    "classic_hook",
    "clean_showcase",
    "promo_pop",
    "punchy_zoom",
    "smooth_flow",
]

async def resolve_render_style(
    requested_style: Optional[str],
    slot_style: Optional[str],
    db: AsyncSession,
    slot_index: int = 0,
) -> str:
    """
    Resolves the exact style ID to render:
    1. If user explicitly provided style_id (e.g. 'promo_pop' or 'random') in request, honor it.
    2. Else if global DEFAULT_RENDER_STYLE setting in DB is configured, use it (or rotate if 'random').
    3. Else if slot has a valid custom style assigned, honor it.
    """
    import random
    from backend.app.models.models import Setting

    # 1. Explicit request style override
    if requested_style and requested_style not in ("default", ""):
        if requested_style in ("random", "diverse"):
            return random.choice(VALID_BUILTIN_STYLES)
        for s in VALID_BUILTIN_STYLES:
            if s in requested_style.lower():
                return s
        return requested_style

    # Check global default setting in DB
    setting_stmt = select(Setting).where(Setting.key == "DEFAULT_RENDER_STYLE")
    setting_rec = (await db.execute(setting_stmt)).scalar_one_or_none()
    default_setting = setting_rec.value.strip() if setting_rec and setting_rec.value else "classic_hook"

    # 2. Slot-level custom style (only if explicitly set to a non-default style)
    if slot_style and slot_style not in ("default", "random", "style_1_classic_hook", ""):
        if slot_style != "classic_hook" or default_setting == "classic_hook":
            for s in VALID_BUILTIN_STYLES:
                if s in slot_style.lower():
                    return s

    # 3. Global setting in DB
    if default_setting in ("random", "diverse"):
        return VALID_BUILTIN_STYLES[slot_index % len(VALID_BUILTIN_STYLES)]
    elif default_setting in VALID_BUILTIN_STYLES:
        return default_setting

    return "classic_hook"

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
    # Single Product Direct Render (e.g. from Clip Library)
    if req and req.product_id and not req.slot_id:
        prod = await db.get(Product, req.product_id)
        if not prod:
            raise HTTPException(status_code=404, detail=f"Product #{req.product_id} not found")
        clip_stmt = select(Clip).where(Clip.product_id == prod.id, Clip.status == "usable")
        clips = (await db.execute(clip_stmt)).scalars().all()
        if not clips:
            raise HTTPException(status_code=400, detail=f"Product '{prod.name}' has no usable video clips in catalog.")

        chosen_style = await resolve_render_style(req.style_id, None, db, slot_index=0)
        job = RenderJob(
            product_id=prod.id,
            style_id=chosen_style,
            title=prod.name,
            subtitle="Trending TikTok Deal",
            status="pending",
            clips_count=len(clips),
        )
        db.add(job)
        await db.commit()
        await db.refresh(job)
        return {
            "ok": True,
            "message": f"Queued FFmpeg render job #{job.id} for product '{prod.name}' with style '{chosen_style}'.",
            "queued_job_ids": [job.id],
            "job_id": job.id,
            "style_id": chosen_style,
        }

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

    if not target_slots and plan:
        # If all slots were rendered earlier, allow re-rendering unposted slots with requested/default style
        slots_stmt = select(PlanSlot).where(PlanSlot.plan_id == plan.id)
        all_slots = (await db.execute(slots_stmt)).scalars().all()
        for s in all_slots:
            if s.status not in ("posted", "published"):
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

        chosen_style = await resolve_render_style(
            requested_style=req.style_id if req else None,
            slot_style=slot.style_id,
            db=db,
            slot_index=slot.slot_index,
        )
        slot.style_id = chosen_style

        job = RenderJob(
            product_id=prod.id,
            plan_slot_id=slot.id,
            style_id=chosen_style,
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
