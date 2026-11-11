import os
import json
import tempfile
import subprocess
from pathlib import Path
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select

from backend.app.core.database import AsyncSessionLocal
from backend.app.models.models import Product, Clip, Setting
from backend.app.services.render.spec import StyleSpec
from backend.app.services.render.engine import RenderEngine

router = APIRouter(prefix="/api/styles", tags=["Styles (Style Studio)"])
engine = RenderEngine()

STYLES_DIR = Path("styles/builtin")

class PreviewRequest(BaseModel):
    style_id: str
    product_id: Optional[int] = None
    title: Optional[str] = None
    subtitle: Optional[str] = None
    sample_duration: float = 6.0

@router.get("")
async def list_styles() -> List[Dict[str, Any]]:
    """Lists all available styles (5 built-in + user created)."""
    styles = []
    # Check default style from settings
    default_style = "classic_hook"
    async with AsyncSessionLocal() as db:
        setting_stmt = select(Setting).where(Setting.key == "DEFAULT_RENDER_STYLE")
        setting_rec = (await db.execute(setting_stmt)).scalar_one_or_none()
        if setting_rec and setting_rec.value:
            default_style = setting_rec.value.strip()

    if STYLES_DIR.exists():
        for p in sorted(STYLES_DIR.glob("*.style.json")):
            try:
                data = json.loads(p.read_text(encoding="utf-8"))
                sid = data.get("id", p.stem.replace(".style", ""))
                styles.append({
                    "id": sid,
                    "name": data.get("name", p.stem),
                    "description": data.get("description", ""),
                    "crop_mode": data.get("clip_rules", {}).get("crop_mode", "cover"),
                    "cut_mode": data.get("cut_logic", {}).get("mode", "beat_synced"),
                    "transitions_enabled": data.get("transitions", {}).get("enabled", False),
                    "is_default": sid == default_style,
                    "spec": data,
                })
            except Exception:
                pass
    return styles

@router.get("/{style_id}")
async def get_style(style_id: str) -> Dict[str, Any]:
    spec = engine.get_style(style_id)
    return spec.model_dump()

@router.post("/{style_id}/set-default")
async def set_default_style_endpoint(style_id: str) -> Dict[str, Any]:
    """Sets this style as the global DEFAULT_RENDER_STYLE in settings."""
    clean_id = style_id.lower()
    async with AsyncSessionLocal() as db:
        stmt = select(Setting).where(Setting.key == "DEFAULT_RENDER_STYLE")
        rec = (await db.execute(stmt)).scalar_one_or_none()
        if rec:
            rec.value = clean_id
        else:
            rec = Setting(key="DEFAULT_RENDER_STYLE", value=clean_id, description="Default render style", is_secret=False)
            db.add(rec)

        # Also update any open/unposted slots in today's plan
        from datetime import datetime
        from backend.app.models.models import Plan, PlanSlot
        today_str = datetime.utcnow().strftime("%Y-%m-%d")
        plan_stmt = select(Plan).where(Plan.date == today_str)
        plan = (await db.execute(plan_stmt)).scalars().first()
        if plan:
            slots_stmt = select(PlanSlot).where(PlanSlot.plan_id == plan.id)
            slots = (await db.execute(slots_stmt)).scalars().all()
            for s in slots:
                if s.status not in ("posted", "published"):
                    s.style_id = clean_id
                    # Reset render_id if user wants to re-render with newly chosen default
                    s.render_id = None
                    s.status = "pending"

        await db.commit()
    return {"ok": True, "style_id": clean_id, "message": f"Default style set to {clean_id}"}

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

@router.get("/preview-video/{filename}")
async def get_preview_video(filename: str):
    """Streams preview video rendered by Style Studio."""
    candidate_paths = [
        Path("data/previews") / filename,
        Path("/app/data/previews") / filename,
    ]
    for p in candidate_paths:
        if p.exists():
            return FileResponse(str(p), media_type="video/mp4")
    raise HTTPException(status_code=404, detail="Preview video file not found")

@router.post("/preview")
async def render_preview(req: PreviewRequest) -> Dict[str, Any]:
    """Generates a fast 5-second preview video using real product clips and Anton typography."""
    spec = engine.get_style(req.style_id)
    
    # 1. Resolve clips from product if provided
    clip_paths = []
    title = req.title or "TRENDING AFFILIATE FIND"
    subtitle = req.subtitle or "MUST-HAVE CREATOR DEAL"

    if req.product_id:
        async with AsyncSessionLocal() as db:
            prod = await db.get(Product, req.product_id)
            if prod:
                if not req.title:
                    title = prod.name
                clip_stmt = select(Clip).where(Clip.product_id == prod.id, Clip.status == "usable")
                clips = (await db.execute(clip_stmt)).scalars().all()
                for c in clips:
                    for base in [Path("data"), Path("/app/data")]:
                        target = base / c.file_path
                        if target.exists():
                            clip_paths.append(target)
                            break

    # 2. Resolve background music
    music_path = None
    data_music = list(Path("data/music").glob("*.mp3")) + list(Path("/app/data/music").glob("*.mp3"))
    if data_music:
        music_path = data_music[0]
    else:
        legacy_music = list(Path("legacy_private/video-editor/music").glob("*.mp3"))
        if legacy_music:
            music_path = legacy_music[0]

    with tempfile.TemporaryDirectory() as td:
        if not clip_paths:
            # Fallback synthetic 1080x1920 test clip
            sample_clip = Path(td) / "sample_clip.mp4"
            cmd_clip = [
                "ffmpeg", "-y", "-v", "error", "-f", "lavfi",
                "-i", "testsrc=size=1080x1920:rate=30", "-t", "6.0",
                "-c:v", "libx264", "-pix_fmt", "yuv420p", str(sample_clip)
            ]
            subprocess.run(cmd_clip, check=True)
            clip_paths = [sample_clip, sample_clip]
        elif len(clip_paths) == 1:
            clip_paths = [clip_paths[0], clip_paths[0]]

        if not music_path:
            sample_music = Path(td) / "sample_music.wav"
            cmd_music = [
                "ffmpeg", "-y", "-v", "error", "-f", "lavfi",
                "-i", "sine=frequency=440:beep_factor=2", "-t", "6.0",
                str(sample_music)
            ]
            subprocess.run(cmd_music, check=True)
            music_path = sample_music

        preview_dir = Path("data/previews")
        if not preview_dir.exists():
            preview_dir = Path("/app/data/previews")
        preview_dir.mkdir(parents=True, exist_ok=True)
        preview_filename = f"preview_{req.style_id}_{os.urandom(3).hex()}.mp4"
        preview_out = preview_dir / preview_filename

        try:
            info = engine.render_video(
                clip_paths=clip_paths[:4],
                music_path=music_path,
                title=title,
                subtitle=subtitle,
                style_id=req.style_id,
                out_path=preview_out,
                min_duration=3.0,
                max_duration=req.sample_duration,
            )
            return {
                "status": "success",
                "preview_url": f"/api/styles/preview-video/{preview_filename}",
                "duration": info.get("duration", 5.0),
                "segments": info.get("segments", 2),
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Preview generation failed: {str(e)}")
