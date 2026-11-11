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

    # 2. Geometry & Aspect Ratio Normalization (Universal Auto-Adaptive)
    clip_w = clip.get("w") or 1080
    clip_h = clip.get("h") or 1920
    is_horizontal = clip_w > clip_h

    # "auto" intelligently chooses contain_blur for horizontal clips and cover for vertical
    effective_crop = crop_mode
    if crop_mode in ("auto", "smart", "adaptive"):
        effective_crop = "contain_blur" if is_horizontal else "cover"

    if effective_crop == "contain_blur":
        # Ambient blurred glow backdrop + centered foreground with subtle depth
        bg_scale = (
            f"scale={width}:{height}:force_original_aspect_ratio=increase:flags=bicubic,"
            f"crop={width}:{height},boxblur=26:5,eq=brightness=-0.12:contrast=1.05"
        )
        fg_scale = f"scale={width}:{height}:force_original_aspect_ratio=decrease:flags=bicubic"
        f.append(
            f"split=2[fg][bg];[bg]{bg_scale}[bg_blur];[fg]{fg_scale}[fg_scaled];"
            f"[bg_blur][fg_scaled]overlay=(W-w)/2:(H-h)/2"
        )
    else:
        # Full-Bleed Cover mode (Scale to fill and center crop)
        f.append(
            f"scale={width}:{height}:force_original_aspect_ratio=increase:flags=bicubic:"
            f"out_range=tv:out_color_matrix=bt709"
        )
        f.append(f"crop={width}:{height}")

    # 3. Professional Motion & Beat-Synced Transition Effects
    seg_dur = max(0.4, n_frames / fps)
    frames_den = max(1, n_frames)

    if motion_type == "zoom_punch" or style_id in ("punchy_zoom", "punchy"):
        # TikTok Affiliate Pro Fast-Paced Cut Cycle (Inspired by @maica.basket):
        # Cut 0: Scroll-stopping snap punch (1.28x -> 1.0x) + optical white flash hit
        # Cut 1: Dynamic whip pan left (+60px entry) + flash hit + punch settle
        # Cut 2: Macro feature zoom-in (1.04x -> 1.20x focus) + optical cut flash
        # Cut 3: Dynamic whip pan right (-60px entry) + flash hit + punch settle
        # Cut 4: Pull-back reveal (1.20x -> 1.0x overview) + optical cut flash
        mode_idx = seg_idx % 5
        if mode_idx == 0:
            # Explosive beat punch zoom
            f.append(f"zoompan=z='if(lte(on,8),1.28-0.035*on,1.0)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={width}x{height}:fps={fps}")
            f.append("fade=t=in:st=0:d=0.08:color=white")
        elif mode_idx == 1:
            # Dynamic Whip-in Left (swish from right)
            f.append(f"zoompan=z='if(lte(on,8),1.18-0.022*on,1.0)':d=1:x='if(lte(on,6),iw/2-(iw/zoom/2)+(6-on)*10,iw/2-(iw/zoom/2))':y='ih/2-(ih/zoom/2)':s={width}x{height}:fps={fps}")
            f.append("fade=t=in:st=0:d=0.06:color=white")
        elif mode_idx == 2:
            # Macro Feature Zoom-In (tactile product focus)
            f.append(f"zoompan=z='min(1.20, 1.04 + (0.16/{frames_den})*on)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={width}x{height}:fps={fps}")
            f.append("fade=t=in:st=0:d=0.05:color=white")
        elif mode_idx == 3:
            # Dynamic Whip-in Right (swish from left)
            f.append(f"zoompan=z='if(lte(on,8),1.18-0.022*on,1.0)':d=1:x='if(lte(on,6),iw/2-(iw/zoom/2)-(6-on)*10,iw/2-(iw/zoom/2))':y='ih/2-(ih/zoom/2)':s={width}x{height}:fps={fps}")
            f.append("fade=t=in:st=0:d=0.06:color=white")
        else:
            # Pull-Back Product Overview Reveal
            f.append(f"zoompan=z='max(1.0, 1.20 - (0.20/{frames_den})*on)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={width}x{height}:fps={fps}")
            f.append("fade=t=in:st=0:d=0.05:color=white")

        # High-converting TikTok affiliate color grading pop
        f.append("eq=contrast=1.07:saturation=1.14:brightness=0.01")

    elif motion_type in ("smooth_flow", "smooth_drift") or style_id in ("smooth_flow", "smooth"):
        # TikTok Aesthetic Continuous Luxury Gimbal Drift (Inspired by @enchanted.roseee):
        # Segment 0: Luxury slow glide zoom in (1.0 -> 1.10)
        # Segment 1: Motorized continuous gimbal pan left
        # Segment 2: Cinematic pull-back drift (1.10 -> 1.0)
        # Segment 3: Motorized continuous gimbal pan right
        mode_idx = seg_idx % 4
        if mode_idx == 0:
            f.append(f"zoompan=z='min(1.10, 1.0 + (0.10/{frames_den})*on)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={width}x{height}:fps={fps}")
        elif mode_idx == 1:
            f.append(f"zoompan=z=1.06:d=1:x='iw/2-(iw/zoom/2)-(on/{frames_den})*40':y='ih/2-(ih/zoom/2)':s={width}x{height}:fps={fps}")
        elif mode_idx == 2:
            f.append(f"zoompan=z='max(1.0, 1.10 - (0.10/{frames_den})*on)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={width}x{height}:fps={fps}")
        else:
            f.append(f"zoompan=z=1.06:d=1:x='iw/2-(iw/zoom/2)+(on/{frames_den})*40':y='ih/2-(ih/zoom/2)':s={width}x{height}:fps={fps}")

        # Silky soft dissolved crossfade on each cut
        fade_d = min(0.12, max(0.06, seg_dur * 0.08))
        fade_out_st = max(0.0, seg_dur - fade_d)
        f.append(f"fade=t=in:st=0:d={fade_d:.3f},fade=t=out:st={fade_out_st:.3f}:d={fade_d:.3f}")

        # Aesthetic cinematic color grade + subtle luxury vignette
        f.append("eq=contrast=1.05:saturation=1.08:brightness=0.01,vignette=PI/5")

    elif motion_type == "slow_zoom":
        f.append(f"zoompan=z='min(1.10, 1.0 + (0.10/{frames_den})*on)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={width}x{height}:fps={fps}")
        fade_d = min(0.15, max(0.06, seg_dur * 0.08))
        fade_out_st = max(0.0, seg_dur - fade_d)
        f.append(f"fade=t=in:st=0:d={fade_d:.3f},fade=t=out:st={fade_out_st:.3f}:d={fade_d:.3f}")

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
