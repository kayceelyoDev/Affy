import os
import asyncio
from typing import Optional, Dict, Any, List
import httpx

from backend.app.core.logging import logger

TELEGRAM_API_BASE = "https://api.telegram.org"

class TelegramClient:
    def __init__(
        self,
        token: Optional[str] = None,
        mock_mode: Optional[bool] = None,
    ):
        self.token = token or os.getenv("TELEGRAM_BOT_TOKEN", "")
        if mock_mode is not None:
            self.mock_mode = mock_mode
        else:
            self.mock_mode = not bool(self.token) or os.getenv("MOCK_BOT", "false").lower() in ("true", "1")
        self.base_url = f"{TELEGRAM_API_BASE}/bot{self.token}" if self.token else ""
        self.sent_messages: List[Dict[str, Any]] = []

    async def get_updates(self, offset: Optional[int] = None, timeout: int = 30) -> List[Dict[str, Any]]:
        """Long polls the Telegram Bot API for incoming updates."""
        if self.mock_mode or not self.token:
            await asyncio.sleep(0.5)
            return []

        params: Dict[str, Any] = {"timeout": timeout}
        if offset is not None:
            params["offset"] = offset

        try:
            async with httpx.AsyncClient(timeout=timeout + 10.0) as client:
                resp = await client.get(f"{self.base_url}/getUpdates", params=params)
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("ok"):
                        return data.get("result", [])
        except httpx.HTTPError as e:
            logger.warning("Telegram long-poll update request failed", error=str(e))
        return []

    async def send_message(
        self,
        chat_id: int | str,
        text: str,
        parse_mode: str = "Markdown",
        reply_markup: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Sends a text message with optional markdown formatting and inline keyboard."""
        payload: Dict[str, Any] = {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": parse_mode,
        }
        if reply_markup:
            payload["reply_markup"] = reply_markup

        if self.mock_mode or not self.token:
            self.sent_messages.append(payload)
            logger.info("[MOCK TELEGRAM] Sent message", chat_id=chat_id, text_snippet=text[:50])
            return {"ok": True, "result": {"message_id": len(self.sent_messages), "chat": {"id": chat_id}, "text": text}}

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(f"{self.base_url}/sendMessage", json=payload)
                if resp.status_code == 200:
                    return resp.json()
                logger.error("Telegram send_message failed", status=resp.status_code, text=resp.text)
        except Exception as e:
            logger.error("Failed to send telegram message", error=str(e))
        return {"ok": False}

    async def answer_callback_query(self, callback_query_id: str, text: Optional[str] = None) -> bool:
        """Acknowledges an inline keyboard callback query."""
        if self.mock_mode or not self.token:
            return True

        payload = {"callback_query_id": callback_query_id}
        if text:
            payload["text"] = text

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(f"{self.base_url}/answerCallbackQuery", json=payload)
                return resp.status_code == 200
        except Exception:
            return False

    async def get_file_bytes(self, file_id: str) -> Optional[bytes]:
        """Fetches binary content of a photo or document uploaded to the bot."""
        if self.mock_mode or not self.token:
            # Return dummy spreadsheet bytes for mock
            return b"MOCK_MEDIA_BYTES"

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(f"{self.base_url}/getFile", params={"file_id": file_id})
                if resp.status_code != 200:
                    return None
                file_info = resp.json().get("result", {})
                file_path = file_info.get("file_path")
                if not file_path:
                    return None

                download_url = f"{TELEGRAM_API_BASE}/file/bot{self.token}/{file_path}"
                dl_resp = await client.get(download_url)
                if dl_resp.status_code == 200:
                    return dl_resp.content
        except Exception as e:
            logger.error("Failed to download telegram file", file_id=file_id, error=str(e))
        return None
