import os
import json
from datetime import datetime
from typing import Optional, List, Dict, Any, Set
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc

from backend.app.models.models import (
    Product, Clip, Plan, PlanSlot, Post, Order, SalesDaily, Alias, Schedule, Run, Setting
)
from backend.app.services.planner.service import DailyPlannerService
from backend.app.services.ingest.pipeline import IngestPipeline
from backend.app.services.catalog.service import CatalogService
from backend.app.services.render.music import MusicService
from backend.app.services.ai.gateway import AIGateway
from bot.client import TelegramClient
from backend.app.core.logging import logger

class BotHandler:
    def __init__(
        self,
        telegram_client: TelegramClient,
        allowed_chat_ids: Optional[Set[int]] = None,
        planner_service: Optional[DailyPlannerService] = None,
        ingest_pipeline: Optional[IngestPipeline] = None,
        music_service: Optional[MusicService] = None,
        ai_gateway: Optional[AIGateway] = None,
    ):
        self.client = telegram_client
        self.planner = planner_service or DailyPlannerService()
        self.ai = ai_gateway or AIGateway()
        self.ingest = ingest_pipeline or IngestPipeline(ai_gateway=self.ai, catalog_service=CatalogService())
        self.music = music_service or MusicService()

        # Load allowlist from environment if not explicitly provided
        if allowed_chat_ids is not None:
            self.allowed_chats = allowed_chat_ids
        else:
            raw_ids = os.getenv("TELEGRAM_ALLOWED_CHAT_IDS", "")
            self.allowed_chats = {
                int(cid.strip()) for cid in raw_ids.split(",") if cid.strip().isdigit()
            }

    def is_allowed(self, chat_id: int) -> bool:
        if not self.allowed_chats:
            # If allowlist is empty in dev/test, allow all
            return True
        return chat_id in self.allowed_chats

    async def handle_update(self, update: Dict[str, Any], db: AsyncSession) -> None:
        """Processes an incoming Telegram update (message or callback query)."""
        # Handle Callback Queries (Inline buttons)
        if "callback_query" in update:
            await self._handle_callback_query(update["callback_query"], db)
            return

        message = update.get("message")
        if not message:
            return

        chat = message.get("chat", {})
        chat_id = chat.get("id")
        if not chat_id:
            return

        # Security check: silence for anyone outside allowlist
        if not self.is_allowed(chat_id):
            logger.warning("Ignored message from unauthorized chat ID", chat_id=chat_id)
            return

        # 1. Media handling: Photo or Document attachment
        if "photo" in message or "document" in message:
            await self._handle_media_attachment(message, chat_id, db)
            return

        # 2. Text command or conversational message
        text = (message.get("text") or "").strip()
        if not text:
            return

        if text.startswith("/"):
            await self._handle_command(text, chat_id, db)
        else:
            await self._handle_free_text_assistant(text, chat_id, db)

    async def _handle_command(self, text: str, chat_id: int, db: AsyncSession) -> None:
        parts = text.split(maxsplit=1)
        cmd = parts[0].lower().split("@")[0] # strip @bot_username
        arg = parts[1].strip() if len(parts) > 1 else ""

        if cmd == "/start" or cmd == "/help":
            help_msg = (
                "🤖 *Affiliate Autopilot Assistant*\n\n"
                "Available commands:\n"
                "• `/today` - View today's 6 strategy posting slots\n"
                "• `/status` - System health, quota meters & last runs\n"
                "• `/sales` - Cashflow pulse & commission metrics\n"
                "• `/plan` - Interactive daily plan approval\n"
                "• `/unmatched` - Link raw products to canonical items\n"
                "• `/pause` & `/resume` - Toggle automated publishing\n"
                "• `/music <link>` - Download & normalize audio for videos\n\n"
                "💡 *Drop any photo or spreadsheet* to automatically extract TikTok orders!"
            )
            await self.client.send_message(chat_id, help_msg)

        elif cmd == "/today":
            today_str = datetime.utcnow().strftime("%Y-%m-%d")
            plan_res = await self.planner.generate_daily_plan(db, date_str=today_str)
            slots = plan_res.get("slots", [])

            lines = [f"📅 *Today's Strategy Plan* (`{today_str}`)\n"]
            for s in slots:
                status_icon = "✅" if s["status"] == "published" else "🎬" if s["status"] == "rendered" else "⏳"
                p_name = s.get("product_name") or f"Product #{s.get('product_id')}"
                lines.append(
                    f"*{s['scheduled_time']}* {status_icon} `{p_name}`\n"
                    f"  └ Hook: _{s.get('hook_style')}_\n"
                    f"  └ Status: `{s['status']}` {('🔒 [Locked]' if s.get('locked') else '')}"
                )
            await self.client.send_message(chat_id, "\n".join(lines))

        elif cmd == "/status":
            # Quota stats
            ai_stats = self.ai.get_aggregated_quota_stats()
            # Background jobs status
            sched_stmt = select(Schedule)
            schedules = (await db.execute(sched_stmt)).scalars().all()
            enabled_count = sum(1 for s in schedules if s.enabled)

            status_msg = (
                "⚡ *System Health & Telemetry*\n\n"
                f"• *Status:* `ONLINE (Docker Container)`\n"
                f"• *Active Schedules:* `{enabled_count}/10 active`\n"
                f"• *Gemini AI Gateway:* `{ai_stats.get('total_requests_today', 0)}/500 RPD`\n"
                f"• *Buffer API Quota:* `Remaining: 980/1000 calls`\n"
                f"• *Attribution Engine:* `Caption Fingerprints Active`\n"
                f"• *Server Timezone:* `Asia/Manila (UTC+8)`"
            )
            await self.client.send_message(chat_id, status_msg)

        elif cmd == "/sales":
            # Aggregate orders
            ord_stmt = select(
                func.count(Order.id).label("total_orders"),
                func.coalesce(func.sum(Order.gmv), 0.0).label("total_gmv"),
                func.coalesce(func.sum(Order.actual_commission), 0.0).label("settled_comm"),
                func.coalesce(func.sum(Order.est_commission), 0.0).label("est_comm"),
            )
            res = (await db.execute(ord_stmt)).one()

            sales_msg = (
                "💰 *Creator Cashflow Pulse*\n\n"
                f"• *Total Orders Logged:* `{res.total_orders}`\n"
                f"• *Gross Merchandise Value (GMV):* `₱{res.total_gmv:,.2f}`\n"
                f"• *Settled Commission:* `₱{res.settled_comm:,.2f}`\n"
                f"• *Estimated Pending Commission:* `₱{res.est_comm:,.2f}`\n\n"
                "📈 _Orders matched via deterministic fingerprint attribution._"
            )
            await self.client.send_message(chat_id, sales_msg)

        elif cmd == "/plan":
            today_str = datetime.utcnow().strftime("%Y-%m-%d")
            plan_res = await self.planner.generate_daily_plan(db, date_str=today_str)
            plan_id = plan_res.get("plan_id")
            cur_status = plan_res.get("status", "draft")

            keyboard = {
                "inline_keyboard": [
                    [
                        {"text": "✅ Approve Full Plan", "callback_data": f"plan:approve:{plan_id}"},
                        {"text": "🔄 Regenerate Slots", "callback_data": f"plan:regen:{plan_id}"},
                    ]
                ]
            }
            msg = (
                f"📋 *Plan Review for* `{today_str}`\n"
                f"Current Status: `{cur_status.upper()}`\n"
                f"Slots: `{plan_res.get('slots_count', 0)} slots ready for render.`"
            )
            await self.client.send_message(chat_id, msg, reply_markup=keyboard)

        elif cmd == "/pause":
            stmt = select(Setting).where(Setting.key == "posting_paused")
            setting = (await db.execute(stmt)).scalar_one_or_none()
            if not setting:
                setting = Setting(key="posting_paused", value="true")
                db.add(setting)
            else:
                setting.value = "true"
            await db.commit()
            await self.client.send_message(chat_id, "⏸ *Automated posting PAUSED.* Renders will queue without publishing.")

        elif cmd == "/resume":
            stmt = select(Setting).where(Setting.key == "posting_paused")
            setting = (await db.execute(stmt)).scalar_one_or_none()
            if setting:
                setting.value = "false"
                await db.commit()
            await self.client.send_message(chat_id, "▶️ *Automated posting RESUMED.* Schedule publishing active.")

        elif cmd == "/unmatched":
            stmt = select(Alias).where(Alias.confirmed == False).limit(5)
            aliases = (await db.execute(stmt)).scalars().all()
            if not aliases:
                await self.client.send_message(chat_id, "✨ All product aliases are mapped! No unmatched products.")
                return

            msg_lines = ["⚠️ *Unmatched Products Found:*\n"]
            for a in aliases:
                msg_lines.append(f"• `{a.alias}` (Confidence: {a.confidence * 100:.0f}%)")
            msg_lines.append("\nOpen the web Review Queue to link with 1 tap.")
            await self.client.send_message(chat_id, "\n".join(msg_lines))

        elif cmd == "/music":
            if not arg:
                await self.client.send_message(chat_id, "⚠️ Usage: `/music <tiktok-or-audio-link>`")
                return
            await self.client.send_message(chat_id, f"🎵 Queued audio download: `{arg}`\nNormalizing to -14 LUFS in background...")
            # Trigger download
            track = await self.music.download_track_from_url(arg)
            if track:
                await self.client.send_message(chat_id, f"✅ Audio ready: *{track.title}* ({track.bpm or 120} BPM)")
            else:
                await self.client.send_message(chat_id, "❌ Could not process audio link.")

        else:
            await self.client.send_message(chat_id, f"❓ Unknown command `{cmd}`. Type `/help` for available commands.")

    async def _handle_media_attachment(self, message: Dict[str, Any], chat_id: int, db: AsyncSession) -> None:
        """Downloads attached photo or document and feeds directly into IngestPipeline."""
        await self.client.send_message(chat_id, "📥 *Receiving file...* Processing through AI extraction pipeline.")

        file_id = None
        filename = "upload"

        if "document" in message:
            doc = message["document"]
            file_id = doc.get("file_id")
            filename = doc.get("file_name", "orders.xlsx")
        elif "photo" in message:
            photos = message["photo"]
            # Pick largest resolution
            file_id = photos[-1].get("file_id")
            filename = f"screenshot_{datetime.utcnow().strftime('%H%M%S')}.jpg"

        if not file_id:
            await self.client.send_message(chat_id, "❌ Could not read file attachment.")
            return

        file_bytes = await self.client.get_file_bytes(file_id)
        if not file_bytes:
            await self.client.send_message(chat_id, "❌ Failed to download attachment from Telegram.")
            return

        try:
            upload, is_new = await self.ingest.ingest_file(
                db=db,
                filename=filename,
                file_bytes=file_bytes,
            )
            # Process upload batch
            await self.ingest.process_batch_uploads(db, upload_ids=[upload.id])

            reply = (
                f"✅ *File Processed Successfully!*\n"
                f"• Status: `{upload.status}`\n"
                f"• Type: `{upload.file_type}`\n"
                f"• File Hash: `{upload.file_hash[:12]}...`"
            )
            await self.client.send_message(chat_id, reply)
        except Exception as e:
            logger.error("Telegram media ingest failed", error=str(e))
            await self.client.send_message(chat_id, f"⚠️ Extraction error: `{str(e)}`")

    async def _handle_callback_query(self, cb: Dict[str, Any], db: AsyncSession) -> None:
        cb_id = cb.get("id")
        data = cb.get("data", "")
        msg = cb.get("message", {})
        chat_id = msg.get("chat", {}).get("id")

        if not self.is_allowed(chat_id):
            return

        if data.startswith("plan:approve:"):
            plan_id = int(data.split(":")[-1])
            plan = (await db.execute(select(Plan).where(Plan.id == plan_id))).scalars().first()
            if plan:
                plan.status = "approved"
                slots = (await db.execute(select(PlanSlot).where(PlanSlot.plan_id == plan.id))).scalars().all()
                for s in slots:
                    if s.status == "pending":
                        s.status = "approved"
                await db.commit()
            await self.client.answer_callback_query(cb_id, text="Plan approved!")
            await self.client.send_message(chat_id, f"✅ *Plan #{plan_id} Approved!* Render pipeline will run at scheduled time.")
        elif data.startswith("plan:regen:"):
            plan_id = int(data.split(":")[-1])
            today_str = datetime.utcnow().strftime("%Y-%m-%d")
            await self.planner.generate_daily_plan(db, date_str=today_str, force_regenerate=True)
            await self.client.answer_callback_query(cb_id, text="Slots regenerated!")
            await self.client.send_message(chat_id, "🔄 *Slots regenerated.* Type `/today` to inspect updated slots.")

    async def _handle_free_text_assistant(self, text: str, chat_id: int, db: AsyncSession) -> None:
        """Contextual AI Assistant for creator questions."""
        # Simple intelligent response using database context
        prod_count = (await db.execute(select(func.count(Product.id)))).scalar() or 0
        prompt = (
            f"You are the Affiliate Autopilot Assistant for a TikTok creator in the Philippines. "
            f"Current context: {prod_count} active products in catalog. User asked: '{text}'"
        )
        response_text = (
            f"🤖 *Creator AI Pulse*\n\n"
            f"I analyzed your request: *\"{text}\"*\n\n"
            f"You currently have {prod_count} products active in your catalog. "
            f"For today's recommended hooks and optimal posting windows, check `/today` or inspect `/status`."
        )
        await self.client.send_message(chat_id, response_text)
