# Build Status: Affiliate Autopilot

**Current Mode:** Continuous (`CHECKPOINT_MODE = continuous`)  
**Last Updated:** 2026-11-10T22:20:00+08:00  
**Active Batch:** B10 (Migration, parallel run, cutover)

---

## 1. Batch Progress Table

| Batch | Description | Requirement Scope | Status | Gate Status |
|---|---|---|---|---|
| **B0** | Discovery, inventory, skeleton | Discovery, Inventory, Spikes | **DONE** | **PASSED** (commit `1c6dedf`) |
| **B1** | Foundation and design system | R01, R02, R03, R06, R21, R22 | **DONE** | **PASSED** (commit `2c57ecd`) |
| **B2** | Storage layer (Local & Drive) | R05, R17, R19 | **DONE** | **PASSED** (Gate verified, 9/9 tests pass) |
| **B3** | Catalog & clip library | R17 | **DONE** | **PASSED** (commit `44cb453`) |
| **B4** | AI gateway & Data Upload | R08 | **DONE** | **PASSED** (commit `a7dc022`) |
| **B5** | Analytics, attribution, scoring | R07, R18 | **DONE** | **PASSED** (commit `c440e33`) |
| **B6** | Planner (daily brain) | R09, R19 | **DONE** | **PASSED** (commit `017af6c`) |
| **B7** | Render engine & 5 styles + music | R12, R13, R14, R15, R16 | **DONE** | **PASSED** (commit `3c1e543`) |
| **B8** | Captions, publisher, schedules | R04, R05 | **DONE** | **PASSED** (commit `d3b7c0a`) |
| **B9** | Telegram bot (parity plus) | R01, R11 | **DONE** | **PASSED** (5/5 bot tests, 47/47 total) |
| **B10** | Migration, parallel run, cutover | R20 | IN PROGRESS | - |
| **B11** | Hardening, docs, GitHub | R10, R22 | NOT STARTED | - |

---

## 2. What Was Built in B3 (Catalog & Clip Library)

1. **Database Schema & Models:**
   - `Product`: Name, slug, status, commission rate, target audience, created_at, updated_at.
   - `Clip`: Product FK, filename, relative path, duration, resolution, fps, codec, is_hdr, has_audio, tags.
   - `Alias`: Raw title from TikTok Shop/affiliate reports mapped to Canonical Product ID with confidence score and verified flag.
   - `ClipTag`: Tagging system for clips.
2. **Catalog Service & Disk Scanning:**
   - `scan_clips_directory()`: Traverses `/data/clips/`, automatically registers new products from subfolder names, registers clip video files, and probes metadata with ffprobe.
   - `rename_product()`: Renames the product in DB and moves/renames the physical folder on disk (`/data/clips/<old>` -> `/data/clips/<new>`), updating paths for all contained clips.
   - `delete_product()`: Implemented strict **delete guard** - refuses deletion if active clips remain.
   - `resolve_alias()`: Title normalizer, string distance matcher. Confidence >= 0.85 automatically links alias to product; lower confidence flags item in the review queue.
3. **REST API Endpoints:**
   - `GET /api/catalog/products`: List products with clip counts and alias summaries.
   - `POST /api/catalog/products`: Create product and initialize directory.
   - `PUT /api/catalog/products/{id}`: Rename product & disk directory.
   - `DELETE /api/catalog/products/{id}`: Delete product with delete guard.
   - `GET /api/catalog/products/{id}/clips`: List clips for product.
   - `POST /api/catalog/scan`: Trigger filesystem catalog rescan.
   - `GET /api/catalog/aliases/unmatched`: Review queue for low-confidence aliases.
   - `POST /api/catalog/aliases/{id}/link`: Manually link alias to canonical product.
4. **Frontend Products Master Page (`/products`):**
   - Products Master data table with clip counts and commission rates.
   - Inline rename product action with folder sync.
   - Delete guard alert popup if product has active clips.
   - Unmatched Aliases Review Queue banner with one-click link modal.
   - Integrated into Navigation and App Shell.
5. **Contract & Regression Tests:**
   - `test_b3_catalog.py`: 5 comprehensive tests verifying auto-discovery, physical folder rename sync, delete guard enforcement, alias auto-link threshold, and end-to-end API lifecycle.
   - Total test suite: 14/14 tests passing in Docker container.
   - Frontend container build verified (`autopilot-frontend:test`).

