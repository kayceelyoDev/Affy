import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from backend.app.core.database import Base, engine, AsyncSessionLocal
from backend.app.services.scheduler import app_scheduler
from backend.app.main import app

@pytest_asyncio.fixture(autouse=True)
async def init_test_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await app_scheduler.init_schedules()
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest_asyncio.fixture
async def db_session():
    async with AsyncSessionLocal() as session:
        yield session

@pytest_asyncio.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
