# Old Video Editor Technical Analysis

This document provides the complete architecture and code-level technical analysis of the legacy video editor located at `\\192.168.1.7\video-editor` (`/home/kent5368/video-editor`), excluding `tech-reel-editor`.

---

## 1. System Architecture & Dependencies

- **Runtime:** Python 3.12-slim container with FFmpeg, `libsndfile1`, `fontconfig`, `fonts-montserrat`, `fonts-dejavu-core`.
- **Python Dependencies (`requirements.txt`):**
  - `fastapi`
  - `uvicorn[standard]`
  - `python-multipart`
  - `librosa` (v0.10.x for audio beat analysis)
  - `soundfile`
  - `numpy`
  - `pillow` (for text width measurement with TrueType font)
- **Container Environment (`docker-compose.yml`):**
  - Port: `8010:8000` (host 8010 mapped to container 8000).
  - Auth: `API_TOKEN` checked via `X-Token` header.
  - Duration: `MAX_DURATION=28` (seconds, target under 30 s for TikTok).
  - Target segment: `TARGET_SEG=2.2` (average seconds per clip).
  - Preset: `X264_PRESET=veryfast`.
  - Fonts: `FONT_BOLD=/app/fonts/Anton-Regular.ttf`, `FONT_SUB=/app/fonts/Anton-Regular.ttf`.
  - Volumes: `./app:/app`, `./music:/music:ro`, `./jobs:/jobs`.

---

## 2. API Endpoints & Job Lifecycle

1. `GET /health` -> `{"ok": True, "tracks": <int>}`
2. `POST /jobs` (Auth: `X-Token`) -> generates 12-char hex job ID, creates `/jobs/<id>`, cleans up jobs older than 6 hours.
3. `POST /jobs/{job}/clips` (Auth: `X-Token`) -> accepts multipart file upload, saves destination as `clip_%02d.mp4` or `.MOV`. Note: n8n caller passes its own custom job ID (e.g. `j<timestamp><random>`), so the endpoint creates the directory on-demand (`create=True`).
4. `POST /jobs/{job}/render` (Auth: `X-Token`) -> body: `{"title": str, "subtitle": str, "music": str}`.
   - Global concurrency lock: `render_lock = threading.Lock()` limits rendering to 1 job at a time due to heavy CPU usage.
   - Background cleanup: deletes job folder after streaming response.
   - Headers: `X-Video-Info` (duration, tempo, beats_per_cut, segments, clips_used), `X-Music` (track name).

---

## 3. Beat Analysis & Cut Logic

- **Audio Probing:**
  - `librosa.load(music_path, sr=22050, mono=True)`
  - `librosa.beat.beat_track(y, sr, tightness=100)` detects tempo (BPM) and beat frames.
  - Tempo normalization: if `tempo < 85`, tempo is doubled (subdividing beats); if `tempo > 170`, tempo is halved.
- **Cut Planning (`plan_cuts`):**
  - Clips are pruned if too many to fit in `max_dur` at 2 beats per clip.
  - Targets `ideal_total = min(max_avail, n * TARGET_SEG)`.
  - Chooses even beats-per-cut (bpc): checks uniform even bpc (2, 4, 6, 8, 10...) closest to `ideal_total`. If not uniform, adjusts individual clips by +/- 2 beats.
  - Starts video at a musical bar (multiple of 4 beats) with sufficient audio remaining.
  - Cuts are aligned to exact frame counts at 30 fps: `frames = [round(t * 30) for t in cuts]`, `seg_frames = [b - a ...]`.

---

## 4. Text Styling Parameters (Anton Yellow + White Look)

- **Font:** Anton Regular (`Anton-Regular.ttf`).
- **Canvas Dimensions:** 1080 x 1920 (9:16 portrait vertical).
- **Positioning:**
  - `TEXT_Y = 230` px (top coordinate of the first text line).
  - `TEXT_WIDTH = 0.78` (text occupies at most 78% of canvas width = 842 px).
  - Maximum font size: `TEXT_MAX_SIZE = 125` px.
- **Coloring:**
  - Title: `#EFD34C` (warm faded lemon yellow, FFmpeg hex `0xEFD34C`).
  - Subtitle: `white` (`0xFFFFFF`).
- **Stroke / Border:**
  - Border width: `max(2, size // 55)`.
  - Border color: `black@0.9` (90% opaque black stroke).
- **Line Breaking Heuristic:**
  - If title contains `//`, `|`, or ` - `, it splits cleanly into title and subtitle.
  - If single long title >= 4 words and cannot fit at 90 px, splits balanced into 2 lines.
- **Vertical Spacing:**
  - Cap height: `cap = int(size * 0.86)`
  - Line gap: `gap = int(cap * 0.40)`
  - Line pitch advance: `cap + gap + int(size * 0.14)`.

---

## 5. The Glitch Fixes (v2 Glitch-Proof Pipeline)

In the owner's legacy editor, roughly 1 in 10 renders experienced corruption, black flashes, desynced audio, or dropped frames. The v2 fix solved this via:

1. **Exact Frame Padding (`tpad`):**
   - Clip ran short? Instead of failing or dropping frames, `tpad=stop_mode=clone:stop=-1` clones the last frame.
2. **Fixed Frame Trim:**
   - `trim=end_frame=<n_frames>` followed by `setpts=PTS-STARTPTS` ensures zero timestamp drift across joins.
3. **No B-Frames (`-bf 0`):**
   - Raw H.264 bitstream concatenation without B-frames prevents PTS/DTS reordering errors and frame drops at clip transitions.
   - `-x264-params open-gop=0:keyint=60:min-keyint=60:scenecut=0`.
4. **Color & HDR Normalization:**
   - Tone-mapping iPhone HDR clips: `zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv`.
   - Normalizing to BT.709 color space and TV color range: `scale=1080:1920:force_original_aspect_ratio=increase:flags=bicubic:out_range=tv:out_color_matrix=bt709,crop=1080:1920`.
5. **Raw Bitstream Concatenation:**
   - Each segment is rendered to a raw `.h264` file, and joining is performed by raw byte stream appending (`out.write(seg.read_bytes())`).
6. **Loudness Normalization:**
   - `loudnorm=I=-14:TP=-1.5:LRA=11` (EBU R128 standard for mobile/TikTok).
   - Audio fade-out: `afade=t=out:st=<fade_start>:d=1.2`.
7. **Post-Render Automated QA (`check_output`):**
   - Decodes output with `-f null -` to catch corrupt frames.
   - Counts exact read frames with `ffprobe -count_frames`.
   - Checks audio and video duration synchronization (must be within 0.4 s).
   - Runs `blackdetect=d=0.15:pix_th=0.04` to detect black flashes.
   - Retries up to `QA_ATTEMPTS = 3` times with bad clip removal if a problem is detected.