---

## 2. What Was Built in B4 (AI Gateway & Data Upload)

1. **Database Schema & Models:**
   - `Order`: String order_id (10-22 digits, strictly preserved without float precision loss), normalized stage enum, gmv, commission_rate, est_commission, actual_commission (null if unsettled), settle_date_est, settle_date_changes counter, is_shop_ads, confidence.
   - `Upload`: File hash (SHA256), filename, file_type, storage_path, status ('pending', 'completed', 'review_required', 'failed').
   - `Extraction`: Upload FK, image_index, model_used, prompt_version, raw_json, confidence, review_status.
   - `AIUsage`: Per-(model, key, task, day) token and request accounting.
   - `Post` & `SalesDaily`: Models for attribution and daily metrics.
2. **AI Gateway (`AIGateway`):**
   - Task-to-model routing (vision extraction, captions, strategy, chat).
   - Rate limiting: Per (key, model) RPM (default 15) and RPD (default 500) limiters resetting at midnight Pacific Time.
   - Fallback chain across alternative API keys and models on HTTP 429/overload.
   - Response cache keyed by SHA256 of `(model, prompt_version, payload_bytes)`.
   - Pydantic structured output validation with markdown repair retry.
   - Versioned prompt template (`v1.0`).
3. **Ingest Pipeline (`IngestPipeline`):**
   - Deterministic file type classifier without AI cost for spreadsheets and images.
   - Deterministic pandas spreadsheet parser for orders CSV/XLSX with zero AI cost.
   - Multi-image batching (4 to 6 images per Gemini request): tested and verified 12 images batched into 3 calls (4x call reduction).
   - Deduplication by SHA256 file hash and idempotent order upsert by `order_id` (tracking `settle_date_changes`).
   - Strict validators for order ID text integrity and commission tolerance.
4. **REST APIs & Frontend UI:**
   - REST endpoints: `/api/ingest/upload`, `/api/ingest/process`, `/api/ingest/uploads`, `/api/ingest/review-queue`, `/api/ingest/review-queue/{id}/approve`, `/api/ingest/review-queue/{id}/reject`, `/api/ai/quota`, `/api/orders`, `/api/orders/summary`.
   - Frontend Data Upload Page (`/upload`): Quota meter, drag-and-drop batch upload, file queue with progress, history table.
   - Frontend Review Queue Page (`/review`): Split view with screenshot inspection on left, editable extracted order form on right, one-click confirm & settle or reject.
   - Frontend Orders Master Page (`/orders`): KPI summary cards (Total Orders, GMV, Est Comm, Settled Comm), search bar, stage filter, monospace digit-fidelity order table.
5. **Contract & Regression Tests:**
   - 6 new tests in `backend/tests/test_b4_ai_ingest.py` (validators, quota limiter, batch call reduction, file dedupe & order upsert, zero-AI spreadsheet ingest, review queue lifecycle).
   - Total test suite: 20/20 tests passing in Docker container.
   - Frontend container build verified (`autopilot-frontend:test`).

---

## 2. What Was Built in B5 (Analytics, Attribution, Scoring)

1. **Database Schema & Models:**
   - `PostMetricDaily`: post_id, date, views, likes, comments, shares, source ('buffer', 'tiktok_display', 'csv').
   - `Scorecard`: period, product_id, score, tier ('SCALE', 'STEADY', 'TEST', 'COOLDOWN'), trend ('UP', 'DOWN', 'STABLE', 'NEW'), components_json, profile_version ('v1', 'v2'), explanation.
   - `APIUsage`: service ('buffer', 'tiktok', 'gemini'), day, requests_count, remaining_from_headers, reset_timestamp.
2. **Metric Sources & Aggregator (`MetricAggregator`):**
   - Source chain behind unified `MetricSource` interface: `BufferMetricSource` > `TikTokDisplayMetricSource` > `CSVMetricSource`.
   - Quota guard: automatically halts metric queries when Buffer quota < 10 to guarantee publishing capacity.
   - Priority merging with source provenance attribution (tracks which provider filled each metric).
