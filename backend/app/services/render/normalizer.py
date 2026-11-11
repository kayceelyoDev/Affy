import json
import subprocess
from pathlib import Path
from typing import Dict, Any, Union, Optional

class BadClip(Exception):
    def __init__(self, clip_path: Union[str, Path], msg: str = ""):
        super().__init__(f"{clip_path}: {msg}" if msg else str(clip_path))
        self.clip_path = str(clip_path)

_FILTERS_CACHE: Optional[str] = None

def has_filter(name: str) -> bool:
    global _FILTERS_CACHE
    if _FILTERS_CACHE is None:
        try:
            r = subprocess.run(["ffmpeg", "-hide_banner", "-filters"], capture_output=True, text=True)
            _FILTERS_CACHE = r.stdout
        except Exception:
            _FILTERS_CACHE = ""
    return f" {name} " in _FILTERS_CACHE

def probe_clip(path: Union[str, Path]) -> Dict[str, Any]:
    """Probes video clip using ffprobe, extracting duration, dimensions, and HDR markers."""
    cmd = [
        "ffprobe", "-v", "error", "-select_streams", "v:0",
        "-show_entries", "stream=width,height,duration,nb_frames,pix_fmt,color_transfer,color_space,color_range:format=duration",
        "-of", "json", str(path)
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, check=True)
        data = json.loads(r.stdout)
        stream = data["streams"][0]
    except Exception:
        raise BadClip(path, "Unreadable or corrupt video container")

    def to_float(val: Any) -> Optional[float]:
        try:
            return float(val) if val else None
        except Exception:
            return None

    fdur = to_float(data.get("format", {}).get("duration"))
    sdur = to_float(stream.get("duration"))
    dur = min(x for x in (fdur, sdur) if x) if (fdur or sdur) else None
    
    if not dur or dur < 0.3:
        raise BadClip(path, f"Clip duration too short ({dur}s)")

    trc = (stream.get("color_transfer") or "").lower()
    is_hdr = trc in ("smpte2084", "arib-std-b67")

    return {
        "path": str(path),
        "dur": dur,
        "hdr": is_hdr,
        "w": stream.get("width"),
        "h": stream.get("height"),
        "pix_fmt": stream.get("pix_fmt"),
    }

