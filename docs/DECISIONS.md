# Architectural and Product Decisions Log

This log records all architecture, technology, and design decisions made throughout the project, following the defaults established in Section 12 of `docs/PROMPT.md`.

---

## Decision Entries

### DEC-001: Frontend Architecture — React PWA
- **Date:** 2026-11-10
- **Decision:** React 18 + Vite + TypeScript + Tailwind CSS with PWA capabilities (manifest + service worker).
- **Rationale:** High desktop density, fast local LAN responsiveness, and native-like desktop installation on Ubuntu/Windows/macOS.

### DEC-002: Buffer Posting Mode — Queue Default with Exact Schedule Support
- **Date:** 2026-11-10
- **Decision:** Default posting mode is Buffer Queue (`mode: addToQueue`, `schedulingType: automatic`). Exact time scheduling (`mode: customScheduled`, `dueAt: ISO8601`) is configurable per slot.
- **Rationale:** Matches proven legacy behavior while enabling precise timing when desired.

### DEC-003: Media Hosting — Cloudinary Default with Interface Abstraction
- **Date:** 2026-11-10
- **Decision:** `MediaHost` interface with `CloudinaryProvider` as default; tunnel provider (Cloudflare Tunnel / ngrok) supported as alternative.
- **Rationale:** Buffer requires a publicly accessible URL to ingest video assets. Cloudinary is already configured and working in the legacy workflow.

### DEC-004: Planner Automation — Auto-Approve with Telegram Notification
- **Date:** 2026-11-10
- **Decision:** Auto-approve is enabled by default, dispatching an immediate summary via Telegram. The owner can toggle to "Approve-first" mode in Settings.
- **Rationale:** Ensures hands-free operation without stalling scheduled post pipelines if the owner is offline.

### DEC-005: Open Source License — AGPL-3.0-or-later Placeholder
- **Date:** 2026-11-10
- **Decision:** Use AGPL-3.0-or-later placeholder in `LICENSE` file, subject to owner confirmation prior to public release.
- **Rationale:** Standard protection for self-hosted network applications.

### DEC-006: Storage Layer Hierarchy — Local & Google Drive Dual Support
- **Date:** 2026-11-10
- **Decision:** Support both Local `/data/clips` and Google Drive via `StorageProvider` abstraction, configurable per product category.
- **Rationale:** Flexibility between local network fast storage and cloud-synced Google Drive.

### DEC-007: Google Drive Authentication — Service Account Default
- **Date:** 2026-11-10
- **Decision:** Service account key JSON is the primary Drive auth method; OAuth2 is the secondary option.
- **Rationale:** Service accounts avoid the 7-day token expiration caveat of unverified OAuth applications in Google Cloud testing status.

### DEC-008: Audio Downloader Safety — Flag Guarded
- **Date:** 2026-11-10
- **Decision:** TikTok audio extraction via `yt-dlp` is governed by `ENABLE_TIKTOK_AUDIO=false` in `.env.example`.
- **Rationale:** Complies with platform terms and prevents unexpected external traffic during testing.

### DEC-009: UI Visual Design System — Monochrome B&W with Muted Dots
- **Date:** 2026-11-10
- **Decision:** Strictly pure black and white styling (Notion/Apple inspired), high information density, semantic status dots with grayscale toggle.
- **Rationale:** Clean, professional creator workspace minimizing distraction.

### DEC-010: Database Engine — SQLite WAL Mode
- **Date:** 2026-11-10
- **Decision:** SQLite with Write-Ahead Logging (`WAL`) mode enabled, stored on `/data/autopilot.db`.
- **Rationale:** Single-user self-hosted system; eliminates unnecessary Postgres container overhead while guaranteeing zero concurrency lockups under typical load.

### DEC-011: Legacy Editor Isolation — Read-Only Guarantee
- **Date:** 2026-11-10
- **Decision:** `\\192.168.1.7\video-editor` is strictly read-only. `tech-reel-editor` is completely excluded from inspection and copying.
- **Rationale:** Preserves host production stability and prevents interference with other running containers.
