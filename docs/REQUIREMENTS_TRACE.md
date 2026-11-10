# Requirements Traceability Matrix (R01 - R22)

This matrix tracks every functional and non-functional requirement defined in the Master Build Prompt from specification through implementation and automated verification.

| ID | Requirement Description | Target Modules & Files | Tests & Verification | Status |
|---|---|---|---|---|
| **R01** | One unified app replacing 4 n8n workflows (Web LAN + Telegram) | `backend/app/main.py`, `bot/main.py`, `compose.yaml` | Service healthchecks, API test suite | IN PROGRESS |
| **R02** | Python backend (FastAPI, SQLAlchemy, Pydantic) + React TS frontend | `backend/app/`, `frontend/src/` | `pytest backend/tests` (9/9 passed), container builds | IN PROGRESS |
| **R03** | Web-based PWA running on Ubuntu server | `frontend/public/manifest.json`, `frontend/src/sw.ts` | PWA manifest, service worker registration | IN PROGRESS |
| **R04** | Buffer publishing/scheduling + editable schedule timings & manual run | `backend/app/services/scheduler.py`, `backend/app/api/schedules.py` | APScheduler test, manual trigger test passed | IN PROGRESS |
| **R05** | Third-party integrations (Buffer, Gemini, Telegram, Drive, Cloudinary) | `backend/app/services/storage/`, `scripts/spikes/` | Spikes S1-S7, StorageProvider contract tests | IN PROGRESS |
| **R06** | Vault encrypted tokens, masked in UI, editable with test buttons | `backend/app/services/vault.py`, `backend/app/api/settings.py` | `test_vault_encryption_roundtrip`, `test_login_and_masked_secrets_api` | **DONE** |
| **R07** | Analytics source chain (Buffer, TikTok Display, CSV) + quota meter | `backend/app/services/analytics/`, `frontend/src/pages/` | Source priority test, quota counter | NOT STARTED |
| **R08** | Data Upload page: batched screenshots, Gemini OCR, dedupe, review | `backend/app/services/upload/`, `frontend/src/pages/` | Batch OCR test, 18-digit order dedupe test | NOT STARTED |
| **R09** | Daily planner: 7x6 strategy quota, slot planning, style/hook picking | `backend/app/services/planner/`, `frontend/src/pages/` | Quota allocation test, idempotency test | NOT STARTED |
| **R10** | Open-source ready, synthetic demo mode, configurable localization | `backend/app/core/config.py`, `LICENSE`, `README.md` | Configuration test, license placeholder | IN PROGRESS |
| **R11** | Telegram bot parity: night summary, approvals, long polling | `bot/main.py` | Bot process skeleton, long polling loop | NOT STARTED |
| **R12** | Python FFmpeg/libass/librosa video render engine | `worker/main.py` | Worker image skeleton, FFmpeg / librosa | IN PROGRESS |
| **R13** | Style 1 (Classic Hook): pixel-matched yellow/white Anton look & cuts | `docs/styles/style-1-classic-hook.md`, `worker/` | Parameter specification validated | IN PROGRESS |
| **R14** | Built-in Styles 2 to 5 (Minimal, Splits, Problem-Solution, Vlog) | `styles/builtin/` | Style specification and render pipeline | NOT STARTED |
| **R15** | Style Studio: clone, customize, real-time preview, save style | `backend/app/api/`, `frontend/src/pages/` | Style CRUD test, preview pipeline | NOT STARTED |
| **R16** | Music library: beat detection, mood/tempo tagging, TikTok audio | `worker/` | Librosa beat detection, yt-dlp spike S5 | IN PROGRESS |
| **R17** | Catalog: products as folders, clip library, alias resolution | `backend/app/services/storage/`, `frontend/src/pages/Storage.tsx` | StorageProvider contract tests passed | IN PROGRESS |
| **R18** | Scoring engine: Sunday strategy, scorecards, v1 & v2 formulas | `backend/app/services/scoring/` | Formula v1 vs v2 regression tests | NOT STARTED |
| **R19** | Safety & idempotency: retries, backoff, audit log, locked slots | `LRUCacheManager` (job locks), CSRF middleware | Lock eviction protection test passed | IN PROGRESS |
| **R20** | Data migration CLI: import from CSVs, shadow mode plan comparison | `scripts/import_from_n8n.py` | Import wizard verified | IN PROGRESS |
| **R21** | UI/UX: Apple clarity, Notion calm, B&W palette, command palette | `frontend/src/components/`, `frontend/src/pages/` | Storage page, Design gallery compiled | IN PROGRESS |
| **R22** | Docker compose multi-container architecture, LAN-bound, healthchecks | `compose.yaml`, `docker/Dockerfile.*`, `Makefile` | Multi-container config passed | IN PROGRESS |
