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
        "slots": [
            {
                "slot_index": 0,
                "duration": 1.2,
                "transition": "snap_zoom",
                "motion": "zoom_punch",
                "crop_mode": "auto",
                "label": "Hook Opening",
            },
            {
                "slot_index": 1,
                "duration": 0.8,
                "transition": "whip_left",
                "motion": "macro_focus",
                "crop_mode": "auto",
                "label": "Beat Drop",
            },
            {
                "slot_index": 2,
                "duration": 1.4,
                "transition": "whip_right",
                "motion": "zoom_punch",
                "crop_mode": "auto",
                "label": "Key Feature",
            },
            {
                "slot_index": 3,
                "duration": 1.1,
                "transition": "swish_up",
                "motion": "macro_focus",
                "crop_mode": "auto",
                "label": "In-Hand Demo",
            },
            {
                "slot_index": 4,
                "duration": 1.5,
                "transition": "dissolve",
                "motion": "overview",
                "crop_mode": "auto",
                "label": "CTA / Outro",
            },
        ],
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
        "target_duration": 6.5,
        "is_custom": False,
        "slots": [
            {
                "slot_index": 0,
                "duration": 1.8,
                "transition": "dissolve",
                "motion": "float_drift",
                "crop_mode": "contain_blur",
                "label": "Ambient Intro",
            },
            {
                "slot_index": 1,
                "duration": 1.4,
                "transition": "dissolve",
                "motion": "macro_focus",
                "crop_mode": "contain_blur",
                "label": "Texture Glide",
            },
            {
                "slot_index": 2,
                "duration": 1.6,
                "transition": "dissolve",
                "motion": "overview",
                "crop_mode": "contain_blur",
                "label": "Design Angles",
            },
            {
                "slot_index": 3,
                "duration": 1.7,
                "transition": "dissolve",
                "motion": "float_drift",
                "crop_mode": "contain_blur",
                "label": "Aesthetic Close",
            },
        ],
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
        "target_duration": 5.6,
        "is_custom": False,
        "slots": [
            {
                "slot_index": 0,
                "duration": 1.0,
                "transition": "snap_zoom",
                "motion": "zoom_punch",
                "crop_mode": "auto",
                "label": "Price Alert",
            },
            {
                "slot_index": 1,
                "duration": 0.9,
                "transition": "whip_right",
                "motion": "macro_focus",
                "crop_mode": "auto",
                "label": "Flash Detail",
            },
            {
                "slot_index": 2,
                "duration": 1.2,
                "transition": "snap_zoom",
                "motion": "zoom_punch",
                "crop_mode": "auto",
                "label": "Discount Value",
            },
            {
                "slot_index": 3,
                "duration": 1.1,
                "transition": "whip_left",
                "motion": "macro_focus",
                "crop_mode": "auto",
                "label": "Unbox / Touch",
            },
            {
                "slot_index": 4,
                "duration": 1.4,
                "transition": "dissolve",
                "motion": "overview",
                "crop_mode": "auto",
                "label": "Urgent CTA",
            },
        ],
    },
]

class TimelineSlot(BaseModel):
    slot_index: int
    duration: float
    transition: str = "snap_zoom"  # snap_zoom, whip_left, whip_right, swish_up, dissolve, none
    motion: str = "zoom_punch"     # zoom_punch, macro_focus, overview, float_drift, slow_zoom, none
    crop_mode: str = "auto"        # auto, contain_blur, cover
    label: Optional[str] = ""

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
    slots: List[Dict[str, Any]] = []

def get_templates_dir() -> Path:
    for d in TEMPLATES_DIRS:
        if d.exists():
            return d
    primary = TEMPLATES_DIRS[0]
    primary.mkdir(parents=True, exist_ok=True)
    return primary

def seed_default_templates_if_needed():
    tdir = get_templates_dir()
    for default_tpl in DEFAULT_TEMPLATES:
        tpl_file = tdir / f"{default_tpl['id']}.json"
        should_write = False
        if not tpl_file.exists():
            should_write = True
        else:
            try:
                data = json.loads(tpl_file.read_text(encoding="utf-8"))
                if "slots" not in data or not data["slots"]:
                    should_write = True
            except Exception:
                should_write = True

        if should_write:
            try:
                tpl_file.write_text(json.dumps(default_tpl, indent=2), encoding="utf-8")
            except Exception:
                pass

def list_all_templates() -> List[Dict[str, Any]]:
    seed_default_templates_if_needed()
    tdir = get_templates_dir()
    templates = []
    seen = set()

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
                    # Ensure slots exists
                    if "slots" not in data or not data["slots"]:
                        # Match with default template slots if available
                        for dt in DEFAULT_TEMPLATES:
                            if dt["id"] == tid:
                                data["slots"] = dt["slots"]
                                break
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
                data = json.loads(c.read_text(encoding="utf-8"))
                if ("slots" not in data or not data["slots"]):
                    for dt in DEFAULT_TEMPLATES:
                        if dt["id"] == clean_id:
                            data["slots"] = dt["slots"]
                            break
                return data
            except Exception:
                pass

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

    # Ensure slot indexes and durations are clean
    if "slots" in spec_data and isinstance(spec_data["slots"], list):
        for idx, s in enumerate(spec_data["slots"]):
            s["slot_index"] = idx
            s["duration"] = round(max(0.3, float(s.get("duration", 1.2))), 2)
            if "transition" not in s:
                s["transition"] = "snap_zoom"
            if "motion" not in s:
                s["motion"] = "zoom_punch"
            if "crop_mode" not in s:
                s["crop_mode"] = spec_data.get("crop_mode", "auto")
            if "label" not in s:
                s["label"] = f"Slot #{idx + 1}"
        spec_data["target_duration"] = round(sum(s["duration"] for s in spec_data["slots"]), 2)

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
