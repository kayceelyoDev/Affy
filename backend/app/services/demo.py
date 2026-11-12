"""
Synthetic Demo Mode Seeder
Provides realistic synthetic creator data (products, clips, orders, scorecards, daily plans)
so users and open-source contributors can explore all features of Affiliate Autopilot
without requiring live third-party API keys or real affiliate credentials.
"""

import json
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.models import (
    Product, Clip, Alias, Order, SalesDaily, Scorecard, Plan, PlanSlot, Track, User
)
from backend.app.core.security import hash_password

DEMO_PRODUCTS = [
    {
        "name": "RGB Mechanical Keyboard - InPlay",
        "category": "Gaming & Tech",
        "commission_rate": 0.08,
        "margin_rate": 0.35,
        "tier": "SCALE",
        "score": 850.5,
    },
    {
        "name": "Dynamic Podcast Microphone - Maono",
        "category": "Audio & Video",
        "commission_rate": 0.07,
        "margin_rate": 0.30,
        "tier": "SCALE",
        "score": 620.0,
    },
    {
        "name": "Laptop Cooling Pad Stand - InPlay",
        "category": "Office & Desk",
        "commission_rate": 0.10,
        "margin_rate": 0.40,
        "tier": "STEADY",
        "score": 480.2,
    },
    {
        "name": "65W GaN Fast Charger - Tranyo",
        "category": "Mobile Accessories",
        "commission_rate": 0.05,
        "margin_rate": 0.25,
        "tier": "TEST",
        "score": 210.0,
    },
    {
        "name": "Dual Dynamic In-Ear Monitor - Popcorn",
        "category": "Audio & Video",
        "commission_rate": 0.06,
        "margin_rate": 0.28,
        "tier": "TEST",
        "score": 195.0,
    },
    {
        "name": "Mini High-Speed Turbo Fan - Goojodoq",
        "category": "Lifestyle & Travel",
        "commission_rate": 0.08,
        "margin_rate": 0.32,
        "tier": "STEADY",
        "score": 410.0,
    },
]

DEMO_HOOKS = [
    ("Classic Hook", "Stop scrolling if your audio still sounds like a tin can!"),
    ("Problem-Solution", "Tired of your laptop overheating during long gaming sessions?"),
    ("Curiosity Gap", "This tiny gadget might be the best 500 pesos I've spent this year."),
    ("Direct Demo", "Watch what happens when we test this mic right next to an electric fan."),
    ("Social Proof / Review", "Over 10,000 creators swear by this keyboard, and here is why."),
    ("Price Drop / Value", "Premium mechanical switches without the premium price tag."),
]


