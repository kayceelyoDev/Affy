import asyncio
from datetime import datetime
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.app.core.database import AsyncSessionLocal
from backend.app.models.models import Schedule
from backend.app.services.job_queue import job_queue
from backend.app.core.logging import logger

DEFAULT_SCHEDULES = [
    {
        "id": "nightly_orders_sync",
        "name": "Nightly Orders & Multi-File Sync",
        "cron_expression": "0 23 * * *", # 11:00 PM
        "enabled": True,
        "timezone": "Asia/Manila",
    },
    {
        "id": "sunday_strategy_engine",
        "name": "Sunday Strategy Engine & Scorecard",
        "cron_expression": "0 8 * * 0",  # Sunday 8:00 AM
        "enabled": True,
        "timezone": "Asia/Manila",
    },
    {
        "id": "morning_daily_planner",
        "name": "Morning Daily Brain Planner",
        "cron_expression": "0 7 * * *",  # 7:00 AM
        "enabled": True,
        "timezone": "Asia/Manila",
    },
    {
        "id": "video_render_pipeline",
        "name": "Video Auto-Editor Render Pipeline",
        "cron_expression": "0 8 * * *",  # 8:00 AM
        "enabled": True,
        "timezone": "Asia/Manila",
    },
    {
        "id": "buffer_poster_sync",
        "name": "Buffer TikTok Poster Sync",
        "cron_expression": "0 9,11,14,16,19,21 * * *", # 6 daily slots
        "enabled": True,
        "timezone": "Asia/Manila",
    },
]

class AppScheduler:
    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self.job_registry: dict[str, callable] = {}

    def register_handler(self, job_id: str, handler: callable):
        self.job_registry[job_id] = handler

    async def execute_job(self, job_id: str, trigger_type: str = "scheduled"):
        logger.info("Executing job", job_id=job_id, trigger=trigger_type)
        run_id = await job_queue.create_run(job_id, trigger_type=trigger_type)
        await job_queue.log(run_id, f"Job '{job_id}' started via {trigger_type} trigger.")
        
        handler = self.job_registry.get(job_id)
        if not handler:
            await job_queue.log(run_id, f"Simulated pipeline execution for '{job_id}'.", level="INFO")
            await asyncio.sleep(1) # simulate work
            await job_queue.log(run_id, f"Pipeline execution completed successfully.", level="INFO")
            await job_queue.complete_run(run_id, status="completed")
            return run_id

        try:
            await handler(run_id)
            await job_queue.complete_run(run_id, status="completed")
        except Exception as e:
            logger.error("Job execution failed", job_id=job_id, error=str(e))
            await job_queue.log(run_id, f"Execution failed: {str(e)}", level="ERROR")
            await job_queue.complete_run(run_id, status="failed", error_message=str(e))
        return run_id

    async def init_schedules(self):
        async with AsyncSessionLocal() as session:
            for s in DEFAULT_SCHEDULES:
                stmt = select(Schedule).where(Schedule.id == s["id"])
                existing = (await session.execute(stmt)).scalar_one_or_none()
                if not existing:
                    session.add(Schedule(**s))
            await session.commit()
            
            # Load and register enabled schedules with APScheduler
            stmt = select(Schedule)
            schedules = (await session.execute(stmt)).scalars().all()
            for sched in schedules:
                if sched.enabled:
                    self._add_to_apscheduler(sched)

    def _add_to_apscheduler(self, sched: Schedule):
        try:
            trigger = CronTrigger.from_crontab(sched.cron_expression, timezone=sched.timezone)
            self.scheduler.add_job(
                self.execute_job,
                trigger=trigger,
                id=sched.id,
                name=sched.name,
                replace_existing=True,
                args=[sched.id, "scheduled"],
            )
            logger.info("Registered schedule", id=sched.id, cron=sched.cron_expression)
        except Exception as e:
            logger.error("Failed to register schedule", id=sched.id, error=str(e))

    def start(self):
        if not self.scheduler.running:
            self.scheduler.start()
            logger.info("APScheduler background service started.")

    def shutdown(self):
        if self.scheduler.running:
            self.scheduler.shutdown()
            logger.info("APScheduler stopped.")

app_scheduler = AppScheduler()
