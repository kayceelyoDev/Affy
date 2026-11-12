# Cutover & Production Switchover Guide

This guide details the exact step-by-step procedure for switching production publishing from the legacy n8n workflows to **Affiliate Autopilot**, along with verification checks, an immediate rollback procedure, and post-cutover security hardening.

---

## 1. Pre-Cutover Checklist

Before touching running production systems, verify that all prerequisites are satisfied:

- [ ] **Data Reconciliation Complete:** `scripts/import_sheets_csv.py` ran with 100% reconciliation and zero errors recorded in `docs/migration/reconciliation_report.md`.
- [ ] **Shadow Mode Parity Verified:** `scripts/shadow_mode_compare.py` produced a valid 7-day shadow comparison in `docs/migration/shadow_mode_report.md`.
- [ ] **Secrets Seeded in Vault:** API credentials (Buffer API token, Gemini API key, Telegram bot token, Cloudinary / Drive credentials) are verified via the Web UI Settings page (`/settings`) with the "Test connection" button.
- [ ] **Clips Stocked:** At least 4 clips are uploaded in `/data/clips/<Product_Name>/` for active catalog products.
- [ ] **Dry-Run Mode Enabled:** By default, `dry_run = True` on plans until Step 3.

---

## 2. Order of Workflow Deactivation (n8n)

Deactivate the 4 legacy n8n workflows **in reverse dependency order** so that partially processed jobs or in-flight renders do not collide or duplicate:

### Step 1: Deactivate Auto-Edit Product Videos (Workflow 3)
- **Workflow Name:** `Auto-edit product videos v4.0 (strategy-aware, urgent daily-plan, clip count & ROI sync)` (32 nodes)
- **Why First:** Prevents the legacy FFmpeg editor service (`video-editor` on port 8010) from spawning new renders or consuming drive clips.
- **Action:** Open n8n web interface -> Navigate to Workflow 3 -> Toggle active switch to **OFF**.

### Step 2: Deactivate Google Drive to Buffer Poster (Workflow 4)
- **Workflow Name:** `Google Drive to Gemini to Buffer (TikTok) v4.0 - 6 a day, anti-repeat hooks & quota sync` (33 nodes)
- **Why Second:** Halts legacy Buffer API calls and caption generation to eliminate duplicate TikTok video posts.
- **Action:** Open n8n web interface -> Navigate to Workflow 4 -> Toggle active switch to **OFF**.

### Step 3: Deactivate Sunday Strategy Engine (Workflow 2)
- **Workflow Name:** `Workflow 2 - Sunday Strategy Engine v3.0 (Master Sync + Scorecard + Two-Step Quota)` (23 nodes)
- **Why Third:** Stops legacy scorecard calculations and overwriting Google Sheet quota tabs.
- **Action:** Open n8n web interface -> Navigate to Workflow 2 -> Toggle active switch to **OFF**.

### Step 4: Deactivate Smart Nightly Orders Sync (Workflow 1)
- **Workflow Name:** `Workflow 1 - Smart Nightly Orders, Multi-File Weekly Sync, Sales Log Sync & Gemini Assistant (v5.1)` (60 nodes)
- **Why Last:** Allows final order settlement sync to finish before disabling orders polling.
- **Action:** Open n8n web interface -> Navigate to Workflow 1 -> Toggle active switch to **OFF**.

---

## 3. Activating Affiliate Autopilot

1. **Start Multi-Container Stack:**
   ```bash
   cd ~/TiktokCreator
   docker compose up -d
   ```
   Verify running containers (`api`, `worker`, `bot`, `frontend`):
   ```bash
   docker compose ps
   ```

2. **Disable Dry-Run & Enable Automated Publishing:**
   - In the Web UI (`http://<LAN_IP>:8090/planner`):
     - Toggle the **Dry Run** switch to **OFF**.
     - Toggle **Auto-Approve** to **ON** (or review daily plans manually).
   - In the Schedules page (`/schedules`):
     - Ensure the 10 automated background jobs (`nightly_orders_sync`, `daily_planner`, `video_render_pipeline`, `buffer_poster_sync`, `metrics_sync`, etc.) are enabled.

3. **Trigger First Autonomous Pipeline Run:**
   - In the Runs page (`/runs`), click **Run Pipeline Chain**.
   - Monitor the live SSE terminal drawer as it executes:
     `StorageSync` -> `DailyPlanner` -> `RenderPipeline` -> `BufferPublisher`.

4. **Verify Telegram Notifications:**
   - Check the Telegram bot chat. Send `/status` and `/today` to confirm the bot responds with live database status.

---

## 4. Rollback Plan (Immediate Fallback)

If unexpected issues or API errors occur during the cutover window:

1. **Pause Affiliate Autopilot Publishing:**
   - Send `/pause` to the Telegram bot or toggle **Dry Run** to **ON** in `/planner`.
   - If containers must be stopped:
     ```bash
     cd ~/TiktokCreator
     docker compose stop
     ```

2. **Reactivate n8n Workflows in Forward Order:**
   - Workflow 1 (`Smart Nightly Orders`) -> Toggle **ON**.
   - Workflow 2 (`Sunday Strategy Engine`) -> Toggle **ON**.
   - Workflow 3 (`Auto-edit product videos`) -> Toggle **ON**.
   - Workflow 4 (`Google Drive to Gemini to Buffer`) -> Toggle **ON**.

3. **Verify Legacy Publishing:**
   - Confirm n8n resumes scheduling and order ingestion.

---

## 5. Post-Cutover Security Hardening & Key Rotation

Once Affiliate Autopilot has operated successfully in live production for 48 hours:

1. **Rotate Video Editor Token:**
   - The old FFmpeg video editor token in `legacy_private/` was exposed in legacy n8n credentials.
   - Decommission or re-key the old `video-editor` container.
2. **Rotate API Keys:**
   - Generate a new personal access token on Buffer.com. Update in `/settings` vault.
   - Generate a new Gemini API Key in Google AI Studio. Update in `/settings` vault.
   - Re-key Telegram Bot Token via `@BotFather` if previously shared with legacy services.
3. **Delete Ephemeral Seed Files:**
   - Confirm `.env.seed` is deleted from disk:
     ```bash
     rm -f .env.seed
     ```
4. **Archive Legacy Sheets:**
   - Set the Google Sheet `TikTok_Brain` to **Read Only** / Viewer mode to prevent accidental edits.
