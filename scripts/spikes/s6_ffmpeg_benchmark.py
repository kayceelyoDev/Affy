"""
Spike S6: FFmpeg Render-Time Benchmark & Transition Test
Generates synthetic test clips and benchmarks render speeds for hard cuts vs xfade transitions.

Usage:
    python s6_ffmpeg_benchmark.py [--live] [--work-dir <path>]
"""

import os
import sys
import time
import shutil
import argparse
import subprocess

def run_mock():
    print("[MOCK] Simulating FFmpeg render performance benchmarks...")
    print(" - Synthetic Clip Specs: 1080x1920 @ 30fps, 5 segments of 2.2s each (total 11.0s)")
    print(" - Target Preset: veryfast, CRF 20, libx264")
    
    mock_results = {
        "style_1_hard_cut": {
            "technique": "raw stream copy / concat filter without transition cross-fade",
            "render_time_seconds": 2.8,
            "speed_multiplier": "3.9x real-time",
            "cpu_utilization": "180% (2 cores)"
        },
        "style_2_xfade_transitions": {
            "technique": "xfade=transition=fade:duration=0.3:offset=2.0",
            "render_time_seconds": 5.4,
            "speed_multiplier": "2.0x real-time",
            "cpu_utilization": "320% (4 cores)"
        },
        "style_3_slide_transitions": {
            "technique": "xfade=transition=slideleft:duration=0.3",
            "render_time_seconds": 5.7,
            "speed_multiplier": "1.9x real-time",
            "cpu_utilization": "330% (4 cores)"
        }
    }
    
    for style, data in mock_results.items():
        print(f"\n[{style.upper()}]:")
        for k, v in data.items():
            print(f"  {k}: {v}")
            
    print("\n[MOCK] Benchmark Summary:")
    print(" - Style 1 Hard Cuts render ~2x faster than xfade transitions.")
    print(" - Server CPU budget (2-4 cores) is well within acceptable real-time limits.")
    return True

def run_live(work_dir="/tmp/s6_benchmark"):
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        print("[ERROR] ffmpeg executable not found in PATH.")
        return False

    os.makedirs(work_dir, exist_ok=True)
    clip_a = os.path.join(work_dir, "clip_a.mp4")
    clip_b = os.path.join(work_dir, "clip_b.mp4")
    out_concat = os.path.join(work_dir, "out_concat.mp4")
    out_xfade = os.path.join(work_dir, "out_xfade.mp4")

    print("[LIVE] Generating 2 synthetic 1080x1920 test clips (2.5s each)...")
    # Clip A: test pattern 1
    subprocess.run([
        ffmpeg, "-y", "-f", "lavfi", "-i", "testsrc=duration=2.5:size=1080x1920:rate=30",
        "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", clip_a
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # Clip B: test pattern 2
    subprocess.run([
        ffmpeg, "-y", "-f", "lavfi", "-i", "smptebars=duration=2.5:size=1080x1920:rate=30",
        "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", clip_b
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # Benchmark 1: Concat (Hard cut)
    print("[LIVE] Running Hard Cut benchmark...")
    t0 = time.time()
    concat_filter = "[0:v][1:v]concat=n=2:v=1:a=0[v]"
    subprocess.run([
        ffmpeg, "-y", "-i", clip_a, "-i", clip_b,
        "-filter_complex", concat_filter, "-map", "[v]",
        "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", out_concat
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    t_concat = time.time() - t0
    print(f"[LIVE] Hard Cut render time: {t_concat:.2f}s (output: 5.0s, speed: {5.0 / t_concat:.2f}x)")

    # Benchmark 2: xfade (Dissolve)
    print("[LIVE] Running xfade Transition benchmark...")
    t0 = time.time()
    xfade_filter = "[0:v][1:v]xfade=transition=fade:duration=0.5:offset=2.0[v]"
    subprocess.run([
        ffmpeg, "-y", "-i", clip_a, "-i", clip_b,
        "-filter_complex", xfade_filter, "-map", "[v]",
        "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", out_xfade
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    t_xfade = time.time() - t0
    print(f"[LIVE] xfade render time: {t_xfade:.2f}s (output: 4.5s, speed: {4.5 / t_xfade:.2f}x)")

    # Cleanup
    shutil.rmtree(work_dir, ignore_errors=True)
    return True

def main():
    parser = argparse.ArgumentParser(description="Spike S6: FFmpeg Render Benchmark")
    parser.add_argument("--live", action="store_true", help="Run live FFmpeg benchmark on server")
    parser.add_argument("--work-dir", type=str, default="/tmp/s6_benchmark", help="Temporary working directory")
    args = parser.parse_args()

    if args.live:
        run_live(args.work_dir)
    else:
        run_mock()

if __name__ == "__main__":
    main()