class DemoSeeder:
    @staticmethod
    async def seed_demo_data(session: AsyncSession) -> Dict[str, Any]:
        """Seeds full synthetic creator dataset idempotently."""
        stats = {
            "products": 0,
            "clips": 0,
            "orders": 0,
            "scorecards": 0,
            "plans": 0,
            "tracks": 0,
        }

        # 1. Admin User
        user_res = await session.execute(select(User).where(User.username == "demo_admin"))
        if not user_res.scalars().first():
            demo_user = User(
                username="demo_admin",
                password_hash=hash_password("demo1234"),
            )
            session.add(demo_user)

        # 2. Products and Clips
        created_products = []
        for p_info in DEMO_PRODUCTS:
            prod_res = await session.execute(select(Product).where(Product.name == p_info["name"]))
            prod = prod_res.scalars().first()
            if not prod:
                prod = Product(
                    name=p_info["name"],
                    folder_path=p_info["name"].replace(" ", "_"),
                    category=p_info["category"],
                    commission_rate=p_info["commission_rate"],
                    margin_rate=p_info["margin_rate"],
                    active=True,
                )
                session.add(prod)
                await session.flush()
                stats["products"] += 1

                # Add 6 synthetic clips
                for c_idx in range(6):
                    clip = Clip(
                        product_id=prod.id,
                        file_path=f"/data/clips/{prod.folder_path}/clip_00{c_idx+1}.mp4",
                        filename=f"clip_00{c_idx+1}.mp4",
                        duration_seconds=5.5,
                        width=1080,
                        height=1920,
                        fps=30.0,
                        codec="h264",
                        status="usable",
                    )
                    session.add(clip)
                    stats["clips"] += 1

                # Add alias
                alias = Alias(
                    product_id=prod.id,
                    raw_alias=f"{p_info['name']} Official TikTok Store",
                    normalized_alias=f"{p_info['name'].lower()} official tiktok store",
                    confidence=1.0,
                    status="linked",
                )
                session.add(alias)
            created_products.append(prod)

        # 3. Synthetic Orders (20 realistic orders across stages)
        stages = ["SETTLED", "DELIVERED_PENDING", "PAID_IN_TRANSIT", "UNPAID", "CANCELLED"]
        today = datetime.now(timezone.utc)
        for i in range(20):
            ord_id = f"585999000111222{i:03d}"
            ord_res = await session.execute(select(Order).where(Order.order_id == ord_id))
            if not ord_res.scalars().first():
                target_prod = created_products[i % len(created_products)]
                stage = stages[i % len(stages)]
                price = 350.0 + (i * 25.0)
                gmv = price
                comm_rate = target_prod.commission_rate
                est_comm = round(gmv * comm_rate, 2)
                act_comm = est_comm if stage == "SETTLED" else (0.0 if stage == "CANCELLED" else None)
                
                order = Order(
                    order_id=ord_id,
                    status_stage=stage,
                    product_id=target_prod.id,
                    product_name_raw=f"{target_prod.name} (Batch #{i+1})",
                    price=price,
                    quantity=1,
                    gmv=gmv,
                    commission_rate=comm_rate,
                    est_commission=est_comm,
                    actual_commission=act_comm,
                    settle_date_est=(today + timedelta(days=3)).strftime("%Y-%m-%d"),
                    settle_date_changes=0,
                    is_shop_ads=(i % 3 == 0),
                    order_date=(today - timedelta(days=i % 7)).strftime("%Y-%m-%d"),
                )
                session.add(order)
                stats["orders"] += 1

        # 4. Scorecards
        week_str = today.strftime("%Y-%m-%d")
        for p_info, prod in zip(DEMO_PRODUCTS, created_products):
            sc_res = await session.execute(
                select(Scorecard).where(
                    Scorecard.period == week_str,
                    Scorecard.product_id == prod.id,
                )
            )
            if not sc_res.scalars().first():
                sc = Scorecard(
                    period=week_str,
                    product_id=prod.id,
                    score=p_info["score"],
                    tier=p_info["tier"],
                    trend="UP" if p_info["tier"] == "SCALE" else "STABLE",
                    components_json=json.dumps({
                        "orders_total": 8 if p_info["tier"] == "SCALE" else 3,
                        "gmv_total": 3500.0 if p_info["tier"] == "SCALE" else 1200.0,
                        "cancel_rate": 0.05,
                    }),
                    profile_version="v2",
                    explanation=f"Demo score based on {p_info['tier']} status",
                )
                session.add(sc)
                stats["scorecards"] += 1

        # 5. Today's Daily Plan (6 slots)
        plan_date = today.strftime("%Y-%m-%d")
        plan_res = await session.execute(select(Plan).where(Plan.date == plan_date))
        plan = plan_res.scalars().first()
        if not plan:
            plan = Plan(date=plan_date, status="approved", dry_run=False)
            session.add(plan)
            await session.flush()
            stats["plans"] += 1

            slot_times = ["09:00", "11:00", "14:00", "16:00", "19:00", "21:00"]
            for idx in range(6):
                target_prod = created_products[idx % len(created_products)]
                hook_style, hook_text = DEMO_HOOKS[idx % len(DEMO_HOOKS)]
                slot = PlanSlot(
                    plan_id=plan.id,
                    slot_index=idx,
                    scheduled_time=slot_times[idx],
                    product_id=target_prod.id,
                    style_id="classic_hook",
                    hook_style=hook_style,
                    hook_text=hook_text,
                    reason=f"Top candidate ({DEMO_PRODUCTS[idx]['tier']} tier)",
                    locked=False,
                    source="rules",
                    status="pending",
                )
                session.add(slot)

        # 6. Demo Background Tracks
        demo_tracks = [
            ("Uptempo Tech Pop Beat", "tech_pop_124bpm.mp3", 124.0, 15.0),
            ("Chill Lo-Fi Product Showcase", "lofi_chill_95bpm.mp3", 95.0, 15.0),
            ("High-Energy Commercial Stomp", "stomp_energy_130bpm.mp3", 130.0, 15.0),
        ]
        for t_title, t_fn, bpm, dur in demo_tracks:
            t_res = await session.execute(select(Track).where(Track.filename == t_fn))
            if not t_res.scalars().first():
                track = Track(
                    title=t_title,
                    filename=t_fn,
                    storage_path=f"/data/music/{t_fn}",
                    duration=dur,
                    bpm=bpm,
                    beats_count=int(dur * (bpm / 60.0)),
                    safe_to_use=True,
                    tags="electronic, modern, upbeat",
                )
                session.add(track)
                stats["tracks"] += 1

        await session.commit()
        return stats