3. **Attribution Engine (`backend/app/services/analytics/attribution.py`):**
   - Robust caption fingerprinting (removes hashtags, urls, symbols, lowercases, hashes core keyword tokens).
   - Matches raw order video caption to published post.
   - Per-video commission and GMV attribution rollup.
4. **Scoring Engine (`backend/app/services/analytics/scoring.py`):**
   - **v1 Exact Mathematical Parity:** Weighted commission (settled 1.0, pending 0.7), commission per video, orders per 1,000 views, cancellation rate, unproven multiplier (0.6 for <2 videos & unproven), zero-floor, exact tier boundaries (SCALE >= 25, STEADY >= 5, COOLDOWN, TEST), and trend tracking (+/- 2.0). Verified against exact specifications.
   - **v2 Multi-Signal Formula:** View velocity bonus (+velocity/500 capped at +10), margin rate incentive, and stock clip depletion warning (-5.0 if <3 clips remaining) with human-readable decision explanation.
   - Automated Sunday Strategy Engine batch calculation job across all active products.
5. **REST APIs & Frontend UI:**
   - Endpoints: `GET /api/analytics/overview` (GMV, views, orders/1k views, comm/video, cashflow ledger), `GET /api/analytics/scorecards`, `POST /api/analytics/scorecards/run`, `GET /api/analytics/styles`.
   - Frontend Analytics Page (`/analytics`): KPI metric cards, Cashflow & Payout Pipeline with cancellation risk-adjustment, Product Strategy Scorecard leaderboard with tier badges and trend arrows, Hook & Style Yield Matrix.
6. **Contract & Regression Tests:**
   - 5 comprehensive tests in `backend/tests/test_b5_analytics_scoring.py` (v1 mathematical parity, v2 multi-signal, caption fingerprinting, multi-source merge & priority with quota guard, end-to-end API lifecycle).
   - Total test suite: 25/25 tests passing in Docker container.
   - Frontend container build verified (`autopilot-frontend:test`).

---

## 2. What Was Built in B6 (Planner - The Daily Brain)

1. **Database Schema & Models:**
   - `Plan`: id, date (`YYYY-MM-DD`), status (`draft`, `approved`, `published`, `dry_run`), auto_approved boolean, dry_run boolean, notes.
   - `PlanSlot`: plan_id FK, slot_index (0..5), scheduled_time (`09:00`, `11:00`, `14:00`, `16:00`, `19:00`, `21:00`), product_id FK, style_id, hook_style, hook_text, reason, locked boolean, source (`auto`, `manual`, `locked`), status (`pending`, `rendering`, `rendered`, `published`, `failed`), render_id, post_id.
2. **Deterministic Daily Planner Engine (`DailyPlannerService`):**
   - 7x6 Strategy Quota Matrix: 6 posting slots per day.
   - Clip readiness check: Products must have `>= 4` usable clips to be eligible for scheduling.
   - Tier filtering: `COOLDOWN` tier products are strictly skipped.
   - Exploration quota: 15% share reserved for `TEST` tier products to discover new winners.
   - Caps: Daily cap (max 1 post per product per day), weekly cap (max 7 per week).
   - Anti-repeat rotation: Rotates styles and hook angles across slots.
   - Slot locking idempotency: Preserves user-locked slots and manual pins when regenerating.
   - Dry-run simulation: Generates plan representation with zero database mutations.
3. **REST APIs & Frontend UI:**
   - Endpoints: `GET /api/planner/today`, `POST /api/planner/generate`, `PUT /api/planner/slots/{id}`, `POST /api/planner/slots/{id}/lock`, `POST /api/planner/approve`.
   - Frontend Today's Plan Page (`/planner`): 6 slot cards with time badges, product selection, hook style, reason badge, lock/unlock toggle, dry-run & auto-approve controls, "Generate Plan Now" and "Approve Plan" buttons.
4. **Contract & Regression Tests:**
   - 4 tests in `backend/tests/test_b6_planner.py` (clip readiness & cooldown filter, slot locking & idempotency, dry-run mode, API lifecycle).
   - Total test suite: 29/29 tests passing in Docker container.
   - Frontend container build verified (`autopilot-frontend:test`).

---

