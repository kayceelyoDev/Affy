# Legacy n8n Workflow Migration Inventory

Total workflows: 4  
Total nodes: 148  
Coverage: 148 of 148 nodes (100%)

---

## 1. Workflow 1: Smart Nightly Orders, Multi-File Weekly Sync, Sales_Log Sync & Gemini Assistant (v5.1) (60 nodes)

| Node Name | Node Type | Behavior & Logic Summary | New Home (Module / Table / UI) | Batch | Status |
|---|---|---|---|---|---|
| Daily 11:59 PM PHT | n8n-nodes-base.scheduleTrigger | Triggers nightly at 23:59 PHT | `backend.scheduler` / `schedules` table | B1 | PLANNED |
| Reminder Settings | n8n-nodes-base.set | Assigns `telegram_chat_id` | `backend.config` / `settings` table | B1 | PLANNED |
| Read Orders for Nightly Pulse | n8n-nodes-base.googleSheets | Queries Orders_Log for pending & settling orders | `backend.services.orders` / `orders` table | B5 | PLANNED |
| Build Nightly Pulse | n8n-nodes-base.code | Computes pending count/commission, settling tomorrow, unmatched count | `bot.handlers.pulse` / Telegram | B9 | PLANNED |
| Ask for sales update | n8n-nodes-base.telegram | Sends nightly reminder and pulse message to Telegram | `bot.client` / Telegram | B9 | PLANNED |
| Check replies every 2 min | n8n-nodes-base.scheduleTrigger | Cron `*/2 * * * *` legacy polling trigger | Replaced by Long Polling in `bot.worker` | B9 | PLANNED |
| Settings | n8n-nodes-base.set | Defines bot token and chat ID | `backend.config` / `secrets` vault | B1 | PLANNED |
| Read offset | n8n-nodes-base.code | Fetches Telegram update offset from static data | Telegram long polling offset in DB / state | B9 | PLANNED |
| Get Telegram updates | n8n-nodes-base.httpRequest | Calls Telegram `getUpdates` API | Replaced by python-telegram-bot long polling | B9 | PLANNED |
| Pick new reply | n8n-nodes-base.code | Inspects updates, extracts photo/document/text, detects csv/xlsx | `bot.handlers.ingest` | B4/B9 | PLANNED |
| List product folders | n8n-nodes-base.googleDrive | Lists Drive folders in clips root | `backend.services.storage` | B2/B3 | PLANNED |
| Read Product_Master | n8n-nodes-base.googleSheets | Reads active product keys and aliases | `backend.services.products` / `products` table | B3 | PLANNED |
| Read Content_Log | n8n-nodes-base.googleSheets | Reads posts and view counts | `backend.services.posts` / `posts` table | B5 | PLANNED |
| Read Orders_Log | n8n-nodes-base.googleSheets | Reads historical orders | `backend.services.orders` / `orders` table | B5 | PLANNED |
| Read Unmatched_Products | n8n-nodes-base.googleSheets | Reads pending unmatched products | `backend.services.products` / `product_aliases` | B3/B4 | PLANNED |
| Unpack Messages | n8n-nodes-base.code | Computes 7-day velocity, executive pulse totals, top products ROI leaderboard | `backend.services.analytics` | B5/B9 | PLANNED |
| Loop Over Messages | n8n-nodes-base.splitInBatches | Iterates batch updates | FastAPI async ingest task queue | B4 | PLANNED |
| Known products | n8n-nodes-base.code | Passes item with context | `backend.services.ingest` | B4 | PLANNED |
| Is Weekly File? | n8n-nodes-base.if | Branch: is document spreadsheet (CSV/XLSX)? | `backend.services.ingest.classifier` | B4 | PLANNED |
| Download Weekly File | n8n-nodes-base.telegram | Downloads binary file from Telegram | `bot.handlers.file_download` | B4/B9 | PLANNED |
| CSV or XLSX Format? | n8n-nodes-base.if | Branch: CSV vs XLSX | `backend.services.ingest.parsers` | B4 | PLANNED |
| Extract CSV File | n8n-nodes-base.extractFromFile | Extracts CSV rows | `pandas` / `csv.DictReader` in ingest service | B4 | PLANNED |
| Extract XLSX File | n8n-nodes-base.extractFromFile | Extracts Excel sheets | `openpyxl` / `pandas` in ingest service | B4 | PLANNED |
| Smart Inspect & Process File | n8n-nodes-base.code | Deterministic parsing of Creator Content CSV vs Commission XLSX | `backend.services.ingest.spreadsheets` | B4 | PLANNED |
| Is Content Data? | n8n-nodes-base.if | Checks if parsed data is creator video metrics | Pipeline router in ingest service | B4/B5 | PLANNED |
| Unpack Content Updates | n8n-nodes-base.code | Unpacks video metric updates | `backend.services.analytics.metrics` | B5 | PLANNED |
| Has Updates? | n8n-nodes-base.if | Filters empty update batches | Service logic in metrics sync | B5 | PLANNED |
| Update Content_Log Views | n8n-nodes-base.googleSheets | Updates views, likes, comments, shares, video_id, link | `posts` / `post_metrics_daily` tables | B5 | PLANNED |
| Unpack Missing Content Posts | n8n-nodes-base.code | Identifies posts from TikTok not in log | Ingest backfill handler | B4/B5 | PLANNED |
| Has Appends? | n8n-nodes-base.if | Checks if new posts exist | Ingest backfill handler | B4/B5 | PLANNED |
| Append Missing Content_Log | n8n-nodes-base.googleSheets | Adds backfilled posts to DB | `posts` table | B5 | PLANNED |
| Confirm Content CSV | n8n-nodes-base.telegram | Sends video metrics sync summary to Telegram | `bot.notifications` | B9 | PLANNED |
| Is Commission Data? | n8n-nodes-base.if | Checks if parsed data is commission/settlement | Ingest router | B4 | PLANNED |
| Unpack Settled Orders | n8n-nodes-base.code | Unpacks settled order rows | `backend.services.orders` | B4 | PLANNED |
| Has Settled Orders? | n8n-nodes-base.if | Checks if settled orders exist | Service logic | B4 | PLANNED |
| Upsert Settled to Orders_Log | n8n-nodes-base.googleSheets | Upserts order_id, stage, settled commission | `orders` table | B4 | PLANNED |
| Confirm Orders XLSX | n8n-nodes-base.telegram | Sends orders sync summary to Telegram | `bot.notifications` | B9 | PLANNED |
| Alert Unknown File | n8n-nodes-base.telegram | Alerts user if spreadsheet format unrecognized | Ingest error handler & bot notification | B4/B9 | PLANNED |
| Has image? | n8n-nodes-base.if | Checks if message is screenshot image | Ingest router | B4 | PLANNED |
| Get image | n8n-nodes-base.telegram | Downloads screenshot image | `bot.handlers.image_download` | B4/B9 | PLANNED |
| Gemini Vision (image) | @n8n/n8n-nodes-langchain.chainLlm | Extracts order cards from screenshot via Gemini Flash-Lite | `ai_gateway` vision extraction service | B4 | PLANNED |
| Gemini Vision Model | @n8n/n8n-nodes-langchain.lmChatGoogleGemini | Configures `gemini-3.5-flash-lite` vision | `ai_gateway.models` | B4 | PLANNED |
| Gemini (text) | @n8n/n8n-nodes-langchain.chainLlm | Text CFO chat & natural language alias mapping | `ai_gateway` chat / assistant service | B4/B9 | PLANNED |
| Gemini Text Model | @n8n/n8n-nodes-langchain.lmChatGoogleGemini | Configures text model for chat | `ai_gateway.models` | B4 | PLANNED |
| Parse sales JSON | n8n-nodes-base.code | Parses Gemini JSON, canonical stages, alias linking, validation | `backend.services.ingest.extraction` | B4 | PLANNED |
| Parsed OK? | n8n-nodes-base.if | Checks parsing success vs failure | Service error handling / review queue | B4 | PLANNED |
| Unpack Orders for Orders_Log | n8n-nodes-base.code | Prepares valid order records | `backend.services.orders` | B4 | PLANNED |
| Has Valid Orders? | n8n-nodes-base.if | Checks valid orders | Service logic | B4 | PLANNED |
| Upsert Orders_Log | n8n-nodes-base.googleSheets | Upserts orders by 10-22 digit order_id | `orders` table | B4 | PLANNED |
| Unpack Unmatched Products | n8n-nodes-base.code | Isolates products with UNMATCHED key | `product_aliases` pending review | B3/B4 | PLANNED |
| Has Unmatched? | n8n-nodes-base.if | Checks unmatched count | Service logic | B3/B4 | PLANNED |
| Append Unmatched_Products | n8n-nodes-base.googleSheets | Records unmatched products to review list | `product_aliases` table (status=pending) | B3/B4 | PLANNED |
| Unpack Master Alias Updates | n8n-nodes-base.code | Prepares alias link updates | `backend.services.products.aliases` | B3 | PLANNED |
| Has Master Alias? | n8n-nodes-base.if | Checks master alias updates | Service logic | B3 | PLANNED |
| Upsert Product_Master Alias | n8n-nodes-base.googleSheets | Updates confirmed product aliases | `product_aliases` / `products` | B3 | PLANNED |
| Confirm logged | n8n-nodes-base.telegram | Sends extraction summary to Telegram | `bot.notifications` | B9 | PLANNED |
| Ask to resend | n8n-nodes-base.telegram | Prompts user to send clearer image | `bot.notifications` | B9 | PLANNED |
| Unpack Sales_Log Rows | n8n-nodes-base.code | Formats rows for Sales_Log | `sales_daily` table | B4/B5 | PLANNED |
| Has Sales_Log Rows? | n8n-nodes-base.if | Checks if sales rows exist | Service logic | B4/B5 | PLANNED |
| Upsert Sales_Log | n8n-nodes-base.googleSheets | Upserts daily aggregated sales by Source | `sales_daily` table | B4/B5 | PLANNED |

