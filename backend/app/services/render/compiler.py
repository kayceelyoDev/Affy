import os
from pathlib import Path
from typing import List, Tuple, Dict, Any, Optional
from PIL import ImageFont

from backend.app.services.render.spec import StyleSpec, TextLayerConfig

def ffmpeg_escape_path(p: Path) -> str:
    s = str(p).replace("\\", "/")
    if len(s) >= 2 and s[1] == ":":
        s = s[0] + "\\:" + s[2:]
    return s.replace("'", "\\'")

def escape_drawtext(text: str) -> str:
    return (
        text.replace("\\", "\\\\")
        .replace("'", "'\\''")
        .replace(":", "\\:")
        .replace("%", "\\%")
    )

def resolve_font_path(font_file: str) -> str:
    candidates = [
        Path(font_file),
        Path("fonts") / Path(font_file).name,
        Path("/app/fonts") / Path(font_file).name,
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
        Path("legacy_private/video-editor/app/fonts/Anton-Regular.ttf"),
    ]
    for c in candidates:
        if c.exists():
            return str(c.resolve())
    return "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

def get_text_width(text: str, font_path: str, size: int) -> float:
    try:
        font = ImageFont.truetype(font_path, size)
        return float(font.getlength(text))
    except Exception:
        return float(len(text) * size * 0.6)

def fit_font_size(lines: List[str], max_w: int, start_size: int, font_path: str, minimum: int = 40) -> int:
    size = start_size
    while size > minimum and max(get_text_width(t, font_path, size) for t in lines) > max_w:
        size -= 2
    return size

def prepare_title_lines(title: str, subtitle: str, max_w: int, font_path: str) -> Tuple[str, str]:
    t1 = title.strip().upper()
    t2 = subtitle.strip().upper() if subtitle else ""
    if not t2:
        if "\n" in t1:
            parts = [p.strip() for p in t1.split("\n") if p.strip()]
            t1, t2 = parts[0], " ".join(parts[1:])
        else:
            for sep in (" // ", " | ", " - "):
                if sep in t1:
                    t1, t2 = [p.strip() for p in t1.split(sep, 1)]
                    break
            else:
                words = t1.split()
                if len(words) >= 4 and fit_font_size([t1], max_w, 125, font_path) < 90:
                    best = min(
                        range(1, len(words)),
                        key=lambda i: abs(len(" ".join(words[:i])) - len(" ".join(words[i:]))),
                    )
                    t1, t2 = " ".join(words[:best]), " ".join(words[best:])
    return t1, t2

def compile_text_filters(
    spec: StyleSpec,
    title: str,
    subtitle: str,
    workdir: Path,
    clip_caption: str = "",
) -> str:
    """Compiles typography and overlay layers into FFmpeg drawtext filter string."""
    filters = []
    w = spec.canvas.width
    font_path = resolve_font_path("fonts/Anton-Regular.ttf")

    title_layer = next((l for l in spec.text_layers if l.name == "title"), None)
    sub_layer = next((l for l in spec.text_layers if l.name == "subtitle"), None)
    caption_layer = next((l for l in spec.text_layers if l.name == "clip_caption"), None)
    cta_layer = next((l for l in spec.text_layers if l.name == "cta"), None)

    # 1. Title and Subtitle processing
    if title_layer:
        max_w = int(w * title_layer.width_ratio)
        layer_font = resolve_font_path(title_layer.font_file) or font_path
        t1, t2 = prepare_title_lines(title, subtitle, max_w, layer_font)
        
        lines = [t for t in (t1, t2) if t]
        size = fit_font_size(lines, max_w, title_layer.max_size, layer_font)
        cap = int(size * 0.86)
        gap = int(cap * 0.40)
        stroke = max(2, size // 55)
        
        y = title_layer.position_y
        for i, text_val in enumerate(lines):
            t_file = workdir / f"t_{i}.txt"
            t_file.write_text(text_val, encoding="utf-8")
            
            color = title_layer.color if i == 0 else (sub_layer.color if sub_layer else "white")
            alpha_expr = ""
            anim = title_layer.animation or ("pop_in" if spec.id == "punchy_zoom" else ("fade_out_2s" if spec.id == "smooth_flow" else "none"))
            if anim == "fade_out_2s":
                alpha_expr = ":alpha='if(lt(t,2.2),min(t/0.35,1),max(0,1-(t-2.2)/0.4))'"
            elif anim == "fade_in":
                alpha_expr = ":alpha='min(t/0.35,1)'"
            elif anim == "pop_in":
                alpha_expr = ":alpha='if(lt(t,0.06),0,1)'"
                
            filters.append(
                f"drawtext=fontfile='{ffmpeg_escape_path(Path(layer_font))}':"
                f"textfile='{ffmpeg_escape_path(t_file)}':"
                f"fontsize={size}:fontcolor={color}:"
                f"borderw={stroke}:bordercolor={title_layer.stroke_color}:"
                f"x=(w-text_w)/2:y={y}{alpha_expr}"
            )
            y += cap + gap + int(size * 0.14)

    # 2. Per-clip caption (for Styles 2, 3, 5)
    if caption_layer and clip_caption:
        cap_file = workdir / f"cap_{abs(hash(clip_caption)) % 10000}.txt"
        cap_file.write_text(clip_caption.strip().upper(), encoding="utf-8")
        cap_font = resolve_font_path(caption_layer.font_file) or font_path
        
        box_args = ""
        if caption_layer.box:
            box_args = f":box=1:boxcolor={caption_layer.box_color}:boxborderw={caption_layer.box_border_w or 6}"
            
        filters.append(
            f"drawtext=fontfile='{ffmpeg_escape_path(Path(cap_font))}':"
            f"textfile='{ffmpeg_escape_path(cap_file)}':"
            f"fontsize={caption_layer.max_size}:fontcolor={caption_layer.color}:"
            f"borderw={caption_layer.stroke_width}:bordercolor={caption_layer.stroke_color}:"
            f"x=(w-text_w)/2:y={caption_layer.position_y}{box_args}"
        )

    # 3. Call to Action (CTA for Style 4)
    if cta_layer:
        cta_text = "TAP YELLOW BASKET TO ORDER"
        cta_file = workdir / "cta.txt"
        cta_file.write_text(cta_text, encoding="utf-8")
        cta_font = resolve_font_path(cta_layer.font_file) or font_path
        
        filters.append(
            f"drawtext=fontfile='{ffmpeg_escape_path(Path(cta_font))}':"
            f"textfile='{ffmpeg_escape_path(cta_file)}':"
            f"fontsize={cta_layer.max_size}:fontcolor={cta_layer.color}:"
            f"box=1:boxcolor={cta_layer.box_color}:boxborderw={cta_layer.box_border_w or 10}:"
            f"x=(w-text_w)/2:y={cta_layer.position_y}"
        )

    return ",".join(filters)