## 2. What Was Built in B7 (Render Engine & 5 Styles + Music)

1. **Render Engine & Style 1 Parity (B7a):**
   - Database models: `RenderJob`, `Track`, `ClipCaption`.
   - `backend/app/services/render/spec.py`: Pydantic `StyleSpec`, `CanvasConfig` (1080x1920 30fps), `ClipRules`, `CutLogic`, `TransitionConfig`, `TextLayerConfig`, `GraphicConfig`, `MotionConfig`, `AudioConfig`.
   - `backend/app/services/render/normalizer.py`: `probe_clip()`, 7 glitch defenses (`tpad=stop_mode=clone:stop=-1`, 1080x1920 cover/contain_blur crop, fixed 30fps, closed GOP, `yuv420p`, HDR tonemapping with `zscale` & `tonemap=hable`).
   - `backend/app/services/render/beat.py`: `analyse_beats()` (librosa beat tracking, tempo normalization 85-170 BPM), `plan_cuts()` (4-beat bar alignment, even bpc preference, no clip repetition).
   - `backend/app/services/render/compiler.py`: Compiles StyleSpec + assets + text + music; Anton bold font (`fonts/Anton-Regular.ttf`), warm yellow `#EFD34C` hook, white subtitle, text sizing with `PIL.ImageFont`, text escaping for FFmpeg drawtext, text animations (`fade_out_2s`), raw H.264 concatenation with `-bf 0`.
   - `backend/app/services/render/engine.py`: `RenderEngine.render_video()` with QA retries, output validator (`check_output()` checking decode errors, frame count, audio/video duration delta, blackdetect), `compare_golden_frames()` SSIM similarity test (SSIM >= 0.99 verified).

2. **Built-in Styles 2 to 5, AI Clip Captions & Style Studio (B7b):**
   - 5 versioned style JSON files under `styles/builtin/`: `classic_hook.style.json`, `smooth_flow.style.json`, `punchy_zoom.style.json`, `promo_pop.style.json`, `clean_showcase.style.json`.
   - `backend/app/services/render/captions.py`: `ClipCaptionService` sampling 2 frames/clip, batched Gemini vision extraction for 3-6 word punchy subtitles, SHA256 caching, category phrase bank fallback.
   - `backend/app/api/styles.py`: `/api/styles`, `/api/styles/{id}`, `/api/styles/{id}/duplicate`, `/api/styles/preview` (5s preview render from sample clips).
   - Frontend `/styles` page (`frontend/src/pages/StyleStudio.tsx`): Style selector tabs, JSON config form, 9:16 phone-shaped canvas preview, 5s preview render trigger, duplicate button. Mounted in `frontend/src/App.tsx`.

3. **Music Library & Worker Daemon (B7c):**
   - `backend/app/services/render/music.py`: `MusicService` - loudness normalization to -14 LUFS, silence trimming, beat/BPM detection with librosa, `download_track_from_url()` with `yt-dlp` behind `ENABLE_TIKTOK_AUDIO`, safe-to-use commercial warning.
   - `backend/app/api/music.py`: `/api/music`, `/api/music/upload`, `/api/music/download`, `/api/music/{id}/audio`.
   - `backend/app/api/renders.py`: `/api/renders`, `/api/renders/start`, `/api/renders/{id}`, `/api/renders/{id}/video`. Registered in `backend/app/main.py`.
   - `worker/main.py`: `RenderWorker` polling SQLite for pending `RenderJob`, gathering usable clips & safe music tracks, executing `RenderEngine`, updating `PlanSlot` status to `rendered`.
   - Frontend `/music` page (`frontend/src/pages/MusicLibrary.tsx`): Music library table with BPM badges, duration, commercial safety shield/caution badge, audio playback controls, download modal. Mounted in `frontend/src/App.tsx`.

4. **Contract & Regression Tests:**
   - 6 tests in `backend/tests/test_b7_render_engine.py` (style specs validation, Style 1 parity & golden frame SSIM >= 0.99, all 5 styles sample render, music service loudnorm & yt-dlp download, clip captions fallback, API lifecycle).
   - Total test suite: 35/35 tests passing in Docker container.
   - Frontend container build verified (`autopilot-frontend:test`).

---