---

## 2. Workflow 2: Sunday Strategy Engine v3.0 (Master Sync + Scorecard + Two-Step Quota) (23 nodes)

| Node Name | Node Type | Behavior & Logic Summary | New Home (Module / Table / UI) | Batch | Status |
|---|---|---|---|---|---|
| Sunday 12:30 AM PHT | n8n-nodes-base.scheduleTrigger | Triggers Sunday 00:30 PHT | `backend.scheduler` / `schedules` table | B1 | PLANNED |
| Run now (manual) | n8n-nodes-base.manualTrigger | Manual execution trigger | "Run Now" in UI Schedules page & API | B1 | PLANNED |
| Settings | n8n-nodes-base.set | Sets window (7d), caps, thresholds (scale=25, steady=5, cooldown=2) | `settings` / `scoring_profiles` | B5/B6 | PLANNED |
| Read Content_Log | n8n-nodes-base.googleSheets | Reads content history | `posts` table | B5 | PLANNED |
| Read Orders_Log | n8n-nodes-base.googleSheets | Reads orders history | `orders` table | B5 | PLANNED |
| Read Product_Master | n8n-nodes-base.googleSheets | Reads active product catalog | `products` table | B3 | PLANNED |
| Read Product_Scorecard | n8n-nodes-base.googleSheets | Reads previous scorecard for trend calculation | `scorecards` table | B5 | PLANNED |
| List product folders | n8n-nodes-base.googleDrive | Lists Drive product folders | `backend.services.storage` | B2/B3 | PLANNED |
| Prepare data | n8n-nodes-base.code | Syncs catalog, computes Scorecard v1 formula, guaranteed min, bonus pool | `backend.services.scoring` | B5/B6 | PLANNED |
| Strategy AI | @n8n/n8n-nodes-langchain.chainLlm | Allocates bonus pool across products with reasons | `backend.services.planner.ai` | B6 | PLANNED |
| Gemini Strategy Model | @n8n/n8n-nodes-langchain.lmChatGoogleGemini | Configures strategy model (temp=0.2) | `ai_gateway` | B4/B6 | PLANNED |
| Quota JSON Parser | @n8n/n8n-nodes-langchain.outputParserStructured | Enforces strict JSON schema on bonus slots | Structured output validation | B4/B6 | PLANNED |
| Validate quota | n8n-nodes-base.code | Validates allocations, fallback split, distributes 7x6 weekly schedule | `backend.services.planner` | B6 | PLANNED |
| Valid quota? | n8n-nodes-base.if | Checks plan validity | Planner service guard | B6 | PLANNED |
| Clear Strategy_Quota | n8n-nodes-base.googleSheets | Clears previous week's quota sheet | Daily DB plans with status | B6 | PLANNED |
| Rows to write | n8n-nodes-base.code | Formats quota rows | `backend.services.planner` | B6 | PLANNED |
| Write Strategy_Quota | n8n-nodes-base.googleSheets | Writes weekly quota and daily_plan_json | `plans` and `plan_slots` tables | B6 | PLANNED |
| Unpack Scorecard Rows | n8n-nodes-base.code | Prepares scorecard records | `backend.services.scoring` | B5 | PLANNED |
| Write Product_Scorecard | n8n-nodes-base.googleSheets | Persists scorecard metrics per product | `scorecards` table | B5 | PLANNED |
| Unpack Master Sync Rows | n8n-nodes-base.code | Prepares new catalog items | `backend.services.products` | B3 | PLANNED |
| Sync Product_Master | n8n-nodes-base.googleSheets | Updates Product_Master with new folders | `products` table | B3 | PLANNED |
| Send strategy report | n8n-nodes-base.telegram | Sends strategy overview to Telegram | `bot.notifications` | B9 | PLANNED |
| Strategy failed | n8n-nodes-base.telegram | Alerts user if strategy run fails | `bot.notifications` | B9 | PLANNED |

