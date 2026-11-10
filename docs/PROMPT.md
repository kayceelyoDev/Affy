# MASTER BUILD PROMPT: Affiliate Autopilot (working name)

You are the lead engineer building a self-hosted, dockerized, open-source-ready web application that replaces four n8n workflows for a TikTok affiliate creator. Work in **batches (B0 to B11)**, one after another, **without stopping between batches** unless a stop condition in section 0 applies. Follow this document exactly. Nothing in it is optional unless it says so.

---

## 0. OPERATING PROTOCOL (read first, obey always)

**0.1 Autonomy.** After finishing a batch and passing its gate, immediately start the next batch. Do not ask for permission or confirmation between batches. `CHECKPOINT_MODE = continuous` (the owner may change this line to `pause_after_B0` to review the inventory first).

**Build order:** B0 scans and documents the old workflows, the sheet and the old editor folder completely. Only after the B0 gate passes do you build the whole new application inside PROJECT_ROOT (section 1.1), continuously, B1 through B11, without returning to the owner in between.

**0.2 Stop conditions (the only reasons to stop and ask):**
1. You cannot read the required inputs (workflows, sheet files, the server editor folder) at all.
2. A step would be destructive outside the new project folder (deleting, overwriting or writing to the server share, or to any original file).
3. A batch gate fails 3 times in a row. In that case write the failure to `docs/BLOCKERS.md`, then continue with the next batch that does not depend on it, and report the blocker at the end.

**0.3 Memory across sessions.** Your context will fill up. Therefore:
- Save this entire prompt to `docs/PROMPT.md` in the first minutes of B0.
- Maintain `docs/progress/BUILD_STATUS.md`: batch table (not started / in progress / done / blocked), what was built, exact commands run with their real results, open issues, and **"Next exact steps"**.
- At the start of every session, read `docs/PROMPT.md` and `docs/progress/BUILD_STATUS.md`, then resume at "Next exact steps". If your context is getting long, finish the current task, update BUILD_STATUS.md, then continue in a fresh session the same way.

**0.4 Batch routine (every batch):**
1. Re-read the batch section and the requirement IDs it covers (section 3).
2. Build in small commits (`git commit` with conventional messages). Commit after every meaningful unit, never with secrets.
3. Write tests alongside code. Run the batch gate. Record the real command output summary in BUILD_STATUS.md.
4. Update `docs/REQUIREMENTS_TRACE.md` (requirement ID, files, tests, status).
5. Report in chat in at most 15 lines (done, tested, not verified, next), then start the next batch.

**0.5 Honesty rules.**
- Never claim something works unless you ran it and saw it work. If Docker, a credential, a network call or a device is unavailable, mark that item **UNVERIFIED** in BUILD_STATUS.md and say what the owner must run (`make spike-*` or a named test). Docker runs on this server, so build and test here for real; only checks that need the owner's credentials (live Buffer, Gemini, Drive, Telegram, TikTok Display API) may stay UNVERIFIED.
- Never invent API fields. For Buffer, the working `createPost` mutation is in the n8n poster workflow (node "Post to Buffer"); copy it. Anything else about the Buffer, TikTok or Google APIs must be checked against official docs or listed as an unverified spike (section 8, B0).
- When these instructions conflict with what you find in the owner's files, **the owner's existing behavior wins for existing features** and **this prompt wins for new features**. Log every conflict in `docs/DECISIONS.md`.
- If something is ambiguous, pick the default given in section 12, log it in DECISIONS.md, and continue.

**0.6 Secrets rules (critical, the repo will be published to GitHub).**
- Never write a token, key, chat ID, folder ID, sheet ID, or password into any tracked file, log, test fixture, screenshot or chat message. Refer to variable names only.
- The owner's workflow JSON files and the server editor folder contain real values. They live only in `legacy_private/` (git-ignored). Add a pre-commit secret scan (gitleaks config) in B0 and keep it on.
- Fixtures and sample data are synthetic.

