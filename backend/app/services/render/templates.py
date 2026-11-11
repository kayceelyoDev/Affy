import os
import re
import json
from pathlib import Path
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

TEMPLATES_DIRS = [
    Path("data/templates"),
    Path("/app/data/templates"),
    Path("backend/data/templates"),
]

DEFAULT_TEMPLATES: List[Dict[str, Any]] = [
    {
        "id": "tpl_viral_deal_drop",
        "name": "Viral Deal Drop",
        "description": "High-energy beat drops, kinetic snap zooms, Anton yellow title hook, and fixed viral beat.",
        "fixed_music_track": "downloadsv2 (1).mp3",
        "base_style_id": "punchy_zoom",
        "crop_mode": "auto",
        "title_color": "#EFD34C",
        "title_font_size": 130,
        "title_y": 240,
        "subtitle_color": "#FFFFFF",
        "subtitle_font_size": 60,
        "subtitle_y": 380,
        "target_duration": 6.0,
        "is_custom": False,
    },
    {
        "id": "tpl_aesthetic_showcase",
        "name": "Aesthetic Showcase",
        "description": "Polished ambient showcase with smooth float drifts, contain-blur backdrop, clean neon cyan typography, and fixed chill beat.",
        "fixed_music_track": "downloadsv2 (2).mp3",
        "base_style_id": "smooth_flow",
        "crop_mode": "contain_blur",
        "title_color": "#00F0FF",
        "title_font_size": 120,
        "title_y": 250,
        "subtitle_color": "#FFFFFF",
        "subtitle_font_size": 56,
        "subtitle_y": 390,
        "target_duration": 6.0,
        "is_custom": False,
    },
    {
        "id": "tpl_promo_pop",
        "name": "Flash Promo Pop",
        "description": "Punchy red & gold discount deal format with snap zooms and dynamic motion for instant TikTok impulse buys.",
        "fixed_music_track": "download (3).mp3",
        "base_style_id": "promo_pop",
        "crop_mode": "auto",
        "title_color": "#FF2E54",
        "title_font_size": 130,
        "title_y": 240,
        "subtitle_color": "#FFD700",
        "subtitle_font_size": 64,
        "subtitle_y": 380,
        "target_duration": 6.0,
        "is_custom": False,
    },
]

class TemplateSpec(BaseModel):
    id: str
    name: str
    description: Optional[str] = ""
    fixed_music_track: str
    base_style_id: str = "punchy_zoom"
    crop_mode: str = "auto"
    title_color: str = "#EFD34C"
    title_font_size: int = 130
    title_y: int = 240
    subtitle_color: str = "#FFFFFF"
    subtitle_font_size: int = 60
    subtitle_y: int = 380
    target_duration: float = 6.0
    is_custom: bool = False
    is_default: bool = False

def get_templates_dir() -> Path:
    for d in TEMPLATES_DIRS:
        if d.exists():
            return d
    # Create the primary one
    primary = TEMPLATES_DIRS[0]
    primary.mkdir(parents=True, exist_ok=True)
    return primary

def seed_default_templates_if_needed():
    tdir = get_templates_dir()
    for default_tpl in DEFAULT_TEMPLATES:
        tpl_file = tdir / f"{default_tpl['id']}.json"
        if not tpl_file.exists():
            try:
                tpl_file.write_text(json.dumps(default_tpl, indent=2), encoding="utf-8")
            except Exception:
                pass

def list_all_templates() -> List[Dict[str, Any]]:
    seed_default_templates_if_needed()
    tdir = get_templates_dir()
    templates = []
    seen = set()

    # Search all candidate directories
    search_dirs = [tdir]
    for d in TEMPLATES_DIRS:
        if d.exists() and d not in search_dirs:
            search_dirs.append(d)

    for sd in search_dirs:
        for f in sorted(sd.glob("*.json")):
            try:
                data = json.loads(f.read_text(encoding="utf-8"))
                tid = data.get("id", f.stem)
                if tid not in seen:
                    seen.add(tid)
                    templates.append(data)
            except Exception:
                pass

    if not templates:
        return [dict(t) for t in DEFAULT_TEMPLATES]

    return templates

def get_template_by_id(template_id: str) -> Optional[Dict[str, Any]]:
    clean_id = template_id.replace("template:", "").strip()
    tdir = get_templates_dir()
    candidates = [
        tdir / f"{clean_id}.json",
        Path("data/templates") / f"{clean_id}.json",
        Path("/app/data/templates") / f"{clean_id}.json",
    ]
    for c in candidates:
        if c.exists():
            try:
                return json.loads(c.read_text(encoding="utf-8"))
            except Exception:
                pass

    # Check defaults fallback
    for dt in DEFAULT_TEMPLATES:
        if dt["id"] == clean_id:
            return dict(dt)

    return None

def save_template_spec(spec_data: Dict[str, Any]) -> Dict[str, Any]:
    tid = spec_data.get("id")
    if not tid:
        slug = re.sub(r'[^a-zA-Z0-9_]', '_', spec_data.get("name", "template").lower())
        tid = f"tpl_{slug}_{os.urandom(2).hex()}"
        spec_data["id"] = tid

    # Save to both data/templates and /app/data/templates if available
    for d in TEMPLATES_DIRS:
        try:
            d.mkdir(parents=True, exist_ok=True)
            (d / f"{tid}.json").write_text(json.dumps(spec_data, indent=2), encoding="utf-8")
        except Exception:
            pass

    return spec_data

def delete_template_by_id(template_id: str) -> bool:
    clean_id = template_id.replace("template:", "").strip()
    deleted = False
    for d in TEMPLATES_DIRS:
        f = d / f"{clean_id}.json"
        if f.exists():
            try:
                f.unlink()
                deleted = True
            except Exception:
                pass
    return deleted
