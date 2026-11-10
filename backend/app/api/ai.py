from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import get_db
from backend.app.services.ai.gateway import AIGateway
from backend.app.api.ingest import get_ingest_pipeline

router = APIRouter(prefix="/api/ai", tags=["AI Gateway"])

@router.get("/quota")
async def get_ai_quota():
    """Return RPM and RPD quota meter stats for Gemini and configured models."""
    pipeline = get_ingest_pipeline()
    stats = pipeline.ai_gateway.get_aggregated_quota_stats()
    return stats

@router.post("/test")
async def test_ai_connectivity():
    """Test AI Gateway connectivity and structured extraction."""
    pipeline = get_ingest_pipeline()
    # Test batch extraction with dummy 1-pixel jpeg
    dummy_jpg = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb\x00C\x00\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xbf\x00\xff\xd9"
    try:
        res = await pipeline.ai_gateway.extract_orders_from_batch([dummy_jpg])
        return {
            "status": "connected",
            "models": pipeline.ai_gateway.task_routing,
            "sample_extraction_results": len(res.results),
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
        }
