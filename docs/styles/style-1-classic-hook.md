# Style 1: Classic Hook Specification

This document defines the exact visual, auditory, and structural parameters for **Style 1: Classic Hook**, maintaining 100% fidelity with the legacy video editor at `\\192.168.1.7\video-editor`.

---

## 1. Canvas & Output Video Parameters

- **Resolution:** 1080 x 1920 pixels (9:16 vertical portrait).
- **Frame Rate:** 30.0 fps fixed (`fps=30`).
- **Pixel Format:** `yuv420p` with BT.709 color matrix (`out_color_matrix=bt709`).
- **Video Codec:** `libx264`
  - Preset: `veryfast`
  - CRF: `20`
  - Keyframe interval (GOP): 60 frames (2.0s at 30 fps), fixed closed GOP (`-g 60 -keyint_min 60 -scenecut 0`).
  - B-frames: `0` (`-bf 0`) to guarantee deterministic concatenation.
  - x264 parameters: `open-gop=0:keyint=60:min-keyint=60:scenecut=0`.
- **Target Duration:** Max 28.0 seconds (TikTok optimal retention limit < 30s).
- **Target Segment Duration:** ~2.2 seconds per clip (`TARGET_SEG=2.2`).

---

## 2. Audio Processing Parameters

- **Source:** Random selection from `/music/` directory (or selected by caller).
- **Beat Analysis:**
  - Library: `librosa` v0.10.x.
  - Sample Rate: 22,050 Hz (`sr=22050`), mono conversion (`mono=True`).
  - Beat Tracking: `librosa.beat.beat_track(y=y, sr=sr, tightness=100)`.
  - Tempo Normalization:
    - If `tempo < 85` BPM: double tempo (`tempo *= 2`) by inserting intermediate beat frames.
    - If `tempo > 170` BPM: halve tempo (`tempo /= 2`) by taking every second beat frame.
- **Beat Alignment:**
  - Cut transitions occur strictly on detected beat frames.
  - Audio starting point: Aligned to the start of a 4-beat musical bar (`start_idx % 4 == 0`).
- **Loudness Normalization & Audio Filtering:**
  - Codec: `aac`, 192 kbps (`-c:a aac -b:a 192k`).
  - Loudnorm filter: `loudnorm=I=-14:TP=-1.5:LRA=11` (EBU R128 / TikTok standard).
  - Audio Fade Out: Exponential or linear fade-out over the final 0.6 seconds (`afade=t=out:st=<dur - 0.6>:d=0.6`).

---

## 3. Typography & Overlay Styling (The Anton Look)

### 3.1 Font Family
- **Font File:** `Anton-Regular.ttf` (Google Fonts Anton).
- **Fallback Font:** `Impact.ttf`.

### 3.2 Positioning & Geometry
- **Vertical Origin (`TEXT_Y`):** `230` px from the top of the canvas.
- **Max Width Ratio (`TEXT_WIDTH`):** `0.78` (maximum width = $1080 \times 0.78 = 842.4$ px).
- **Max Font Size (`TEXT_MAX_SIZE`):** `125` px.
- **Line Spacing:** 1.05x line height (`round(size * 1.05)`).
- **Inter-line Gap:** 1.12x line height (`round(size * 1.12)`).

### 3.3 Text Colors & Outline
- **Hook / Title (Line 1):**
  - Text Color: Warm Lemon Yellow `#EFD34C` (FFmpeg `0xEFD34C`).
  - Outline Color: `black@0.9` (90% opacity black).
  - Outline Width: `max(2, round(size / 55))` px.
  - Shadow: None (clean solid outline).
- **Subtitle / Body (Line 2+):**
  - Text Color: Pure White `#FFFFFF` (FFmpeg `0xFFFFFF`).
  - Outline Color: `black@0.9` (90% opacity black).
  - Outline Width: `max(2, round(size / 55))` px.

### 3.4 Text Layout & Line Breaking
- Target line count: 2 lines preferred, max 3 lines.
- Dynamic Font Sizing: Decrements by 2 px starting from `TEXT_MAX_SIZE = 125` until both Title and Subtitle fit within the 842 px bounding box (measured via `PIL.ImageFont.getbbox`).
- Text Escaping: All text strings are escaped for FFmpeg drawtext:
  `text.replace('\\', '\\\\').replace("'", "'\\\\''").replace(':', '\\:').replace('%', '\\%')`.

---

## 4. Video Normalization & Glitch Defenses

Every raw clip undergoes 7 sequential normalization filters to prevent FFmpeg pipeline crashes and visual glitches:

1. **Short Clip Protection:**
   - Appends `tpad=stop_mode=clone:stop=-1` to ensure clips shorter than the allocated segment duration do not freeze or terminate early.
2. **Crop & Fill to 9:16 Vertical:**
   - Formula: `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920:(iw-1080)/2:(ih-1920)/2`.
   - Centers content and fills full 1080x1920 frame without black letterboxing.
3. **Framerate & PTS Reset:**
   - `fps=30,setpts=PTS-STARTPTS` ensures fixed 30.0 fps timing without drift.
4. **Color Space & HDR Tonemapping:**
   - Detects wide color gamut / 10-bit HDR (BT.2020).
   - If HDR: Converts via `zscale=transfer=linear,tonemap=hable,zscale=transfer=bt709:matrix=bt709:primaries=bt709,format=yuv420p`.
   - If SDR: Standard `format=yuv420p`.
5. **Deterministic Bitstream Concatenation:**
   - Each segment is rendered to intermediate `.ts` / raw H.264 bitstream (`-bsf:v h264_mp4toannexb`) with no B-frames (`-bf 0`).
   - Final concatenation uses the FFmpeg `concat` demuxer/protocol without re-encoding video frames where possible, or single-pass filtergraph.
6. **No Video Transitions (Hard Cuts):**
   - Style 1 strictly uses instant beat-matched hard cuts between clips (no xfade / cross-dissolve). Transitions are reserved for Styles 2-5.
7. **Audio Silence Prevention:**
   - Background audio is loop-padded (`aloop=loop=-1:size=2e+09`) if audio track is shorter than video duration.

---

## 5. Metadata & Provenance

When rendered, Style 1 outputs the following response headers and metadata:
- `X-Video-Info`: `dur=<seconds>,tempo=<bpm>,bpc=<beats_per_cut>,segs=<num_segments>,clips=<num_clips>`
- `X-Music`: `<music_filename>`
- `style_id`: `style_1_classic_hook`
