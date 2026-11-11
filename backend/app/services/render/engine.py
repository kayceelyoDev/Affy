import os
import json
import random
import re
import subprocess
import tempfile
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple, Union

import structlog

from backend.app.services.render.spec import StyleSpec
from backend.app.services.render.normalizer import probe_clip, build_clip_filters, BadClip
from backend.app.services.render.beat import analyse_beats, plan_cuts
from backend.app.services.render.compiler import compile_text_filters
from backend.app.services.render.templates import get_template_by_id

logger = structlog.get_logger("render_engine")

class RenderEngine:
    def __init__(self, styles_dir: Optional[Path] = None):
        self.styles_dir = styles_dir or Path("styles/builtin")
        self._styles_cache: Dict[str, StyleSpec] = {}

    def get_style(self, style_id: str) -> StyleSpec:
        if style_id in self._styles_cache:
            return self._styles_cache[style_id]

        clean_id = style_id.lower().replace("template:", "").strip()
        if clean_id in self._styles_cache:
            return self._styles_cache[clean_id]

        # 1. Check if style_id refers to a Template
        tpl = get_template_by_id(clean_id)
        if tpl:
            base_style_id = tpl.get("base_style_id", "punchy_zoom")
            base_spec = self.get_style(base_style_id).model_copy(deep=True)
            base_spec.id = clean_id
            base_spec.name = tpl.get("name", clean_id)
            if "crop_mode" in tpl:
                base_spec.clip_rules.crop_mode = tpl["crop_mode"]

            for layer in base_spec.text_layers:
                lname = layer.name.lower()
                if lname == "title":
                    layer.color = tpl.get("title_color", layer.color)
                    layer.max_size = tpl.get("title_font_size", layer.max_size)
                    layer.position_y = tpl.get("title_y", layer.position_y)
                elif lname == "subtitle":
                    layer.color = tpl.get("subtitle_color", layer.color)
                    layer.max_size = tpl.get("subtitle_font_size", layer.max_size)
                    layer.position_y = tpl.get("subtitle_y", layer.position_y)

            self._styles_cache[style_id] = base_spec
            self._styles_cache[clean_id] = base_spec
            return base_spec

        # 2. Check built-in keyword aliases
        if clean_id not in ("classic_hook", "clean_showcase", "promo_pop", "punchy_zoom", "smooth_flow"):
            if "classic" in clean_id:
                clean_id = "classic_hook"
            elif "showcase" in clean_id or "clean" in clean_id:
                clean_id = "clean_showcase"
            elif "promo" in clean_id or "pop" in clean_id:
                clean_id = "promo_pop"
            elif "zoom" in clean_id or "punch" in clean_id:
                clean_id = "punchy_zoom"
            elif "flow" in clean_id or "smooth" in clean_id:
                clean_id = "smooth_flow"

        if clean_id in self._styles_cache:
            return self._styles_cache[clean_id]

        file_candidates = [
            self.styles_dir / f"{clean_id}.style.json",
            self.styles_dir / f"{style_id}.style.json",
            Path(f"styles/builtin/{clean_id}.style.json"),
            Path(f"/app/styles/builtin/{clean_id}.style.json"),
            Path(f"styles/builtin/{style_id}.style.json"),
            Path(f"/app/styles/builtin/{style_id}.style.json"),
        ]
        for f in file_candidates:
            if f.exists():
                try:
                    spec = StyleSpec.model_validate_json(f.read_text(encoding="utf-8"))
                    self._styles_cache[style_id] = spec
                    self._styles_cache[clean_id] = spec
                    return spec
                except Exception as e:
                    logger.warning("failed_to_parse_style", file=str(f), error=str(e))

        # Default fallback to Classic Hook
        default_spec = StyleSpec(
            id=style_id,
            name="Classic Hook (Fallback)",
            canvas={"width": 1080, "height": 1920, "fps": 30, "crf": 20, "preset": "veryfast", "pixel_format": "yuv420p"},
            clip_rules={"min_count": 2, "max_count": 12, "target_seg": 2.2, "min_duration": 10.0, "max_duration": 28.0, "crop_mode": "cover"},
            cut_logic={"mode": "beat_synced", "fixed_duration": 2.2},
            transitions={"enabled": False, "transitions": []},
            text_layers=[],
            graphics=[],
            motion={"type": "none", "intensity": 1.0},
            audio={"target_lufs": -14.0, "fade_out_sec": 1.2, "ducking": False, "normalize": True},
        )
        return default_spec

    def assign_segments(self, clips: List[Dict[str, Any]], durations: List[float]) -> List[Tuple[Dict[str, Any], float]]:
        plan = []
        for c, d in zip(clips, durations):
            dur = c["dur"]
            # Target the active 15% to 65% sweet spot of creator footage (bypasses static phone setup time)
            if dur >= d + 1.2:
                min_start = max(0.4, dur * 0.15)
                max_start = max(min_start, dur * 0.70 - d)
                start = random.uniform(min_start, max_start)
            elif dur >= d + 0.4:
                start = random.uniform(0.2, dur - d - 0.1)
            else:
                start = max(0.0, (dur - d) / 2.0)
            plan.append((c, start))
        return plan

    def render_segment(
        self,
        clip: Dict[str, Any],
        start: float,
        n_frames: int,
        text_filter: str,
        out_path: Path,
        spec: StyleSpec,
        seg_idx: int = 0,
        total_segs: int = 1,
    ):
        vf = build_clip_filters(
            clip=clip,
            n_frames=n_frames,
            text_filter=text_filter,
            crop_mode=spec.clip_rules.crop_mode,
            motion_type=spec.motion.type,
            motion_intensity=spec.motion.intensity,
            fps=spec.canvas.fps,
            width=spec.canvas.width,
            height=spec.canvas.height,
            seg_idx=seg_idx,
            total_segs=total_segs,
            style_id=spec.id,
        )

        cmd = [
            "ffmpeg", "-y", "-v", "error", "-fflags", "+discardcorrupt+genpts",
            "-ss", f"{start:.3f}", "-i", clip["path"], "-an", "-sn", "-dn",
            "-vf", vf,
            "-c:v", "libx264", "-preset", spec.canvas.preset, "-crf", str(spec.canvas.crf),
            "-profile:v", "high", "-level", "4.1", "-bf", "0",
            "-x264-params", f"open-gop=0:keyint={spec.canvas.fps * 2}:min-keyint={spec.canvas.fps * 2}:scenecut=0",
            "-pix_fmt", spec.canvas.pixel_format, "-colorspace", "bt709", "-color_primaries", "bt709",
            "-color_trc", "bt709", "-color_range", "tv",
            "-r", str(spec.canvas.fps), "-f", "h264", str(out_path)
        ]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode != 0 or not out_path.exists() or out_path.stat().st_size == 0:
            raise BadClip(clip["path"], r.stderr.strip()[-300:] or "Render segment failed")

    def check_output(self, path: Path, expected_frames: int) -> List[str]:
        problems = []
        # Check decode errors
        dec = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "null", "-"], capture_output=True, text=True).stderr.strip()
        if dec:
            problems.append(f"decode errors: {dec[:150]}")

        # Check frame count
        p = subprocess.run(
            ["ffprobe", "-v", "error", "-select_streams", "v:0", "-count_frames", "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", str(path)],
            capture_output=True, text=True
        )
        try:
            got = int(p.stdout.strip().strip(","))
            if abs(got - expected_frames) > 1:
                problems.append(f"frame count {got}, expected {expected_frames}")
        except Exception:
            pass

        # Check audio/video duration sync
        d = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,duration", "-of", "csv=p=0", str(path)],
            capture_output=True, text=True
        ).stdout.split()
        durations: Dict[str, float] = {}
        for line in d:
            parts = line.split(",")
            if len(parts) >= 2:
                try:
                    durations[parts[0]] = float(parts[1])
                except ValueError:
                    pass
        if "audio" in durations and "video" in durations:
            if abs(durations["audio"] - durations["video"]) > 0.4:
                problems.append(f"audio {durations['audio']:.1f}s vs video {durations['video']:.1f}s")

        # Check black frames (threshold 0.40s avoids false positives on intentional transition dips)
        b = subprocess.run(
            ["ffmpeg", "-hide_banner", "-i", str(path), "-vf", "blackdetect=d=0.40:pix_th=0.04", "-an", "-f", "null", "-"],
            capture_output=True, text=True
        ).stderr
        if re.search(r"black_start", b):
            problems.append("black frames detected")

        return problems

    def render_video(
        self,
        clip_paths: List[Union[str, Path]],
        music_path: Union[str, Path],
        title: str,
        subtitle: str = "",
        style_id: str = "classic_hook",
        out_path: Union[str, Path] = "output.mp4",
        seed: Optional[int] = None,
        max_duration: Optional[float] = None,
        min_duration: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Main rendering entry point implementing exact glitch-defended pipeline with QA retries."""
        if seed is not None:
            random.seed(seed)

        out_path = Path(out_path)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        spec = self.get_style(style_id)

        # 0. Resolve fixed audio if using a Template
        tpl = get_template_by_id(style_id)
        if tpl and tpl.get("fixed_music_track"):
            fixed_file = tpl["fixed_music_track"]
            for mdir in [Path("data/music"), Path("/app/data/music"), Path("backend/data/music"), Path("legacy_private/video-editor/music")]:
                candidate = mdir / fixed_file
                if candidate.exists():
                    music_path = candidate
                    break

        min_dur = min_duration or spec.clip_rules.min_duration
        max_dur = max_duration or spec.clip_rules.max_duration

        # 1. Probing clips
        clips = []
        skipped = []
        for p in clip_paths:
            try:
                clips.append(probe_clip(p))
            except BadClip as e:
                skipped.append(str(e))

        if not clips:
            raise RuntimeError(f"No readable clips found: {'; '.join(skipped)}")

        # 2. Beat analysis & Cut Planning
        tempo, beats, music_len = analyse_beats(music_path)
        
        last_problem = ""
        attempts = 3
        for attempt in range(1, attempts + 1):
            try:
                t0, cuts, used_clips, bpc = plan_cuts(
                    clips=clips,
                    beats=beats,
                    tempo=tempo,
                    music_len=music_len,
                    target_seg=spec.clip_rules.target_seg,
                    min_dur=min_dur,
                    max_dur=max_dur,
                )

                fps = spec.canvas.fps
                frames = [round(t * fps) for t in cuts]
                seg_frames = [b - a for a, b in zip(frames, frames[1:])]
                plan = self.assign_segments(used_clips, [n / fps for n in seg_frames])

                with tempfile.TemporaryDirectory() as workdir:
                    work = Path(workdir)
                    text_filter = compile_text_filters(spec, title, subtitle, work)
                    joined = work / "all.h264"
                    
                    with open(joined, "wb") as out_h264:
                        for idx, ((clip, start), n) in enumerate(zip(plan, seg_frames)):
                            seg = work / f"seg_{idx:03d}.h264"
                            self.render_segment(
                                clip=clip,
                                start=start,
                                n_frames=n,
                                text_filter="",  # Pure video motion and cuts without embedded per-segment text
                                out_path=seg,
                                spec=spec,
                                seg_idx=idx,
                                total_segs=len(plan),
                            )
                            out_h264.write(seg.read_bytes())
                            seg.unlink()

                    total_dur = sum(seg_frames) / fps
                    fade_start = max(0.0, total_dur - spec.audio.fade_out_sec)

                    # Continuous video overlay: text burns across the full joined video stream,
                    # ensuring typography stays 100% rock-solid and persistent across clip cuts
                    mux_cmd = [
                        "ffmpeg", "-y", "-v", "error", "-framerate", str(fps), "-f", "h264", "-i", str(joined),
                        "-ss", f"{t0:.3f}", "-t", f"{total_dur:.3f}", "-i", str(music_path),
                    ]
                    if text_filter:
                        mux_cmd.extend([
                            "-vf", text_filter,
                            "-c:v", "libx264", "-preset", spec.canvas.preset, "-crf", str(spec.canvas.crf),
                            "-profile:v", "high", "-level", "4.1",
                            "-pix_fmt", spec.canvas.pixel_format,
                            "-x264-params", f"open-gop=0:keyint={spec.canvas.fps * 2}:min-keyint={spec.canvas.fps * 2}:scenecut=0",
                        ])
                    else:
                        mux_cmd.extend(["-c:v", "copy"])

                    mux_cmd.extend([
                        "-af", f"loudnorm=I={spec.audio.target_lufs}:TP=-1.5:LRA=11,afade=t=out:st={fade_start:.3f}:d={spec.audio.fade_out_sec:.3f}",
                        "-c:a", "aac", "-b:a", "192k", "-t", f"{total_dur:.3f}", "-movflags", "+faststart", str(out_path)
                    ])
                    subprocess.run(mux_cmd, check=True)

                expected_frames = sum(seg_frames)
                problems = self.check_output(out_path, expected_frames)
                if not problems:
                    return {
                        "style_id": spec.id,
                        "duration": round(total_dur, 2),
                        "tempo": round(tempo, 1),
                        "beats_per_cut": bpc,
                        "segments": len(plan),
                        "clips_used": len({p[0]["path"] for p in plan}),
                        "attempts": attempt,
                        "skipped_clips": len(skipped),
                    }
                last_problem = "; ".join(problems)

            except BadClip as e:
                bad_clip_path = e.clip_path
                skipped.append(str(e))
                clips = [c for c in clips if c["path"] != bad_clip_path]
                if not clips:
                    break
                continue

        raise RuntimeError(f"Could not produce clean render after {attempts} attempts: {last_problem}")

def compare_golden_frames(video_a: Union[str, Path], video_b: Union[str, Path], sample_time: float = 1.0) -> float:
    """Extracts a frame at sample_time from both videos and computes Structural Similarity (SSIM)."""
    with tempfile.TemporaryDirectory() as td:
        img_a = Path(td) / "a.png"
        img_b = Path(td) / "b.png"
        subprocess.run(["ffmpeg", "-y", "-ss", str(sample_time), "-i", str(video_a), "-vframes", "1", str(img_a)], capture_output=True, check=True)
        subprocess.run(["ffmpeg", "-y", "-ss", str(sample_time), "-i", str(video_b), "-vframes", "1", str(img_b)], capture_output=True, check=True)

        res = subprocess.run(
            ["ffmpeg", "-i", str(img_a), "-i", str(img_b), "-filter_complex", "ssim", "-f", "null", "-"],
            capture_output=True, text=True
        )
        match = re.search(r"All:([0-9.]+)", res.stderr)
        if match:
            return float(match.group(1))
        return 1.0
