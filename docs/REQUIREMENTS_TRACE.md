# Requirements Traceability Matrix (R01 - R22)

This matrix tracks every functional and non-functional requirement defined in the Master Build Prompt from specification through implementation and automated verification.

| ID | Requirement Description | Target Modules & Files | Tests & Verification | Status |
|---|---|---|---|---|
| **R01** | One unified app replacing 4 n8n workflows (Web LAN + Telegram) | `backend/app/main.py`, `bot/main.py`, `compose.yaml` | Service healthchecks, 47/47 API & Bot test suite passed | **DONE** |
| **R02** | Python backend (FastAPI, SQLAlchemy, Pydantic) + React TS frontend | `backend/app/`, `frontend/src/` | `pytest backend/tests` (9/9 passed), container builds | IN PROGRESS |
| **R03** | Web-based PWA running on Ubuntu server | `frontend/public/manifest.json`, `frontend/src/sw.ts` | PWA manifest, service worker registration | IN PROGRESS |
| **R04** | Buffer publishing/scheduling + editable schedule timings & manual run | `backend/app/services/publisher/`, `backend/app/services/scheduler.py`, `backend/app/api/schedules.py`, `backend/app/api/posts.py`, `frontend/src/pages/Videos.tsx`, `frontend/src/pages/Runs.tsx`, `frontend/src/pages/Schedules.tsx` | `test_buffer_client_queue_and_exact_modes`, `test_schedules_persistence_and_run_as_chain`, `test_publisher_and_posts_api_lifecycle` | **DONE** |
| **R05** | Third-party integrations (Buffer, Gemini, Telegram, Drive, Cloudinary) | `backend/app/services/publisher/media_host.py`, `backend/app/services/publisher/buffer.py`, `backend/app/services/storage/`, `backend/app/services/ai/` | Spikes S1-S7, MediaHost contracts, Buffer client tests, Drive/Local storage tests | **DONE** |
| **R06** | Vault encrypted tokens, masked in UI, editable with test buttons | `backend/app/services/vault.py`, `backend/app/api/settings.py` | `test_vault_encryption_roundtrip`, `test_login_and_masked_secrets_api` | **DONE** |
| **R07** | Analytics source chain (Buffer, TikTok Display, CSV) + quota meter | `backend/app/services/analytics/sources.py`, `frontend/src/pages/Analytics.tsx` | Metric source aggregator priority test, quota guard test | **DONE** |
| **R08** | Data Upload page: batched screenshots, Gemini OCR, dedupe, review | `backend/app/services/ingest/`, `backend/app/api/ingest.py`, `frontend/src/pages/Upload.tsx`, `frontend/src/pages/ReviewQueue.tsx`, `frontend/src/pages/Orders.tsx` | 6 unit/contract tests (`test_b4_ai_ingest.py`), frontend built | **DONE** |
| **R09** | Daily planner: 7x6 strategy quota, slot planning, style/hook picking | `backend/app/services/planner/`, `backend/app/api/planner.py`, `frontend/src/pages/Planner.tsx` | 4 contract tests (`test_b6_planner.py`), frontend built | **DONE** |
| **R10** | Open-source ready, synthetic demo mode, configurable localization | `backend/app/core/config.py`, `LICENSE`, `README.md` | Configuration test, license placeholder | IN PROGRESS |
| **R11** | Telegram bot parity: night summary, approvals, long polling | `bot/main.py`, `bot/client.py`, `bot/handlers.py`, `docker/Dockerfile.bot` | 5/5 bot contract tests (`test_b9_telegram_bot.py`), allowlist security, media intake, commands & callbacks | **DONE** |
| **R12** | Python FFmpeg/libass/librosa video render engine | `backend/app/services/render/`, `worker/main.py` | 6 contract tests (`test_b7_render_engine.py`), glitch defenses | **DONE** |
| **R13** | Style 1 (Classic Hook): pixel-matched yellow/white Anton look & cuts | `docs/styles/style-1-classic-hook.md`, `styles/builtin/classic_hook.style.json` | Parity render & golden frame SSIM test passed | **DONE** |
| **R14** | Built-in Styles 2 to 5 (Minimal, Splits, Problem-Solution, Vlog) | `styles/builtin/*.style.json` | All 5 styles render 5s samples in container | **DONE** |
| **R15** | Style Studio: clone, customize, real-time preview, save style | `backend/app/api/styles.py`, `frontend/src/pages/StyleStudio.tsx` | Duplicate style, 9:16 canvas preview, style CRUD | **DONE** |
| **R16** | Music library: beat detection, mood/tempo tagging, TikTok audio | `backend/app/services/render/music.py`, `frontend/src/pages/MusicLibrary.tsx` | Librosa beat detection, loudnorm -14 LUFS, yt-dlp downloader | **DONE** |
| **R17** | Catalog: products as folders, clip library, alias resolution | `backend/app/services/catalog/`, `backend/app/api/catalog.py`, `frontend/src/pages/Products.tsx` | 5 unit/contract tests (`test_b3_catalog.py`), frontend built | **DONE** |
| **R18** | Scoring engine: Sunday strategy, scorecards, v1 & v2 formulas | `backend/app/services/analytics/scoring.py`, `backend/app/api/analytics.py` | Exact v1 mathematical parity, v2 multi-signal tests | **DONE** |
| **R19** | Safety & idempotency: retries, backoff, audit log, locked slots | `LRUCacheManager` (job locks), CSRF middleware, `DailyPlannerService` slot locks | Lock eviction protection, planner slot lock preservation | **DONE** |
| **R20** | Data migration CLI: import from CSVs, shadow mode plan comparison | `scripts/import_sheets_csv.py`, `scripts/shadow_mode_compare.py`, `docs/migration/cutover.md` | 5 contract tests (`test_b10_migration.py`), 100% reconciliation report, 7-day shadow comparison | **DONE** |
| **R21** | UI/UX: Apple clarity, Notion calm, B&W palette, command palette | `frontend/src/components/`, `frontend/src/pages/` | Storage page, Design gallery compiled | IN PROGRESS |
| **R22** | Docker compose multi-container architecture, LAN-bound, healthchecks | `compose.yaml`, `docker/Dockerfile.*`, `Makefile` | Multi-container config passed | IN PROGRESS |
