import pytest_asyncio
from backend.app.core.database import Base, engine
from backend.app.services.scheduler import app_scheduler

@pytest_asyncio.fixture(autouse=True)
async def init_test_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await app_scheduler.init_schedules()
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
