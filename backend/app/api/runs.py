import json
import asyncio
from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from backend.app.core.database import get_db, AsyncSessionLocal
from backend.app.models.models import Run, RunLog, User
from backend.app.services.job_queue import job_queue
from backend.app.api.auth import get_current_user

router = APIRouter(prefix="/runs", tags=["runs"])

class RunLogItem(BaseModel):
    id: int
    timestamp: datetime
    level: str
    message: str

class RunResponse(BaseModel):
    id: str
    job_name: str
    trigger_type: str
    status: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    logs: Optional[list[RunLogItem]] = None

@router.get("", response_model=list[RunResponse])
async def list_runs(
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user)
):
    stmt = select(Run).order_by(desc(Run.started_at)).limit(limit)
    runs = (await db.execute(stmt)).scalars().all()
    return runs

@router.get("/{run_id}", response_model=RunResponse)
async def get_run(
    run_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user)
):
    stmt = select(Run).where(Run.id == run_id)
    run = (await db.execute(stmt)).scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    
    logs_stmt = select(RunLog).where(RunLog.run_id == run_id).order_by(RunLog.id)
    logs = (await db.execute(logs_stmt)).scalars().all()
    
    return RunResponse(
        id=run.id,
        job_name=run.job_name,
        trigger_type=run.trigger_type,
        status=run.status,
        started_at=run.started_at,
        completed_at=run.completed_at,
        error_message=run.error_message,
        logs=[RunLogItem(id=l.id, timestamp=l.timestamp, level=l.level, message=l.message) for l in logs]
    )

@router.get("/{run_id}/logs/stream")
async def stream_run_logs(
    run_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Server-Sent Events (SSE) live logs stream."""
    stmt = select(Run).where(Run.id == run_id)
    run = (await db.execute(stmt)).scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")

    async def event_generator():
        # First send all historical logs
        async with AsyncSessionLocal() as session:
            logs_stmt = select(RunLog).where(RunLog.run_id == run_id).order_by(RunLog.id)
            historical_logs = (await session.execute(logs_stmt)).scalars().all()
            for l in historical_logs:
                data = json.dumps({"timestamp": l.timestamp.isoformat(), "level": l.level, "message": l.message})
                yield f"data: {data}\n\n"

        if run.status in ("completed", "failed"):
            yield f"data: {json.dumps({'_type': 'DONE', 'status': run.status})}\n\n"
            return

        # Listen for real-time logs
        q = job_queue.subscribe_logs(run_id)
        try:
            while True:
                item = await asyncio.wait_for(q.get(), timeout=30.0)
                yield f"data: {json.dumps(item)}\n\n"
                if item.get("_type") == "DONE":
                    break
        except asyncio.TimeoutError:
            yield f": keep-alive\n\n"
        finally:
            job_queue.unsubscribe_logs(run_id, q)

    return StreamingResponse(event_generator(), media_type="text/event-stream")
