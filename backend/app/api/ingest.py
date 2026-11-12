import json
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel

from backend.app.core.database import get_db
from backend.app.models.models import Upload, Extraction, Order, Alias
from backend.app.services.ai.gateway import AIGateway
from backend.app.services.catalog.service import CatalogService
from backend.app.services.ingest.pipeline import IngestPipeline
from backend.app.services.ingest.validators import validate_order_id, normalize_stage

router = APIRouter(prefix="/api/ingest", tags=["Ingest"])

# Singleton gateway & pipeline instances
_ai_gateway = AIGateway(default_rpm=15, default_rpd=500, fake_provider=True)
_catalog_service = CatalogService()
_pipeline = IngestPipeline(_ai_gateway, _catalog_service)

def get_ingest_pipeline() -> IngestPipeline:
    return _pipeline

class ProcessRequest(BaseModel):
    upload_ids: List[int]

class ExtractionApproveRequest(BaseModel):
    order_id: str
    status_stage: str
    product_name_raw: str
    price: float
    quantity: int = 1
    commission_rate: float = 0.10
    est_commission: Optional[float] = None
    actual_commission: Optional[float] = None
    settle_date_est: Optional[str] = None
    product_id: Optional[int] = None

@router.post("/upload")
async def upload_files(
    files: List[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    pipeline: IngestPipeline = Depends(get_ingest_pipeline),
):
    """Upload multiple screenshots or spreadsheets with SHA256 deduplication."""
    results = []
    for f in files:
        content = await f.read()
        upload_rec, is_new = await pipeline.ingest_file(db, f.filename, content)
        results.append({
            "id": upload_rec.id,
            "filename": upload_rec.filename,
            "file_hash": upload_rec.file_hash,
            "file_type": upload_rec.file_type,
            "status": upload_rec.status,
            "is_duplicate": not is_new,
        })
    return {"uploads": results}

@router.post("/process")
async def process_batch(
    req: ProcessRequest,
    db: AsyncSession = Depends(get_db),
    pipeline: IngestPipeline = Depends(get_ingest_pipeline),
):
    """Batch-process uploaded files using deterministic parsers and 4-6 image Gemini batching."""
    summary = await pipeline.process_batch_uploads(db, req.upload_ids)
    return summary

@router.get("/uploads")
async def list_uploads(
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Upload).order_by(Upload.created_at.desc()).limit(limit)
    rows = (await db.execute(stmt)).scalars().all()
    return {
        "uploads": [
            {
                "id": u.id,
                "filename": u.filename,
                "file_type": u.file_type,
                "status": u.status,
                "file_hash": u.file_hash,
                "created_at": u.created_at.isoformat() if u.created_at else None,
                "completed_at": u.completed_at.isoformat() if u.completed_at else None,
                "error_message": u.error_message,
            }
            for u in rows
        ]
    }

@router.get("/review-queue")
async def get_review_queue(
    db: AsyncSession = Depends(get_db),
):
    """Retrieve extractions flagged for manual review."""
    stmt = (
        select(Extraction, Upload)
        .join(Upload, Extraction.upload_id == Upload.id)
        .where(Extraction.review_status == "pending_review")
        .order_by(Extraction.created_at.desc())
    )
    rows = (await db.execute(stmt)).all()

    items = []
    for ext, up in rows:
        parsed_data = {}
        if ext.raw_json:
            try:
                parsed_data = json.loads(ext.raw_json)
            except Exception:
                parsed_data = {}

        items.append({
            "extraction_id": ext.id,
            "upload_id": up.id,
            "filename": up.filename,
            "image_index": ext.image_index,
            "model_used": ext.model_used,
            "prompt_version": ext.prompt_version,
            "confidence": ext.confidence,
            "extracted_data": parsed_data,
            "created_at": ext.created_at.isoformat() if ext.created_at else None,
        })

    return {"items": items}

@router.post("/review-queue/{id}/approve")
async def approve_review_item(
    id: int,
    req: ExtractionApproveRequest,
    db: AsyncSession = Depends(get_db),
    pipeline: IngestPipeline = Depends(get_ingest_pipeline),
):
    """Manually approve and upsert an extracted order into orders table."""
    ext_stmt = select(Extraction).where(Extraction.id == id)
    ext = (await db.execute(ext_stmt)).scalars().first()
    if not ext:
        raise HTTPException(status_code=404, detail="Extraction item not found")

    is_valid, clean_id, reason = validate_order_id(req.order_id)
    if not is_valid:
        raise HTTPException(status_code=400, detail=f"Invalid Order ID: {reason}")

    # Upsert order
    from types import SimpleNamespace
    order_data = SimpleNamespace(
        order_id=clean_id,
        status_stage=req.status_stage,
        product_name_raw=req.product_name_raw,
        price=req.price,
        quantity=req.quantity,
        gmv=round(req.price * req.quantity, 2),
        commission_rate=req.commission_rate,
        est_commission=req.est_commission,
        actual_commission=req.actual_commission,
        settle_date_est=req.settle_date_est,
        is_shop_ads=False,
        confidence=1.0,
        order_date=None,
    )

    await pipeline._upsert_order(
        db,
        order_data,
        upload_id=ext.upload_id,
        product_id=req.product_id,
    )

    ext.review_status = "manually_approved"
    await db.commit()

    return {"status": "approved", "order_id": clean_id}

@router.post("/review-queue/{id}/reject")
async def reject_review_item(
    id: int,
    db: AsyncSession = Depends(get_db),
):
    ext_stmt = select(Extraction).where(Extraction.id == id)
    ext = (await db.execute(ext_stmt)).scalars().first()
    if not ext:
        raise HTTPException(status_code=404, detail="Extraction item not found")

    ext.review_status = "rejected"
    await db.commit()
    return {"status": "rejected", "id": id}
