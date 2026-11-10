import uuid
import asyncio
from datetime import datetime
from typing import Optional, Callable, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.app.core.database import AsyncSessionLocal
from backend.app.models.models import Run, RunLog
from backend.app.core.logging import logger

# In-memory message queues for active SSE listeners per run_id
_run_subscribers: dict[str, list[asyncio.Queue]] = {}

class JobQueue:
    @staticmethod
    async def create_run(
        job_name: str,
        trigger_type: str = "manual",
        metadata_json: Optional[str] = None
    ) -> str:
        run_id = str(uuid.uuid4())
        async with AsyncSessionLocal() as session:
            run = Run(
                id=run_id,
                job_name=job_name,
                trigger_type=trigger_type,
                status="pending",
                started_at=datetime.utcnow(),
                metadata_json=metadata_json,
            )
            session.add(run)
            await session.commit()
        return run_id

    @staticmethod
    async def log(run_id: str, message: str, level: str = "INFO") -> None:
        async with AsyncSessionLocal() as session:
            log_entry = RunLog(
                run_id=run_id,
                timestamp=datetime.utcnow(),
                level=level,
                message=message,
            )
            session.add(log_entry)
            await session.commit()

        # Push to active SSE streams
        if run_id in _run_subscribers:
            event_payload = {
                "timestamp": datetime.utcnow().isoformat(),
                "level": level,
                "message": message,
            }
            for q in _run_subscribers[run_id]:
                await q.put(event_payload)

    @staticmethod
    async def complete_run(run_id: str, status: str = "completed", error_message: Optional[str] = None) -> None:
        async with AsyncSessionLocal() as session:
            stmt = select(Run).where(Run.id == run_id)
            result = await session.execute(stmt)
            run = result.scalar_one_or_none()
            if run:
                run.status = status
                run.completed_at = datetime.utcnow()
                run.error_message = error_message
                await session.commit()

        # Signal completion to subscribers
        if run_id in _run_subscribers:
            for q in _run_subscribers[run_id]:
                await q.put({"_type": "DONE", "status": status})

    @staticmethod
    def subscribe_logs(run_id: str) -> asyncio.Queue:
        q = asyncio.Queue()
        if run_id not in _run_subscribers:
            _run_subscribers[run_id] = []
        _run_subscribers[run_id].append(q)
        return q

    @staticmethod
    def unsubscribe_logs(run_id: str, q: asyncio.Queue) -> None:
        if run_id in _run_subscribers and q in _run_subscribers[run_id]:
            _run_subscribers[run_id].remove(q)
            if not _run_subscribers[run_id]:
                del _run_subscribers[run_id]

job_queue = JobQueue()