---

## 3. Workflow 3: Auto-edit product videos v4.0 (32 nodes)

| Node Name | Node Type | Behavior & Logic Summary | New Home (Module / Table / UI) | Batch | Status |
|---|---|---|---|---|---|
| Daily run (1 AM) | n8n-nodes-base.scheduleTrigger | Triggers daily at 01:00 PHT | `backend.scheduler` / `schedules` table | B1 | PLANNED |
| Run now (manual) | n8n-nodes-base.manualTrigger | Manual execution trigger | "Run Now" in UI Schedules page & API | B1 | PLANNED |
| Settings | n8n-nodes-base.set | Sets editor_url, editor_token, target stock=6, max_run=6, min_clips=4 | `backend.config` / `settings` table | B1 | PLANNED |
| List ready stock | n8n-nodes-base.googleDrive | Checks ready rendered videos in storage | `backend.services.storage` / `renders` table | B2/B7 | PLANNED |
| List product folders | n8n-nodes-base.googleDrive | Lists raw product folders | `backend.services.storage` | B2/B3 | PLANNED |
| Read Strategy_Quota | n8n-nodes-base.googleSheets | Reads active plan, daily_plan_json, adjustments | `plans` / `plan_slots` tables | B6 | PLANNED |
| Read Content_Log | n8n-nodes-base.googleSheets | Checks videos already posted today | `posts` table | B5 | PLANNED |
| Read Product_Master | n8n-nodes-base.googleSheets | Checks active flag and canonical names | `products` table | B3 | PLANNED |
| Read Orders_Log | n8n-nodes-base.googleSheets | Computes sales scores for tie-breaking | `orders` table | B5 | PLANNED |
| Plan production | n8n-nodes-base.code | Selects products needing renders (prioritizes today/tomorrow urgent) | `worker.render_planner` | B6/B7 | PLANNED |
| Any jobs? | n8n-nodes-base.if | Branch: are there videos to render? | Worker task queue | B7 | PLANNED |
| Explain no jobs | n8n-nodes-base.code | Explains reasons (stock full, insufficient clips, cooling) | Worker logs / Telegram note | B7/B9 | PLANNED |
| Send note | n8n-nodes-base.telegram | Sends status note to Telegram | `bot.notifications` | B9 | PLANNED |
| Loop Over Items | n8n-nodes-base.splitInBatches | Iterates render jobs | Worker task runner | B7 | PLANNED |
| List clips of product | n8n-nodes-base.googleDrive | Lists available clips in product folder | `backend.services.storage` / `clips` table | B2/B3 | PLANNED |
| Pick clips | n8n-nodes-base.code | Selects 4-6 clips preferring unused; updates clip_count; short cooldown | `worker.clip_picker` | B7 | PLANNED |
| Enough clips? | n8n-nodes-base.if | Checks clip count >= min_clips (4) | Clip validation in picker | B7 | PLANNED |
| Download clip | n8n-nodes-base.googleDrive | Downloads clip file to local worker cache | `StorageProvider.download` | B2/B7 | PLANNED |
| Send clip to editor | n8n-nodes-base.httpRequest | Uploads clip to FFmpeg editor (`/jobs/{id}/clips`) | Ported directly into worker (internal call) | B7 | PLANNED |
| Check uploads | n8n-nodes-base.code | Validates clip upload count | Worker internal validation | B7 | PLANNED |
| Clips uploaded? | n8n-nodes-base.if | Branch: did all clips upload? | Worker internal error handling | B7 | PLANNED |
| Render video | n8n-nodes-base.httpRequest | Calls `/jobs/{id}/render` with title & subtitle | Ported directly into worker FFmpeg pipeline | B7 | PLANNED |
| Rendered? | n8n-nodes-base.if | Verifies rendered binary returned | Worker internal error handling | B7 | PLANNED |
| Save to videos folder | n8n-nodes-base.googleDrive | Saves rendered mp4 to storage videos folder | `StorageProvider.upload` | B2/B7 | PLANNED |
| Saved? | n8n-nodes-base.if | Verifies file saved | Worker error handling | B7 | PLANNED |
| Record success | n8n-nodes-base.code | Records clip usage in database; status OK | `renders` and `clips` tables | B7 | PLANNED |
| Record failure | n8n-nodes-base.code | Logs render failure | `runs` and `run_logs` tables | B1/B7 | PLANNED |
| Record skip | n8n-nodes-base.code | Logs skipped product (insufficient clips) | `runs` and `run_logs` tables | B1/B7 | PLANNED |
| Build summary | n8n-nodes-base.code | Summarizes renders completed, stock, deficit | `worker.summary` | B7/B9 | PLANNED |
| Send summary | n8n-nodes-base.telegram | Sends render summary to Telegram | `bot.notifications` | B9 | PLANNED |
| Unpack Clip Counts | n8n-nodes-base.code | Prepares clip counts for catalog sync | `backend.services.products` | B3 | PLANNED |
| Update Product_Master Clips | n8n-nodes-base.googleSheets | Persists real clip count in catalog | `products.clip_count` column | B3 | PLANNED |

