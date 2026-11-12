import random
from pathlib import Path
from typing import List, Tuple, Any, Dict, Union
import librosa

def analyse_beats(music_path: Union[str, Path]) -> Tuple[float, List[float], float]:
    """Analyzes musical beat frames, bpm, and track duration with librosa.
    Applies tempo halving/doubling to stay in optimal 85-170 BPM cadence range.
    """
    y, sr = librosa.load(str(music_path), sr=22050, mono=True)
    tempo, frames = librosa.beat.beat_track(y=y, sr=sr, units="frames", tightness=100)
    beats = list(librosa.frames_to_time(frames, sr=sr))
    tempo_val = float(tempo if not hasattr(tempo, "__len__") else tempo[0])
    
    if len(beats) < 8:
        raise RuntimeError(f"Could not find a steady beat in {music_path}")
        
    while tempo_val < 85:  # Half-tempo adjustment
        mids = [(a + b) / 2.0 for a, b in zip(beats, beats[1:])]
        beats = sorted(beats + mids)
        tempo_val *= 2.0
        
    while tempo_val > 170:  # Double-tempo adjustment
        beats = beats[::2]
        tempo_val /= 2.0
        
    music_len = len(y) / sr
    return float(tempo_val), beats, float(music_len)

def plan_cuts(
    clips: List[Dict[str, Any]],
    beats: List[float],
    tempo: float,
    music_len: float,
    target_seg: float = 2.2,
    min_dur: float = 10.0,
    max_dur: float = 28.0,
) -> Tuple[float, List[float], List[Dict[str, Any]], Union[int, List[int]]]:
    """Plans cut points so each clip is used at most once, aligned to 4-beat musical bars.
    Returns:
      t0: start offset in seconds
      cuts: relative cut timestamps (starting at 0.0)
      used_clips: ordered clips assigned to segments
      bpc_desc: beats per cut indicator
    """
    if not clips:
        raise RuntimeError("No readable clips provided for render")

    max_avail = min(max_dur, music_len - 0.5)
    min_dur = min(min_dur, max_avail)
    beat_dur = 60.0 / tempo

    # Trim clips if too many to fit in max duration even at 2 beats per clip
    used_clips = list(clips)
    while len(used_clips) > 1 and len(used_clips) * 2 * beat_dur > max_avail:
        used_clips.pop()

    n = len(used_clips)
    ideal_total = max(min_dur, min(max_avail, n * target_seg))

    # 1. Prefer uniform even beats per cut (bpc: 2, 4, 6, 8, 10, 12)
    best_uniform_bpc = None
    best_diff = float("inf")
    for bpc in range(2, 22, 2):
        dur = n * bpc * beat_dur
        if min_dur <= dur <= max_avail:
            diff = abs(dur - ideal_total)
            if diff < best_diff:
                best_diff = diff
                best_uniform_bpc = bpc

    if best_uniform_bpc is not None:
        bpc_list = [best_uniform_bpc] * n
    else:
        # 2. Non-uniform even bpc: adjust clips by +/- 2 beats
        base_bpc = max(2, int(round(ideal_total / n / beat_dur / 2)) * 2)
        bpc_list = [base_bpc] * n
        while sum(bpc_list) * beat_dur < min_dur:
            idx = min(range(n), key=lambda i: bpc_list[i])
            bpc_list[idx] += 2
        while sum(bpc_list) * beat_dur > max_avail and any(b > 2 for b in bpc_list):
            idx = max(range(n), key=lambda i: bpc_list[i])
            if bpc_list[idx] <= 2:
                break
            bpc_list[idx] -= 2

    total_beats = sum(bpc_list)
    
    # Align start with musical bars (multiples of 4 beats)
    valid_starts = [
        i for i in range(len(beats) - total_beats)
        if i % 4 == 0 and beats[i + total_beats] <= music_len - 0.4
    ]
    if not valid_starts:
        valid_starts = [
            i for i in range(len(beats) - total_beats)
            if beats[i + total_beats] <= music_len - 0.4
        ]
    if not valid_starts:
        valid_starts = [0]

    s = valid_starts[0] if len(valid_starts) <= 2 else random.choice(valid_starts[:3])
    t0 = beats[s]

    cuts = [0.0]
    curr_beat = s
    for b in bpc_list:
        curr_beat += b
        cuts.append(beats[min(curr_beat, len(beats) - 1)] - t0)

    bpc_desc = bpc_list if len(set(bpc_list)) > 1 else bpc_list[0]
    return t0, cuts, used_clips, bpc_desc
