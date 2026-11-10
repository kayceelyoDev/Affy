from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.app.core.database import get_db
from backend.app.models.models import Schedule, User
from backend.app.services.scheduler import app_scheduler
from backend.app.api.auth import get_current_user

router = APIRouter(prefix="/schedules", tags=["schedules"])

class ScheduleResponse(BaseModel):
    id: str
    name: str
    cron_expression: str
    enabled: bool
    timezone: str
    next_run_at: Optional[datetime] = None
    last_run_at: Optional[datetime] = None
    last_status: Optional[str] = None

class UpdateScheduleRequest(BaseModel):
    cron_expression: Optional[str] = None
    enabled: Optional[bool] = None
    timezone: Optional[str] = None

@router.get("", response_model=list[ScheduleResponse])
async def list_schedules(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user)
):
    stmt = select(Schedule)
    records = (await db.execute(stmt)).scalars().all()
    return records

@router.put("/{schedule_id}")
async def update_schedule(
    schedule_id: str,
    req: UpdateScheduleRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user)
):
    stmt = select(Schedule).where(Schedule.id == schedule_id)
    sched = (await db.execute(stmt)).scalar_one_or_none()
    if not sched:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found")

    if req.cron_expression is not None:
        sched.cron_expression = req.cron_expression
    if req.enabled is not None:
        sched.enabled = req.enabled
    if req.timezone is not None:
        sched.timezone = req.timezone

    await db.commit()
    # Update scheduler registry
    if sched.enabled:
        app_scheduler._add_to_apscheduler(sched)
    else:
        try:
            app_scheduler.scheduler.remove_job(sched.id)
        except Exception:
            pass

    return sched

@router.post("/{schedule_id}/run")
async def run_schedule_now(
    schedule_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user)
):
    stmt = select(Schedule).where(Schedule.id == schedule_id)
    sched = (await db.execute(stmt)).scalar_one_or_none()
    if not sched:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found")

    # Trigger job in background
    run_id = await app_scheduler.execute_job(schedule_id, trigger_type="manual")
    return {"ok": True, "schedule_id": schedule_id, "run_id": run_id}