---

## 4. Workflow 4: Google Drive to Gemini to Buffer (TikTok) v4.0 (33 nodes)

| Node Name | Node Type | Behavior & Logic Summary | New Home (Module / Table / UI) | Batch | Status |
|---|---|---|---|---|---|
| Daily run (2 AM PHT) | n8n-nodes-base.scheduleTrigger | Triggers daily at 02:00 PHT | `backend.scheduler` / `schedules` table | B1 | PLANNED |
| Run now (manual) | n8n-nodes-base.manualTrigger | Manual execution trigger | "Run Now" in UI Schedules page & API | B1 | PLANNED |
| Settings | n8n-nodes-base.set | Buffer channel, Cloudinary presets, target per day=6, limits | `backend.config` / `settings` / `secrets` | B1 | PLANNED |
| List videos in Drive | n8n-nodes-base.googleDrive | Lists finished videos ready to post | `StorageProvider.list` / `renders` table | B2/B8 | PLANNED |
| Read Strategy_Quota | n8n-nodes-base.googleSheets | Reads active plan & weekly remaining | `plans` / `plan_slots` tables | B6 | PLANNED |
| Read Content_Log | n8n-nodes-base.googleSheets | Checks videos already posted today | `posts` table | B5/B8 | PLANNED |
| Read Product_Master | n8n-nodes-base.googleSheets | Resolves canonical product keys | `products` table | B3 | PLANNED |
| Pick videos | n8n-nodes-base.code | Selects up to daily cap (6); selects anti-repeat hook style | `backend.services.publisher` | B8 | PLANNED |
| Any videos? | n8n-nodes-base.if | Branch: videos available to post? | Publisher service logic | B8 | PLANNED |
| No videos left | n8n-nodes-base.telegram | Alerts Telegram if no stock available | `bot.notifications` | B8/B9 | PLANNED |
| Loop Over Items | n8n-nodes-base.splitInBatches | Iterates videos to publish | Publisher queue runner | B8 | PLANNED |
| Download video | n8n-nodes-base.googleDrive | Downloads video file from storage | `StorageProvider.download` | B2/B8 | PLANNED |
| Upload to Cloudinary | n8n-nodes-base.httpRequest | Uploads video to MediaHost (Cloudinary/Tunnel) | `MediaHost` provider interface | B8 | PLANNED |
| Write caption | @n8n/n8n-nodes-langchain.chainLlm | Writes SEO TikTok caption with chosen hook style | `backend.services.captions` | B8 | PLANNED |
| Google Gemini Chat Model | @n8n/n8n-nodes-langchain.lmChatGoogleGemini | Configures `gemini-3.5-flash-lite` | `ai_gateway` | B4/B8 | PLANNED |
| JSON Parser | @n8n/n8n-nodes-langchain.outputParserStructured | Enforces JSON schema for caption | Structured output in `ai_gateway` | B4/B8 | PLANNED |
| Final caption | n8n-nodes-base.code | Validates caption, adds fingerprint, fallback template if AI fails | `backend.services.captions` | B8 | PLANNED |
| Ready to post? | n8n-nodes-base.if | Checks video URL and caption exist | Publisher pre-flight check | B8 | PLANNED |
| Post to Buffer | n8n-nodes-base.httpRequest | GraphQL `createPost` mutation with `mode: addToQueue` | `backend.services.publisher.buffer_client` | B8 | PLANNED |
| Posted? | n8n-nodes-base.if | Checks Buffer response for `data.createPost.post.id` | Buffer client response parser | B8 | PLANNED |
| Log to Content_Log | n8n-nodes-base.googleSheets | Appends post record (ID, caption, hook, timestamp) | `posts` table | B8 | PLANNED |
| Delete posted video | n8n-nodes-base.googleDrive | Deletes posted video file from stock | `StorageProvider.delete` | B2/B8 | PLANNED |
| Record success | n8n-nodes-base.set | Records post success | `posts` table (status=posted) | B8 | PLANNED |
| Record failure | n8n-nodes-base.code | Captures failure reason | `posts` table / `run_logs` | B8 | PLANNED |
| Wait before next video | n8n-nodes-base.wait | 15 s delay between posts | Configurable delay in publisher worker | B8 | PLANNED |
| Build summary | n8n-nodes-base.code | Builds post summary and increments Buffer monthly quota | `backend.services.publisher.summary` | B8/B9 | PLANNED |
| Send summary | n8n-nodes-base.telegram | Sends publishing summary to Telegram | `bot.notifications` | B9 | PLANNED |
| Prepare Quota Progress | n8n-nodes-base.code | Computes remaining weekly quota after post | `backend.services.planner.progress` | B6/B8 | PLANNED |
| Update Strategy_Quota Progress | n8n-nodes-base.googleSheets | Updates quota progress in DB | `plan_slots` table | B6/B8 | PLANNED |
| Cleanup enabled? | n8n-nodes-base.if | Checks `cloudinary_cleanup_days` > 0 | `MediaHost.cleanup` | B8 | PLANNED |
| List Cloudinary videos | n8n-nodes-base.httpRequest | Lists uploaded assets | `MediaHost.list_old` | B8 | PLANNED |
| Pick old uploads | n8n-nodes-base.code | Filters assets older than cleanup threshold (14d) | `MediaHost.cleanup` | B8 | PLANNED |
| Delete old uploads | n8n-nodes-base.httpRequest | Deletes expired assets | `MediaHost.delete_batch` | B8 | PLANNED |
