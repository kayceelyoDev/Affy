import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from backend.app.models.models import Product, Clip, Scorecard, Plan, PlanSlot
from backend.app.services.planner.service import DailyPlannerService

@pytest.mark.asyncio
async def test_planner_rules_clip_readiness_and_cooldown_filter(db_session: AsyncSession):
    planner = DailyPlannerService()

    # Product 1: 5 usable clips, SCALE tier (Score 40) -> Eligible
    p1 = Product(name="Scale Wireless Mic", category="Audio", folder_path="Scale_Mic", active=True)
    db_session.add(p1)
    await db_session.commit()
    await db_session.refresh(p1)
    for i in range(5):
        db_session.add(Clip(product_id=p1.id, file_path=f"Scale_Mic/c_{i}.mp4", filename=f"c_{i}.mp4", status="usable"))
    db_session.add(Scorecard(period="weekly", product_id=p1.id, score=40.0, tier="SCALE"))

    # Product 2: 2 usable clips (low stock < 4), SCALE tier -> MUST BE SKIPPED
    p2 = Product(name="Low Stock Speaker", category="Audio", folder_path="Low_Speaker", active=True)
    db_session.add(p2)
    await db_session.commit()
    await db_session.refresh(p2)
    for i in range(2):
        db_session.add(Clip(product_id=p2.id, file_path=f"Low_Speaker/c_{i}.mp4", filename=f"c_{i}.mp4", status="usable"))
    db_session.add(Scorecard(period="weekly", product_id=p2.id, score=35.0, tier="SCALE"))

    # Product 3: 6 usable clips, COOLDOWN tier -> MUST BE SKIPPED
    p3 = Product(name="Cooldown Camera", category="Video", folder_path="Cooldown_Cam", active=True)
    db_session.add(p3)
    await db_session.commit()
    await db_session.refresh(p3)
    for i in range(6):
        db_session.add(Clip(product_id=p3.id, file_path=f"Cooldown_Cam/c_{i}.mp4", filename=f"c_{i}.mp4", status="usable"))
    db_session.add(Scorecard(period="weekly", product_id=p3.id, score=1.0, tier="COOLDOWN"))

    # Product 4: 5 usable clips, TEST tier -> Selected for exploration
    p4 = Product(name="Test Tripod Pro", category="Video", folder_path="Test_Tripod", active=True)
    db_session.add(p4)
    await db_session.commit()
    await db_session.refresh(p4)
    for i in range(5):
        db_session.add(Clip(product_id=p4.id, file_path=f"Test_Tripod/c_{i}.mp4", filename=f"c_{i}.mp4", status="usable"))
    db_session.add(Scorecard(period="weekly", product_id=p4.id, score=2.5, tier="TEST"))

    await db_session.commit()

    # Generate plan
    plan_data = await planner.generate_daily_plan(db_session, date_str="2026-11-12", auto_approve=True)

    assert plan_data["slots_count"] == 6
    slots = plan_data["slots"]

    scheduled_product_ids = [s["product_id"] for s in slots if s["product_id"] is not None]

    # Verify P1 (Scale) and P4 (Test exploration) are present
    assert p1.id in scheduled_product_ids
    assert p4.id in scheduled_product_ids

    # Verify P2 (Low clips < 4) and P3 (Cooldown) were NEVER scheduled
    assert p2.id not in scheduled_product_ids
    assert p3.id not in scheduled_product_ids

