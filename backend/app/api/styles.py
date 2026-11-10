import os
import json
import tempfile
import subprocess
from pathlib import Path
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel

from backend.app.services.render.spec import StyleSpec
from backend.app.services.render.engine import RenderEngine

router = APIRouter(prefix="/api/styles", tags=["Styles (Style Studio)"])
engine = RenderEngine()

STYLES_DIR = Path("styles/builtin")

class PreviewRequest(BaseModel):
    style_id: str
    title: str = "SAMPLE PRODUCT TITLE"
    subtitle: str = "MUST HAVE CREATOR DEAL"
    sample_duration: float = 5.0

@router.get("")
async def list_styles() -> List[Dict[str, Any]]:
    """Lists all available styles (5 built-in + user created)."""
    styles = []
    if STYLES_DIR.exists():
        for p in sorted(STYLES_DIR.glob("*.style.json")):
            try:
                data = json.loads(p.read_text(encoding="utf-8"))
                styles.append({
                    "id": data.get("id", p.stem.replace(".style", "")),
                    "name": data.get("name", p.stem),
                    "description": data.get("description", ""),
                    "crop_mode": data.get("clip_rules", {}).get("crop_mode", "cover"),
                    "cut_mode": data.get("cut_logic", {}).get("mode", "beat_synced"),
                    "transitions_enabled": data.get("transitions", {}).get("enabled", False),
                    "spec": data,
                })
            except Exception:
                pass
    return styles

@router.get("/{style_id}")
async def get_style(style_id: str) -> Dict[str, Any]:
    spec = engine.get_style(style_id)
    return spec.model_dump()

@router.post("")
async def save_style(spec: StyleSpec) -> Dict[str, Any]:
    STYLES_DIR.mkdir(parents=True, exist_ok=True)
    out_file = STYLES_DIR / f"{spec.id}.style.json"
    out_file.write_text(spec.model_dump_json(indent=2), encoding="utf-8")
    return {"message": "Style saved", "id": spec.id}

@router.post("/{style_id}/duplicate")
async def duplicate_style(style_id: str) -> Dict[str, Any]:
    orig = engine.get_style(style_id)
    new_id = f"{style_id}_copy_{os.urandom(2).hex()}"
    new_spec = orig.model_copy(update={"id": new_id, "name": f"{orig.name} (Copy)"})
    out_file = STYLES_DIR / f"{new_id}.style.json"
    out_file.write_text(new_spec.model_dump_json(indent=2), encoding="utf-8")
    return {"message": "Style duplicated", "id": new_id, "name": new_spec.name}

@router.post("/preview")
async def render_preview(req: PreviewRequest) -> Dict[str, Any]:
    """Generates a quick 5-second preview video from synthetic/sample clips for the Style Studio phone canvas."""
    spec = engine.get_style(req.style_id)
    
    with tempfile.TemporaryDirectory() as td:
        sample_clip = Path(td) / "sample_clip.mp4"
        sample_music = Path(td) / "sample_music.wav"
        preview_out = Path("data/previews") / f"preview_{req.style_id}.mp4"
        preview_out.parent.mkdir(parents=True, exist_ok=True)

        # Generate synthetic 5s clip and tone
        cmd_clip = [
            "ffmpeg", "-y", "-v", "error", "-f", "lavfi",
            "-i", "testsrc=size=1080x1920:rate=30", "-t", "6.0",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", str(sample_clip)
        ]
        subprocess.run(cmd_clip, check=True)

        cmd_music = [
            "ffmpeg", "-y", "-v", "error", "-f", "lavfi",
            "-i", "sine=frequency=440:beep_factor=2", "-t", "6.0",
            str(sample_music)
        ]
        subprocess.run(cmd_music, check=True)

        try:
            info = engine.render_video(
                clip_paths=[sample_clip, sample_clip],
                music_path=sample_music,
                title=req.title,
                subtitle=req.subtitle,
                style_id=req.style_id,
                out_path=preview_out,
                min_duration=3.0,
                max_duration=req.sample_duration,
            )
            return {
                "status": "success",
                "preview_url": f"/api/styles/preview-video/{preview_out.name}",
                "duration": info.get("duration", 5.0),
                "segments": info.get("segments", 2),
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Preview generation failed: {str(e)}")
