import json
from typing import Dict, Any, Optional, Tuple, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from backend.app.models.models import Product, Order, Post, PostMetricDaily, Scorecard

def calculate_score_v1(
    videos_posted: int,
    total_views: int,
    avg_views: float,
    orders_total: int,
    settled_orders: int,
    settled_commission: float,
    pending_commission: float,
    cancelled_orders: int = 0,
    prev_score: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Exact mathematical port of the Sunday Strategy Engine n8n formula:
    - Weighted commission: Settled 1.0, Pending 0.7
    - Commission per video: weighted_commission / max(1, videos_posted)
    - Orders per 1,000 views: orders_total / (total_views/1000) or orders_total * 1.5 if 0 views
    - Cancel rate: cancelled / (orders_total + cancelled)
    - Raw score: comm_per_video*10 + orders_per_1000_views*5 + settled_orders*6 + avg_views/500 - cancel_rate*20
    - Multiplier 0.6 if videos_posted < 2 and not proven (settled < 1 and orders < 2)
    - Floor at 0.0
    - Tiers: SCALE, STEADY, TEST, COOLDOWN
    - Trends: UP, DOWN, STABLE, NEW
    """
    weighted_comm = (settled_commission * 1.0) + (pending_commission * 0.7)
    comm_per_video = weighted_comm / max(1, videos_posted)

    if total_views > 0:
        orders_per_1k = orders_total / (total_views / 1000.0)
    else:
        orders_per_1k = orders_total * 1.5

    total_with_cancelled = orders_total + cancelled_orders
    cancel_rate = (cancelled_orders / total_with_cancelled) if total_with_cancelled > 0 else 0.0

    raw = (
        (comm_per_video * 10.0)
        + (orders_per_1k * 5.0)
        + (settled_orders * 6.0)
        + (avg_views / 500.0)
        - (cancel_rate * 20.0)
    )

    proven_sales = (settled_orders >= 1 or orders_total >= 2)
    if videos_posted < 2 and not proven_sales:
        raw *= 0.6

    score = round(max(0.0, raw), 2)

    # Tiers
    if (videos_posted >= 2 or proven_sales) and score >= 25.0:
        tier = "SCALE"
    elif (videos_posted >= 1 or orders_total >= 1) and score >= 5.0:
        tier = "STEADY"
    elif videos_posted >= 4 and orders_total == 0 and score < 2.0:
        tier = "COOLDOWN"
    else:
        tier = "TEST"

    # Trends
    if prev_score is None:
        trend = "NEW"
    elif score - prev_score >= 2.0:
        trend = "UP"
    elif prev_score - score >= 2.0:
        trend = "DOWN"
    else:
        trend = "STABLE"

    components = {
        "videos_posted": videos_posted,
        "total_views": total_views,
        "avg_views": round(avg_views, 1),
        "orders_total": orders_total,
        "settled_orders": settled_orders,
        "settled_commission": round(settled_commission, 2),
        "pending_commission": round(pending_commission, 2),
        "weighted_commission": round(weighted_comm, 2),
        "commission_per_video": round(comm_per_video, 2),
        "orders_per_1000_views": round(orders_per_1k, 2),
        "cancel_rate": round(cancel_rate, 4),
        "proven_sales": proven_sales,
    }

    return {
        "score": score,
        "tier": tier,
        "trend": trend,
        "profile_version": "v1",
        "components": components,
        "explanation": f"v1 Score {score} ({tier}, {trend}) based on {orders_total} orders and ₱{round(weighted_comm, 2)} weighted commission across {videos_posted} video(s).",
    }

def calculate_score_v2(
    videos_posted: int,
    total_views: int,
    avg_views: float,
    orders_total: int,
    settled_orders: int,
    settled_commission: float,
    pending_commission: float,
    cancelled_orders: int = 0,
    prev_score: Optional[float] = None,
    views_velocity_24h: int = 0,
    margin_rate: float = 0.30,
    usable_clips_count: int = 5,
) -> Dict[str, Any]:
    """
    Scoring v2: Multi-signal scoring with view velocity boost and stock clips penalty.
    """
    v1_result = calculate_score_v1(
        videos_posted=videos_posted,
        total_views=total_views,
        avg_views=avg_views,
        orders_total=orders_total,
        settled_orders=settled_orders,
        settled_commission=settled_commission,
        pending_commission=pending_commission,
        cancelled_orders=cancelled_orders,
        prev_score=prev_score,
    )

    score = v1_result["score"]
    explanation_parts = [f"Base v1 score: {score}"]

    # 1. 24h Velocity Bonus
    if views_velocity_24h > 1000:
        velocity_bonus = min(10.0, views_velocity_24h / 500.0)
        score += velocity_bonus
        explanation_parts.append(f"+{round(velocity_bonus, 1)} velocity bonus ({views_velocity_24h} views in 24h)")

    # 2. Margin Rate Bonus
    if margin_rate >= 0.20:
        margin_bonus = (margin_rate - 0.10) * 15.0
        score += margin_bonus
        explanation_parts.append(f"+{round(margin_bonus, 1)} high margin bonus ({round(margin_rate * 100)}%)")

    # 3. Clip Depletion Penalty (Warning if under 3 clips left)
    if usable_clips_count < 3:
        score = max(0.0, score - 5.0)
        explanation_parts.append("-5.0 low stock clip warning (<3 clips)")

    final_score = round(max(0.0, score), 2)

    # Recalculate Tier
    if (videos_posted >= 2 or v1_result["components"]["proven_sales"]) and final_score >= 25.0:
        tier = "SCALE"
    elif (videos_posted >= 1 or orders_total >= 1) and final_score >= 5.0:
        tier = "STEADY"
    elif videos_posted >= 4 and orders_total == 0 and final_score < 2.0:
        tier = "COOLDOWN"
    else:
        tier = "TEST"

    # Trends
    if prev_score is None:
        trend = "NEW"
    elif final_score - prev_score >= 2.0:
        trend = "UP"
    elif prev_score - final_score >= 2.0:
        trend = "DOWN"
    else:
        trend = "STABLE"

    v1_result["components"]["views_velocity_24h"] = views_velocity_24h
    v1_result["components"]["margin_rate"] = margin_rate
    v1_result["components"]["usable_clips_count"] = usable_clips_count

    return {
        "score": final_score,
        "tier": tier,
        "trend": trend,
        "profile_version": "v2",
        "components": v1_result["components"],
        "explanation": "; ".join(explanation_parts),
    }

async def run_product_scoring(
    db: AsyncSession,
    period: str = "weekly",
    profile_version: str = "v1",
) -> List[Scorecard]:
    """
    Executes Sunday Strategy Engine scoring across all active catalog products.
    """
    products_stmt = select(Product).where(Product.active == True)
    products = list((await db.execute(products_stmt)).scalars().all())

    scorecards = []
    for prod in products:
        # 1. Fetch Orders for product
        orders_stmt = select(Order).where(Order.product_id == prod.id)
        orders = list((await db.execute(orders_stmt)).scalars().all())

        orders_total = len([o for o in orders if o.status_stage not in ["cancelled", "refunded", "unpaid"]])
        settled_orders = len([o for o in orders if o.status_stage == "settled"])
        cancelled_orders = len([o for o in orders if o.status_stage == "cancelled"])

        settled_comm = sum(o.actual_commission or o.est_commission or 0.0 for o in orders if o.status_stage == "settled")
        pending_comm = sum(o.est_commission or 0.0 for o in orders if o.status_stage in ["to_ship", "shipped", "delivered"])

        # 2. Fetch Posts for product
        posts_stmt = select(Post).where(Post.product_id == prod.id)
        posts = list((await db.execute(posts_stmt)).scalars().all())
        videos_posted = len(posts)

        # 3. Fetch Views from metrics
        post_ids = [p.id for p in posts]
        total_views = 0
        if post_ids:
            metrics_stmt = select(func.sum(PostMetricDaily.views)).where(PostMetricDaily.post_id.in_(post_ids))
            total_views = (await db.execute(metrics_stmt)).scalar() or 0

        avg_views = (total_views / max(1, videos_posted)) if videos_posted > 0 else 0.0

        # 4. Fetch Previous Score
        prev_stmt = (
            select(Scorecard.score)
            .where(Scorecard.product_id == prod.id)
            .order_by(Scorecard.created_at.desc())
        )
        prev_score = (await db.execute(prev_stmt)).scalars().first()

        # 5. Compute Score
        if profile_version == "v2":
            res = calculate_score_v2(
                videos_posted=videos_posted,
                total_views=total_views,
                avg_views=avg_views,
                orders_total=orders_total,
                settled_orders=settled_orders,
                settled_commission=settled_comm,
                pending_commission=pending_comm,
                cancelled_orders=cancelled_orders,
                prev_score=prev_score,
                margin_rate=prod.margin_rate,
            )
        else:
            res = calculate_score_v1(
                videos_posted=videos_posted,
                total_views=total_views,
                avg_views=avg_views,
                orders_total=orders_total,
                settled_orders=settled_orders,
                settled_commission=settled_comm,
                pending_commission=pending_comm,
                cancelled_orders=cancelled_orders,
                prev_score=prev_score,
            )

        card = Scorecard(
            period=period,
            product_id=prod.id,
            score=res["score"],
            tier=res["tier"],
            trend=res["trend"],
            components_json=json.dumps(res["components"]),
            profile_version=res["profile_version"],
            explanation=res["explanation"],
        )
        db.add(card)
        scorecards.append(card)

    await db.commit()
    return scorecards
