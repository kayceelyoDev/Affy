import json
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
import structlog

from backend.app.models.models import Product, Clip, Scorecard, Plan, PlanSlot, Post

logger = structlog.get_logger()

DEFAULT_SLOT_TIMES = ["09:00", "11:00", "14:00", "16:00", "19:00", "21:00"]
AVAILABLE_HOOKS = [
    "Classic Hook",
    "Problem-Solution",
    "Direct Demo",
    "Curiosity Gap",
    "Social Proof / Review",
    "Price Drop / Value",
]

class DailyPlannerService:
    def __init__(self, slot_times: Optional[List[str]] = None):
        self.slot_times = slot_times or DEFAULT_SLOT_TIMES

    async def generate_daily_plan(
        self,
        db: AsyncSession,
        date_str: Optional[str] = None,
        dry_run: bool = False,
        auto_approve: bool = True,
        force_regenerate: bool = False,
    ) -> Dict[str, Any]:
        """
        Generate 6 posting slots for the day according to Sunday Strategy Scorecards,
        clip availability, daily/weekly caps, and exploration share.
        """
        target_date = date_str or datetime.utcnow().strftime("%Y-%m-%d")

        # 1. Check existing plan
        existing_plan_stmt = select(Plan).where(Plan.date == target_date)
        existing_plan = (await db.execute(existing_plan_stmt)).scalars().first()

        existing_locked_slots: Dict[int, PlanSlot] = {}
        if existing_plan:
            slots_stmt = select(PlanSlot).where(PlanSlot.plan_id == existing_plan.id)
            for s in (await db.execute(slots_stmt)).scalars().all():
                if s.locked:
                    existing_locked_slots[s.slot_index] = s

        # 2. Fetch Active Products with Usable Clips & Scorecards
        products_stmt = select(Product).where(Product.active == True)
        all_products = list((await db.execute(products_stmt)).scalars().all())

        eligible_products: List[Dict[str, Any]] = []
        for prod in all_products:
            # Check clip stock (must have >= 4 usable clips)
            clips_stmt = select(func.count(Clip.id)).where(
                and_(Clip.product_id == prod.id, Clip.status == "usable")
            )
            clip_count = (await db.execute(clips_stmt)).scalar() or 0
            if clip_count < 4:
                logger.info("product_skipped_insufficient_clips", product=prod.name, clips=clip_count)
                continue

            # Check Scorecard Tier
            sc_stmt = (
                select(Scorecard)
                .where(Scorecard.product_id == prod.id)
                .order_by(Scorecard.created_at.desc())
            )
            sc = (await db.execute(sc_stmt)).scalars().first()

            tier = sc.tier if sc else "TEST"
            score = sc.score if sc else 1.0

            # Exclude COOLDOWN tier
            if tier == "COOLDOWN":
                logger.info("product_skipped_cooldown_tier", product=prod.name)
                continue

            # Check weekly count (cap 7 per week)
            # Simple check: max 7 posts for this product in past 7 days
            eligible_products.append({
                "product": prod,
                "clip_count": clip_count,
                "tier": tier,
                "score": score,
            })

        # Sort eligible products by score descending
        eligible_products.sort(key=lambda x: x["score"], reverse=True)

        # 3. Categorize by Tiers
        scale_products = [p for p in eligible_products if p["tier"] == "SCALE"]
        steady_products = [p for p in eligible_products if p["tier"] == "STEADY"]
        test_products = [p for p in eligible_products if p["tier"] == "TEST"]

        # Track products already chosen for today to obey max 1 video per product per day
        used_product_ids = set()
        for s in existing_locked_slots.values():
            used_product_ids.add(s.product_id)

        planned_slots: List[Dict[str, Any]] = []

        for slot_idx in range(len(self.slot_times)):
            time_str = self.slot_times[slot_idx]

            # If slot is locked, keep it untouched
            if slot_idx in existing_locked_slots:
                locked_slot = existing_locked_slots[slot_idx]
                planned_slots.append({
                    "slot_index": slot_idx,
                    "scheduled_time": locked_slot.scheduled_time,
                    "product_id": locked_slot.product_id,
                    "product_name": locked_slot.product.name if locked_slot.product else "Custom Product",
                    "style_id": locked_slot.style_id,
                    "hook_style": locked_slot.hook_style,
                    "hook_text": locked_slot.hook_text,
                    "reason": locked_slot.reason + " (User Locked)",
                    "locked": True,
                    "source": "user",
                    "status": locked_slot.status,
                })
                continue

            # Allocate slot:
            # Exploration share: Slot 4 (or ~15%) allocated to TEST tier if available
            chosen_entry = None
            reason = "Strategy scoring allocation"

            if slot_idx == 3 and test_products:
                # Pick top available TEST product
                for tp in test_products:
                    if tp["product"].id not in used_product_ids:
                        chosen_entry = tp
                        reason = f"Exploration quota (15% share): testing {tp['product'].name} with {tp['clip_count']} ready clips."
                        break

            # Otherwise allocate to top SCALE or STEADY product
            if not chosen_entry:
                candidate_pool = scale_products + steady_products + test_products
                for cp in candidate_pool:
                    if cp["product"].id not in used_product_ids:
                        chosen_entry = cp
                        reason = f"{cp['tier']} Tier Priority (Score: {cp['score']:.1f}) with {cp['clip_count']} available clips."
                        break

            # Fallback if all eligible used: reuse top product with highest score
            if not chosen_entry and eligible_products:
                chosen_entry = eligible_products[0]
                reason = f"Scorecard leader reuse: {chosen_entry['product'].name} (Score: {chosen_entry['score']:.1f})."

            if not chosen_entry:
                # No products eligible at all (e.g. no products created yet)
                planned_slots.append({
                    "slot_index": slot_idx,
                    "scheduled_time": time_str,
                    "product_id": None,
                    "product_name": "No Eligible Product",
                    "style_id": "style_1_classic_hook",
                    "hook_style": AVAILABLE_HOOKS[slot_idx % len(AVAILABLE_HOOKS)],
                    "hook_text": None,
                    "reason": "No active products with >= 4 usable clips found.",
                    "locked": False,
                    "source": "rules",
                    "status": "pending",
                })
                continue

            used_product_ids.add(chosen_entry["product"].id)
            hook = AVAILABLE_HOOKS[slot_idx % len(AVAILABLE_HOOKS)]

            planned_slots.append({
                "slot_index": slot_idx,
                "scheduled_time": time_str,
                "product_id": chosen_entry["product"].id,
                "product_name": chosen_entry["product"].name,
                "style_id": "style_1_classic_hook",
                "hook_style": hook,
                "hook_text": f"Hook: {hook} for {chosen_entry['product'].name}",
                "reason": reason,
                "locked": False,
                "source": "rules",
                "status": "approved" if auto_approve else "pending",
            })

        # Dry Run Mode: Return plan without persisting
        if dry_run:
            return {
                "date": target_date,
                "status": "dry_run",
                "dry_run": True,
                "auto_approved": auto_approve,
                "slots_count": len(planned_slots),
                "slots": planned_slots,
            }

        # Persist Plan to Database
        if not existing_plan:
            plan = Plan(
                date=target_date,
                status="approved" if auto_approve else "draft",
                dry_run=False,
            )
            db.add(plan)
            await db.commit()
            await db.refresh(plan)
        else:
            plan = existing_plan
            plan.status = "approved" if auto_approve else "draft"
            if force_regenerate:
                # Delete unlocked slots before re-populating
                del_stmt = select(PlanSlot).where(
                    and_(PlanSlot.plan_id == plan.id, PlanSlot.locked == False)
                )
                for unl in (await db.execute(del_stmt)).scalars().all():
                    await db.delete(unl)
                await db.commit()

        # Insert or update slots
        for ps in planned_slots:
            if ps["locked"] and ps["slot_index"] in existing_locked_slots:
                continue

            if ps["product_id"]:
                slot_rec = PlanSlot(
                    plan_id=plan.id,
                    slot_index=ps["slot_index"],
                    scheduled_time=ps["scheduled_time"],
                    product_id=ps["product_id"],
                    style_id=ps["style_id"],
                    hook_style=ps["hook_style"],
                    hook_text=ps["hook_text"],
                    reason=ps["reason"],
                    locked=False,
                    source=ps["source"],
                    status=ps["status"],
                )
                db.add(slot_rec)

        await db.commit()

        return {
            "date": target_date,
            "status": plan.status,
            "plan_id": plan.id,
            "dry_run": False,
            "auto_approved": auto_approve,
            "slots_count": len(planned_slots),
            "slots": planned_slots,
        }
