import os
import asyncio
import signal
from typing import Optional
import structlog

from backend.app.core.database import AsyncSessionLocal
from bot.client import TelegramClient
from bot.handlers import BotHandler
from backend.app.core.logging import configure_logging, logger

configure_logging(debug=os.getenv("DEBUG", "false").lower() == "true")

class TelegramBotDaemon:
    def __init__(self):
        self.running = False
        self.client = TelegramClient()
        self.handler = BotHandler(telegram_client=self.client)
        self.offset: Optional[int] = None

    async def start(self):
        self.running = True
        logger.info(
            "Telegram Bot polling daemon initialized",
            mock_mode=self.client.mock_mode,
            allowed_chats=list(self.handler.allowed_chats),
        )

        while self.running:
            try:
                updates = await self.client.get_updates(offset=self.offset, timeout=30)
                for update in updates:
                    update_id = update.get("update_id")
                    if update_id is not None:
                        self.offset = update_id + 1

                    async with AsyncSessionLocal() as session:
                        try:
                            await self.handler.handle_update(update, session)
                        except Exception as e:
                            logger.error("Error processing update", update_id=update_id, error=str(e))
                
                # Small pause between polls
                await asyncio.sleep(0.5)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Telegram polling loop error", error=str(e))
                await asyncio.sleep(5)

    def stop(self):
        logger.info("Stopping Telegram Bot polling daemon...")
        self.running = False

async def run():
    bot = TelegramBotDaemon()
    loop = asyncio.get_running_loop()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, bot.stop)
        except NotImplementedError:
            pass # Windows compatibility

    await bot.start()

def main():
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        pass

if __name__ == "__main__":
    main()
