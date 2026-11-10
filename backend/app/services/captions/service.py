import re
import random
import uuid
from typing import Optional, List, Tuple, Dict, Any
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc

from backend.app.models.models import Post, PostMetricDaily, Order, Setting
from backend.app.core.logging import logger

DEFAULT_BANNED_CLAIMS = [
    "cure",
    "gamot",
    "pang-pagaling",
    "100% guarantee",
    "guaranteed",
    "miracle",
    "fda approved",
    "slimming",
    "weight loss",
    "instant whitening",
    "pampaputi agad",
    "money back guarantee",
    "zero risk",
    "no side effects",
]

DEFAULT_HOOK_STYLES = [
    "Classic Hook",
    "Problem-Solution",
    "Curiosity Gap",
    "Secret Hack",
    "Before-After",
    "Price-Drop Alert",
    "Direct Recommendation",
]

DEFAULT_CTA = "Check the yellow basket below! 👇"
DEFAULT_HASHTAGS = "#fyp #tiktokshop #tiktokmademebuyit #budolfinds"

TAGLISH_TEMPLATES = [
    "{fingerprint} {hook_text}! 🔥 Legit na legit itong {product_name}. Sobrang sulit ng quality, promise! {cta} {hashtags}",
    "{fingerprint} Ito na ang sign mo! {hook_text}! ✨ Grabe ang convenience ng {product_name}. Highly recommended! {cta} {hashtags}",
    "{fingerprint} Bakit ngayon ko lang nalaman to?! {hook_text}! 😱 Sobrang ganda ng {product_name}, must-have talaga! {cta} {hashtags}",
    "{fingerprint} Viral find alert! {hook_text}! 💯 Tested and proven ang {product_name}. Wag pahuli guys! {cta} {hashtags}",
    "{fingerprint} Honest review: {hook_text}! 🙌 Napaka-useful ng {product_name} sa daily routine ko. {cta} {hashtags}",
]

class CaptionService:
    @staticmethod
    def generate_fingerprint(slot_id: Optional[int] = None, salt: Optional[str] = None) -> str:
        """
        Generates a unique, normalized fingerprint that starts the caption
        for deterministic order-to-post attribution matching (section 5.3 item 6).
        """
        sid = slot_id if slot_id is not None else random.randint(100, 999)
        code = salt if salt else uuid.uuid4().hex[:4].upper()
        return f"[TTC-{sid:03d}-{code}]"

    @staticmethod
    def filter_banned_claims(text: str, banned_list: Optional[List[str]] = None) -> Tuple[str, List[str]]:
        """
        Scans text for banned marketing claims and sanitizes them.
        Returns (sanitized_text, list_of_detected_violations).
        """
        active_banned = banned_list or DEFAULT_BANNED_CLAIMS
        detected = []
        sanitized = text

        for claim in active_banned:
            pattern = re.compile(r'\b' + re.escape(claim) + r'\b', re.IGNORECASE)
            if pattern.search(sanitized):
                detected.append(claim)
                # Sanitize by replacing with generic safe term
                sanitized = pattern.sub("proven quality", sanitized)

        return sanitized, detected

    @classmethod
    def generate_caption(
        cls,
        product_name: str,
        hook_text: str,
        slot_id: Optional[int] = None,
        custom_cta: Optional[str] = None,
        banned_list: Optional[List[str]] = None,
        fingerprint: Optional[str] = None,
    ) -> Tuple[str, str]:
        """
        Generates a high-converting Taglish caption with hook, unique fingerprint,
        product benefits, CTA, and hashtag stack. Sanitizes against banned claims.
        """
        fp = fingerprint or cls.generate_fingerprint(slot_id)
        cta = custom_cta or DEFAULT_CTA
        
        # Select random Taglish template
        template = random.choice(TAGLISH_TEMPLATES)
        raw_caption = template.format(
            fingerprint=fp,
            hook_text=hook_text.strip(),
            product_name=product_name.strip(),
            cta=cta,
            hashtags=DEFAULT_HASHTAGS,
        )

        sanitized_caption, violations = cls.filter_banned_claims(raw_caption, banned_list)
        if violations:
            logger.warning("Sanitized banned claims in caption", violations=violations, fp=fp)

        return sanitized_caption, fp


class HookLearningEngine:
    @staticmethod
    async def get_hook_performance(db: AsyncSession, product_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Aggregates historical performance per hook style:
        views, orders, commission, and calculated conversion score.
        """
        query = select(
            Post.hook_style,
            func.count(func.distinct(Post.id)).label("total_posts"),
            func.coalesce(func.sum(PostMetricDaily.views), 0).label("total_views"),
            func.coalesce(func.count(func.distinct(Order.id)), 0).label("total_orders"),
            func.coalesce(func.sum(func.coalesce(Order.actual_commission, Order.est_commission, 0.0)), 0.0).label("total_commission"),
        ).outerjoin(PostMetricDaily, Post.id == PostMetricDaily.post_id
        ).outerjoin(Order, Post.id == Order.matched_post_id)

        if product_id:
            query = query.where(Post.product_id == product_id)

        query = query.where(Post.hook_style.isnot(None)).group_by(Post.hook_style)
        
        results = (await db.execute(query)).all()
        
        stats = []
        for row in results:
            hook_style = row.hook_style or "Classic Hook"
            posts = row.total_posts or 0
            views = row.total_views or 0
            orders = row.total_orders or 0
            comm = float(row.total_commission or 0.0)

            # Orders per 1,000 views
            views_in_k = max(1.0, views / 1000.0)
            orders_per_1k = orders / views_in_k if views > 0 else (orders * 1.5)
            avg_comm = comm / max(1, posts)

            # Composite learning score (60% revenue weight, 40% conversion weight)
            score = round((avg_comm * 0.6) + (orders_per_1k * 4.0), 2)

            stats.append({
                "hook_style": hook_style,
                "total_posts": posts,
                "total_views": views,
                "total_orders": orders,
                "total_commission": round(comm, 2),
                "orders_per_1000_views": round(orders_per_1k, 2),
                "avg_commission_per_post": round(avg_comm, 2),
                "score": score,
            })

        # Sort descending by score
        stats.sort(key=lambda x: x["score"], reverse=True)
        return stats

    @classmethod
    async def recommend_hook(
        cls,
        db: AsyncSession,
        product_id: Optional[int] = None,
        available_hooks: Optional[List[str]] = None,
        exploration_rate: float = 0.15
    ) -> str:
        """
        Learned hook selector with multi-armed bandit exploration (15% exploration quota)
        to discover winning angles while exploiting historical high-converting hooks.
        """
        hooks = available_hooks or DEFAULT_HOOK_STYLES
        perf = await cls.get_hook_performance(db, product_id)

        # 15% exploration: pick uniformly from all available hooks
        if random.random() < exploration_rate or not perf:
            chosen = random.choice(hooks)
            logger.info("Hook selected via exploration quota", hook=chosen)
            return chosen

        # 85% exploitation: pick top-ranked hook from historical data
        top_hook = perf[0]["hook_style"]
        if top_hook in hooks:
            logger.info("Hook selected via exploitation ranking", hook=top_hook, score=perf[0]["score"])
            return top_hook

        return random.choice(hooks)
