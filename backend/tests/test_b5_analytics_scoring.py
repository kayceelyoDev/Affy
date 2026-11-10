import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.app.models.models import Product, Order, Post, PostMetricDaily, Scorecard
from backend.app.services.analytics.scoring import calculate_score_v1, calculate_score_v2, run_product_scoring
from backend.app.services.analytics.attribution import generate_caption_fingerprint, match_order_caption_to_post, get_post_attribution_summary
from backend.app.services.analytics.sources import BufferMetricSource, TikTokDisplayMetricSource, CSVMetricSource, MetricAggregator

def test_v1_scoring_mathematical_parity():
    # Case 1: High performing proven product
    # videos=5, views=25000, avg=5000, orders=50, settled=35, settled_comm=350, pending_comm=150, cancelled=2
    # weighted_comm = 350*1.0 + 150*0.7 = 350 + 105 = 455
    # comm_per_video = 455 / 5 = 91.0
    # orders_per_1k = 50 / 25 = 2.0
    # cancel_rate = 2 / 52 = 0.03846
    # raw = 91.0*10 + 2.0*5 + 35*6 + 5000/500 - 0.03846*20
    # raw = 910 + 10 + 210 + 10 - 0.77 = 1139.23 -> Score 1139.23, Tier SCALE
    res = calculate_score_v1(
        videos_posted=5,
        total_views=25000,
        avg_views=5000,
        orders_total=50,
        settled_orders=35,
        settled_commission=350.0,
        pending_commission=150.0,
        cancelled_orders=2,
        prev_score=1000.0,
    )
    assert res["score"] == 1139.23
    assert res["tier"] == "SCALE"
    assert res["trend"] == "UP" # 1139.23 - 1000.0 >= 2.0

    # Case 2: Unproven with <2 videos and no proven sales (0.6 multiplier applied)
    # videos=1, views=1000, avg=1000, orders=0, settled=0, comm=0
    # raw = 0 + 0 + 0 + 1000/500 - 0 = 2.0 -> * 0.6 = 1.2
    res2 = calculate_score_v1(
        videos_posted=1,
        total_views=1000,
        avg_views=1000,
        orders_total=0,
        settled_orders=0,
        settled_commission=0.0,
        pending_commission=0.0,
        cancelled_orders=0,
        prev_score=None,
    )
    assert res2["score"] == 1.2
    assert res2["tier"] == "TEST"
    assert res2["trend"] == "NEW"

    # Case 3: Cooldown product (4 videos, 0 orders, score < 2.0)
    res3 = calculate_score_v1(
        videos_posted=4,
        total_views=400,
        avg_views=100,
        orders_total=0,
        settled_orders=0,
        settled_commission=0.0,
        pending_commission=0.0,
        cancelled_orders=0,
        prev_score=1.5,
    )
    assert res3["tier"] == "COOLDOWN"

    # Case 4: Zero views fallback (orders_total * 1.5)
    res4 = calculate_score_v1(
        videos_posted=2,
        total_views=0,
        avg_views=0,
        orders_total=4,
        settled_orders=2,
        settled_commission=20.0,
        pending_commission=10.0,
    )
    assert res4["components"]["orders_per_1000_views"] == 4 * 1.5

def test_v2_scoring_multi_signal():
    res_v2 = calculate_score_v2(
        videos_posted=3,
        total_views=10000,
        avg_views=3333,
        orders_total=10,
        settled_orders=8,
        settled_commission=100.0,
        pending_commission=20.0,
        cancelled_orders=0,
        prev_score=50.0,
        views_velocity_24h=2500, # Velocity bonus
        margin_rate=0.30, # Margin bonus
        usable_clips_count=1, # Low clip penalty (-5.0)
    )
    assert res_v2["profile_version"] == "v2"
    assert "velocity bonus" in res_v2["explanation"]
    assert "high margin bonus" in res_v2["explanation"]
    assert "low stock clip warning" in res_v2["explanation"]

def test_caption_fingerprint_and_attribution():
    # 1. Normalize captions with emojis, hashtags, and symbols
    cap1 = "Check out this amazing wireless mic! #tiktokfinds #creator 🔥 https://vt.tiktok.com/xyz"
    cap2 = "check out this AMAZING wireless mic! #viral https://vt.tiktok.com/abc"
    fp1 = generate_caption_fingerprint(cap1)
    fp2 = generate_caption_fingerprint(cap2)

    # Core tokens 'check out this amazing wireless mic' should produce identical fingerprints
    assert fp1 != ""
    assert fp1 == fp2

