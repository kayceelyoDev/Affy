# Requirements Traceability Matrix (R01 - R22)

This matrix tracks every functional and non-functional requirement defined in the Master Build Prompt from specification through implementation and automated verification.

| ID | Requirement Description | Target Modules & Files | Tests & Verification | Status |
|---|---|---|---|---|
| **R01** | One unified app replacing 4 n8n workflows (Web LAN + Telegram) | `backend/main.py`, `bot/bot.py`, `docker-compose.yml` | End-to-end integration test, Bot polling check | NOT STARTED |
| **R02** | Python backend (FastAPI, SQLAlchemy, Pydantic) + React TS frontend | `backend/`, `frontend/` | `pytest backend/`, `npm run build frontend/` | NOT STARTED |
| **R03** | Web-based PWA running on Ubuntu server | `frontend/manifest.json`, `frontend/sw.ts` | PWA audit, service worker registration test | NOT STARTED |
| **R04** | Buffer publishing/scheduling + editable schedule timings & manual run | `backend/services/publisher/`, `backend/services/scheduler.py` | Unit tests on schedule triggers, mutation builder test | NOT STARTED |
| **R05** | Third-party integrations (Buffer, Gemini, Telegram, Drive, Cloudinary) | `backend/services/media_host/`, `backend/services/integrations/` | Spikes S1-S5, integration contract tests | IN PROGRESS (Spikes built) |
| **R06** | Vault encrypted tokens, masked in UI, editable with test buttons | `backend/services/vault.py`, `backend/api/settings.py` | Cryptographic round-trip test, masking test | NOT STARTED |
| **R07** | Analytics source chain (Buffer, TikTok Display, CSV) + quota meter | `backend/services/analytics/`, `frontend/pages/Analytics.tsx` | Source priority test, quota counter unit test | NOT STARTED |
| **R08** | Data Upload page: batched screenshots, Gemini OCR, dedupe, review | `backend/services/upload/`, `frontend/pages/Upload.tsx` | Batch OCR test, 18-digit order dedupe test | NOT STARTED |
| **R09** | Daily planner: 7x6 strategy quota, slot planning, style/hook picking | `backend/services/planner/`, `frontend/pages/Planner.tsx` | Quota allocation test, idempotency test | NOT STARTED |
| **R10** | Open-source ready, synthetic demo mode, configurable localization | `backend/config.py`, `backend/demo_data/`, `LICENSE` | `DEMO_MODE=true` startup test | NOT STARTED |
| **R11** | Telegram bot parity: night summary, approvals, long polling | `bot/bot.py`, `bot/handlers/` | Mock bot command loop test | NOT STARTED |
| **R12** | Python FFmpeg/libass/librosa video render engine | `worker/render/`, `worker/audio.py` | Video render unit test, audio beat sync test | NOT STARTED |
| **R13** | Style 1 (Classic Hook): pixel-matched yellow/white Anton look & cuts | `styles/builtin/style_1_classic.py`, `worker/render/filters.py` | Style 1 visual parity test, frame count test | NOT STARTED |
| **R14** | Built-in Styles 2 to 5 (Minimal, Splits, Problem-Solution, Vlog) | `styles/builtin/style_{2,3,4,5}.py` | Render test for each style | NOT STARTED |
| **R15** | Style Studio: clone, customize, real-time preview, save style | `backend/api/styles.py`, `frontend/pages/StyleStudio.tsx` | Style CRUD test, JSON schema validation test | NOT STARTED |
| **R16** | Music library: beat detection, mood/tempo tagging, TikTok audio | `backend/services/music/`, `worker/audio.py` | Librosa BPM test, yt-dlp downloader test | NOT STARTED |
| **R17** | Catalog: products as folders, clip library, alias resolution | `backend/services/catalog/`, `frontend/pages/Catalog.tsx` | Alias matching test, folder scan test | NOT STARTED |
| **R18** | Scoring engine: Sunday strategy, scorecards, v1 & v2 formulas | `backend/services/scoring/` | Formula v1 vs v2 regression tests | NOT STARTED |
| **R19** | Safety & idempotency: retries, backoff, audit log, locked slots | `backend/core/retry.py`, `backend/models/audit.py` | Slot conflict test, retry backoff test | NOT STARTED |
| **R20** | Data migration CLI: import from CSVs, shadow mode plan comparison | `scripts/import_sheets_csv.py`, `backend/services/shadow.py` | CSV import fidelity test, diff report test | NOT STARTED |
| **R21** | UI/UX: Apple clarity, Notion calm, B&W palette, command palette | `frontend/src/components/`, `frontend/src/index.css` | UI component test, dark/light theme switch | NOT STARTED |
| **R22** | Docker compose multi-container architecture, LAN-bound, healthchecks | `compose.yaml`, `Dockerfile.*`, `Makefile` | `docker compose config`, container smoke test | NOT STARTED |
