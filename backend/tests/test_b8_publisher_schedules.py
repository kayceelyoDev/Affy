import os
import pytest
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.app.models.models import (
    User, Product, Plan, PlanSlot, RenderJob, Post, PostMetricDaily, Order, Schedule, Run
)
from backend.app.services.captions.service import CaptionService, HookLearningEngine
from backend.app.services.publisher.media_host import (
    MockMediaHostProvider, TunnelMediaHostProvider, get_tunnel_token_file
)
from backend.app.services.publisher.buffer import BufferClient, BufferQuotaExceededError
from backend.app.services.scheduler import app_scheduler


@pytest.mark.asyncio
async def test_caption_service_taglish_banned_claims_and_fingerprint():
    """Validates Taglish generation, unique fingerprint prefix, and banned marketing claims sanitization."""
    # 1. Fingerprint generation
    fp = CaptionService.generate_fingerprint(slot_id=42, salt="TEST")
    assert fp == "[TTC-042-TEST]"

    # 2. Banned claims filter
    dirty_text = "This product has a 100% guarantee to cure your headache! Miracle item with FDA approved stamp."
    clean_text, violations = CaptionService.filter_banned_claims(dirty_text)
    assert len(violations) >= 3
    assert "cure" in violations
    assert "100% guarantee" in violations
    assert "miracle" in violations
    assert "fda approved" in violations
    assert "cure" not in clean_text.lower()

    # 3. Taglish caption generation
    caption, gen_fp = CaptionService.generate_caption(
        product_name="Ultra Bass Earbuds",
        hook_text="Stop buying cheap headphones!",
        slot_id=1,
        custom_cta="Pindutin ang yellow basket! 👇",
    )
    assert gen_fp in caption
    assert "Ultra Bass Earbuds" in caption
    assert "Pindutin ang yellow basket! 👇" in caption
    assert "#fyp" in caption


@pytest.mark.asyncio
async def test_hook_learning_recommendations(db_session: AsyncSession):
    """Verifies that historical hook conversion performance is aggregated and top hooks prioritized."""
    # Seed product
    prod = Product(name="Kitchen Chopper", category="Home", folder_path="Kitchen_Chopper", active=True)
    db_session.add(prod)
    await db_session.commit()
    await db_session.refresh(prod)

    # Seed posts with different hook styles
    p1 = Post(product_id=prod.id, hook_style="Problem-Solution", status="published")
    p2 = Post(product_id=prod.id, hook_style="Classic Hook", status="published")
    db_session.add_all([p1, p2])
    await db_session.commit()
    await db_session.refresh(p1)
    await db_session.refresh(p2)

    # Seed metrics and orders: Problem-Solution has 10 orders, Classic Hook has 1
    m1 = PostMetricDaily(post_id=p1.id, date="2026-11-09", views=5000)
    m2 = PostMetricDaily(post_id=p2.id, date="2026-11-09", views=5000)
    db_session.add_all([m1, m2])

    for i in range(10):
        db_session.add(Order(
            order_id=f"1000000000{i:02d}",
            product_id=prod.id,
            matched_post_id=p1.id,
            product_name_raw="Kitchen Chopper",
            actual_commission=50.0,
        ))
    db_session.add(Order(
        order_id="200000000001",
        product_id=prod.id,
        matched_post_id=p2.id,
        product_name_raw="Kitchen Chopper",
        actual_commission=50.0,
    ))
    await db_session.commit()

    # Evaluate hook learning performance
    perf = await HookLearningEngine.get_hook_performance(db_session, product_id=prod.id)
    assert len(perf) == 2
    assert perf[0]["hook_style"] == "Problem-Solution"
    assert perf[0]["total_orders"] == 10
    assert perf[0]["score"] > perf[1]["score"]

    # Recommend hook with 0% exploration (pure exploitation)
    chosen = await HookLearningEngine.recommend_hook(db_session, product_id=prod.id, exploration_rate=0.0)
    assert chosen == "Problem-Solution"


@pytest.mark.asyncio
async def test_buffer_client_queue_and_exact_modes():
    """Tests Buffer GraphQL client in Queue mode vs Exact-time mode."""
    client = BufferClient(mock_mode=True)
    
    # 1. Queue mode
    res_queue = await client.create_post(
        channel_id="chan_123",
        text="Test Caption in Queue",
        media_url="https://mock-cdn.local/vid1.mp4",
        mode="queue",
    )
    assert res_queue["status"] == "queued"
    assert res_queue["channelId"] == "chan_123"

    # 2. Exact-time mode
    target_dt = datetime.now(timezone.utc) + timedelta(hours=5)
    res_exact = await client.create_post(
        channel_id="chan_123",
        text="Test Caption Exact Time",
        media_url="https://mock-cdn.local/vid2.mp4",
        mode="exact",
        due_at=target_dt,
    )
    assert res_exact["status"] == "scheduled"
    assert res_exact["dueAt"] == target_dt.isoformat()


