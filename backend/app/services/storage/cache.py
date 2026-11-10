import os
import time
from pathlib import Path
from typing import Optional
from backend.app.core.config import settings
from backend.app.core.logging import logger

class LRUCacheManager:
    """Size-capped LRU local disk cache for remote media files with strict job locks."""

    def __init__(self, cache_dir: Optional[Path] = None, max_bytes: int = 5 * 1024 * 1024 * 1024):
        self.cache_dir = (cache_dir or (settings.DATA_DIR / "cache")).resolve()
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.max_bytes = max_bytes
        self.locked_files: set[str] = set()
        self.access_times: dict[str, float] = {}

        # Scan existing files on startup
        self._rescan_cache()

    def _rescan_cache(self):
        for root, _, files in os.walk(self.cache_dir):
            for f in files:
                p = Path(root) / f
                rel = p.relative_to(self.cache_dir).as_posix()
                try:
                    self.access_times[rel] = p.stat().st_atime
                except Exception:
                    self.access_times[rel] = time.time()

    def lock_file(self, rel_path: str):
        """Lock file to prevent LRU eviction while in use by rendering/posting jobs."""
        clean = rel_path.lstrip("/\\")
        self.locked_files.add(clean)
        logger.debug("File locked in cache", path=clean)

    def unlock_file(self, rel_path: str):
        """Unlock file once job finishes."""
        clean = rel_path.lstrip("/\\")
        self.locked_files.discard(clean)
        logger.debug("File unlocked in cache", path=clean)

    def is_locked(self, rel_path: str) -> bool:
        clean = rel_path.lstrip("/\\")
        return clean in self.locked_files

    def touch(self, rel_path: str):
        clean = rel_path.lstrip("/\\")
        self.access_times[clean] = time.time()

    def get_current_size(self) -> int:
        total = 0
        for root, _, files in os.walk(self.cache_dir):
            for f in files:
                try:
                    total += (Path(root) / f).stat().st_size
                except Exception:
                    pass
        return total

    def put(self, rel_path: str, data: bytes) -> Path:
        clean = rel_path.lstrip("/\\")
        dest = self.cache_dir / clean
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        self.access_times[clean] = time.time()
        self.evict_if_needed()
        return dest

    def evict_if_needed(self) -> list[str]:
        """Evicts oldest unlocked files until total cache usage is below max_bytes."""
        evicted: list[str] = []
        current_size = self.get_current_size()
        if current_size <= self.max_bytes:
            return evicted

        # Sort candidate files by access time (oldest first)
        candidates = sorted(
            [p for p in self.access_times.keys() if p not in self.locked_files],
            key=lambda p: self.access_times.get(p, 0.0)
        )

        for rel in candidates:
            if current_size <= self.max_bytes:
                break
            full_path = self.cache_dir / rel
            if full_path.exists() and full_path.is_file():
                try:
                    file_size = full_path.stat().st_size
                    full_path.unlink()
                    current_size -= file_size
                    del self.access_times[rel]
                    evicted.append(rel)
                    logger.info("Evicted LRU cached asset", path=rel, freed_bytes=file_size)
                except Exception as e:
                    logger.error("Failed to evict file", path=rel, error=str(e))

        if current_size > self.max_bytes:
            logger.warning(
                "Cache size exceeded quota, but remaining files are locked by active jobs",
                current_size=current_size,
                max_bytes=self.max_bytes,
                locked_count=len(self.locked_files)
            )

        return evicted

lru_cache = LRUCacheManager()
