# Changelog

All notable changes to Affiliate Autopilot will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-11-10

### Added
- **Batch 0 (Discovery, Inventory & Skeleton):**
  - Full inventory of 148 legacy n8n nodes across 4 workflows accounted for (`docs/migration/inventory.md`).
  - Schema analysis of 8 Google Sheet tabs (`docs/migration/sheet-schema.md`).
  - Analysis of legacy FFmpeg video editor (`docs/migration/editor-analysis.md`).
  - Spike kit (S1-S7) with mock and live modes.
  - Secret scanning with zero secrets in tracked repo.
- **Batch 1 (Foundation & Design System):**
  - FastAPI lifespan, SQLite WAL database, Argon2id auth, HMAC sessions, CSRF protection, AES-256-GCM vault, APScheduler.
  - React + TypeScript + Vite + Tailwind CSS monochrome Notion/Apple design system with collapsible sidebar, command palette, PWA manifest, and service worker.
- **Batch 2 (Storage Layer: Local & Drive):**
  - Storage provider contracts (`LocalStorageProvider`, `DriveStorageProvider`).
  - LRU cache with size limits and active job locks.
  - Storage dashboard with disk meters, tabbed directory browser, and video player.
- **Batch 3 (Catalog & Clip Library):**
  - Products as folders (`/data/clips/<product>/`), clip library with ffprobe metadata extraction.
  - Physical folder rename sync, delete guard modal, alias resolution with fuzzy matching.
- **Batch 4 (AI Gateway & Data Upload):**
  - Task-to-model AI gateway with RPM/RPD rate limiting, fallback chains, and markdown repair.
  - Deterministic spreadsheet parser (0 AI calls) and 4-6 image batched vision OCR.
  - Drag-and-drop batch upload, split-screen review queue, and orders master table.
- **Batch 5 (Analytics, Attribution, Scoring):**
  - Metric source chain (Buffer, TikTok Display API, CSV) with quota meter.
  - Attribution engine with caption keyword fingerprinting and order-to-post matching.
  - Sunday Strategy Scoring engine: v1 exact mathematical parity with legacy n8n formula and v2 multi-signal scoring.
- **Batch 6 (Planner - The Daily Brain):**
  - Daily planner service with 7x6 strategy quota matrix (6 daily slots: 09:00, 11:00, 14:00, 16:00, 19:00, 21:00).
  - Clip readiness check (`clip_count >= 4`), COOLDOWN skips, daily cap (max 1/product/day), 15% exploration quota, and user slot locks.
- **Batch 7 (Render Engine & 5 Styles + Music):**
  - Python FFmpeg render engine with 7 glitch defenses, Anton font `#EFD34C` hook overlay, SSIM >= 0.99 golden frame parity.
  - 5 versioned styles (`classic_hook`, `smooth_flow`, `punchy_zoom`, `promo_pop`, `clean_showcase`).
  - Style Studio with 9:16 canvas preview and Music Library with librosa beat detection and -14 LUFS normalization.
  - Dedicated background worker daemon (`worker/main.py`).
- **Batch 8 (Captions, Buffer Publisher, Schedules):**
  - Taglish caption engine with banned claims filter, CTA, and `[TTC-XXX-SALT]` attribution fingerprint.
  - Multi-armed bandit hook learning engine with 15% exploration quota.
  - Buffer publisher supporting Queue and Exact-time modes with quota guard.
  - MediaHost providers (`CloudinaryMediaHostProvider`, `TunnelMediaHostProvider`, `MockMediaHostProvider`).
  - 10 editable background jobs in APScheduler and autonomous pipeline chain executor with live SSE logs.
- **Batch 9 (Telegram Bot - Parity Plus):**
  - Long-polling daemon with strict allowlist authorization.
  - Commands: `/today`, `/status`, `/sales`, `/plan`, `/pause`, `/resume`, `/unmatched`, `/music <link>`, `/help`.
  - Inline approval callbacks, media intake directly into IngestPipeline, and conversational creator assistant.
- **Batch 10 (Migration, Parallel Run, Cutover):**
  - Google Sheets CSV importer (`scripts/import_sheets_csv.py`) with 100% data reconciliation across 71 legacy rows.
  - Shadow mode simulator (`scripts/shadow_mode_compare.py`) producing 7-day parallel run comparison.
  - Cutover guide (`docs/migration/cutover.md`) with reverse workflow deactivation sequence and rollback procedure.
- **Batch 11 (Hardening, Docs, GitHub Readiness):**
  - Synthetic demo mode (`DEMO_MODE=true`, `scripts/seed_demo.py`, `GET /api/demo/status`, `POST /api/demo/seed`).
  - GitHub Actions CI/CD workflow (`.github/workflows/ci.yml`) for linting, testing, and multi-arch container builds (`amd64`, `arm64`).
  - Dependabot configuration (`.github/dependabot.yml`).
  - AGPL-3.0 license placeholder, third-party license notices (`docs/THIRD_PARTY_LICENSES.md`), and comprehensive security audit (`docs/SECURITY_AUDIT.md`).