@pytest.mark.asyncio
async def test_metric_sources_merge_and_priority():
    # Buffer source with low quota (< 10) guards and refuses
    buf_low = BufferMetricSource(quota_remaining=5)
    res_low = await buf_low.fetch_metrics(["post_1"])
    assert res_low == {}

    # Normal sources
    buf_normal = BufferMetricSource(quota_remaining=50, known_ids=["post_1"])
    tiktok_disp = TikTokDisplayMetricSource(known_ids=["post_tiktok"])
    csv_src = CSVMetricSource({"post_csv": {"views": 999, "likes": 20, "comments": 2, "shares": 1}})

    # Priority order: Buffer > TikTok Display > CSV
    aggregator = MetricAggregator(sources=[buf_normal, tiktok_disp, csv_src])
    merged = await aggregator.aggregate_metrics_for_posts(["post_1", "post_tiktok", "post_csv"])

    assert "post_1" in merged
    assert merged["post_1"]["source"] == "buffer"
    assert merged["post_1"]["views"] == 1250

    assert "post_tiktok" in merged
    assert merged["post_tiktok"]["source"] == "tiktok_display"
    assert merged["post_tiktok"]["views"] == 1500

    assert "post_csv" in merged
    assert merged["post_csv"]["source"] == "csv"
    assert merged["post_csv"]["views"] == 999

@pytest.mark.asyncio
async def test_analytics_api_and_sunday_scoring(client: AsyncClient, db_session: AsyncSession):
    # 1. Seed Product
    prod = Product(
        name="Strategy Test Wireless Earbuds",
        category="Audio",
        folder_path="Strategy_Test_Wireless_Earbuds",
        commission_rate=0.15,
        margin_rate=0.35,
        active=True,
    )
    db_session.add(prod)
    await db_session.commit()
    await db_session.refresh(prod)

    # 2. Seed Posts
    post = Post(
        product_id=prod.id,
        buffer_post_id="buf_test_1001",
        caption="Super bass wireless earbuds test review #earbuds",
        caption_fingerprint=generate_caption_fingerprint("Super bass wireless earbuds test review"),
        hook_style="Classic Hook",
        status="published",
    )
    db_session.add(post)
    await db_session.commit()
    await db_session.refresh(post)

    # 3. Seed Metrics
    metric = PostMetricDaily(
        post_id=post.id,
        date="2026-11-10",
        views=4500,
        likes=120,
        comments=15,
        shares=8,
        source="buffer",
    )
    db_session.add(metric)

    # 4. Seed Orders
    ord1 = Order(
        order_id="578912345678907701",
        status_stage="settled",
        product_id=prod.id,
        product_name_raw="Wireless Earbuds Super Bass",
        price=500.0,
        quantity=2,
        gmv=1000.0,
        commission_rate=0.15,
        est_commission=150.0,
        actual_commission=150.0,
        settle_date_est="2026-11-09",
        matched_post_id=post.id,
    )
    ord2 = Order(
        order_id="578912345678907702",
        status_stage="shipped",
        product_id=prod.id,
        product_name_raw="Wireless Earbuds Super Bass",
        price=500.0,
        quantity=1,
        gmv=500.0,
        commission_rate=0.15,
        est_commission=75.0,
        actual_commission=None,
        settle_date_est="2026-11-16",
        matched_post_id=post.id,
    )
    db_session.add_all([ord1, ord2])
    await db_session.commit()

    # 5. Test Attribution Summary
    attrib = await get_post_attribution_summary(db_session, post.id)
    assert attrib["orders_count"] == 2
    assert attrib["gmv"] == 1500.0
    assert attrib["actual_commission"] == 150.0

    # 6. Test GET /api/analytics/overview
    ov_resp = await client.get("/api/analytics/overview")
    assert ov_resp.status_code == 200
    ov_data = ov_resp.json()
    assert ov_data["total_views"] >= 4500
    assert ov_data["cashflow"]["settled"] >= 150.0
    assert ov_data["cashflow"]["settling_soon"] >= 75.0

    # 7. Test POST /api/analytics/scorecards/run
    sc_run_resp = await client.post(
        "/api/analytics/scorecards/run",
        json={"period": "weekly", "profile_version": "v1"},
        headers={"X-CSRF-Token": "csrf-test-token"},
        cookies={"csrf_token": "csrf-test-token"},
    )
    assert sc_run_resp.status_code == 200
    assert sc_run_resp.json()["status"] == "completed"

    # 8. Test GET /api/analytics/scorecards
    sc_list_resp = await client.get("/api/analytics/scorecards")
    assert sc_list_resp.status_code == 200
    cards = sc_list_resp.json()["scorecards"]
    assert len(cards) >= 1
    matched_sc = next((c for c in cards if c["product_id"] == prod.id), None)
    assert matched_sc is not None
    assert matched_sc["tier"] in ["SCALE", "STEADY", "TEST"]

    # 9. Test GET /api/analytics/styles
    st_resp = await client.get("/api/analytics/styles")
    assert st_resp.status_code == 200
    styles = st_resp.json()["styles"]
    assert len(styles) >= 1
    found_hook = next((s for s in styles if s["hook_style"] == "Classic Hook"), None)
    assert found_hook is not None
    assert found_hook["total_views"] >= 4500
