from typing import Optional, List, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from pydantic import BaseModel

from backend.app.core.database import get_db
from backend.app.models.models import Plan, PlanSlot, Product
from backend.app.services.planner.service import DailyPlannerService

router = APIRouter(prefix="/api/planner", tags=["Planner (Daily Brain)"])
planner_service = DailyPlannerService()

class GeneratePlanRequest(BaseModel):
    date: Optional[str] = None
    dry_run: bool = False
    auto_approve: bool = True
    force_regenerate: bool = False

class UpdateSlotRequest(BaseModel):
    product_id: Optional[int] = None
    style_id: Optional[str] = None
    hook_style: Optional[str] = None
    hook_text: Optional[str] = None
    scheduled_time: Optional[str] = None
    status: Optional[str] = None
    locked: Optional[bool] = None

@router.get("/today")
async def get_today_plan(
    date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    target_date = date or datetime.utcnow().strftime("%Y-%m-%d")

    plan_stmt = select(Plan).where(Plan.date == target_date)
    plan = (await db.execute(plan_stmt)).scalars().first()

    if not plan:
        # Generate plan on the fly if not existing
        await planner_service.generate_daily_plan(db, date_str=target_date, dry_run=False, auto_approve=True)
        plan = (await db.execute(plan_stmt)).scalars().first()

    slots_stmt = (
        select(PlanSlot, Product.name.label("product_name"))
        .outerjoin(Product, PlanSlot.product_id == Product.id)
        .where(PlanSlot.plan_id == plan.id)
        .order_by(PlanSlot.slot_index.asc())
    )
    rows = (await db.execute(slots_stmt)).all()

    slots_data = []
    for s, p_name in rows:
        slots_data.append({
            "id": s.id,
            "slot_index": s.slot_index,
            "scheduled_time": s.scheduled_time,
            "product_id": s.product_id,
            "product_name": p_name or "Unknown Product",
            "style_id": s.style_id,
            "hook_style": s.hook_style,
            "hook_text": s.hook_text,
            "reason": s.reason,
            "locked": s.locked,
            "source": s.source,
            "status": s.status,
            "render_id": s.render_id,
            "post_id": s.post_id,
        })

    return {
        "plan_id": plan.id,
        "date": plan.date,
        "status": plan.status,
        "dry_run": plan.dry_run,
        "slots_count": len(slots_data),
        "slots": slots_data,
    }

@router.post("/generate")
async def generate_plan(
    req: GeneratePlanRequest,
    db: AsyncSession = Depends(get_db),
):
    """Trigger daily plan generation with deterministic scoring, clip check, and exploration share."""
    res = await planner_service.generate_daily_plan(
        db,
        date_str=req.date,
        dry_run=req.dry_run,
        auto_approve=req.auto_approve,
        force_regenerate=req.force_regenerate,
    )
    return res

@router.put("/slots/{slot_id}")
async def update_slot(
    slot_id: int,
    req: UpdateSlotRequest,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(PlanSlot).where(PlanSlot.id == slot_id)
    slot = (await db.execute(stmt)).scalars().first()
    if not slot:
        raise HTTPException(status_code=404, detail="Plan slot not found")

    if req.product_id is not None:
        slot.product_id = req.product_id
        slot.source = "user"
    if req.style_id is not None:
        slot.style_id = req.style_id
    if req.hook_style is not None:
        slot.hook_style = req.hook_style
    if req.hook_text is not None:
        slot.hook_text = req.hook_text
    if req.scheduled_time is not None:
        slot.scheduled_time = req.scheduled_time
    if req.status is not None:
        slot.status = req.status
    if req.locked is not None:
        slot.locked = req.locked

    await db.commit()
    return {"status": "updated", "slot_id": slot_id, "locked": slot.locked}

@router.post("/slots/{slot_id}/lock")
async def toggle_slot_lock(
    slot_id: int,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(PlanSlot).where(PlanSlot.id == slot_id)
    slot = (await db.execute(stmt)).scalars().first()
    if not slot:
        raise HTTPException(status_code=404, detail="Plan slot not found")

    slot.locked = not slot.locked
    await db.commit()
    return {"status": "lock_toggled", "slot_id": slot_id, "locked": slot.locked}

@router.post("/approve")
async def approve_all_today(
    date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    target_date = date or datetime.utcnow().strftime("%Y-%m-%d")
    plan_stmt = select(Plan).where(Plan.date == target_date)
    plan = (await db.execute(plan_stmt)).scalars().first()
    if not plan:
        raise HTTPException(status_code=404, detail="No plan found for today")

    slots_stmt = select(PlanSlot).where(PlanSlot.plan_id == plan.id)
    slots = (await db.execute(slots_stmt)).scalars().all()
    for s in slots:
        if s.status == "pending":
            s.status = "approved"

    plan.status = "approved"
    await db.commit()
    return {"status": "approved", "approved_slots": len(slots)}