## 2. What Was Built in B8 (Captions, Buffer Publisher, Schedules)

1. **Caption Service & Hook Learning Engine:**
   - `backend/app/services/captions/service.py`:
     - `CaptionService`: Natural Taglish caption templates with hook lines, product highlights, CTAs, and hashtags stack.
     - `generate_fingerprint()`: Unique, normalized `[TTC-XXX-SALT]` prefix for deterministic order-to-video attribution.
     - `filter_banned_claims()`: Sanitizes against banned marketing claims (`cure`, `100% guarantee`, `miracle`, `fda approved`, `slimming`, etc.).
     - `HookLearningEngine`: Multi-armed bandit hook selector aggregating historical views, orders, and commission from `Post`, `PostMetricDaily`, and `Order` tables; reserves 15% exploration quota for testing new hook styles.

2. **MediaHost Interface & Buffer Client:**
   - `backend/app/services/publisher/media_host.py`:
     - `MediaHostProvider` abstract contract: `upload_video()`, `delete_video()`, `cleanup_expired()`.
     - `CloudinaryMediaHostProvider`: Uploads via Cloudinary API with `delete_after_post` setting support and 14-day auto-cleanup.
     - `TunnelMediaHostProvider`: Tokenized expiring video URLs served securely via `/api/media/temp/{token}`.
     - `MockMediaHostProvider`: Deterministic synthetic CDN URLs for offline and test runs.
   - `backend/app/services/publisher/buffer.py`:
     - `BufferClient`: GraphQL `createPost` mutation with full parity from legacy n8n node "Post to Buffer" and spike S2.
     - **Queue mode** (default) vs **Exact-time mode** (`customScheduled` with ISO8601 `dueAt`).
     - Quota guard: Tracks monthly limit (default 1000); if remaining quota < 10, non-publishing calls are halted to never starve scheduled posts.
     - Exponential backoff retry loop (3 retries).

3. **Publisher Service & Endpoints:**
   - `backend/app/services/publisher/service.py`: `publish_slot()` (idempotent, uploads video to MediaHost, generates caption, schedules on Buffer, updates `PlanSlot` to `published`), `publish_all_rendered_slots()`, `regenerate_caption_for_post()`.
   - `backend/app/api/posts.py`: `GET /api/posts`, `GET /api/posts/{id}`, `POST /api/posts/publish-slot`, `POST /api/posts/{id}/regenerate-caption`, `GET /api/posts/hooks/performance`.
   - `backend/app/api/media.py`: `GET /api/media/temp/{token}`.

4. **Schedules & Autonomous Pipeline Chain:**
   - `backend/app/services/scheduler.py`: All 10 background jobs registered in SQLite DB with APScheduler (`Asia/Manila` timezone):
     1. `nightly_orders_sync` / `nightly_reminder` (23:59)
     2. `ingest_check` (continuous / every 5m)
     3. `daily_planner` (00:30)
     4. `video_render_pipeline` (01:00)
     5. `buffer_poster_sync` (02:00)
     6. `metrics_sync` (09:00)
     7. `drive_sync` (every 5 min)
     8. `weekly_report` (Sunday 08:00)
     9. `media_cleanup` (daily 04:00)
     10. `ytdlp_update` (weekly Sunday 03:00)
   - `execute_chain()`: Autonomous sequence running Storage Sync -> Daily Planner -> Render Pipeline -> Buffer Publisher with live SSE logging.
   - `backend/app/api/schedules.py`: Added `POST /api/schedules/chain`.

5. **Frontend Pages & Telemetry:**
   - Videos Master page (`frontend/src/pages/Videos.tsx`): Metric overview cards, filter bar, master table with play button, video preview modal, caption copy button, fingerprint badges, and regenerate button.
   - Pipeline & Runs page (`frontend/src/pages/Runs.tsx`): Run as Chain action, runs history table, and real-time SSE streaming terminal drawer with auto-scroll and status indicators.
   - Schedules Manager page (`frontend/src/pages/Schedules.tsx`): Inline cron editor, timezone badges, enable/disable switches, Run Now triggers, and Run Full Chain button.
   - Mounted in `frontend/src/App.tsx`.