@pytest.mark.asyncio
async def test_planner_slot_locking_and_idempotency(db_session: AsyncSession):
    planner = DailyPlannerService()

    # Create Product A & Product B
    pA = Product(name="Earbuds Pro", category="Audio", folder_path="Earbuds_Pro", active=True)
    pB = Product(name="Headphones Max", category="Audio", folder_path="Headphones_Max", active=True)
    db_session.add_all([pA, pB])
    await db_session.commit()
    for p in [pA, pB]:
        await db_session.refresh(p)
        for i in range(5):
            db_session.add(Clip(product_id=p.id, file_path=f"{p.folder_path}/c_{i}.mp4", filename=f"c_{i}.mp4", status="usable"))
        db_session.add(Scorecard(period="weekly", product_id=p.id, score=28.0, tier="SCALE"))
    await db_session.commit()

    # Initial plan run
    date_val = "2026-11-15"
    res1 = await planner.generate_daily_plan(db_session, date_str=date_val)
    plan_id = res1["plan_id"]

    # User manually locks Slot 1 (index 1) to Product B with custom hook
    slot_stmt = select(PlanSlot).where(and_(PlanSlot.plan_id == plan_id, PlanSlot.slot_index == 1))
    slot1 = (await db_session.execute(slot_stmt)).scalars().first()
    assert slot1 is not None

    slot1.locked = True
    slot1.product_id = pB.id
    slot1.hook_style = "Custom Story Hook"
    slot1.reason = "User pinned VIP deal"
    await db_session.commit()

    # Re-run planner (force regenerate unlocked slots)
    res2 = await planner.generate_daily_plan(db_session, date_str=date_val, force_regenerate=True)

    # Check that Slot 1 remained strictly locked to Product B and custom hook
    slot1_after = (await db_session.execute(slot_stmt)).scalars().first()
    assert slot1_after.locked is True
    assert slot1_after.product_id == pB.id
    assert slot1_after.hook_style == "Custom Story Hook"
    assert "User Locked" in res2["slots"][1]["reason"]

@pytest.mark.asyncio
async def test_planner_dry_run_mode(db_session: AsyncSession):
    planner = DailyPlannerService()
    date_val = "2026-12-01"

    # Ensure no plans exist for date_val
    plans_before = (await db_session.execute(select(func.count(Plan.id)).where(Plan.date == date_val))).scalar()
    assert plans_before == 0

    # Execute Dry-Run
    dry_plan = await planner.generate_daily_plan(db_session, date_str=date_val, dry_run=True)

    assert dry_plan["dry_run"] is True
    assert dry_plan["status"] == "dry_run"
    assert dry_plan["slots_count"] == 6

    # Verify ZERO records committed to database
    plans_after = (await db_session.execute(select(func.count(Plan.id)).where(Plan.date == date_val))).scalar()
    assert plans_after == 0

@pytest.mark.asyncio
async def test_planner_api_lifecycle(client: AsyncClient, db_session: AsyncSession):
    # Seed product
    prod = Product(name="API Planner Drone", category="Gadgets", folder_path="API_Drone", active=True)
    db_session.add(prod)
    await db_session.commit()
    await db_session.refresh(prod)
    for i in range(5):
        db_session.add(Clip(product_id=prod.id, file_path=f"API_Drone/c_{i}.mp4", filename=f"c_{i}.mp4", status="usable"))
    db_session.add(Scorecard(period="weekly", product_id=prod.id, score=30.0, tier="SCALE"))
    await db_session.commit()

    # 1. GET /api/planner/today (auto-generates)
    today_resp = await client.get("/api/planner/today")
    assert today_resp.status_code == 200
    today_data = today_resp.json()
    assert today_data["slots_count"] == 6
    assert len(today_data["slots"]) == 6

    first_slot_id = today_data["slots"][0]["id"]

    # 2. POST /api/planner/slots/{id}/lock
    lock_resp = await client.post(
        f"/api/planner/slots/{first_slot_id}/lock",
        headers={"X-CSRF-Token": "csrf-test-token"},
        cookies={"csrf_token": "csrf-test-token"},
    )
    assert lock_resp.status_code == 200
    assert lock_resp.json()["locked"] is True

    # 3. POST /api/planner/approve
    appr_resp = await client.post(
        "/api/planner/approve",
        headers={"X-CSRF-Token": "csrf-test-token"},
        cookies={"csrf_token": "csrf-test-token"},
    )
    assert appr_resp.status_code == 200
    assert appr_resp.json()["status"] == "approved"