def build_clip_filters(
    clip: Dict[str, Any],
    n_frames: int,
    text_filter: str = "",
    crop_mode: str = "cover",
    motion_type: str = "none",
    motion_intensity: float = 1.0,
    fps: int = 30,
    width: int = 1080,
    height: int = 1920,
    seg_idx: int = 0,
    total_segs: int = 1,
    style_id: str = "classic_hook",
) -> str:
    """Builds glitch-defended FFmpeg video filter chain for an individual clip segment."""
    f = []
    
    # 1. HDR to SDR Tonemapping (if HDR is detected and ffmpeg supports zscale/tonemap)
    if clip.get("hdr") and has_filter("zscale") and has_filter("tonemap"):
        f.append(
            "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,"
            "tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv"
        )

    # 2. Geometry & Aspect Ratio Normalization
    if crop_mode == "contain_blur":
        # Blurred background + foreground overlay
        bg_scale = f"scale={width}:{height}:force_original_aspect_ratio=increase:flags=bicubic,crop={width}:{height},boxblur=25:5"
        fg_scale = f"scale={width}:{height}:force_original_aspect_ratio=decrease"
        f.append(f"split=2[fg][bg];[bg]{bg_scale}[bg_blur];[fg]{fg_scale}[fg_scaled];[bg_blur][fg_scaled]overlay=(W-w)/2:(H-h)/2")
    else:
        # Default Cover mode (Scale to fill and center crop)
        f.append(f"scale={width}:{height}:force_original_aspect_ratio=increase:flags=bicubic:out_range=tv:out_color_matrix=bt709")
        f.append(f"crop={width}:{height}")

    # 3. Professional Motion & Beat-Synced Transition Effects
    seg_dur = max(0.4, n_frames / fps)

    if motion_type == "zoom_punch" or style_id in ("punchy_zoom", "punchy"):
        # Dynamic pro affiliate cut rotation:
        # Cut 0: Explosive beat punch (1.28x -> 1.0x) + optical white flash
        # Cut 1: Pull-back detail reveal (starts 1.22x -> pulls back to 1.0x) + flash
        # Cut 2: Dynamic whip-in from left (horizontal shift + punch)
        # Cut 3: Dynamic whip-in from right (horizontal shift + punch)
        mode_idx = seg_idx % 4
        if mode_idx == 0:
            # Explosive beat punch zoom
            f.append(f"zoompan=z='if(lte(on,10),1.28-0.028*on,1.0)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={width}x{height}:fps={fps}")
            f.append("fade=t=in:st=0:d=0.08:color=white")
        elif mode_idx == 1:
            # Pull-back detail reveal
            f.append(f"zoompan=z='max(1.0, 1.22-0.007*on)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={width}x{height}:fps={fps}")
            f.append("fade=t=in:st=0:d=0.07:color=white")
        elif mode_idx == 2:
            # Dynamic Whip-in Left
            f.append(f"zoompan=z='if(lte(on,10),1.20-0.02*on,1.0)':d=1:x='if(lte(on,6),iw/2-(iw/zoom/2)+(6-on)*25,iw/2-(iw/zoom/2))':y='ih/2-(ih/zoom/2)':s={width}x{height}:fps={fps}")
            f.append("fade=t=in:st=0:d=0.07:color=white")
        else:
            # Dynamic Whip-in Right
            f.append(f"zoompan=z='if(lte(on,10),1.20-0.02*on,1.0)':d=1:x='if(lte(on,6),iw/2-(iw/zoom/2)-(6-on)*25,iw/2-(iw/zoom/2))':y='ih/2-(ih/zoom/2)':s={width}x{height}:fps={fps}")
            f.append("fade=t=in:st=0:d=0.07:color=white")

    elif motion_type in ("smooth_flow", "smooth_drift") or style_id in ("smooth_flow", "smooth"):
        # Professional 4-way continuous luxury slider motion + silky dissolves:
        # Segment 0: Slow elegant zoom in (1.0 -> 1.09)
        # Segment 1: Slow continuous pan left
        # Segment 2: Slow elegant pull back (1.09 -> 1.0)
        # Segment 3: Slow continuous pan right
        frames_den = max(1, n_frames)
        mode_idx = seg_idx % 4
        if mode_idx == 0:
            f.append(f"zoompan=z='min(zoom+0.0009,1.09)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={width}x{height}:fps={fps}")
        elif mode_idx == 1:
            f.append(f"zoompan=z=1.06:d=1:x='iw/2-(iw/zoom/2)-(on/{frames_den})*45':y='ih/2-(ih/zoom/2)':s={width}x{height}:fps={fps}")
        elif mode_idx == 2:
            f.append(f"zoompan=z='max(1.0, 1.09-0.0008*on)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={width}x{height}:fps={fps}")
        else:
            f.append(f"zoompan=z=1.06:d=1:x='iw/2-(iw/zoom/2)+(on/{frames_den})*45':y='ih/2-(ih/zoom/2)':s={width}x{height}:fps={fps}")

        fade_d = min(0.12, max(0.06, seg_dur * 0.08))
        fade_out_st = max(0.0, seg_dur - fade_d)
        f.append(f"fade=t=in:st=0:d={fade_d:.3f},fade=t=out:st={fade_out_st:.3f}:d={fade_d:.3f}")

    elif motion_type == "slow_zoom":
        f.append(f"zoompan=z='min(zoom+0.0012,1.12)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={width}x{height}:fps={fps}")

    # 4. Deterministic Frame Timing & Padding Glitch Defense
    f.extend([
        "setsar=1",
        f"fps={fps}:round=near",
        "tpad=stop_mode=clone:stop=-1",  # Prevents early finish on short cuts
        f"trim=end_frame={n_frames}",
        "setpts=PTS-STARTPTS",
    ])

    # 5. Text Overlays (if specified)
    if text_filter:
        f.append(text_filter)

    # 6. Standard 8-bit YUV420p color format
    f.append("format=yuv420p")
    return ",".join(f)
