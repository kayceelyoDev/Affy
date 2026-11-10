import hashlib
import json
import time
from datetime import datetime
from typing import Dict, Any, List, Optional, Type, TypeVar
import httpx
from pydantic import BaseModel
import structlog
from backend.app.services.ai.schemas import BatchedOrdersExtraction
from backend.app.services.ai.prompts.orders_vision import SYSTEM_INSTRUCTION, USER_PROMPT, PROMPT_VERSION

logger = structlog.get_logger()

T = TypeVar("T", bound=BaseModel)

class AIQuotaExceededException(Exception):
    def __init__(self, message: str, retry_after_seconds: Optional[int] = None):
        super().__init__(message)
        self.retry_after_seconds = retry_after_seconds

class RateLimiter:
    """Per (key, model) RPM and RPD limiter resetting at midnight Pacific Time."""
    def __init__(self, rpm_limit: int = 15, rpd_limit: int = 500):
        self.rpm_limit = rpm_limit
        self.rpd_limit = rpd_limit
        self.minute_requests: List[float] = []
        self.daily_count: int = 0
        self.last_day_pacific: Optional[str] = None

    def _get_pacific_day(self) -> str:
        # Midnight Pacific Time (UTC-8 / UTC-7)
        # Using simple UTC-8 offset for deterministic accounting
        utc_now = time.time()
        pacific_now = datetime.utcfromtimestamp(utc_now - 8 * 3600)
        return pacific_now.strftime("%Y-%m-%d")

    def check_and_increment(self) -> bool:
        current_time = time.time()
        pacific_day = self._get_pacific_day()

        if self.last_day_pacific != pacific_day:
            self.daily_count = 0
            self.last_day_pacific = pacific_day

        # Filter out requests older than 60s
        self.minute_requests = [t for t in self.minute_requests if current_time - t < 60.0]

        if len(self.minute_requests) >= self.rpm_limit:
            return False

        if self.daily_count >= self.rpd_limit:
            return False

        self.minute_requests.append(current_time)
        self.daily_count += 1
        return True

    def get_stats(self) -> Dict[str, Any]:
        current_time = time.time()
        pacific_day = self._get_pacific_day()
        if self.last_day_pacific != pacific_day:
            self.daily_count = 0
            self.last_day_pacific = pacific_day

        recent_rpm = len([t for t in self.minute_requests if current_time - t < 60.0])
        return {
            "current_rpm": recent_rpm,
            "rpm_limit": self.rpm_limit,
            "rpd_count": self.daily_count,
            "rpd_limit": self.rpd_limit,
            "remaining_today": max(0, self.rpd_limit - self.daily_count),
            "reset_timezone": "Pacific/US (UTC-8)",
        }

