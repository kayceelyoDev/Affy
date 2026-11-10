from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func

from backend.app.core.database import get_db
from backend.app.models.models import Post, Product, RenderJob, PlanSlot, User
from backend.app.api.auth import get_current_user
from backend.app.services.publisher.service import PublisherService
from backend.app.services.captions.service import HookLearningEngine
from backend.app.core.logging import logger

router = APIRouter(prefix="/posts", tags=["posts"])
publisher_service = PublisherService()

class PostResponse(BaseModel):
    id: int
    product_id: Optional[int] = None
    product_name: Optional[str] = None
    render_id: Optional[int] = None
    buffer_post_id: Optional[str] = None
    tiktok_video_id: Optional[str] = None
    caption: Optional[str] = None
    caption_fingerprint: Optional[str] = None
    hook_style: Optional[str] = None
    style_id: Optional[str] = None
    media_url: Optional[str] = None
    mode: str
    scheduled_for: Optional[datetime] = None
    posted_at: Optional[datetime] = None
    status: str
    created_at: datetime

class PostListResponse(BaseModel):
    posts: List[PostResponse]
    total_count: int
    total_published: int
    total_scheduled: int

class RegenerateCaptionRequest(BaseModel):
    custom_cta: Optional[str] = None

class PublishSlotRequest(BaseModel):
    slot_id: int
    mode: str = "queue" # queue or exact
    channel_id: Optional[str] = None

@router.get("", response_model=PostListResponse)
async def list_posts(
    product_id: Optional[int] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(Post).order_by(desc(Post.created_at))
    if product_id:
        stmt = stmt.where(Post.product_id == product_id)
    if status_filter:
        stmt = stmt.where(Post.status == status_filter)

    count_stmt = select(func.count(Post.id))
    if product_id:
        count_stmt = count_stmt.where(Post.product_id == product_id)
    if status_filter:
        count_stmt = count_stmt.where(Post.status == status_filter)

    total_count = (await db.execute(count_stmt)).scalar() or 0

    pub_count_stmt = select(func.count(Post.id)).where(Post.status == "published")
    total_published = (await db.execute(pub_count_stmt)).scalar() or 0

    sched_count_stmt = select(func.count(Post.id)).where(Post.status == "scheduled")
    total_scheduled = (await db.execute(sched_count_stmt)).scalar() or 0

    posts_records = (await db.execute(stmt.offset(offset).limit(limit))).scalars().all()

    # Pre-fetch product names
    product_ids = [p.product_id for p in posts_records if p.product_id]
    prod_map = {}
    if product_ids:
        p_stmt = select(Product).where(Product.id.in_(product_ids))
        prods = (await db.execute(p_stmt)).scalars().all()
        prod_map = {p.id: p.name for p in prods}

    results = []
    for p in posts_records:
        results.append(PostResponse(
            id=p.id,
            product_id=p.product_id,
            product_name=prod_map.get(p.product_id, f"Product #{p.product_id}" if p.product_id else "Unassigned"),
            render_id=p.render_id,
            buffer_post_id=p.buffer_post_id,
            tiktok_video_id=p.tiktok_video_id,
            caption=p.caption,
            caption_fingerprint=p.caption_fingerprint,
            hook_style=p.hook_style,
            style_id=p.style_id,
            media_url=p.media_url,
            mode=p.mode or "queue",
            scheduled_for=p.scheduled_for,
            posted_at=p.posted_at,
            status=p.status,
            created_at=p.created_at,
        ))

    return PostListResponse(
        posts=results,
        total_count=total_count,
        total_published=total_published,
        total_scheduled=total_scheduled,
    )

@router.get("/hooks/performance")
async def get_hook_leaderboard(
    product_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Returns hook style conversion rate, revenue yield, and multi-armed bandit score."""
    perf = await HookLearningEngine.get_hook_performance(db, product_id)
    return {"hooks": perf}

@router.get("/{post_id}", response_model=PostResponse)
async def get_post_detail(
    post_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(Post).where(Post.id == post_id)
    post = (await db.execute(stmt)).scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    prod_name = None
    if post.product_id:
        p_stmt = select(Product).where(Product.id == post.product_id)
        prod = (await db.execute(p_stmt)).scalar_one_or_none()
        prod_name = prod.name if prod else None

    return PostResponse(
        id=post.id,
        product_id=post.product_id,
        product_name=prod_name,
        render_id=post.render_id,
        buffer_post_id=post.buffer_post_id,
        tiktok_video_id=post.tiktok_video_id,
        caption=post.caption,
        caption_fingerprint=post.caption_fingerprint,
        hook_style=post.hook_style,
        style_id=post.style_id,
        media_url=post.media_url,
        mode=post.mode or "queue",
        scheduled_for=post.scheduled_for,
        posted_at=post.posted_at,
        status=post.status,
        created_at=post.created_at,
    )

@router.post("/publish-all")
async def publish_all_rendered(
    mode: str = "queue",
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Workflow 4 (Drive to Buffer v4.0) trigger:
    Publishes all rendered slots to Buffer queue, uploads videos to MediaHost,
    and generates Taglish captions with unique attribution fingerprints.
    """
    try:
        posts = await publisher_service.publish_all_rendered_slots(db=db, mode=mode)
        return {
            "ok": True,
            "message": f"Successfully published/scheduled {len(posts)} posts to Buffer.",
            "published_count": len(posts),
            "posts": [p.id for p in posts],
        }
    except Exception as e:
        logger.error("Batch publish failed", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/publish-slot", response_model=PostResponse)
async def publish_plan_slot(
    req: PublishSlotRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Uploads rendered video to MediaHost and creates a scheduled post on Buffer."""
    try:
        post = await publisher_service.publish_slot(
            db=db,
            slot_id=req.slot_id,
            mode=req.mode,
            channel_id=req.channel_id,
        )
        return PostResponse(
            id=post.id,
            product_id=post.product_id,
            render_id=post.render_id,
            buffer_post_id=post.buffer_post_id,
            tiktok_video_id=post.tiktok_video_id,
            caption=post.caption,
            caption_fingerprint=post.caption_fingerprint,
            hook_style=post.hook_style,
            style_id=post.style_id,
            media_url=post.media_url,
            mode=post.mode or "queue",
            scheduled_for=post.scheduled_for,
            posted_at=post.posted_at,
            status=post.status,
            created_at=post.created_at,
        )
    except Exception as e:
        logger.error("Publish slot failed", slot_id=req.slot_id, error=str(e))
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/{post_id}/regenerate-caption", response_model=PostResponse)
async def regenerate_caption(
    post_id: int,
    req: Optional[RegenerateCaptionRequest] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Regenerates a new unique Taglish caption and attribution fingerprint."""
    try:
        cta = req.custom_cta if req else None
        updated_post = await publisher_service.regenerate_caption_for_post(db, post_id, custom_cta=cta)
        return PostResponse(
            id=updated_post.id,
            product_id=updated_post.product_id,
            render_id=updated_post.render_id,
            buffer_post_id=updated_post.buffer_post_id,
            tiktok_video_id=updated_post.tiktok_video_id,
            caption=updated_post.caption,
            caption_fingerprint=updated_post.caption_fingerprint,
            hook_style=updated_post.hook_style,
            style_id=updated_post.style_id,
            media_url=updated_post.media_url,
            mode=updated_post.mode or "queue",
            scheduled_for=updated_post.scheduled_for,
            posted_at=updated_post.posted_at,
            status=updated_post.status,
            created_at=updated_post.created_at,
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
