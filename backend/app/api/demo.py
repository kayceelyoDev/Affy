from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import get_db
from backend.app.services.demo import DemoSeeder
from backend.app.core.config import settings

router = APIRouter(prefix="/api/demo", tags=["Demo"])

@router.get("/status")
async def get_demo_status():
    return {
        "demo_mode": settings.DEMO_MODE,
        "message": "Demo mode is active" if settings.DEMO_MODE else "Production mode is active",
    }

@router.post("/seed")
async def seed_demo_endpoint(db: AsyncSession = Depends(get_db)):
    """Seed synthetic creator data for exploring the application without real credentials."""
    stats = await DemoSeeder.seed_demo_data(db)
    return {
        "status": "success",
        "message": "Synthetic demo data seeded successfully",
        "stats": stats,
    }