**0.7 Workspace and read-only rules.**
- **PROJECT_ROOT** is the folder you are currently pointed at: the new, dedicated folder on the Ubuntu server. Every new file goes there and nowhere else.
- The **old editor folder** (section 1.1) is **read-only**: never write, edit, rename, move, delete, build in, run containers from, or create files in it. The `tech-reel-editor` folder is never opened, copied or referenced. Never modify the attached originals either; copy what you need into `legacy_private/` and work on copies.
- This server is shared with other running apps (for example n8n, the old editor service, AdGuard, Ollama and the owner's other projects). Never stop, restart, reconfigure or remove another app's containers, volumes, networks, files or ports. Never run `docker system prune` or any cleanup outside this project's own compose project.
- Use the fixed compose project name `affiliate-autopilot`, project-prefixed volumes and networks, and modest resource limits.
- Do not deactivate or edit the running n8n workflows; the owner does that at cutover (B10).

---

## 1. INPUTS

**1.1 Workspace and old editor folder (the owner pastes the note below).**

`[OWNER ACCESS NOTE: the owner pastes the old editor folder path here, for example "\\192.168.1.7\video-editor", and says to ignore the tech-reel-editor folder, which is a different app]`

- **PROJECT_ROOT** = the folder you are currently pointed at, a new dedicated folder on the Ubuntu server. The whole new application is built **there and only there**. PROJECT_ROOT is the repository root (no extra wrapper folder inside it). If it is not empty, list what is in it, never overwrite or delete existing files, and log it in `docs/DECISIONS.md`.
- **OLD EDITOR FOLDER** = the path in the note above. It lives on the same server, so from where you run it is probably a local path (for example `~/video-editor`); the `\\192.168.1.7\...` form is how it looks from the owner's laptop. Use whichever form you can reach. This is the old FFmpeg editor whose behavior must be fully understood and then rebuilt inside the new app. **Exclude the `tech-reel-editor` folder entirely.**
- **Scan all of it first:** full tree listing, then every source file, config, Dockerfile, compose file, script, font, template and small asset. Large media files are listed by name and size only. Before copying anything, write a manifest (path, size, modified time) of the old folder to `legacy_private/old-editor.manifest.txt`; B11 re-checks that nothing in it changed.
- Copy reference files into `PROJECT_ROOT/legacy_private/video-editor/` with a read-only copy, for example:

```
rsync -a --exclude tech-reel-editor --exclude node_modules --exclude .git --exclude __pycache__ --exclude '*.mp4' --exclude '*.mov' --exclude '*.mkv' --exclude '*.webm' --exclude '.env' --exclude '.env.*' "<old editor path>/" legacy_private/video-editor/
```

(`cp -r` with the same exclusions is fine.) Never copy `.env` values; record variable names only.

**1.2 Attachments the owner provides:**
- The four n8n workflow JSON files (148 nodes total): *Workflow 1 Smart Nightly Orders (60 nodes)*, *Workflow 2 Sunday Strategy Engine (23)*, *Auto-edit product videos (32)*, *Google Drive to Gemini to Buffer, TikTok poster (33)*.
- The Google Sheet export for **TikTok_Brain** (tabs include Content_Log, Orders_Log, Product_Master, Sales_Log, Strategy_Quota, Product_Scorecard, Unmatched_Products, plus Dashboard and Analytics).

Copy them to `legacy_private/workflows/` and `legacy_private/sheets/`.

---

## 2. PRODUCT SUMMARY AND SCOPE

**Product:** a single-user, self-hosted app for TikTok affiliates and creators. It auto-edits product videos from clips, writes captions with AI, posts through Buffer, ingests sales and view data (screenshots and files), scores products and styles, and plans what to post every day. Access is by web UI on the local network (installable as a PWA, so it behaves like a desktop app) and by a Telegram bot. Everything runs on the owner's Ubuntu server in Docker.

**In scope:** everything in sections 3 to 11.

**Out of scope (do not build, do not touch):** the Gmail auto-labeler, Hermes agent, Milaw, the expense tracker, the LMS, Tigum, the local AI toolkit, and the `tech-reel-editor` app. Multi-tenant hosting is not in v1 (Buffer has no third-party OAuth for new apps).

---

## 3. REQUIREMENTS CHECKLIST (traceability; every ID must end up DONE or explicitly BLOCKED)

| ID | Requirement |
|---|---|
| R01 | One app replaces all four n8n workflows, reachable on the LAN by browser and by Telegram. |
| R02 | Backend and AI logic in Python (no JavaScript backend). Frontend is React + TypeScript. |
| R03 | Web-based, installable PWA; everything runs on the Ubuntu server. |
| R04 | Buffer still publishes and schedules. The owner can edit the time of every process (render, post, plan, reminders, sync) and enable, disable or run each one now. |
| R05 | Third-party services: Buffer, Gemini, Telegram, Google Drive, Cloudinary (kept, because Buffer must fetch videos from a public URL; behind a `MediaHost` interface with an optional tunnel provider). |
| R06 | All tokens are auto-filled on first run from a seed, stored encrypted, masked in the UI, and editable on a Settings page with "Test connection". |
| R07 | Better analytics. Pull video data without wasting Buffer API quota where possible; use a source chain (Buffer metrics, TikTok Display API, CSV). Show a quota meter. |
| R08 | Data Upload page: many screenshots and files at once, processed with Gemini Flash-Lite (default 500 requests per day, editable), batched, deduplicated, with a review queue. |
| R09 | Daily decisions: the planner uses yesterday's sales, views and uploaded data to decide what to post and which style, hook and time to use. |
| R10 | Open-source and sellable: clean repo, license placeholder, configurable language, currency, timezone and region, demo mode, install story. |
| R11 | Target users: TikTok affiliates and creators. |
| R12 | UI/UX: Apple-style plus Notion-style, purely black and white, modern minimalist. |
| R13 | Products are listed as folders; the folder name is the product name. |
| R14 | Google Drive folders can be imported and viewed in the app; the user can edit and upload inside the app while files are stored on Drive. |
| R15 | Editor styles: the current style is saved as a template (Style 1) and four new built-in styles are added (five total) with transitions, graphics and AI captions per clip. Users can create more in a Style Studio. |
| R16 | Paste a TikTok link, extract the audio, save it to the app and to Drive or local, depending on the user's storage choice. |
| R17 | Two storage options (Google Drive or local). The app creates one folder tree for all assets: videos, audio, images, analytics files, exports. |
| R18 | Everything is dockerized; the repository is organized for publishing on GitHub. |
| R19 | Analyze the workflows, the sheet and the server editor folder first; create a new organized project folder with a new editor and the whole application. |
| R20 | Work in batches and continue automatically (section 0). |
| R21 | Fix the known weak spots (section 5.3). |
| R22 | Preserve the existing data and behavior (section 5.1, 5.2) so migration loses nothing. |

---

## 4. TECH STACK (fixed)

| Layer | Choice |
|---|---|
| Backend | Python 3.12, FastAPI, SQLAlchemy 2, Alembic, Pydantic v2, structlog |
| Database | SQLite (WAL) by default; PostgreSQL via compose profile. Code must run on both. |
| Jobs and schedules | APScheduler with a DB job store (editable schedules survive restarts) and a DB-backed job queue consumed by a separate **worker** process. Every job is idempotent and logged to `runs` and `run_logs`. |
| AI | Own `ai_gateway` module on `google-genai`; optional Ollama provider for text fallback. |
| Video | FFmpeg (with libass and fonts), `ffprobe`; beat analysis with librosa; the editor is ported into the worker (no separate service). |
| Telegram | `python-telegram-bot` or `aiogram`, **long polling** (no public URL or webhook). |
| Frontend | React + TypeScript + Vite + Tailwind (CSS-variable tokens) + shadcn/ui on Radix + TanStack Query and Table + dnd-kit + Framer Motion + Lucide icons; served by FastAPI as a PWA. |
| Packaging | Docker Compose: `api`, `worker`, `bot`, optional `db` (PostgreSQL) and `proxy` (Caddy) profiles. |
| Quality | pytest, ruff, mypy, ESLint, Vitest, Playwright smoke tests, pre-commit with gitleaks. |

Repository layout (create exactly, add folders as needed):

```
PROJECT_ROOT/   (this is the repository root)
  backend/  frontend/  worker/  bot/
  styles/builtin/*.style.json      fonts/ (OFL-licensed only)
  docker/  compose.yaml  compose.prod.yaml
  scripts/import_from_n8n.py  scripts/import_sheets_csv.py  scripts/spikes/
  docs/  (install, architecture, migration, styles, api, progress, PROMPT.md)
  legacy_private/                  git-ignored: originals, reference only
  .env.example  .gitignore  .pre-commit-config.yaml  .gitleaks.toml
  LICENSE  README.md  CONTRIBUTING.md  CHANGELOG.md  Makefile
```

---

## 5. WHAT MUST BE PRESERVED, AND WHAT MUST BE FIXED

### 5.1 Baseline behavior to port exactly (verify each against the workflow files; the files win on existing behavior)

**Schedules (Asia/Manila, all editable):** nightly sales reminder 23:59; Sunday strategy 00:30 (becomes the nightly planner, see B6); auto-edit 01:00; poster 02:00.

**Defaults:** 6 videos per day; max 1 video per product per day; 4 to 6 clips per video; target stock 6; max renders per run 6; short cooldown 3 days when a product has too few clips; strategy window 7 days; max 7 videos per product per week; guaranteed minimum per product per week = 2 if `active_products * 2 <= weekly_total - 6`, else 1 (weekly_total = videos_per_day * 7); caption language "Taglish (natural mix of Filipino and English)"; fallback call to action "Check the link below" with the pointing-down emoji; fallback hashtags `#fyp #tiktokshop #tiktokmademebuyit`; Buffer monthly limit setting 1000; Cloudinary cleanup after 14 days; wait between posts as in the poster workflow.

**Order stages (canonical):** `UNPAID` (Customer unpaid, e.g. cash on delivery), `PAID_IN_TRANSIT` (Pending, no settle date), `DELIVERED_PENDING` (Pending with estimated settle date), `SETTLED`, `CANCELLED` (ineligible, cancel, return, refund, invalid, closed). Confirm the exact mapping in the "Smart Inspect & Process File" and "Unpack Orders" nodes.

**Order rules:** `order_id` is TEXT, copied digit for digit, valid only if 10 to 22 digits; flag `order_id_uncertain`; `is_shop_ads` flag; commission rate as a decimal; `actual_commission` null when "-" is shown; orders upsert by `order_id`; `settle_date_changes` tracked; unmatched products go to a pending alias list and the owner links them with a one-tap choice.

**Scorecard v1 (port exactly, as selectable "scoring profile v1"):**
- Order weights: SETTLED 1.0, pending 0.7, cancelled counted separately, unpaid ignored.
- `commission_per_video = weighted_commission / max(1, videos_posted)`
- `orders_per_1000_views = orders_total / (total_views / 1000)`, or `orders_total * 1.5` when there are no views
- `cancel_rate = cancelled / (orders_total + cancelled)`
- `raw = commission_per_video*10 + orders_per_1000_views*5 + settled_orders*6 + avg_views/500 - cancel_rate*20`
- If `videos_posted < 2` and no proven sales (settled >= 1 or orders >= 2), multiply by 0.6. Floor at 0.
- Tiers: SCALE if (videos >= 2 or proven) and score >= 25; STEADY if (videos >= 1 or orders >= 1) and score >= 5; COOLDOWN if videos >= 4 and orders == 0 and score < 2; otherwise TEST. Trend UP/DOWN/STABLE/NEW versus the previous score (thresholds in the code node).

**Two-step quota (port as the baseline planner):** step 1 guaranteed minimum per active product; step 2 distribute the remaining pool as bonus slots (SCALE most, STEADY moderate, TEST small exploration of 1 to 2, COOLDOWN zero), capped at `max_per_product_per_week`; AI proposes `bonus_slots`, code validates (sum equals pool, caps, exact product keys) and falls back to a score-proportional split; build the 7-day plan by distributing slots across weekdays with at most 6 per day and no product twice in a day when avoidable.

**Captions:** product name (or main search keyword) in the first 8 words; 1 to 2 short natural sentences; only obvious general benefits; never invent specs, prices, discounts, ratings or claims; one short call to action; 4 to 6 hashtags (2 broad, 2 to 4 specific); under 300 characters; requested language; JSON output with one `caption` field; backup caption (product name + call to action + hashtags + title tag) if AI fails.

**Hook styles (rotate, avoid repeats per product and per batch):** a curious question; a short POV line; a "wait till you see this" teaser; a relatable everyday problem with the product as the fix; a casual recommendation like telling a friend; a "you need this if..." line.

**Buffer:** GraphQL at `https://api.buffer.com`, bearer personal API key, `createPost` mutation as written in the poster workflow (text, channelId, `schedulingType: automatic`, `mode: addToQueue`, video asset by URL). Keep it as "Queue mode".

**Cloudinary:** upload by unsigned preset, use the `secure_url` for Buffer, delete uploads older than the cleanup days.

**Existing video look (becomes Style 1):** product title in yellow plus subtitle in white at the top, Anton font, tight heavy letters, static text only, beat-synced cuts, 30 s maximum, 4 to 6 random clips, clip rotation that prefers unused clips, the glitch fix for the roughly 1 in 10 renders that glitched. Read the real parameters from the editor folder; do not guess them.

**Telegram:** nightly reminder text and pipeline pulse (pending orders, estimated commission, settling tomorrow, unmatched count); screenshots sent as files for sharper order IDs; weekly CSV/XLSX drops; chat assistant for ROI, cashflow, top videos, unmatched products and alias mapping ("map 1 to ..."); no-videos-left warning; render and post summaries.

**Sheet data:** import Content_Log, Orders_Log, Product_Master, Sales_Log, Strategy_Quota, Product_Scorecard, Unmatched_Products (and keep Dashboard and Analytics as reference). Known columns include Content_Log: Date_PHT, Time_PHT, Product_Name, File_Name, Hook_Style, Buffer_Post_ID, Caption, Views, product_key, video_id, tiktok_link, likes, comments, shares, last_synced_date; Orders_Log: order_id, first_seen_date, last_updated_date, status_stage, settle_date_est, settle_date_changes, product_key, product_name_raw, price, quantity, gmv, is_shop_ads, video_caption_raw, matched_video_id, commission_rate, est_commission, actual_commission, notes, order_date. Confirm against the real export.

### 5.2 Data migration rules
- **No data loss.** Every row and every column is imported. Columns the new schema does not know go into a JSON `extra` field. Renaming columns is allowed only if the data is kept.
- Normalize dates to ISO UTC with the display zone from settings; resolve ambiguous dd/mm vs mm/dd by the same heuristic the workflows use, report ambiguous rows, never drop them.
- `order_id` is always text; detect and report IDs that were rounded to numbers.
- Importers are idempotent (running twice does not duplicate).

### 5.3 Weak spots to fix (all required)
1. **State in n8n static data** (recent clips, cooldowns, posted IDs, clip counts, quota snapshot) becomes database tables.
2. **Google Sheets as the database** becomes real tables with ISO timestamps; Sheets and CSV export remain only as optional reports.
3. **Product names patched in code** (for example suffixes added for fast charger, laptop cooler, computer speaker) become an alias table with a UI.
4. **Magic numbers in scoring** become an editable, versioned scoring profile with an explanation stored per decision. Keep v1 exact, ship v2 with recency decay, shrinkage for low sample sizes, and per-style and per-hook effects, selectable in Settings.
5. **Random hook rotation** becomes learned: track hook-style performance per product and overall and bias toward winners with an exploration share.
6. **Caption-text order matching** becomes reliable: every caption starts with a unique fingerprint (first words made unique per post, stored normalized) so affiliate-order video captions match the exact post.
7. **Weekly stale-checked quota** becomes a daily plan with weekly guardrails; slots are idempotent (a slot is rendered once and posted once), fixing the "same videos regenerated every day" and "more than 6 videos a day" bugs.
8. **Telegram polled every 2 minutes** becomes long polling.
9. **Repeated whole-tab reads** disappear; use indexed queries.

---

## 6. ARCHITECTURE

```
browser / PWA / Telegram
        |
   FastAPI (REST + SSE live job logs): auth, settings, secrets vault
        |
   services: ingest, products, storage, planner, styles, captions, publisher, analytics
        |                         |
   job queue  <---- worker ----> FFmpeg render, yt-dlp, AI gateway, Buffer, MediaHost
        |
   SQLite/Postgres + /data volume (or Google Drive via StorageProvider)
```

All external access goes only through gateway modules: `ai_gateway`, `buffer_client`, `telegram`, `MediaHost`, `StorageProvider`, `metrics_sources`. No direct calls elsewhere.

---

## 7. DATA MODEL (Alembic migration for every change)

`products` (key, display_name, active, storage_folder_ref, clip_count, default_style_id, notes) · `product_aliases` (alias, product_id, status confirmed|pending, sample_order_id) · `clips` (product_id, storage_ref, hash, duration, caption_cache, last_used_at) · `renders` (product_id, style_id, style_version, spec_snapshot, clip_ids, storage_ref, status, created_at) · `posts` (render_id, buffer_post_id, caption, caption_fingerprint, hook_style, style_id, scheduled_for, posted_at, status) · `post_metrics_daily` (post_id, date, views, likes, comments, shares, source) · `orders` (order_id TEXT, status_stage, product_id, price, qty, gmv, commission_rate, est_commission, actual_commission, settle_date_est, settle_date_changes, is_shop_ads, matched_post_id, confidence, extra JSON) · `sales_daily` · `plans` and `plan_slots` (date, time, product, style, hook, reason, locked, source ai|user, status) · `scorecards` (period, product, score, tier, trend, components JSON, profile_version) · `uploads` and `extractions` (file hash, type, model, raw JSON, confidence, review_status, prompt_version) · `music_tracks` (title, source_url, storage_ref, duration, bpm, beat_times, license_note, safe_to_use) · `styles` (name, version, spec JSON, builtin, archived) · `schedules` (job, cron/time, enabled, last/next run) · `runs` and `run_logs` · `secrets` (name, encrypted value, last_tested, last_rotated) · `settings` · `ai_usage` (model, key label, task, day, count) · `api_usage` (service, day, count, remaining from headers) · `audit_log` · `users`.

Times are stored in UTC; the display zone is a setting (default Asia/Manila).

---

## 8. BATCHES

### B0. Discovery, inventory, skeleton (no application code beyond the skeleton)
1. In PROJECT_ROOT, create the repo layout, `git init`, `.gitignore` (including `legacy_private/`, `data/`, `.env`), pre-commit with gitleaks, `Makefile`, and save this prompt to `docs/PROMPT.md`. Create `docs/progress/BUILD_STATUS.md`, `docs/DECISIONS.md`, `docs/BLOCKERS.md`.
2. Write the old editor folder manifest, then copy the inputs into `legacy_private/` (section 1).
3. **Workflows:** for each file list every node (type, name, trigger, settings, credential names only, sheet tab and columns read or written, external calls) and summarize each code node's logic. Output `docs/migration/inventory.md` as a table: Behavior | Source (file, node) | New home (module, table, page) | Batch | Status. Add a script `scripts/check_inventory.py` that proves all 148 nodes are covered.
4. **Sheet:** per tab: columns, types, row count, date formats seen, anomalies (duplicates, mixed dates, blank keys, rounded order IDs). Output `docs/migration/sheet-schema.md` with the mapping to tables.
5. **Old editor folder** (scan all of it, read-only, `tech-reel-editor` excluded; tree listing first, then every source, config and script): Dockerfile, dependencies, endpoints (including `/jobs/{id}/clips` and `/jobs/{id}/render` and the `X-Token` header), every FFmpeg command and filter graph, text styling parameters, font, music and beat handling, job lifecycle, and the glitch fix. Output `docs/migration/editor-analysis.md` and `docs/styles/style-1-classic-hook.md` with exact parameters.
6. **Secrets inventory:** names only, in `docs/migration/secrets-inventory.md`.
7. **Spike kit:** create `scripts/spikes/` and `docs/SPIKES.md`. Each spike has a mock mode and a live mode that the owner runs with real credentials (`make spike-<n>`): S1 Buffer post metrics on a real TikTok post (are views present, requests used, rate-limit headers); S2 Buffer create-post with an exact schedule time (verify the `mode` and `dueAt` field names in the official API reference); S3 Gemini batched multi-image extraction accuracy on at least 10 real screenshots (4 to 6 per request); S4 Drive service account list and upload; S5 `yt-dlp` on a real TikTok link (run it yourself on the server if it has internet access); S6 render-time test of transition styles on this server (run it yourself with synthetic test clips made by FFmpeg); S7 TikTok Display API `video.list` (optional). Continue with mocks; never block on live results.
8. Create `docs/REQUIREMENTS_TRACE.md` with all R-IDs.

**Gate:** all files exist; inventory covers 148 of 148 nodes; secret scan clean; no tracked file contains a token, chat ID or folder ID; the old editor folder is untouched (manifest unchanged); nothing was written outside PROJECT_ROOT.

### B1. Foundation and design system
- Docker skeleton: `api`, `worker`, `bot`, optional `db` and `proxy` profiles, `/data` volume, healthchecks, non-root users, pinned base images, restart policy, worker CPU and memory limits. `make up`, `make down`, `make check`.
- **Shared-server rules:** before choosing host ports, check what is in use (`ss -ltnp` and `docker ps`); known examples are n8n on 5678 and the old editor on 8010, but trust the live check. Take ports from `.env` with free defaults, bind to the LAN only, and never reuse another app's port, volume or network name.
- Backend core: config, DB, Alembic, Argon2 admin login with session cookie, CSRF, login rate limit, LAN-only bind by default, audit log, structured logging with secret redaction.
- **Secrets vault:** AES-GCM or Fernet; master key generated on first run and stored outside the DB (0600 file or Docker secret); API never returns stored values (masked tail only); Replace and Test connection actions; every change audited.
- Settings store, `schedules` table with APScheduler and DB job store, job queue, `runs` and `run_logs`, SSE live logs, Run Now, enable and disable.
- **First-run wizard** and `scripts/import_from_n8n.py` (reads the plain Settings values from the workflow JSON such as chat ID, folder IDs, Cloudinary name and preset, editor URL; reads `.env.seed` for the Telegram, Buffer, Gemini and other keys; encrypts them; tells the owner to delete the seed file). n8n exports contain credential references only, so never expect keys inside the JSON.
- Frontend scaffold with the **design system** (section 10) and a `/design` gallery route, app shell (sidebar, breadcrumbs, command palette, themes), PWA manifest and service worker.
**Gate:** `make check` passes; `docker compose config` valid; login works; secret round-trip test (stored encrypted, never returned); job runs and streams logs; `/design` renders all components in light and dark.

### B2. Storage layer (Local and Google Drive)
- `StorageProvider` interface: `list`, `stat`, `download` (to cache), `upload` (resumable), `rename`, `move`, `delete` (to trash), `changes`. Contract tests run against both Local and a Drive fake.
- Identical folder tree on both:
```
Affiliate Autopilot/
  products/<Product Name>/   raw clips
  renders/                   finished videos
  music/                     audio library
  images/                    uploaded screenshots
  analytics/                 CSV/XLSX uploads and exports
  styles/                    custom fonts, graphics packs
```
- Settings: one global choice (Local or Google Drive) plus optional per-category override. A migration tool copies, verifies by hash and only then flips the setting.
- Google Drive: **service account** (default) and **OAuth** (second option); use file IDs and hashes, never names; Changes API polling (default 5 minutes) plus a Refresh button; size-capped LRU cache for downloads; shortcut and Google-native file handling.
- Storage settings page with connection test and a folder tree view.
**Gate:** provider contract tests green for Local and the Drive fake; migration tool dry-run and verify tested; Drive live check listed as UNVERIFIED for the owner (S4).

### B3. Catalog: products as folders, clip library, aliases
- Products page: Notion-style gallery of folders (cover from first clip, clip count, active toggle); New Product creates a folder in storage; opening a folder shows a clip grid with preview; drag-upload many files, rename, move, delete, multi-select; renaming a folder renames the product and, after confirmation, the Drive folder.
- **Drive import wizard:** connect, pick root folder, list subfolders, tick which become products; adopt existing folders and clips without moving anything; two-way sync.
- Aliases and Unmatched Products UI (dropdown to link an alias; bulk confirm).
- Clip metadata via `ffprobe`; thumbnails; low-stock warning (fewer than the minimum clips).
- Product views: Table, Gallery, Board; inline editing.
**Gate:** import of a fake Drive tree creates the right products; alias linking updates matching; upload and rename flow tested on both providers.

### B4. AI gateway and Data Upload
- **AI gateway:** task-to-model routing in Settings (vision extraction and captions on a Flash-Lite model, strategy and chat on a stronger model, optional Ollama text fallback). Validate model IDs against the models list at first run; never hard-code an assumption that a model exists. Per `(key, model)` counters for RPM and RPD (defaults 15 and 500, editable; RPD resets at midnight Pacific time); fallback chain on 429 or overload (next model, next key, then queue for after the reset); response cache keyed by input hash; Pydantic structured output with one repair retry, then the review queue; versioned prompt files with the version stored on each extraction; Usage page.
- **Ingest pipeline** (shared by web and Telegram): multi-file drag and drop with per-file progress; type detection without AI for spreadsheets (TikTok Studio content CSV, commission and orders XLSX, by headers); a cheap classifier for images (Affiliate Orders screen, Products screen, other); **batch 4 to 6 images per Gemini request** with a schema returning results per image index; dedupe by file hash and by `order_id` upsert; validators (order ID 10 to 22 digits, commission about rate times price within tolerance, canonical stage mapping); deterministic pandas handlers for spreadsheets (update views, append missing posts, upsert settled orders) with no AI cost.
- **Review queue page:** image on the left, editable extracted fields on the right, one-click confirm, unmatched product linking.
- Orders, Sales and Uploads pages.
**Gate:** fixtures of synthetic screenshots and files go through the whole pipeline with a faked Gemini; batching reduces the number of calls (asserted by test); dedupe and validators tested; quota counters and fallback tested.

### B5. Analytics sources, attribution, scoring
- **Metric sources behind one interface, with priority and per-source enable:** (1) Buffer post metrics via a personal API key, paginated posts-with-metrics or aggregate queries (about 1 to 2 requests per day; metrics refresh roughly daily and a missing metric is not zero; verify whether TikTok views are filled via spike S1); (2) TikTok Display API `video.list` (own videos, daily snapshots, token refresh; only a current cumulative total is returned, so store daily snapshots); (3) TikTok Studio CSV upload. Merge by `buffer_post_id` and TikTok video ID; show which source filled each number.
- **Quota meter:** Buffer and AI requests used today and this month, from response headers and local counters; refuse non-essential calls when low; posting has priority over metrics. Never hard-code Buffer limits; read them from headers.
- **Attribution:** caption fingerprint matching of orders to posts; per-video commission.
- **Analytics page:** per-product views, orders, GMV, settled and pending commission, cancel rate, orders per 1,000 views, commission per video; per-style and per-hook performance; time-of-day and weekday performance; cashflow (pending, settling soon, settled, with cancel rate applied to pending); 24 h and 72 h views velocity.
- **Scoring profiles v1 (exact port) and v2** with an explanation stored per decision; tiers and trends; Dashboard page (today's plan, posted and queued, quota meters, cashflow, alerts).
**Gate:** v1 reproduces the workflow's numbers on the imported sheet data (write a comparison test using the real export in `legacy_private/` and a synthetic fixture for CI); attribution tests; quota-meter tests with recorded headers; sources merge test.

### B6. Planner (the daily brain)
- Runs nightly after ingest (default 00:30) and whenever new data is uploaded. Inputs: yesterday's orders and views, last 7 and 28 days, clip stock, cooldowns, style and hook performance.
- Order of decisions: deterministic scoring, then rules (guaranteed minimum per product per week, caps per day and per week, cooldown for repeatedly dry products, clip-stock check of at least 4 clips, exploration share default 15 percent for TEST products), then the AI allocates only the leftover slots with a one-line reason each. Output must pass validation (sum, caps, exact keys); on failure fall back to the score-proportional split. Also choose a style and a hook per slot, and a target time.
- **Today's Plan page:** edit, swap, lock or skip a slot; auto-approve toggle (default ON, with a Telegram summary; OFF waits for approval); **dry-run mode** that plans and renders nothing and posts nothing, used in B10.
- Idempotent slots: a slot is rendered once and posted once; daily post cap check includes anything posted today.
**Gate:** unit tests for rules, caps, fallback, idempotency, daily-cap and dry-run; the plan for the imported data is generated and explained.

### B7. Render engine and styles (three sub-batches, run in order)

**B7a. Engine and Style 1.**
- Normalize every clip first (30 fps, 1080x1920, yuv420p, audio normalized).
- A **style spec** (JSON, versioned) compiled in Python into an FFmpeg `filter_complex`. Spec fields: canvas; clip rules (min and max count, per-clip duration range, speed, crop or blurred-background fill); cut logic (beat-synced or fixed); transitions (weighted list with durations); text layers (title, subtitle, call to action, per-clip caption: font, size, color, stroke, box, position, animation); graphics (PNG or SVG with start and end times); motion (zoom punch, Ken Burns); audio (music pool, volume, ducking).
- Worker module: pick clips (prefer unused, record usage), render, write locally, upload to the chosen storage; keep a one-day buffer of ready videos; timeout and queue; per-render log.
- Port the old editor as **Style 1 "Classic Hook"** with exact parameters from the editor analysis, including the glitch fix.
- **Parity test:** render the same sample inputs with the old logic (recorded outputs or its commands) and the new worker; compare frames (SSIM threshold documented). Golden-frame tests per style.

**B7b. Styles 2 to 5, AI clip captions, Style Studio.**
| # | Name | Look | Techniques |
|---|---|---|---|
| 1 | Classic Hook | the owner's current look | static `drawtext`, beat-synced hard cuts |
| 2 | Smooth Flow | soft crossfades and slides; white AI caption bottom-center on each clip; small title fading out after 2 s | `xfade` (fade, dissolve, slideleft), alpha-faded `drawtext` |
| 3 | Punchy Zoom | cuts of 0.6 to 1.2 s; zoom punch on every beat; whip and flash transitions; large word-by-word highlighted center captions | scale and crop expressions on beat, `xfade` (zoomin, wipeleft, short pixelize), ASS subtitles with karaoke timing |
| 4 | Promo Pop | animated call-to-action badge, top banner with product name, progress bar, sticker graphics, captions on a pill background | timed PNG `overlay`, `drawbox` progress bar from an expression, `drawtext` with box |
| 5 | Clean Showcase | blurred-background fill, slow Ken Burns, serif title card for the first 1.5 s, lower-third captions, soft fades | `boxblur` plus `overlay`, slow `zoompan`, `fade` |
- Ship these as `styles/builtin/*.style.json` with OFL-licensed fonts and a small graphics pack drawn by you (no copyrighted assets).
- **AI clip captions:** sample 2 to 3 frames per clip; **one batched Gemini Flash-Lite vision request per video** returns a 3 to 6 word caption per clip in the caption language, with no invented specs or claims; cache by clip, product and language; editable in the Clip Library; fallback to a per-product phrase bank.
- **Style Studio page:** form builder, not code: transitions, fonts (upload TTF or OTF), colors, drag text and graphics on a phone-shaped preview, caption mode; **Preview Render** makes a 5 s low-resolution test from sample clips; duplicate, archive, export and import `.style.json`.
- Style selection per product: default style, rotation pool, or "planner picks"; every post stores `style_id`.
- Document the measured render time of each style (S6) and any known `xfade` limits.

**B7c. Music Library.**
- Page and Telegram command `/music <link>`. Worker downloads with a pinned `yt-dlp`, extracts audio with FFmpeg, normalizes loudness to about -14 LUFS, trims leading silence, detects BPM and beat times (librosa), saves to the `music/` folder of the chosen storage, stores title, source URL, duration, BPM, tags, license note and a safe-to-use flag. Optional "keep source video" toggle (off by default). Manual audio upload always available. Scheduled `yt-dlp` update inside the container; clear errors when extraction fails.
- **Plugin switch:** the TikTok downloader sits behind `ENABLE_TIKTOK_AUDIO` (default `false` in `.env.example`; the owner's own `.env` sets `true`). Show a Settings warning that sounds from other videos are often copyrighted and can be muted or flagged, especially on commercial and affiliate accounts; the planner prefers tracks marked safe. Never place downloaded music in the repo or image.
**Gate:** all five styles render a 5 s sample in tests; golden-frame tests; Style 1 parity passes; music extraction tested with a local audio fixture and a mocked downloader; S5 and S6 listed for the owner.

### B8. Captions, publisher, schedules
- Caption service per section 5.1 with the fingerprint, banned-claims list in Settings, backup template, and a Regenerate button on the post detail page.
- **Hook learning** (section 5.3 item 5).
- **Buffer client** through `buffer_client`: **Queue mode** (current) and **Exact-time mode** (the app computes slot times and uses Buffer's scheduled-post fields, confirmed by spike S2; if unverified, ship Queue mode as the default and mark Exact-time mode UNVERIFIED). Retries with backoff; every call counted in the quota meter; posting never starved by metrics.
- **MediaHost interface** with two providers: Cloudinary (default) and Tunnel (tokenized, expiring media URL served by the app for use behind a tunnel hostname). Keep the auto-cleanup. Delete-after-post as a setting.
- **Schedules page:** every job (nightly reminder, ingest check, planner, render, post, metrics sync, music update, cleanup, weekly report) with time or cron editor, enable toggle, Run Now, last and next run, and a "run as chain" option (ingest, plan, render, post).
- Pipeline and Runs page with live logs and retry; Videos page showing each render and post with metrics, caption, style and hook.
**Gate:** end-to-end test with fakes: plan, render, caption, publish, log; Buffer error paths; quota refusal; schedule edits persist across restart.

### B9. Telegram bot (parity plus)
- Allowlisted chat IDs only; silence for everyone else. Photos and documents go into the same ingest pipeline as the web page.
- Commands: `/today`, `/status` (quota meters, last runs), `/sales` (cashflow pulse), `/plan` (approve, edit, skip), `/pause`, `/resume`, `/unmatched` (link aliases with buttons), `/music <link>`, free-text assistant using the same data as the dashboard.
- Scheduled messages: nightly reminder with pipeline pulse, no-videos-left warning, render and post summaries, weekly report with CSV export, low-quota warnings.
**Gate:** bot handlers tested with a fake Telegram client; allowlist test; ingest via bot test.

### B10. Migration, parallel run, cutover
- `scripts/import_sheets_csv.py` for all tabs (rules in 5.2) with a report of rows imported, merged and flagged.
- First-run wizard completes the setup from the n8n import and `.env.seed`.
- **Shadow mode:** the app plans and shows what it would do next to n8n for 5 to 7 days, with a comparison report (plan vs what n8n posted). Dry-run is on by default until the owner switches posting over.
- `docs/migration/cutover.md`: step-by-step switch, rollback, which n8n workflows to deactivate in which order, and a reminder to rotate the old editor token and any keys that were in the originals.
**Gate:** importer idempotency, row-count reconciliation against the real export (in `legacy_private/`), comparison report produced.

### B11. Hardening, docs, GitHub
- CI (GitHub Actions): lint, type check, tests, build **amd64 and arm64** images, push to GHCR on version tags; Dependabot; secret scanning.
- README quickstart (`docker compose up -d`, first-run wizard), architecture, install, configuration, styles, API, migration, troubleshooting, contributing, changelog, security policy.
- **Demo mode** with fake data so a visitor can explore without any account; sample data pack (synthetic).
- LICENSE placeholder (AGPL-3.0-or-later, flagged in DECISIONS.md as owner-pending); third-party license notices; a documented list of features that depend on third-party services and their terms.
- Security review checklist run and recorded (secrets, auth, CSRF, headers, upload validation, file-type and size limits, path traversal, SSRF protection on the downloader and media URLs, log redaction).
- **Final completeness audit:** complete `docs/REQUIREMENTS_TRACE.md` so every R-ID and every inventory row has a file, a test and a status; list everything UNVERIFIED or BLOCKED with the exact owner action; run the whole test suite and `docker compose build`; re-check that the old editor folder manifest is unchanged; write the final report.
**Gate:** zero R-IDs without a status; no secret in tracked files (scan output recorded); `make check` and compose build pass (or are marked UNVERIFIED with a reason).

---

## 9. DEFAULT SCHEDULES (all editable on the Schedules page; timezone Asia/Manila)

| Job | Default |
|---|---|
| Nightly sales reminder and pipeline pulse | 23:59 |
| Ingest check (Telegram uses long polling continuously) | continuous |
| Daily planner | 00:30 |
| Render | 01:00 |
| Post | 02:00 |
| Metrics sync (1 to 2 Buffer requests) | 09:00 |
| Drive sync | every 5 minutes |
| Weekly report | Sunday 08:00 |
| Media cleanup | daily 04:00 |
| yt-dlp update | weekly |

---

## 10. UI/UX SPECIFICATION (Apple clarity, Notion calm, black and white)

| Token | Light | Dark |
|---|---|---|
| Background | #FFFFFF | #000000 |
| Surface | #FAFAFA | #0A0A0A |
| Raised | #FFFFFF | #141414 |
| Hairline border | rgba(0,0,0,.08) | rgba(255,255,255,.10) |
| Text primary | #0A0A0A | #F5F5F5 |
| Text secondary | #6B6B6B | #A1A1A1 |
| Text tertiary | #9A9A9A | #6E6E6E |
| Primary button and focus ring | black with white label | white with black label |

- Type: `-apple-system` and SF Pro, Inter fallback; 14 px body, 13 px dense tables, headings 28, 22, 17 px at weight 500 to 600, letter-spacing -0.01em.
- Space and shape: 4 px grid, 8 px rhythm; radius 10 px controls, 14 px cards and sheets; hairlines instead of shadows; shadows only on floating layers; translucent blurred title bar and sheets.
- Notion-style: collapsible sidebar with the product folder tree, favorites and recents; breadcrumbs; every list is a database with Table, Gallery and Board views, inline editing, hover row actions, drag and drop; Cmd/Ctrl+K command palette (jump, run a job, upload).
- Motion: 150 to 220 ms ease-out, springs on sheets, skeleton loaders, full `prefers-reduced-motion` support.
- Color: none in the chrome. Status is an icon plus a word; a 6 px muted status dot may use green, amber and red; a Settings toggle makes it grayscale. Thumbnails and user content are the only other color.
- Themes: Light, Dark, System. WCAG AA. Keyboard-first with a visible 2 px focus ring. Usable on a phone (bottom tab bar under 768 px). Installable PWA with icon and splash.
- Pages: Dashboard, Today's Plan, Pipeline and Runs, Videos, Products, Clip Library, Style Studio, Music Library, Storage, Data Upload and Review Queue, Orders, Analytics, Schedules, Integrations and Settings (secrets, test buttons, limits, language, timezone, scoring profile, caption rules, banned claims), Usage (AI and Buffer requests), Audit log.
- A `/design` route shows every component and state; new UI may use only these tokens and components.

---

## 11. SECURITY AND OPEN-SOURCE READINESS

- Secrets encrypted at rest; never in code, image, logs, front-end bundle or git history; auto-fill happens only through the first-run import.
- Admin login with Argon2, session cookie, CSRF, login rate limit; bind to the LAN interface by default; optional HTTPS through the proxy profile.
- Validate every upload (type, size, extension vs content), prevent path traversal, restrict the downloader and media fetches against SSRF, redact logs.
- Configurable language, currency, timezone and TikTok Shop region (affiliate order screens differ; keep extraction prompts per region and versioned), hook styles, caption rules, style templates.
- Single-user and self-hosted first; each user brings their own Buffer key, Gemini key, Telegram bot and (optionally) a Drive service account and TikTok developer app. Document each in `docs/`.
- Do not promise earnings anywhere; state that TikTok, TikTok Shop and Buffer can change screens, APIs and rules.

---

## 12. DECISION DEFAULTS (use these unless the owner overrides; log in `docs/DECISIONS.md`)

1. Frontend: React PWA.
2. Posting: Buffer **Queue mode** default; **Exact-time mode** selectable (after spike S2).
3. Cloudinary: default provider; Tunnel provider optional.
4. Planner approval: auto-approve ON with a Telegram summary; the owner can switch to approve-first.
5. License: AGPL-3.0-or-later placeholder, owner-pending.
6. Clip storage: Google Drive or local chosen at setup, per-category override allowed.
7. Drive login: service account default, OAuth as the second option. Known catches to document: the narrow `drive.file` scope cannot browse existing folders; OAuth apps left in Testing status have refresh tokens that expire after about 7 days.
8. TikTok audio downloader: behind `ENABLE_TIKTOK_AUDIO`, off in `.env.example`, on in the owner's `.env`.
9. Status dots: muted semantic dots with a grayscale toggle.
10. Default model IDs are editable settings and validated at first run.

---

## 13. DEFINITION OF DONE (whole project)

- Every R01 to R22 is DONE or has a documented BLOCKED or UNVERIFIED reason with the exact owner action.
- `docker compose up -d` brings up a working app from a clean machine; the first-run wizard completes the setup.
- Style 1 matches the old editor output within the documented tolerance; styles 2 to 5 render; Style Studio can create and preview a new style.
- Data Upload ingests a batch of mixed screenshots and files, with a review queue for uncertain items.
- The planner produces an explained daily plan from imported data; slots are idempotent.
- Telegram bot commands work against fakes; owner-run live checks are listed.
- The repository contains no secrets and is organized for GitHub.

---

## 14. START NOW

1. Read sections 0 to 3 again.
2. Confirm PROJECT_ROOT is the folder you are pointed at and that the old editor folder is reachable read-only. Begin **B0**. When its gate passes, continue straight into **B1**, and so on through **B11**, following section 0.
3. Send a first short message when B0 starts (what you are reading) and one after every batch gate (done, tested, UNVERIFIED, next).