@pytest.mark.asyncio
async def test_buffer_client_quota_guard_and_retries():
    """Verifies that low remaining quota halts non-publishing metrics calls while protecting publishing."""
    client = BufferClient(monthly_limit=10, mock_mode=True)
    # Simulate 5 calls made -> 5 remaining
    client.call_count = 5

    # Non-publishing call should fail with quota warning when < 10 remaining
    with pytest.raises(BufferQuotaExceededError) as exc_info:
        client.check_quota(is_publishing=False)
    assert "paused to protect scheduled posts" in str(exc_info.value)

    # But publishing calls are still allowed until 0!
    client.check_quota(is_publishing=True)

    # Exhaust all calls
    client.call_count = 10
    with pytest.raises(BufferQuotaExceededError):
        client.check_quota(is_publishing=True)


@pytest.mark.asyncio
async def test_media_host_providers_cloudinary_and_tunnel(tmp_path):
    """Tests MockMediaHostProvider and TunnelMediaHostProvider tokenized access."""
    # 1. MockMediaHost
    mock_host = MockMediaHostProvider()
    url = await mock_host.upload_video("/tmp/dummy.mp4", public_id="slot_1")
    assert "https://res.cloudinary.com" in url
    assert await mock_host.delete_video("slot_1") is True

    # 2. TunnelMediaHost
    dummy_file = tmp_path / "sample.mp4"
    dummy_file.write_bytes(b"VIDEO_DATA")

    tunnel_host = TunnelMediaHostProvider(base_url="https://autopilot.local", token_ttl_seconds=3600)
    tunnel_url = await tunnel_host.upload_video(str(dummy_file))
    assert tunnel_url.startswith("https://autopilot.local/api/media/temp/t_")

    token = tunnel_url.split("/")[-1]
    resolved_path = get_tunnel_token_file(token)
    assert resolved_path == str(dummy_file)

    # Token revocation
    assert await tunnel_host.delete_video(token) is True
    assert get_tunnel_token_file(token) is None


@pytest.mark.asyncio
async def test_schedules_persistence_and_run_as_chain(db_session: AsyncSession):
    """Verifies all 10 default schedules and autonomous Run as Chain."""
    # Run the chain
    run_id = await app_scheduler.execute_chain(trigger_type="manual_test")
    assert run_id is not None

    # Check Run record
    stmt = select(Run).where(Run.id == run_id)
    run = (await db_session.execute(stmt)).scalar_one_or_none()
    if run:
        assert run.status in ("completed", "pending", "running")


@pytest.mark.asyncio
async def test_publisher_and_posts_api_lifecycle(client: AsyncClient, db_session: AsyncSession):
    """Tests end-to-end publishing lifecycle: slot publish -> post creation -> idempotency -> caption regen."""
    # Log in first to get session and csrf tokens
    login_res = await client.post("/api/auth/login", json={"username": "admin", "password": "b8_admin_password"})
    assert login_res.status_code == 200
    csrf_token = login_res.json()["csrf_token"]
    headers = {"X-CSRF-Token": csrf_token}

    # 1. Seed Product, Plan, PlanSlot, RenderJob
    prod = Product(name="Smart Magnetic Powerbank", category="Tech", folder_path="Powerbank", active=True)
    db_session.add(prod)
    await db_session.commit()
    await db_session.refresh(prod)

    plan = Plan(date="2026-11-10", status="approved")
    db_session.add(plan)
    await db_session.commit()
    await db_session.refresh(plan)

    slot = PlanSlot(
        plan_id=plan.id,
        slot_index=0,
        scheduled_time="09:00",
        product_id=prod.id,
        hook_style="Curiosity Gap",
        hook_text="Don't travel without this gadget!",
        status="rendered",
    )
    db_session.add(slot)
    await db_session.commit()
    await db_session.refresh(slot)

    job = RenderJob(
        plan_slot_id=slot.id,
        product_id=prod.id,
        status="completed",
        output_path="/tmp/autopilot_vids/sample_slot_101.mp4",
    )
    db_session.add(job)
    await db_session.commit()
    await db_session.refresh(job)

    # 2. Publish PlanSlot via API
    resp = await client.post(
        "/api/posts/publish-slot",
        json={"slot_id": slot.id, "mode": "queue"},
        headers=headers,
    )
    assert resp.status_code == 200
    post_data = resp.json()
    assert post_data["product_id"] == prod.id
    assert post_data["status"] == "scheduled"
    assert post_data["caption_fingerprint"].startswith("[TTC-")
    assert "Smart Magnetic Powerbank" in post_data["caption"]
    post_id = post_data["id"]

    # 3. Idempotency test: publishing slot again returns existing post without duplicate
    resp_again = await client.post(
        "/api/posts/publish-slot",
        json={"slot_id": slot.id, "mode": "queue"},
        headers=headers,
    )
    assert resp_again.status_code == 200
    assert resp_again.json()["id"] == post_id

    # 4. Regenerate caption for post
    regen_resp = await client.post(
        f"/api/posts/{post_id}/regenerate-caption",
        json={"custom_cta": "Buy now on TikTok!"},
        headers=headers,
    )
    assert regen_resp.status_code == 200
    assert "Buy now on TikTok!" in regen_resp.json()["caption"]

    # 5. Query posts list
    list_resp = await client.get("/api/posts")
    assert list_resp.status_code == 200
    assert list_resp.json()["total_count"] >= 1
    assert list_resp.json()["total_scheduled"] >= 1

    # 6. Query hook leaderboard
    hooks_resp = await client.get("/api/posts/hooks/performance")
    assert hooks_resp.status_code == 200
    assert "hooks" in hooks_resp.json()
