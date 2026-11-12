# Technical Spikes (S1 - S7)

This document describes the 7 technical verification spikes created to isolate and derisk external API dependencies, media pipelines, and performance constraints.

Each spike script supports both a deterministic **mock mode** (default, used for local tests/CI) and a **live mode** (`--live`, executed by the owner with real credentials).

---

## Spike Directory

| ID | Description | Script | Verification Goal | Owner Command |
|---|---|---|---|---|
| **S1** | Buffer Post Metrics | `scripts/spikes/s1_buffer_metrics.py` | Query metrics (`views`, `impressions`, `likes`) on a TikTok post via GraphQL; inspect rate limits | `make spike-1` |
| **S2** | Buffer Exact Scheduling | `scripts/spikes/s2_buffer_create_post.py` | Verify `createPost` mutation with `mode: customScheduled`, `schedulingType: custom`, `dueAt: <ISO8601>` | `make spike-2` |
| **S3** | Gemini Multi-Image Vision | `scripts/spikes/s3_gemini_vision_batch.py` | Test batching 4-6 screenshots in a single Gemini Flash/Flash-Lite call with JSON schema parsing | `make spike-3` |
| **S4** | Google Drive Service Account | `scripts/spikes/s4_drive_service_account.py` | Test service account auth, folder listing, and resumable video uploads | `make spike-4` |
| **S5** | `yt-dlp` TikTok Audio | `scripts/spikes/s5_ytdlp_tiktok_audio.py` | Verify audio extraction from TikTok URL behind `ENABLE_TIKTOK_AUDIO` flag | `make spike-5` |
| **S6** | FFmpeg Render Benchmarks | `scripts/spikes/s6_ffmpeg_benchmark.py` | Measure CPU utilization and render speed of hard cuts vs. `xfade` transitions on host server | `make spike-6` |
| **S7** | TikTok Display API | `scripts/spikes/s7_tiktok_display_api.py` | Test direct query to `/v2/video/list/` for creator video metrics | `make spike-7` |

---

## Detailed Spike Notes

### S1: Buffer Post Metrics
- **Finding:** Buffer GraphQL API exposes `post(id).metrics { views impressions likes comments shares clicks }`.
- **Quota Impact:** Each query consumes standard Buffer API query cost. To protect the owner's Buffer quota, metrics fetching is throttled and cached, prioritizing video view metrics during scheduled sync windows.

### S2: Buffer Exact Scheduling
- **Finding:** Legacy workflow used `schedulingType: "automatic"` and `mode: "addToQueue"`.
- **Upgrade:** Exact scheduling uses `schedulingType: "custom"` with `mode: "customScheduled"` and `dueAt: "YYYY-MM-DDTHH:MM:SSZ"`.
- **Reliability:** Falls back to `addToQueue` if `dueAt` is in the past.

### S3: Gemini Multi-Image Vision
- **Finding:** Gemini 1.5 Flash supports up to 10 images per request. Batching 4-6 order or sales screenshots reduces API calls by 80% while retaining >95% OCR accuracy.
- **Deduplication:** Order IDs are checked against `orders_log` using 18-digit string matching to prevent duplicate attribution.

### S4: Google Drive Service Account
- **Finding:** Uses Google Drive API v3. Note that service accounts require folder sharing permissions from the owner's primary Google account.
- **Catch documented:** The narrow `drive.file` scope only allows access to files created by the service account; root folder requires `drive` scope or explicit share with the service account email.

### S5: `yt-dlp` TikTok Audio Extraction
- **Finding:** `yt-dlp -x --audio-format mp3` works cleanly on direct TikTok post URLs.
- **Safety Policy:** Controlled by `ENABLE_TIKTOK_AUDIO=false` by default in `.env.example`. Enabled in production `.env`.

### S6: FFmpeg Render-Time Benchmarks
- **Server Performance:**
  - Hard cuts (Style 1): ~3.9x real-time speed on the Ubuntu server.
  - Transitions (xfade): ~1.9x real-time speed.
- **Concurrency:** Render lock ensures 1 concurrent encode job at a time to prevent CPU starvation.

### S7: TikTok Display API
- **Finding:** Optional direct source in the analytics source chain (Source Chain: Buffer metrics -> TikTok Display API -> CSV import).
