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
| **B3** | Catalog & clip library | R17 | NOT STARTED | - |
| **B4** | AI gateway & Data Upload | R08 | NOT STARTED | - |
| **B5** | Analytics, attribution, scoring | R07, R18 | NOT STARTED | - |
| **B6** | Planner (daily brain) | R09, R19 | NOT STARTED | - |
| **B7** | Render engine & 5 styles + music | R12, R13, R14, R15, R16 | NOT STARTED | - |
| **B8** | Captions, publisher, schedules | R04, R05 | NOT STARTED | - |
| **B9** | Telegram bot (parity plus) | R01, R11 | NOT STARTED | - |
| **B10** | Migration, parallel run, cutover | R20 | NOT STARTED | - |
| **B11** | Hardening, docs, GitHub | R10, R22 | NOT STARTED | - |

---

## 2. What Was Built in B2

1. **Storage Provider Abstraction & Providers:**
   - `StorageProvider` abstract base class (`list`, `stat`, `download`, `upload`, `rename`, `move`, `delete`, `changes`).
   - `LocalStorageProvider`: Secure local NVMe file operations, directory traversal protection, `/trash` preservation with timestamping, change journaling.
   - `DriveStorageProvider`: Google Drive API v3 provider using service account authentication.
   - `FakeDriveStorageProvider`: Deterministic in-memory Google Drive fake for contract testing.
2. **Size-Capped LRU Cache Manager with Job Locks:**
   - `LRUCacheManager`: Configurable size quota on downloaded assets (`/data/cache`).
   - Strict job locks: `lock_file()` and `unlock_file()` guarantee files needed by active or queued render jobs are never evicted even when disk quota is exceeded.
   - Tested: evicts oldest unlocked assets up to quota, strictly refuses to evict locked files.
3. **Storage Sync Service & REST API:**
   - `StorageSyncService`: Bidirectional/polling synchronization, rate limit backoff on HTTP 429/503, conflict resolution (newest mtime wins).
   - `/api/storage/meters`: Returns local disk total/free, LRU cache usage, Google Drive quota.
   - `/api/storage/files`: Directory browsing for `/clips`, `/renders`, `/archive`, `/trash`.
   - `/api/storage/sync`: Immediate manual sync trigger.
   - `/api/storage/preview/{file_path}`: Video streaming endpoint with HTTP Range support for in-browser playback.
4. **Frontend Storage & Sync Page (`/storage`):**
   - Three live storage meters (NVMe, LRU Cache with Job Lock indicator, Google Drive Cloud).
   - Tabbed directory browser (`/clips`, `/renders`, `/archive`, `/trash`).
   - Video preview modal player with aspect ratio preservation.
   - "Sync Now" button with CSRF protection and loading state.
5. **Contract Test Suite:**
   - `test_storage_provider_contract`: Parameterized contract tests running against both Local filesystem and Drive Fake (upload, stat, list, rename, move, delete, changes).
   - `test_lru_cache_eviction_and_job_locks`: Verified LRU eviction and job lock protections.
   - `test_storage_api_and_sync`: Verified API meters, file listings, and manual sync.

---

## 3. Exact Commands Run & Real Results

- `python scripts/run_check.py` -> `RESULT: OK (Inventory, Secrets, and Integrity checks passed)`
- `docker run --rm autopilot-api:test pytest backend/tests` -> `RESULT: 9 passed in 2.93s`
- `docker build -t autopilot-frontend:test -f docker/Dockerfile.frontend .` -> `RESULT: OK (built in 3.38s)`

---

## 4. Next Exact Steps

1. Run secret scan prior to staging.
2. Commit B2 with message `feat(b2): implement local and drive storage layer, lru cache with job locks, and storage ui`.
3. Proceed autonomously to **B3 (Catalog: products as folders, clip library, aliases)**.
