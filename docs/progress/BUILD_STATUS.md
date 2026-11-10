# Build Status: Affiliate Autopilot

**Current Mode:** Continuous (`CHECKPOINT_MODE = continuous`)  
**Last Updated:** 2026-11-10T20:40:00+08:00  
**Active Batch:** B2 (Storage layer: Local and Google Drive) -> Transitioning to B3 (Catalog & clip library)

---

## 1. Batch Progress Table

| Batch | Description | Requirement Scope | Status | Gate Status |
|---|---|---|---|---|
| **B0** | Discovery, inventory, skeleton | Discovery, Inventory, Spikes | **DONE** | **PASSED** (commit `1c6dedf`) |
| **B1** | Foundation and design system | R01, R02, R03, R06, R21, R22 | **DONE** | **PASSED** (commit `2c57ecd`) |
| **B2** | Storage layer (Local & Drive) | R05, R17, R19 | **DONE** | **PASSED** (Gate verified, 9/9 tests pass) |
| **B3** | Catalog & clip library | R17 | **DONE** | **PASSED** (14/14 tests pass, frontend built) |
| **B4** | AI gateway & Data Upload | R08 | IN PROGRESS | - |
| **B5** | Analytics, attribution, scoring | R07, R18 | NOT STARTED | - |
| **B6** | Planner (daily brain) | R09, R19 | NOT STARTED | - |
| **B7** | Render engine & 5 styles + music | R12, R13, R14, R15, R16 | NOT STARTED | - |
| **B8** | Captions, publisher, schedules | R04, R05 | NOT STARTED | - |
| **B9** | Telegram bot (parity plus) | R01, R11 | NOT STARTED | - |
| **B10** | Migration, parallel run, cutover | R20 | NOT STARTED | - |
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

## 3. Exact Commands Run & Real Results

- `docker build -t autopilot-api:test -f docker/Dockerfile.api .` -> `RESULT: OK`
- `docker run --rm autopilot-api:test pytest backend/tests -v` -> `RESULT: 14 passed in 4.82s`
- `docker build -t autopilot-frontend:test -f docker/Dockerfile.frontend .` -> `RESULT: OK (built in 3.56s)`
- `python scripts/scan_secrets.py` -> `RESULT: Secret scan PASSED: 0 secrets found`
- `python scripts/check_inventory.py` -> `RESULT: Inventory check PASSED: All 148 nodes accounted for`

---

## 4. Next Exact Steps

1. Commit B3 with message `feat(b3): implement catalog, products as folders, clip library, and aliases`.
2. Proceed autonomously to **B4 (AI Gateway and Data Upload)**:
   - Build Gemini Gateway service with multi-model fallback (Gemini 1.5 Flash / Flash-Lite).
   - Implement daily quota tracking (default 500 requests/day, editable in settings) and token accounting.
   - Build batch upload ingestion pipeline for TikTok Shop order screenshots (multi-image batching 4-6 screenshots per call).
   - Implement strict 18-digit order ID string preservation and deduplication against SQLite DB.
   - Build review queue for low-confidence or unparseable uploads.
   - Build frontend Data Upload page (`/upload`) with drag-and-drop file upload, quota meter, and review queue interface.
   - Test in container, run gate, update trace/status, commit.
