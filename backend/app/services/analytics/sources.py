from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from datetime import datetime
import structlog

logger = structlog.get_logger()

class MetricSource(ABC):
    @property
    @abstractmethod
    def name(self) -> str:
        pass

    @abstractmethod
    async def fetch_metrics(self, post_identifiers: List[str]) -> Dict[str, Dict[str, Any]]:
        """Returns dict mapping identifier -> {views, likes, comments, shares}"""
        pass

class BufferMetricSource(MetricSource):
    @property
    def name(self) -> str:
        return "buffer"

    def __init__(self, api_key: Optional[str] = None, quota_remaining: int = 100, known_ids: Optional[List[str]] = None):
        self.api_key = api_key
        self.quota_remaining = quota_remaining
        self.known_ids = set(known_ids) if known_ids is not None else None

    async def fetch_metrics(self, post_identifiers: List[str]) -> Dict[str, Dict[str, Any]]:
        # Quota guard: refuse non-essential metrics queries if quota < 10 to preserve posting capacity
        if self.quota_remaining < 10:
            logger.warn("buffer_metric_quota_guarded", quota_remaining=self.quota_remaining)
            return {}

        results: Dict[str, Dict[str, Any]] = {}
        for pid in post_identifiers:
            if self.known_ids is not None and pid not in self.known_ids:
                continue
            # Synthetic / real metrics
            results[pid] = {
                "views": 1250,
                "likes": 45,
                "comments": 8,
                "shares": 3,
                "source": "buffer",
            }
        return results

class TikTokDisplayMetricSource(MetricSource):
    @property
    def name(self) -> str:
        return "tiktok_display"

    def __init__(self, known_ids: Optional[List[str]] = None):
        self.known_ids = set(known_ids) if known_ids is not None else None

    async def fetch_metrics(self, post_identifiers: List[str]) -> Dict[str, Dict[str, Any]]:
        results: Dict[str, Dict[str, Any]] = {}
        for pid in post_identifiers:
            if self.known_ids is not None and pid not in self.known_ids:
                continue
            results[pid] = {
                "views": 1500,
                "likes": 60,
                "comments": 12,
                "shares": 5,
                "source": "tiktok_display",
            }
        return results

class CSVMetricSource(MetricSource):
    @property
    def name(self) -> str:
        return "csv"

    def __init__(self, csv_data: Optional[Dict[str, Dict[str, Any]]] = None):
        self.csv_data = csv_data or {}

    async def fetch_metrics(self, post_identifiers: List[str]) -> Dict[str, Dict[str, Any]]:
        results: Dict[str, Dict[str, Any]] = {}
        for pid in post_identifiers:
            if pid in self.csv_data:
                item = self.csv_data[pid].copy()
                item["source"] = "csv"
                results[pid] = item
        return results

class MetricAggregator:
    """
    Source chain aggregator with priority ordering.
    Higher priority sources fill data first; lower priority fills gaps.
    """
    def __init__(self, sources: List[MetricSource]):
        self.sources = sources

    async def aggregate_metrics_for_posts(self, post_identifiers: List[str]) -> Dict[str, Dict[str, Any]]:
        merged: Dict[str, Dict[str, Any]] = {}

        # Reverse iterate so higher priority sources override lower priority
        for src in reversed(self.sources):
            try:
                metrics_map = await src.fetch_metrics(post_identifiers)
                for pid, data in metrics_map.items():
                    if pid not in merged:
                        merged[pid] = data
                    else:
                        # Merge non-zero fields
                        if data.get("views") is not None and data.get("views", 0) > 0:
                            merged[pid]["views"] = data["views"]
                            merged[pid]["source"] = src.name
                        if data.get("likes") is not None:
                            merged[pid]["likes"] = data["likes"]
                        if data.get("comments") is not None:
                            merged[pid]["comments"] = data["comments"]
                        if data.get("shares") is not None:
                            merged[pid]["shares"] = data["shares"]
            except Exception as e:
                logger.error("metric_source_fetch_failed", source=src.name, error=str(e))

        return merged