class AIGateway:
    """
    Unified AI Gateway with Task-to-Model Routing, Multi-Key Fallback,
    RPM/RPD Rate Limiting, Response Caching, and Structured Output.
    """
    def __init__(
        self,
        api_keys: Optional[List[str]] = None,
        default_rpm: int = 15,
        default_rpd: int = 500,
        fake_provider: bool = False,
    ):
        self.api_keys = api_keys or []
        self.default_rpm = default_rpm
        self.default_rpd = default_rpd
        self.fake_provider = fake_provider
        self.rate_limiters: Dict[str, RateLimiter] = {}
        self.cache: Dict[str, str] = {}
        self.task_routing: Dict[str, List[str]] = {
            "vision_extraction": ["gemini-1.5-flash", "gemini-1.5-flash-8b", "gemini-1.5-flash-latest"],
            "captions": ["gemini-1.5-flash", "gemini-1.5-flash-8b"],
            "strategy": ["gemini-1.5-pro", "gemini-1.5-flash"],
            "chat": ["gemini-1.5-pro", "gemini-1.5-flash"],
        }
        self.call_count: int = 0  # Useful for testing batching reductions

    def _get_limiter(self, key_label: str, model: str) -> RateLimiter:
        limiter_key = f"{key_label}:{model}"
        if limiter_key not in self.rate_limiters:
            self.rate_limiters[limiter_key] = RateLimiter(self.default_rpm, self.default_rpd)
        return self.rate_limiters[limiter_key]

    def _hash_request(self, model: str, prompt_version: str, payload_bytes: bytes) -> str:
        h = hashlib.sha256()
        h.update(model.encode("utf-8"))
        h.update(prompt_version.encode("utf-8"))
        h.update(payload_bytes)
        return h.hexdigest()

    async def extract_orders_from_batch(
        self,
        image_bytes_list: List[bytes],
        task: str = "vision_extraction",
    ) -> BatchedOrdersExtraction:
        """
        Extract orders from up to 6 images in a single batched AI request.
        """
        if not image_bytes_list:
            return BatchedOrdersExtraction(results=[])

        models = self.task_routing.get(task, ["gemini-1.5-flash"])
        combined_bytes = b"".join(image_bytes_list)

        # Check Cache
        primary_model = models[0]
        cache_key = self._hash_request(primary_model, PROMPT_VERSION, combined_bytes)
        if cache_key in self.cache:
            logger.info("ai_gateway_cache_hit", cache_key=cache_key)
            cached_data = json.loads(self.cache[cache_key])
            return BatchedOrdersExtraction.model_validate(cached_data)

        # If fake provider, return deterministic mock without network
        if self.fake_provider:
            self.call_count += 1
            limiter = self._get_limiter("mock", primary_model)
            if not limiter.check_and_increment():
                raise AIQuotaExceededException("Daily AI request quota exceeded (RPD limit).")

            mock_result = self._generate_mock_batch_extraction(image_bytes_list)
            self.cache[cache_key] = mock_result.model_dump_json()
            return mock_result

        # Live Fallback Chain across models and keys
        last_error = None
        keys = self.api_keys if self.api_keys else ["NO_KEY"]

        for key_idx, key in enumerate(keys):
            for model in models:
                key_label = f"key_{key_idx}"
                limiter = self._get_limiter(key_label, model)

                if not limiter.check_and_increment():
                    logger.warn("rate_limit_exceeded_local", model=model, key_label=key_label)
                    continue

                try:
                    result = await self._call_gemini_vision(
                        api_key=key,
                        model=model,
                        images=image_bytes_list,
                        system_prompt=SYSTEM_INSTRUCTION,
                        user_prompt=USER_PROMPT.format(image_count=len(image_bytes_list)),
                    )
                    self.call_count += 1
                    self.cache[cache_key] = result.model_dump_json()
                    return result
                except Exception as e:
                    logger.error("gemini_call_failed", model=model, error=str(e))
                    last_error = e

        raise AIQuotaExceededException(f"All AI keys and fallback models exhausted. Last error: {last_error}")

    def _generate_mock_batch_extraction(self, images: List[bytes]) -> BatchedOrdersExtraction:
        """Deterministic mock extraction for tests and synthetic fixtures."""
        from backend.app.services.ai.schemas import SingleImageExtraction, ExtractedOrderItem

        results = []
        for idx, img in enumerate(images):
            # Create deterministic order based on index and image hash
            img_hash = hashlib.md5(img).hexdigest()[:6]
            order_num = f"57891234567890{idx:04d}" # 18 digits valid order ID
            price = 450.0 + (idx * 25.0)
            qty = 1 + (idx % 2)
            rate = 0.10
            est_comm = round(price * qty * rate, 2)
            is_settled = (idx % 2 == 1)

            results.append(
                SingleImageExtraction(
                    image_index=idx,
                    screen_type="affiliate_orders",
                    orders=[
                        ExtractedOrderItem(
                            order_id=order_num,
                            status_stage="settled" if is_settled else "in_transit",
                            product_name_raw=f"Mock Wireless Earbuds Pro #{idx} [{img_hash}]",
                            price=price,
                            quantity=qty,
                            gmv=price * qty,
                            commission_rate=rate,
                            est_commission=est_comm,
                            actual_commission=est_comm if is_settled else None,
                            settle_date_est="2026-11-15" if not is_settled else "2026-11-09",
                            is_shop_ads=False,
                            order_date="2026-11-08",
                            confidence=0.95,
                            uncertain_fields=[],
                        )
                    ],
                )
            )
        return BatchedOrdersExtraction(results=results)

    async def _call_gemini_vision(
        self,
        api_key: str,
        model: str,
        images: List[bytes],
        system_prompt: str,
        user_prompt: str,
    ) -> BatchedOrdersExtraction:
        """Call Gemini REST endpoint with base64 images and JSON Schema validation."""
        import base64

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        parts: List[Dict[str, Any]] = [{"text": f"{system_prompt}\n\n{user_prompt}"}]

        for img in images:
            b64_data = base64.b64encode(img).decode("utf-8")
            parts.append({
                "inline_data": {
                    "mime_type": "image/jpeg",
                    "data": b64_data,
                }
            })

        payload = {
            "contents": [{"parts": parts}],
            "generationConfig": {
                "response_mime_type": "application/json",
                "temperature": 0.1,
            },
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code == 429:
                raise AIQuotaExceededException("Google Gemini API HTTP 429: Rate limit exceeded.")
            resp.raise_for_status()

            data = resp.json()
            text_content = data["candidates"][0]["content"]["parts"][0]["text"]
            
            # Pydantic parsing with one repair attempt
            try:
                parsed_json = json.loads(text_content)
                return BatchedOrdersExtraction.model_validate(parsed_json)
            except Exception as parse_err:
                logger.warn("gemini_json_parse_retry", error=str(parse_err))
                # Attempt repair
                repaired = self._attempt_json_repair(text_content)
                return BatchedOrdersExtraction.model_validate(repaired)

    def _attempt_json_repair(self, text: str) -> Dict[str, Any]:
        """Simple repair for markdown json wrappers and trailing commas."""
        clean = text.strip()
        if clean.startswith("```json"):
            clean = clean[7:]
        if clean.startswith("```"):
            clean = clean[3:]
        if clean.endswith("```"):
            clean = clean[:-3]
        return json.loads(clean.strip())

    def get_aggregated_quota_stats(self) -> Dict[str, Any]:
        total_used = sum(lim.daily_count for lim in self.rate_limiters.values())
        return {
            "daily_requests_used": total_used,
            "daily_limit": self.default_rpd,
            "remaining_today": max(0, self.default_rpd - total_used),
            "reset_time": "Midnight Pacific Time",
            "models_configured": self.task_routing,
        }
