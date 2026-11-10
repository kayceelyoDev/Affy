import os
import pytest
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.app.models.models import (
    Product, Clip, Plan, PlanSlot, Order, Setting, Alias
)
from bot.client import TelegramClient
from bot.handlers import BotHandler

@pytest.mark.asyncio
async def test_telegram_allowlist_authorization(db_session: AsyncSession):
    """Verifies that allowed chats receive responses while unauthorized chats are ignored silently."""
    client = TelegramClient(mock_mode=True)
    # Allowlist chat ID 12345 only
    handler = BotHandler(telegram_client=client, allowed_chat_ids={12345})

    # 1. Message from unauthorized user (99999)
    unauthorized_update = {
        "update_id": 1,
        "message": {
            "chat": {"id": 99999},
            "text": "/today",
        }
    }
    await handler.handle_update(unauthorized_update, db_session)
    # Must be 0 sent messages (strict silence)
    assert len(client.sent_messages) == 0

    # 2. Message from authorized user (12345)
    authorized_update = {
        "update_id": 2,
        "message": {
            "chat": {"id": 12345},
            "text": "/start",
        }
    }
    await handler.handle_update(authorized_update, db_session)
    # Must receive welcome / help response
    assert len(client.sent_messages) == 1
    assert "Affiliate Autopilot Assistant" in client.sent_messages[0]["text"]


@pytest.mark.asyncio
async def test_telegram_commands_today_status_sales(db_session: AsyncSession):
    """Tests bot commands: /today, /status, /sales, /pause, /resume."""
    client = TelegramClient(mock_mode=True)
    handler = BotHandler(telegram_client=client, allowed_chat_ids={100})

    # Seed product and order
    prod = Product(name="Bot Test Tripod", category="Gadgets", folder_path="Tripod", active=True)
    db_session.add(prod)
    await db_session.commit()
    await db_session.refresh(prod)

    order = Order(
        order_id="999888777666",
        product_id=prod.id,
        product_name_raw="Bot Test Tripod",
        gmv=1500.0,
        actual_commission=150.0,
        est_commission=50.0,
    )
    db_session.add(order)
    await db_session.commit()

    # 1. /status command
    await handler.handle_update({"update_id": 10, "message": {"chat": {"id": 100}, "text": "/status"}}, db_session)
    status_msg = client.sent_messages[-1]["text"]
    assert "System Health & Telemetry" in status_msg
    assert "ONLINE" in status_msg

    # 2. /sales command
    await handler.handle_update({"update_id": 11, "message": {"chat": {"id": 100}, "text": "/sales"}}, db_session)
    sales_msg = client.sent_messages[-1]["text"]
    assert "Creator Cashflow Pulse" in sales_msg
    assert "₱1,500.00" in sales_msg
    assert "₱150.00" in sales_msg

    # 3. /today command
    await handler.handle_update({"update_id": 12, "message": {"chat": {"id": 100}, "text": "/today"}}, db_session)
    today_msg = client.sent_messages[-1]["text"]
    assert "Today's Strategy Plan" in today_msg

    # 4. /pause command
    await handler.handle_update({"update_id": 13, "message": {"chat": {"id": 100}, "text": "/pause"}}, db_session)
    assert "posting PAUSED" in client.sent_messages[-1]["text"]
    stmt = select(Setting).where(Setting.key == "posting_paused")
    setting = (await db_session.execute(stmt)).scalar_one_or_none()
    assert setting is not None
    assert setting.value == "true"

    # 5. /resume command
    await handler.handle_update({"update_id": 14, "message": {"chat": {"id": 100}, "text": "/resume"}}, db_session)
    assert "posting RESUMED" in client.sent_messages[-1]["text"]


@pytest.mark.asyncio
async def test_telegram_interactive_plan_and_callbacks(db_session: AsyncSession):
    """Tests interactive /plan review and inline callback query approval."""
    client = TelegramClient(mock_mode=True)
    handler = BotHandler(telegram_client=client, allowed_chat_ids={200})

    # Seed plan
    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    plan = Plan(date=today_str, status="draft")
    db_session.add(plan)
    await db_session.commit()
    await db_session.refresh(plan)

    # 1. User sends /plan
    await handler.handle_update({"update_id": 20, "message": {"chat": {"id": 200}, "text": "/plan"}}, db_session)
    plan_msg = client.sent_messages[-1]
    assert "Plan Review" in plan_msg["text"]
    assert "reply_markup" in plan_msg
    assert "Approve Full Plan" in plan_msg["reply_markup"]["inline_keyboard"][0][0]["text"]

    # 2. User clicks inline button "Approve Full Plan"
    cb_update = {
        "update_id": 21,
        "callback_query": {
            "id": "cb_123",
            "message": {"chat": {"id": 200}},
            "data": f"plan:approve:{plan.id}",
        }
    }
    await handler.handle_update(cb_update, db_session)

    # Verify plan status updated to approved
    await db_session.refresh(plan)
    assert plan.status == "approved"
    assert "Approved!" in client.sent_messages[-1]["text"]


@pytest.mark.asyncio
async def test_telegram_media_intake_photo_and_document(db_session: AsyncSession):
    """Verifies that photo or spreadsheet dropped into chat routes directly to IngestPipeline."""
    client = TelegramClient(mock_mode=True)
    handler = BotHandler(telegram_client=client, allowed_chat_ids={300})

    # Drop document (.xlsx)
    doc_update = {
        "update_id": 30,
        "message": {
            "chat": {"id": 300},
            "document": {
                "file_id": "file_doc_12345",
                "file_name": "orders_report.xlsx",
            }
        }
    }
    await handler.handle_update(doc_update, db_session)

    # Should have sent "Receiving file..." and completion message
    assert len(client.sent_messages) >= 2
    assert "File Processed Successfully" in client.sent_messages[-1]["text"]


@pytest.mark.asyncio
async def test_telegram_free_text_assistant(db_session: AsyncSession):
    """Verifies that non-command conversational messages route to the Creator AI Assistant."""
    client = TelegramClient(mock_mode=True)
    handler = BotHandler(telegram_client=client, allowed_chat_ids={400})

    msg_update = {
        "update_id": 40,
        "message": {
            "chat": {"id": 400},
            "text": "Ano ang magandang hook para sa microphone bukas?",
        }
    }
    await handler.handle_update(msg_update, db_session)

    response = client.sent_messages[-1]["text"]
    assert "Creator AI Pulse" in response
    assert "microphone" in response
