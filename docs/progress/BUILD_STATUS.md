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
| **B3** | Catalog & clip library | R17 | **DONE** | **PASSED** (commit `44cb453`) |
| **B4** | AI gateway & Data Upload | R08 | **DONE** | **PASSED** (20/20 tests pass, frontend built) |
| **B5** | Analytics, attribution, scoring | R07, R18 | IN PROGRESS | - |
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

## 3. Exact Commands Run & Real Results

- `docker build -t autopilot-frontend:test -f docker/Dockerfile.frontend .` -> `RESULT: OK (built in 3.54s)`
- `docker build -t autopilot-api:test -f docker/Dockerfile.api .` -> `RESULT: OK`
- `docker run --rm autopilot-api:test pytest backend/tests -v` -> `RESULT: 20 passed in 7.68s`
- `python scripts/scan_secrets.py` -> `RESULT: Secret scan PASSED: 0 secrets found`
- `python scripts/check_inventory.py` -> `RESULT: Inventory check PASSED: All 148 nodes accounted for`

---

## 4. Next Exact Steps

1. Stage and commit B4 with message `feat(b4): implement ai gateway, multi-image batching, data upload, review queue, and orders master`.
2. Proceed autonomously to **B5 (Analytics sources, attribution, scoring)**:
   - Metric sources interface with priority and per-source enable:
     1. Buffer post metrics (paginated posts with metrics or aggregate queries).
     2. TikTok Display API `video.list` (own videos, daily snapshots, token refresh).
     3. TikTok Studio CSV upload.
   - Merge metrics by `buffer_post_id` and TikTok `video_id`, with source attribution tracking.
   - Quota meter for Buffer & AI requests from headers & local counters.
   - Attribution engine: Caption fingerprint matching of orders to posts; per-video commission.
   - Scoring profiles: v1 (exact n8n formula reproduction) and v2 (multi-signal formula).
   - Frontend Analytics Page (`/analytics`): GMV, views, orders/1k views, cashflow (settled/pending), 24h & 72h velocity.
   - Write tests (`test_b5_analytics_scoring.py`), run gate, update trace/status, commit.
