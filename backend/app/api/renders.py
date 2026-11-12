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

class RemixRequest(BaseModel):
    job_id: Optional[int] = None
    post_id: Optional[int] = None
    product_id: Optional[int] = None
    style_id: Optional[str] = None
    music_track: Optional[str] = None
    title: Optional[str] = None
    subtitle: Optional[str] = None
    clip_ids: Optional[List[int]] = None

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
        clean_req = requested_style.strip().lower()
        if clean_req in ("random", "diverse"):
            return random.choice(VALID_BUILTIN_STYLES)
        if clean_req.startswith("tpl_") or clean_req.startswith("template:") or clean_req.startswith("custom_"):
            return clean_req.replace("template:", "")
        for s in VALID_BUILTIN_STYLES:
            if s == clean_req or s in clean_req:
                return s
        return clean_req

    # Check global default setting in DB
    setting_stmt = select(Setting).where(Setting.key == "DEFAULT_RENDER_STYLE")
    setting_rec = (await db.execute(setting_stmt)).scalar_one_or_none()
    default_setting = setting_rec.value.strip() if setting_rec and setting_rec.value else "classic_hook"

    # 2. Slot-level custom style (only if explicitly set to a non-default style)
    if slot_style and slot_style not in ("default", "random", "style_1_classic_hook", ""):
        clean_slot = slot_style.strip().lower()
        if clean_slot.startswith("tpl_") or clean_slot.startswith("template:") or clean_slot.startswith("custom_"):
            return clean_slot.replace("template:", "")
        for s in VALID_BUILTIN_STYLES:
            if s == clean_slot:
                return s
        return clean_slot

    # 3. Global setting in DB
    if default_setting in ("random", "diverse"):
        return VALID_BUILTIN_STYLES[slot_index % len(VALID_BUILTIN_STYLES)]

    return default_setting.replace("template:", "")

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

@router.post("/remix")
async def remix_render_endpoint(
    req: RemixRequest,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Rerenders / remixes a video live with customized style/template, music track, or hooks.
    Updates the RenderJob and linked Post records with the new output video file.
    """
    from backend.app.models.models import Post
    from backend.app.services.render.templates import get_template_by_id

    job = None
    post = None

    if req.job_id:
        job = await db.get(RenderJob, req.job_id)
        if job:
            post_stmt = select(Post).where(Post.render_id == job.id)
            post = (await db.execute(post_stmt)).scalar_one_or_none()

    if not job and req.post_id:
        post = await db.get(Post, req.post_id)
        if post and post.render_id:
            job = await db.get(RenderJob, post.render_id)

    prod_id = req.product_id or (job.product_id if job else (post.product_id if post else None))
    if not prod_id:
        raise HTTPException(status_code=400, detail="Cannot remix without a valid product ID")

    prod = await db.get(Product, prod_id)
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")

    # 1. Resolve clips
    clip_paths = []
    if req.clip_ids:
        for cid in req.clip_ids:
            c = await db.get(Clip, cid)
            if c:
                for base in [Path("data"), Path("/app/data")]:
                    target = base / c.file_path
                    if target.exists():
                        clip_paths.append(target)
                        break

    if not clip_paths:
        clip_stmt = select(Clip).where(Clip.product_id == prod.id, Clip.status == "usable")
        clips = (await db.execute(clip_stmt)).scalars().all()
        for c in clips:
            for base in [Path("data"), Path("/app/data")]:
                target = base / c.file_path
                if target.exists():
                    clip_paths.append(target)
                    break

    if not clip_paths:
        raise HTTPException(status_code=400, detail="No usable video clips found for this product")

    if len(clip_paths) == 1:
        clip_paths = [clip_paths[0], clip_paths[0]]

    # 2. Resolve style & template
    chosen_style = req.style_id or (job.style_id if job else (post.style_id if post else "punchy_zoom"))
    chosen_style = chosen_style.replace("template:", "").strip()

    # 3. Resolve music
    music_path = None
    all_music = []
    for mdir in [Path("data/music"), Path("/app/data/music"), Path("legacy_private/video-editor/music")]:
        if mdir.exists():
            all_music.extend(list(mdir.glob("*.mp3")))

    # Check if style is a template with fixed audio
    tpl = get_template_by_id(chosen_style)
    if tpl and tpl.get("fixed_music_track"):
        fixed_name = tpl["fixed_music_track"]
        for m in all_music:
            if m.name == fixed_name or m.stem == fixed_name:
                music_path = m
                break

    if not music_path and req.music_track:
        for m in all_music:
            if m.name == req.music_track or m.stem == req.music_track:
                music_path = m
                break

    if not music_path and all_music:
        music_path = all_music[0]

    # 4. Resolve Title & Subtitle
    title = req.title or (job.title if job else prod.name)
    subtitle = req.subtitle if req.subtitle is not None else (job.subtitle if job else "Special Creator Deal")

    # 5. Output path
    jid = job.id if job else os.urandom(3).hex()
    out_filename = f"remix_{prod.id}_{jid}_{os.urandom(2).hex()}.mp4"
    out_dir = Path("data/renders") / datetime.utcnow().strftime("%Y-%m-%d")
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / out_filename

    # 6. Render
    try:
        render_info = engine.render_video(
            clip_paths=clip_paths[:6],
            music_path=music_path,
            title=title,
            subtitle=subtitle,
            style_id=chosen_style,
            out_path=out_path,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Render remix failed: {str(e)}")

    dur = render_info.get("duration", 5.0)

    # 7. Update Job
    if not job:
        job = RenderJob(
            product_id=prod.id,
            style_id=chosen_style,
            title=title,
            subtitle=subtitle,
            status="completed",
            progress_pct=100,
            duration=dur,
            output_path=str(out_path),
            clips_count=len(clip_paths),
            completed_at=datetime.utcnow(),
        )
        db.add(job)
        await db.flush()
    else:
        job.style_id = chosen_style
        job.title = title
        job.subtitle = subtitle
        job.output_path = str(out_path)
        job.duration = dur
        job.status = "completed"
        job.progress_pct = 100
        job.completed_at = datetime.utcnow()
        job.error_message = None

    # 8. Update Post
    if post:
        post.media_url = str(out_path)
        post.style_id = chosen_style
        post.caption = f"{title} - {subtitle}"
        post.hook_style = subtitle
        post.render_id = job.id
    elif req.post_id:
        new_post = Post(
            product_id=prod.id,
            render_id=job.id,
            caption=f"{title} - {subtitle}",
            hook_style=subtitle,
            style_id=chosen_style,
            media_url=str(out_path),
            mode="queue",
            status="ready_to_post",
        )
        db.add(new_post)
        await db.flush()
        post = new_post

    await db.commit()

    return {
        "ok": True,
        "message": "Video successfully remixed and updated",
        "job_id": job.id,
        "post_id": post.id if post else None,
        "preview_url": f"/api/renders/{job.id}/video?v={int(datetime.utcnow().timestamp())}",
        "duration": dur,
        "title": title,
        "subtitle": subtitle,
        "style_id": chosen_style,
        "music_track": music_path.name if music_path else "",
    }