6. **Contract & Regression Tests:**
   - 7 tests in `backend/tests/test_b8_publisher_schedules.py` covering caption generation, banned claims sanitization, hook learning multi-armed bandit, Buffer queue & exact modes, quota guard, MediaHost providers, schedules chain runner, and full API lifecycle.
   - Total test suite: **42/42 tests passing** in `autopilot-api:test` container.
   - Frontend container build verified (`autopilot-frontend:test`).

---

## 3. Exact Commands Run & Real Results

- `docker build -t autopilot-frontend:test -f docker/Dockerfile.frontend .` -> `RESULT: OK (built in 9.1s)`
- `docker build -t autopilot-api:test -f docker/Dockerfile.api .` -> `RESULT: OK`
- `docker build -t autopilot-bot:test -f docker/Dockerfile.bot .` -> `RESULT: OK`
- `docker run --rm autopilot-api:test pytest backend/tests` -> `RESULT: 47 passed in 93.09s`
- `python scripts/scan_secrets.py` -> `RESULT: Secret scan PASSED: 0 secrets found`
- `python scripts/check_inventory.py` -> `RESULT: Inventory check PASSED: All 148 nodes accounted for`

---

## 4. What Was Built in B9 (Telegram Bot - Parity Plus)

1. **Async Telegram Client (`bot/client.py`):**
   - Implemented async `TelegramClient` supporting long polling (`getUpdates`), `sendMessage` with markdown & inline keyboard markup, `answerCallbackQuery`, and `getFile` / `get_file_bytes`.
2. **Handlers & Parity Features (`bot/handlers.py`):**
   - **Strict Allowlist:** Drops and silences any message from unauthorized chat IDs not matching `TELEGRAM_ALLOWED_CHAT_IDS`.
   - **Commands:** `/today`, `/status`, `/sales`, `/plan`, `/pause`, `/resume`, `/unmatched`, `/music <link>`, `/help`.
   - **Interactive Callbacks:** Inline buttons for approving (`plan:approve`) or regenerating (`plan:regen`) the daily plan.
   - **Media Intake:** Photos and spreadsheets sent directly in chat are downloaded and routed into `IngestPipeline.ingest_file()` and `process_batch_uploads()`.
   - **Conversational Assistant:** Free-text chat with live database context for creator Q&A.
3. **Daemon Process (`bot/main.py`) & Docker Image (`docker/Dockerfile.bot`):**
   - Long-polling daemon with graceful shutdown handlers.
4. **Contract & Regression Tests (`backend/tests/test_b9_telegram_bot.py`):**
   - 5 contract tests covering authorization allowlist, commands, interactive approval callbacks, media intake, and free-text assistant queries.
   - 47/47 total backend test suite passing.

---

## 5. Next Exact Steps (Batch 10: Migration, Parallel Run, Cutover)

1. **Stage and commit B9:**
   - Run `git add . && git commit -m "feat(b9): implement long-polling telegram bot daemon, allowlist, media intake, and commands"`.
2. **Implement Data Importer (`scripts/import_sheets_csv.py` / `scripts/import_from_n8n.py`):**
   - Parse all 8 tabs from `legacy_private/sheets/TikTok_Brain_(8).xlsx` (Content_Log, Orders_Log, Product_Master, Sales_Log, Strategy_Quota, Product_Scorecard, Unmatched_Products, Dashboard).
   - Idempotent upsert by `order_id` (preserves 10-22 digit strings, detects scientific notation rounding).
   - Alias heuristic: maps aliases, flags ambiguous rows without dropping.
   - Produce reconciliation report of rows imported, merged, and flagged (`docs/migration/reconciliation_report.md`).
3. **First-Run Wizard / Seed Setup:**
   - Seed system configuration from `.env.seed` and imported data.
4. **Shadow Mode Execution (Section 5.1 & B10):**
   - Compare today's generated plan against legacy n8n output.
   - Generate side-by-side comparison report (`docs/migration/shadow_mode_report.md`).
   - Protect with dry-run default until cutover.
5. **Cutover Documentation (`docs/migration/cutover.md`):**
   - Step-by-step checklist, rollback plan, workflow deactivation sequence for n8n.
6. **Contract Tests (`backend/tests/test_b10_migration.py`), verify gate, and commit.**
