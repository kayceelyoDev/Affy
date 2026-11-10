import os
import json
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.app.main import app
from backend.app.models.models import Upload, Extraction, Order
from backend.app.services.ai.gateway import AIGateway, AIQuotaExceededException
from backend.app.services.catalog.service import CatalogService
from backend.app.services.ingest.pipeline import IngestPipeline
from backend.app.services.ingest.validators import validate_order_id, normalize_stage, validate_commission_tolerance
from backend.app.services.ingest.spreadsheet import parse_orders_spreadsheet

@pytest.mark.asyncio
async def test_order_id_and_stage_validators():
    # 1. Valid Order IDs
    valid_id = "578912345678901234" # 18 digits
    is_valid, clean_id, reason = validate_order_id(valid_id)
    assert is_valid is True
    assert clean_id == valid_id
    assert reason is None

    # 2. Rejects scientific notation
    is_valid, _, reason = validate_order_id("5.78912E+17")
    assert is_valid is False
    assert "scientific notation" in reason

    # 3. Rejects float rounding
    is_valid, _, reason = validate_order_id("5789123456789012.0")
    assert is_valid is False
    assert "trailing .0" in reason

    # 4. Rejects too short or too long
    is_valid, _, _ = validate_order_id("12345")
    assert is_valid is False
    is_valid, _, _ = validate_order_id("1" * 30)
    assert is_valid is False

    # 5. Normalizes stages
    assert normalize_stage("In transit") == "shipped"
    assert normalize_stage("Awaiting payment") == "unpaid"
    assert normalize_stage("Completed") == "settled"
    assert normalize_stage("Returned") == "refunded"
    assert normalize_stage("Cancelled by customer") == "cancelled"

    # 6. Commission tolerance check
    assert validate_commission_tolerance(price=500, quantity=2, commission_rate=0.10, est_commission=100.0) is True
    assert validate_commission_tolerance(price=500, quantity=2, commission_rate=0.10, est_commission=90.0) is True
    # 25% tolerance exceeded (expected 100, got 200)
    assert validate_commission_tolerance(price=500, quantity=2, commission_rate=0.10, est_commission=200.0) is False

@pytest.mark.asyncio
async def test_ai_gateway_quota_limiter_and_caching():
    gateway = AIGateway(default_rpm=15, default_rpd=2, fake_provider=True)
    img_sample = b"synthetic_image_data_1"

    # First call - consumes 1 quota
    res1 = await gateway.extract_orders_from_batch([img_sample])
    assert len(res1.results) == 1
    assert gateway.call_count == 1

    # Second call with same data - cache hit! (does not consume additional quota or increment call count)
    res2 = await gateway.extract_orders_from_batch([img_sample])
    assert gateway.call_count == 1
    assert res1.model_dump_json() == res2.model_dump_json()

    # Second distinct call - consumes 2nd quota
    img_sample2 = b"synthetic_image_data_2"
    res3 = await gateway.extract_orders_from_batch([img_sample2])
    assert gateway.call_count == 2

    # Third distinct call - exceeds RPD limit of 2!
    img_sample3 = b"synthetic_image_data_3"
    with pytest.raises(AIQuotaExceededException):
        await gateway.extract_orders_from_batch([img_sample3])

    stats = gateway.get_aggregated_quota_stats()
    assert stats["daily_requests_used"] == 2
    assert stats["remaining_today"] == 0

@pytest.mark.asyncio
async def test_batched_multi_image_extraction_reduces_calls(db_session: AsyncSession, tmp_path):
    gateway = AIGateway(default_rpm=50, default_rpd=500, fake_provider=True)
    cat_service = CatalogService()
    pipeline = IngestPipeline(gateway, cat_service, upload_dir=str(tmp_path / "uploads"), batch_size=5)

    # Ingest 12 synthetic screenshot images
    upload_ids = []
    for i in range(12):
        fake_content = f"fake_png_header_and_pixels_{i}".encode("utf-8")
        upload_rec, is_new = await pipeline.ingest_file(
            db_session,
            f"screenshot_affiliate_orders_{i}.png",
            fake_content,
        )
        assert is_new is True
        upload_ids.append(upload_rec.id)

    # Process all 12 images
    summary = await pipeline.process_batch_uploads(db_session, upload_ids)

    # 12 images batched into chunks of 5: ceil(12/5) = 3 calls
    assert summary["processed_uploads"] == 12
    assert summary["ai_api_calls_made"] == 3
    assert gateway.call_count == 3
    assert summary["image_orders_auto_approved"] >= 12

@pytest.mark.asyncio
async def test_file_deduplication_and_order_upsert(db_session: AsyncSession, tmp_path):
    gateway = AIGateway(default_rpm=50, default_rpd=500, fake_provider=True)
    cat_service = CatalogService()
    pipeline = IngestPipeline(gateway, cat_service, upload_dir=str(tmp_path / "uploads"), batch_size=5)

    content = b"unique_screenshot_payload_99"

    # Upload 1
    up1, is_new1 = await pipeline.ingest_file(db_session, "order_shot.png", content)
    assert is_new1 is True

    # Upload 2 (identical file) -> Deduplicated!
    up2, is_new2 = await pipeline.ingest_file(db_session, "order_shot_copy.png", content)
    assert is_new2 is False
    assert up1.id == up2.id

    # Process upload
    await pipeline.process_batch_uploads(db_session, [up1.id])

    # Check order was created
    stmt = select(Order)
    orders = list((await db_session.execute(stmt)).scalars().all())
    assert len(orders) >= 1
    initial_order = orders[0]
    first_settle_changes = initial_order.settle_date_changes

    # Now upsert with a modified settle date to verify settle_date_changes increment
    from types import SimpleNamespace
    modified_item = SimpleNamespace(
        order_id=initial_order.order_id,
        status_stage="settled",
        product_name_raw=initial_order.product_name_raw,
        price=initial_order.price,
        quantity=initial_order.quantity,
        gmv=initial_order.gmv,
        commission_rate=initial_order.commission_rate,
        est_commission=initial_order.est_commission,
        actual_commission=45.0,
        settle_date_est="2026-12-01", # Changed date
        is_shop_ads=False,
        confidence=1.0,
        order_date=initial_order.order_date,
    )
    await pipeline._upsert_order(db_session, modified_item, upload_id=up1.id)
    await db_session.commit()
    await db_session.refresh(initial_order)

    assert initial_order.status_stage == "settled"
    assert initial_order.actual_commission == 45.0
    assert initial_order.settle_date_changes == first_settle_changes + 1

