import json
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from backend.app.core.database import get_db
from backend.app.models.models import Order, Post, Product, Scorecard, PostMetricDaily, APIUsage
from backend.app.services.analytics.scoring import run_product_scoring

router = APIRouter(prefix="/api/analytics", tags=["Analytics & Scoring"])

@router.get("/overview")
async def get_analytics_overview(
    db: AsyncSession = Depends(get_db),
):
    """Overall creator metrics, conversion efficiency, and cashflow ledger."""
    # Orders & Commissions
    orders_stmt = select(Order)
    orders = list((await db.execute(orders_stmt)).scalars().all())

    total_orders = len([o for o in orders if o.status_stage not in ["cancelled", "refunded", "unpaid"]])
    cancelled_orders = len([o for o in orders if o.status_stage == "cancelled"])
    total_with_cancelled = total_orders + cancelled_orders
    cancel_rate = (cancelled_orders / total_with_cancelled) if total_with_cancelled > 0 else 0.0

    total_gmv = sum(o.gmv for o in orders if o.status_stage != "cancelled")
    settled_payouts = sum(o.actual_commission or o.est_commission or 0.0 for o in orders if o.status_stage == "settled")
    settling_soon = sum(o.est_commission or 0.0 for o in orders if o.status_stage in ["shipped", "delivered"])
    unsettled_pending = sum(o.est_commission or 0.0 for o in orders if o.status_stage == "to_ship")

    # Pending adjusted by cancel rate
    risk_adjusted_pending = (settling_soon + unsettled_pending) * (1.0 - cancel_rate)

    # Views & Posts
    views_stmt = select(func.sum(PostMetricDaily.views))
    total_views = (await db.execute(views_stmt)).scalar() or 0

    posts_count_stmt = select(func.count(Post.id))
    total_videos = (await db.execute(posts_count_stmt)).scalar() or 0

    # Conversions
    orders_per_1k = (total_orders / (total_views / 1000.0)) if total_views > 0 else (total_orders * 1.5)
    comm_per_video = (settled_payouts / max(1, total_videos)) if total_videos > 0 else 0.0

    return {
        "total_views": total_views,
        "total_videos": total_videos,
        "total_orders": total_orders,
        "total_gmv": round(total_gmv, 2),
        "orders_per_1000_views": round(orders_per_1k, 2),
        "commission_per_video": round(comm_per_video, 2),
        "cancel_rate_pct": round(cancel_rate * 100, 2),
        "cashflow": {
            "settled": round(settled_payouts, 2),
            "settling_soon": round(settling_soon, 2),
            "pending_raw": round(settling_soon + unsettled_pending, 2),
            "risk_adjusted_pending": round(risk_adjusted_pending, 2),
        },
    }

@router.get("/scorecards")
async def list_scorecards(
    period: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Scorecard, Product.name.label("product_name"))
        .join(Product, Scorecard.product_id == Product.id)
    )
    if period:
        stmt = stmt.where(Scorecard.period == period)
    stmt = stmt.order_by(Scorecard.score.desc())

    rows = (await db.execute(stmt)).all()
    items = []
    for sc, p_name in rows:
        comp = {}
        if sc.components_json:
            try:
                comp = json.loads(sc.components_json)
            except Exception:
                pass
        items.append({
            "id": sc.id,
            "period": sc.period,
            "product_id": sc.product_id,
            "product_name": p_name,
            "score": sc.score,
            "tier": sc.tier,
            "trend": sc.trend,
            "profile_version": sc.profile_version,
            "explanation": sc.explanation,
            "components": comp,
            "created_at": sc.created_at.isoformat() if sc.created_at else None,
        })
    return {"scorecards": items}

@router.post("/scorecards/run")
async def run_scoring_job(
    period: str = "weekly",
    profile_version: str = "v1",
    db: AsyncSession = Depends(get_db),
):
    """Trigger Sunday Strategy Engine scoring run for all active products."""
    cards = await run_product_scoring(db, period=period, profile_version=profile_version)
    return {"status": "completed", "scorecards_generated": len(cards)}

@router.get("/styles")
async def get_styles_performance(
    db: AsyncSession = Depends(get_db),
):
    """Aggregated performance metrics grouped by hook style."""
    stmt = (
        select(
            Post.hook_style,
            func.count(Post.id).label("videos_count"),
            func.sum(PostMetricDaily.views).label("total_views"),
        )
        .outerjoin(PostMetricDaily, Post.id == PostMetricDaily.post_id)
        .group_by(Post.hook_style)
    )
    rows = (await db.execute(stmt)).all()

    styles = []
    for hook, count, views in rows:
        hook_name = hook or "Classic Hook"
        tot_views = views or 0
        styles.append({
            "hook_style": hook_name,
            "videos_count": count,
            "total_views": tot_views,
            "avg_views_per_video": round(tot_views / max(1, count), 1),
        })

    return {"styles": styles}
