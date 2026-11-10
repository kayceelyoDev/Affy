# Affiliate Autopilot

**Affiliate Autopilot** is a self-hosted, dockerized, all-in-one automation platform for TikTok creators and affiliates. It replaces fragmented automation workflows with a unified, high-performance web dashboard (React PWA) and long-polling Telegram bot.

---

## Key Capabilities

- **AI Creative Pipeline:** Auto-edits multi-clip product videos with beat-synchronized cuts (`librosa`), dynamic text overlays (Anton yellow/white classic look and modern transition styles), and AI-generated captions (`Gemini Flash`).
- **Buffer Publisher:** Direct automated posting and queue scheduling to TikTok via Buffer API (supporting both automatic queue and exact-time publishing).
- **Data Upload & Extraction:** Batched screenshot and CSV ingestion for TikTok Shop orders, GMV, and commissions with OCR powered by Gemini Flash-Lite.
- **Brain Planner:** Autonomous 7x6 daily strategy quota planning that evaluates product velocity, past video performance, and margin to allocate slots.
- **Telegram Companion Bot:** Complete remote control via long polling (no public webhook ports required): daily summaries, approval gates, manual triggers, and interactive brain queries.
- **Enterprise-Grade Vault:** AES-256-GCM encrypted credential vault with zero plaintext secret exposure.

---

## Tech Stack

- **Backend:** Python 3.12, FastAPI, SQLAlchemy 2 (async), Alembic, Pydantic v2, APScheduler, SQLite WAL.
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, PWA.
- **Video Engine:** Python FFmpeg, `libass`, `librosa`, `soundfile`, `Pillow`.
- **Infrastructure:** Docker Compose multi-container (`api`, `worker`, `bot`).

---

## Quickstart

### Prerequisites
- Docker Engine 24+ and Docker Compose v2+
- Python 3.12+ (for local development or CLI utilities)

### 1. Clone & Configure Environment
```bash
cp .env.example .env
# Edit .env with your local LAN ports and settings
```

### 2. Launch Services
```bash
docker compose up -d
```
Access the web dashboard on your local network at `http://<server-ip>:8090`.

---

## Documentation

- [Build Status](docs/progress/BUILD_STATUS.md)
- [Requirements Traceability](docs/REQUIREMENTS_TRACE.md)
- [Architecture & Decisions](docs/DECISIONS.md)
- [Workflow Inventory](docs/migration/inventory.md)
- [Video Editor Technical Analysis](docs/migration/editor-analysis.md)
- [Style 1 Specification](docs/styles/style-1-classic-hook.md)
- [Technical Spikes (S1-S7)](docs/SPIKES.md)

---

## License

This project is licensed under the AGPL-3.0 License (placeholder) - see the [LICENSE](LICENSE) file for details.