@pytest.mark.asyncio
async def test_deterministic_spreadsheet_orders_ingest_zero_ai_calls(db_session: AsyncSession, tmp_path):
    gateway = AIGateway(fake_provider=True)
    calls_before = gateway.call_count
    cat_service = CatalogService()
    pipeline = IngestPipeline(gateway, cat_service, upload_dir=str(tmp_path / "uploads"))

    # Create CSV content
    csv_text = """Order ID,Order status,Product name,Price,Quantity,Commission rate,Estimated commission,Actual commission,Settlement date
578912345678909901,Delivered,Microphone Wireless Kit,890.0,1,10%,89.0,-,2026-11-20
578912345678909902,Completed,Selfie Ring Light 12in,450.0,2,12%,108.0,108.0,2026-11-10
"""
    up_csv, is_new = await pipeline.ingest_file(db_session, "tiktok_orders_export.csv", csv_text.encode("utf-8"))
    assert is_new is True
    assert up_csv.file_type == "spreadsheet_orders"

    summary = await pipeline.process_batch_uploads(db_session, [up_csv.id])
    assert summary["spreadsheet_orders_ingested"] == 2
    # CRITICAL: Zero AI calls used for spreadsheets!
    assert summary["ai_api_calls_made"] == 0
    assert gateway.call_count == calls_before

    # Check orders in DB
    ord1 = (await db_session.execute(select(Order).where(Order.order_id == "578912345678909901"))).scalars().first()
    assert ord1 is not None
    assert ord1.status_stage == "delivered"
    assert ord1.actual_commission is None # Was '-'

    ord2 = (await db_session.execute(select(Order).where(Order.order_id == "578912345678909902"))).scalars().first()
    assert ord2 is not None
    assert ord2.status_stage == "settled"
    assert ord2.actual_commission == 108.0

@pytest.mark.asyncio
async def test_review_queue_and_orders_api(client: AsyncClient, db_session: AsyncSession):
    # 1. Create an extraction flagged for pending review
    up = Upload(
        file_hash="fake_hash_review_queue",
        filename="blurred_screenshot.png",
        file_type="image_orders",
        storage_path="/tmp/fake_shot.png",
        status="review_required",
    )
    db_session.add(up)
    await db_session.commit()
    await db_session.refresh(up)

    ext = Extraction(
        upload_id=up.id,
        image_index=0,
        model_used="gemini-1.5-flash",
        prompt_version="v1.0",
        raw_json=json.dumps({
            "order_id": "578912345678908888",
            "product_name_raw": "Bluetooth Selfie Tripod",
            "price": 320.0,
            "quantity": 1,
            "confidence": 0.65,
        }),
        confidence=0.65,
        review_status="pending_review",
        order_id_extracted="578912345678908888",
    )
    db_session.add(ext)
    await db_session.commit()
    await db_session.refresh(ext)

    # 2. Query review queue
    rq_resp = await client.get("/api/ingest/review-queue")
    assert rq_resp.status_code == 200
    items = rq_resp.json()["items"]
    found = next((i for i in items if i["extraction_id"] == ext.id), None)
    assert found is not None
    assert found["confidence"] == 0.65

    # 3. Manually approve item via API
    approve_payload = {
        "order_id": "578912345678908888",
        "status_stage": "settled",
        "product_name_raw": "Bluetooth Selfie Tripod Corrected",
        "price": 320.0,
        "quantity": 1,
        "commission_rate": 0.15,
        "est_commission": 48.0,
        "actual_commission": 48.0,
        "settle_date_est": "2026-11-12",
    }
    approve_resp = await client.post(
        f"/api/ingest/review-queue/{ext.id}/approve",
        json=approve_payload,
        headers={"X-CSRF-Token": "csrf-test-token"},
        cookies={"csrf_token": "csrf-test-token"},
    )
    assert approve_resp.status_code == 200
    assert approve_resp.json()["status"] == "approved"

    # 4. Check Orders API
    orders_resp = await client.get("/api/orders?search=578912345678908888")
    assert orders_resp.status_code == 200
    orders_data = orders_resp.json()
    assert orders_data["total"] >= 1
    matched = orders_data["items"][0]
    assert matched["order_id"] == "578912345678908888"
    assert matched["status_stage"] == "settled"
    assert matched["actual_commission"] == 48.0

    # 5. Check AI Quota API
    quota_resp = await client.get("/api/ai/quota")
    assert quota_resp.status_code == 200
    q_data = quota_resp.json()
    assert "daily_limit" in q_data
    assert "remaining_today" in q_data
