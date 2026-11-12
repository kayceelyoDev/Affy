import os
import json
import asyncio
import uuid
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import httpx

from backend.app.core.logging import logger

BUFFER_GRAPHQL_ENDPOINT = "https://api.buffer.com"

class BufferQuotaExceededError(Exception):
    pass

class BufferAPIError(Exception):
    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message)
        self.status_code = status_code

CREATE_POST_MUTATION = """
mutation CreatePost($input: CreatePostInput!) {
    createPost(input: $input) {
        ... on PostActionSuccess {
            post {
                id
                text
                status
                dueAt
            }
        }
        ... on MutationError {
            message
        }
    }
}
"""

class BufferClient:
    def __init__(
        self,
        access_token: Optional[str] = None,
        monthly_limit: int = 1000,
        mock_mode: Optional[bool] = None,
    ):
        self.access_token = access_token or os.getenv("BUFFER_ACCESS_TOKEN", "")
        self.monthly_limit = monthly_limit
        # Default to mock mode if token is empty or MOCK_BUFFER is set
        if mock_mode is not None:
            self.mock_mode = mock_mode
        else:
            self.mock_mode = not bool(self.access_token) or os.getenv("MOCK_BUFFER", "false").lower() in ("true", "1")
        self.call_count = 0

    def get_remaining_quota(self) -> int:
        return max(0, self.monthly_limit - self.call_count)

    def check_quota(self, is_publishing: bool = True) -> None:
        remaining = self.get_remaining_quota()
        # Quota guard: if remaining < 10, non-publishing calls (metrics) are blocked
        if not is_publishing and remaining < 10:
            raise BufferQuotaExceededError(f"Buffer quota low ({remaining} calls remaining). Analytics sync paused to protect scheduled posts.")
        if remaining <= 0:
            raise BufferQuotaExceededError("Monthly Buffer API quota exhausted (limit reached).")

    async def create_post(
        self,
        channel_id: str,
        text: str,
        media_url: str,
        mode: str = "queue",
        due_at: Optional[datetime] = None,
        max_retries: int = 3,
    ) -> Dict[str, Any]:
        """
        Creates a scheduled video post on Buffer via GraphQL.
        Supports:
          - Queue mode: adds to Buffer's native publishing queue
          - Exact-time mode: schedules post for exact computed slot time
        """
        self.check_quota(is_publishing=True)
        self.call_count += 1

        if self.mock_mode:
            return self._mock_create_post(channel_id, text, media_url, mode, due_at)

        # Build payload
        if mode == "exact" and due_at:
            due_at_utc = due_at.astimezone(timezone.utc) if due_at.tzinfo else due_at.replace(tzinfo=timezone.utc)
            due_at_str = due_at_utc.strftime("%Y-%m-%dT%H:%M:%SZ")
            scheduling_type = "custom"
            post_mode = "customScheduled"
        else:
            due_at_str = None
            scheduling_type = "automatic"
            post_mode = "addToQueue"

        input_payload: Dict[str, Any] = {
            "channelId": channel_id,
            "text": text,
            "schedulingType": scheduling_type,
            "mode": post_mode,
            "assets": [
                {
                    "video": {
                        "url": media_url
                    }
                }
            ],
        }
        if due_at_str:
            input_payload["dueAt"] = due_at_str

        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }

        # Retry loop with exponential backoff
        last_error = None
        for attempt in range(max_retries):
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    resp = await client.post(
                        BUFFER_GRAPHQL_ENDPOINT,
                        json={"query": CREATE_POST_MUTATION, "variables": {"input": input_payload}},
                        headers=headers,
                    )
                    
                    if resp.status_code in (429, 500, 502, 503, 504):
                        logger.warning("Buffer API transient error, retrying", status=resp.status_code, attempt=attempt + 1)
                        await asyncio.sleep(2 ** attempt)
                        continue

                    resp.raise_for_status()
                    data = resp.json()

                    if "errors" in data and data["errors"]:
                        error_msg = "; ".join([e.get("message", "Unknown error") for e in data["errors"]])
                        raise BufferAPIError(f"Buffer GraphQL error: {error_msg}")

                    post_res = data.get("data", {}).get("createPost", {})
                    if "message" in post_res and not post_res.get("post"):
                        raise BufferAPIError(f"Buffer mutation failed: {post_res['message']}")

                    created_post = post_res.get("post", {})
                    logger.info("Buffer post scheduled successfully", id=created_post.get("id"), mode=mode)
                    return created_post

            except httpx.HTTPError as e:
                last_error = e
                logger.warning("Buffer network exception", error=str(e), attempt=attempt + 1)
                await asyncio.sleep(2 ** attempt)

        raise BufferAPIError(f"Failed to post to Buffer after {max_retries} attempts: {str(last_error)}")

    def _mock_create_post(
        self,
        channel_id: str,
        text: str,
        media_url: str,
        mode: str,
        due_at: Optional[datetime],
    ) -> Dict[str, Any]:
        mock_id = f"buf_post_{uuid.uuid4().hex[:12]}"
        due_str = due_at.isoformat() if due_at else (datetime.now(timezone.utc).isoformat())
        logger.info("[MOCK] Buffer post created", id=mock_id, mode=mode, dueAt=due_str, text_snippet=text[:40])
        return {
            "id": mock_id,
            "text": text,
            "status": "scheduled" if mode == "exact" else "queued",
            "dueAt": due_str,
            "channelId": channel_id,
            "mediaUrl": media_url,
        }
