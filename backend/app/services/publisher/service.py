import os
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from backend.app.models.models import PlanSlot, RenderJob, Post, Product, Setting
from backend.app.services.captions.service import CaptionService
from backend.app.services.publisher.media_host import get_media_host, MediaHostProvider
from backend.app.services.publisher.buffer import BufferClient
from backend.app.core.logging import logger

class PublisherError(Exception):
    pass

class PublisherService:
    def __init__(
        self,
        buffer_client: Optional[BufferClient] = None,
        media_host: Optional[MediaHostProvider] = None,
    ):
        self.buffer_client = buffer_client or BufferClient()
        self.media_host = media_host or get_media_host()

    async def publish_slot(
        self,
        db: AsyncSession,
        slot_id: int,
        mode: str = "queue",
        channel_id: Optional[str] = None,
    ) -> Post:
        """
        Takes an approved and rendered PlanSlot, uploads the video asset to MediaHost,
        generates the Taglish caption with anti-repeat fingerprint, and publishes to Buffer.
        Idempotent: if already published, returns existing Post.
        """
        stmt = select(PlanSlot).where(PlanSlot.id == slot_id)
        slot = (await db.execute(stmt)).scalar_one_or_none()
        if not slot:
            raise PublisherError(f"PlanSlot #{slot_id} not found.")

        # Idempotency check: if already has post_id, retrieve and return
        if slot.post_id:
            p_stmt = select(Post).where(Post.id == slot.post_id)
            existing_post = (await db.execute(p_stmt)).scalar_one_or_none()
            if existing_post and existing_post.status in ("scheduled", "published"):
                logger.info("Slot already published, returning existing post", slot_id=slot_id, post_id=existing_post.id)
                return existing_post

        # Find associated render job
        r_stmt = select(RenderJob).where(RenderJob.plan_slot_id == slot.id).order_by(desc(RenderJob.id))
        job = (await r_stmt.scalar_one_or_none()) if hasattr(r_stmt, "scalar_one_or_none") else (await db.execute(r_stmt)).scalars().first()

        # Fallback to slot.render_id if set
        if not job and slot.render_id:
            r_stmt2 = select(RenderJob).where(RenderJob.id == slot.render_id)
            job = (await db.execute(r_stmt2)).scalar_one_or_none()

        video_path = job.output_path if job else None
        if not video_path or not os.path.exists(video_path):
            # If simulated or test run, create a lightweight dummy MP4 if needed
            if os.getenv("DEMO_MODE", "true").lower() in ("true", "1") or "test" in os.getenv("ENV", ""):
                os.makedirs("/tmp/autopilot_vids", exist_ok=True)
                video_path = f"/tmp/autopilot_vids/sample_slot_{slot.id}.mp4"
                if not os.path.exists(video_path):
                    with open(video_path, "wb") as f:
                        f.write(b"\x00" * 1024)
            else:
                raise PublisherError(f"Cannot publish slot #{slot_id}: render output file not found.")

        # Get Product display name
        prod_stmt = select(Product).where(Product.id == slot.product_id)
        prod = (await db.execute(prod_stmt)).scalar_one_or_none()
        product_name = prod.name if prod else f"Product {slot.product_id}"

        # 1. Generate Caption & Unique Fingerprint
        hook_text = slot.hook_text or slot.hook_style or "Super viral find!"
        caption, fingerprint = CaptionService.generate_caption(
            product_name=product_name,
            hook_text=hook_text,
            slot_id=slot.id,
        )

        # 2. Upload video to MediaHost
        media_url = await self.media_host.upload_video(video_path, public_id=f"autopilot_{slot.id}_{fingerprint[1:-1]}")

        # 3. Determine schedule time if in exact mode
        due_at = None
        if mode == "exact":
            now = datetime.now(timezone.utc)
            # slot.scheduled_time is "HH:MM", e.g. "09:00", "11:00"
            try:
                parts = slot.scheduled_time.split(":")
                hour, minute = int(parts[0]), int(parts[1])
                target = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
                if target <= now:
                    target += timedelta(days=1)
                due_at = target
            except Exception:
                due_at = now + timedelta(hours=2)

        # 4. Schedule via Buffer
        target_channel = channel_id or os.getenv("BUFFER_CHANNEL_ID", "default_channel")
        buffer_res = await self.buffer_client.create_post(
            channel_id=target_channel,
            text=caption,
            media_url=media_url,
            mode=mode,
            due_at=due_at,
        )

        # 5. Persist Post record
        post = Post(
            product_id=slot.product_id,
            render_id=job.id if job else None,
            buffer_post_id=buffer_res.get("id"),
            caption=caption,
            caption_fingerprint=fingerprint,
            hook_style=slot.hook_style,
            style_id=slot.style_id,
            media_url=media_url,
            mode=mode,
            scheduled_for=due_at,
            posted_at=datetime.utcnow(),
            status="scheduled",
        )
        db.add(post)
        await db.flush()

        # Update slot
        slot.post_id = post.id
        slot.status = "published"
        await db.commit()
        await db.refresh(post)

        # 6. Check delete_after_post setting
        del_stmt = select(Setting).where(Setting.key == "delete_after_post")
        del_setting = (await db.execute(del_stmt)).scalar_one_or_none()
        if del_setting and del_setting.value.lower() in ("true", "1"):
            await self.media_host.delete_video(media_url)
            logger.info("Deleted hosted media asset after scheduling per setting", media_url=media_url)

        logger.info("Published slot successfully", slot_id=slot_id, post_id=post.id, buffer_id=post.buffer_post_id)
        return post

    async def publish_all_rendered_slots(self, db: AsyncSession, mode: str = "queue") -> List[Post]:
        """
        Publishes all pending slots whose status is 'rendered' or 'approved' with an output video.
        """
        stmt = select(PlanSlot).where(
            PlanSlot.status.in_(["rendered", "approved"]),
            PlanSlot.post_id.is_(None)
        ).order_by(PlanSlot.slot_index)
        
        slots = (await db.execute(stmt)).scalars().all()
        published = []
        for s in slots:
            try:
                p = await self.publish_slot(db, s.id, mode=mode)
                published.append(p)
                # Small inter-post spacing delay
                await asyncio.sleep(0.5)
            except Exception as e:
                logger.error("Failed to publish slot", slot_id=s.id, error=str(e))
        return published

    async def regenerate_caption_for_post(
        self,
        db: AsyncSession,
        post_id: int,
        custom_cta: Optional[str] = None
    ) -> Post:
        """
        Regenerates a new unique Taglish caption and fingerprint for a Post.
        """
        stmt = select(Post).where(Post.id == post_id)
        post = (await db.execute(stmt)).scalar_one_or_none()
        if not post:
            raise PublisherError(f"Post #{post_id} not found.")

        product_name = f"Product {post.product_id}"
        if post.product_id:
            prod_stmt = select(Product).where(Product.id == post.product_id)
            prod = (await db.execute(prod_stmt)).scalar_one_or_none()
            if prod:
                product_name = prod.name

        new_caption, new_fp = CaptionService.generate_caption(
            product_name=product_name,
            hook_text=post.hook_style or "Amazing deal",
            slot_id=post.id,
            custom_cta=custom_cta,
        )

        post.caption = new_caption
        post.caption_fingerprint = new_fp
        await db.commit()
        await db.refresh(post)
        logger.info("Regenerated caption for post", post_id=post_id, fp=new_fp)
        return post
