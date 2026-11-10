import re
import hashlib
from typing import Optional, Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from backend.app.models.models import Post, Order

def generate_caption_fingerprint(caption: Optional[str]) -> str:
    """
    Generate normalized fingerprint of a video caption for robust attribution.
    Strips hashtags, URLs, emojis, and whitespace, hashing the core keywords.
    """
    if not caption:
        return ""

    # Remove hashtags and URLs
    clean = re.sub(r"#\S+", "", caption)
    clean = re.sub(r"https?://\S+", "", clean)
    # Strip non-alphanumeric characters
    clean = re.sub(r"[^\w\s]", "", clean.lower()).strip()
    # Normalize whitespaces
    tokens = [t for t in clean.split() if len(t) > 2] # Skip 1-2 char noise words
    normalized = " ".join(tokens[:15]) # Use first 15 keywords

    if not normalized:
        return ""
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:16]

async def match_order_caption_to_post(
    db: AsyncSession,
    raw_caption: Optional[str],
    product_id: Optional[int],
) -> Optional[int]:
    """
    Attempt to attribute an affiliate order to a published post using caption fingerprint.
    """
    if not raw_caption or not product_id:
        return None

    fp = generate_caption_fingerprint(raw_caption)
    if not fp:
        return None

    stmt = select(Post.id).where(
        and_(
            Post.product_id == product_id,
            Post.caption_fingerprint == fp,
        )
    )
    matched_id = (await db.execute(stmt)).scalars().first()
    return matched_id

async def get_post_attribution_summary(
    db: AsyncSession,
    post_id: int,
) -> Dict[str, Any]:
    """Calculate aggregated orders, GMV, and commission attributed to a post."""
    stmt = select(
        func.count(Order.id).label("orders_count"),
        func.sum(Order.gmv).label("total_gmv"),
        func.sum(Order.est_commission).label("total_est_comm"),
        func.sum(Order.actual_commission).label("total_actual_comm"),
    ).where(Order.matched_post_id == post_id)

    row = (await db.execute(stmt)).first()
    if not row:
        return {"orders_count": 0, "gmv": 0.0, "est_commission": 0.0, "actual_commission": 0.0}

    return {
        "orders_count": row.orders_count or 0,
        "gmv": round(row.total_gmv or 0.0, 2),
        "est_commission": round(row.total_est_comm or 0.0, 2),
        "actual_commission": round(row.total_actual_comm or 0.0, 2),
    }
