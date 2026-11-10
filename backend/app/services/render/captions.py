import hashlib
import json
import subprocess
import tempfile
from pathlib import Path
from typing import List, Dict, Any, Optional

import structlog
from pydantic import BaseModel

from backend.app.services.ai.gateway import AIGateway

logger = structlog.get_logger("clip_captions")

class ClipCaptionItem(BaseModel):
    clip_index: int
    caption: str

class VideoClipCaptionsResult(BaseModel):
    captions: List[ClipCaptionItem]

# Fallback phrase bank per product category
DEFAULT_PHRASE_BANK = [
    "High quality build and feel",
    "Super easy to use anywhere",
    "Crisp sound and clear audio",
    "Compact and lightweight design",
    "Must have creator essential",
    "Fast and reliable performance",
    "Smooth finish premium look",
    "Worth every single peso",
]

class ClipCaptionService:
    def __init__(self, ai_gateway: Optional[AIGateway] = None):
        self.ai = ai_gateway or AIGateway()
        self._cache: Dict[str, str] = {}

    def extract_clip_sample_frames(self, clip_path: Path, num_frames: int = 2) -> List[bytes]:
        """Extracts 2-3 sample frames from video clip as JPEG bytes."""
        frames = []
        with tempfile.TemporaryDirectory() as td:
            # Capture frame at 25% and 75% through
            pattern = Path(td) / "frame_%02d.jpg"
            cmd = [
                "ffmpeg", "-y", "-v", "error", "-i", str(clip_path),
                "-vf", f"fps=0.5,scale=540:960", "-frames:v", str(num_frames),
                str(pattern)
            ]
            subprocess.run(cmd, capture_output=True)
            for f in sorted(Path(td).glob("frame_*.jpg")):
                frames.append(f.read_bytes())
        return frames

    def get_clip_hash(self, clip_path: Path) -> str:
        h = hashlib.sha256()
        with open(clip_path, "rb") as f:
            chunk = f.read(65536)
            h.update(chunk)
        return h.hexdigest()

    async def generate_clip_captions_for_video(
        self,
        clip_paths: List[Path],
        product_name: str,
        language: str = "en",
    ) -> List[str]:
        """Batches 2-3 sample frames per clip into a single vision call, returning 3-6 word punchy captions."""
        results: List[str] = []
        missing_clips = []
        missing_indices = []

        for idx, cp in enumerate(clip_paths):
            clip_hash = self.get_clip_hash(cp)
            cache_key = f"{clip_hash}:{product_name}:{language}"
            if cache_key in self._cache:
                results.append(self._cache[cache_key])
            else:
                results.append("")
                missing_clips.append(cp)
                missing_indices.append(idx)

        if not missing_clips:
            return results

        # Gather sample frames
        all_frames: List[bytes] = []
        for cp in missing_clips:
            clip_frames = self.extract_clip_sample_frames(cp, num_frames=2)
            if clip_frames:
                all_frames.extend(clip_frames[:2])

        # If no AI key available or mock environment, use deterministic phrase bank
        system_instruction = (
            f"You are a TikTok video editor creating short 3-6 word on-screen subtitles for product '{product_name}'. "
            f"Write punchy, engaging Taglish or English phrases describing what is visually shown. "
            f"Never invent specs. Exactly 3 to 6 words per clip."
        )

        try:
            res = await self.ai.call(
                task="vision_extraction",
                prompt_version="v1.0",
                response_schema=VideoClipCaptionsResult,
                images=all_frames[:10],
                system_instruction=system_instruction,
            )
            data: VideoClipCaptionsResult = res["data"]
            for item in data.captions:
                if item.clip_index < len(missing_indices):
                    target_idx = missing_indices[item.clip_index]
                    results[target_idx] = item.caption
                    # Cache
                    clip_hash = self.get_clip_hash(missing_clips[item.clip_index])
                    self._cache[f"{clip_hash}:{product_name}:{language}"] = item.caption
        except Exception as e:
            logger.warning("ai_caption_fallback", error=str(e))

        # Fill any missing with fallback phrase bank
        for i, val in enumerate(results):
            if not val:
                fallback_phrase = DEFAULT_PHRASE_BANK[i % len(DEFAULT_PHRASE_BANK)]
                results[i] = fallback_phrase

        return results
