# Google Sheets Schema & Migration Analysis

This document provides the full analysis of the 8 tabs from the owner's Google Sheet (`TikTok_Brain`), documenting columns, detected types, row counts, observed date formats, anomalies, and the target SQL schema mappings.

---

## 1. Tab Overview & Inventory

| Tab Name | Rows | Columns | Description | Primary Key / Unique Key | Target Database Table |
|---|---|---|---|---|---|
| `Product_Master` | 14 | 8 | Catalog of affiliate products, clip counts, aliases | `product_key` (TEXT) | `products`, `product_aliases` |
| `Content_Log` | 12 | 15 | History of rendered and published TikTok videos | `Buffer_Post_ID` or (`video_id`, `Caption`) | `posts`, `renders` |
| `Orders_Log` | 25 | 18 | Synced and extracted affiliate orders | `order_id` (TEXT, 10-22 digits) | `orders` |
| `Sales_Log` | 9 | 10 | Daily aggregated / settled commission records | `Source` (order_id or event reference) | `sales_daily` |
| `Product_Scorecard` | 11 | 18 | Weekly computed product performance scores | (`week_start`, `product_key`) | `scorecards` |
| `Strategy_Quota` | 0 | 15 | Weekly strategic posting quota and daily distribution | (`Week_Start_PHT`, `product_key`) | `plans`, `plan_slots` |
| `Unmatched_Products` | 0 | 8 | Pending order product names not mapped to catalog | `raw_product_name` | `product_aliases` (status=pending) |
| `Analytics / Dashboard` | 62 | 12 | Formula-driven reporting sheet (reference only) | N/A | Replaced by Web Analytics Dashboard |

---

## 2. Detailed Schema & Type Mapping

### A. `Product_Master` (14 rows)
- **Columns & Observed Data:**
  - `product_key` (TEXT, NOT NULL): Canonical product identifier (e.g. `LAPTOP COOLER - INPLAY`).
  - `display_name` (TEXT): Display title, identical to `product_key` in existing export.
  - `drive_folder_name` (TEXT): Name of folder in Google Drive (matches `product_key`).
  - `clip_count` (INTEGER, NULLABLE): Number of raw clips in folder (values 6-9; 6 products have NULL/blank).
  - `tiktok_name_aliases` (TEXT, NULLABLE): Comma-separated raw product name strings from TikTok Shop.
  - `default_commission_rate` (DECIMAL, NULLABLE): Default commission rate (NULL in sheet).
  - `active` (TEXT / BOOLEAN): Flag for whether product is active (empty in export, treated as TRUE).
  - `date_added` (DATE, ISO `YYYY-MM-DD`): Date added to catalog (e.g. `2026-11-02`).
- **Anomalies / Edge Cases:**
  - 6 rows have empty `clip_count`. Handled by defaulting to 0 or probing storage.
  - `tiktok_name_aliases` contains truncated product titles ending with `...`. The alias table must store both exact aliases and prefix matching.
- **Target Table:** `products` and `product_aliases`.

### B. `Content_Log` (12 rows)
- **Columns & Observed Data:**
  - `Date_PHT` (DATE, ISO `YYYY-MM-DD`): Post date in Asia/Manila.
  - `Time_PHT` (TIME, `HH:MM:SS`): Post time in Asia/Manila.
  - `Product_Name` (TEXT): Catalog product name.
  - `File_Name` (TEXT): Rendered video file name (e.g. `LAPTOP COOLER - INPLAY (261105010102).mp4`).
  - `Hook_Style` (TEXT): One of 6 hook styles.
  - `Buffer_Post_ID` (TEXT): 24-char hex Buffer post ID.
  - `Caption` (TEXT): Published TikTok caption with hashtags.
  - `Views` (INTEGER, NULLABLE): View count (currently 0 or blank, awaiting sync).
  - `product_key` (TEXT): Matches `Product_Name`.
  - `video_id` (TEXT, NULLABLE): TikTok video ID.
  - `tiktok_link` (TEXT, NULLABLE): TikTok public URL.
  - `likes`, `comments`, `shares` (INTEGER, NULLABLE): Social metrics.
  - `last_synced_date` (DATE, NULLABLE): Timestamp of last metrics sync.
- **Target Table:** `posts` (linked to `renders` and `products`).

### C. `Orders_Log` (25 rows)
- **Columns & Observed Data:**
  - `order_id` (TEXT, NOT NULL, 18 digits): All 25 rows have valid 18-digit string IDs.
  - `first_seen_date` (DATE, ISO `YYYY-MM-DD`): Initial ingest date.
  - `last_updated_date` (DATE, ISO `YYYY-MM-DD`): Last status change date.
  - `status_stage` (TEXT): Canonical stage (`SETTLED`, `CANCELLED`, `UNPAID`, `PAID_IN_TRANSIT`, `DELIVERED_PENDING`).
  - `settle_date_est` (DATE, NULLABLE): Estimated or actual release date.
  - `settle_date_changes` (INTEGER): Number of times the estimated date changed (all 0 in export).
  - `product_key` (TEXT): Mapped catalog product key or `UNMATCHED`.
  - `product_name_raw` (TEXT): Full raw title from order card or spreadsheet.
  - `price` (DECIMAL): Unit price in PHP.
  - `quantity` (INTEGER): Units ordered (all 1 in export).
  - `gmv` (DECIMAL): Gross merchandise value in PHP.
  - `is_shop_ads` (BOOLEAN): Whether order came from Shop Ads.
  - `video_caption_raw` (TEXT, NULLABLE): Caption snippet on order card.
  - `matched_video_id` (TEXT, NULLABLE): TikTok video ID if matched.
  - `commission_rate` (DECIMAL): Decimal rate (0.03, 0.05, 0.07, 0.08).
  - `est_commission` (DECIMAL): Expected payout.
  - `actual_commission` (DECIMAL, NULLABLE): Settled payout (NULL for pending, 0 for cancelled).
  - `notes` (TEXT, NULLABLE): Tag notes (`WEEKLY_COMMISSION_SETTLED`, etc.).
- **Anomalies / Edge Cases:**
  - `actual_commission` is empty for UNPAID and PENDING orders. Must be mapped to `NULL`.
  - `order_id` must NEVER be parsed as a float to prevent 18-digit IEEE 754 precision loss.
- **Target Table:** `orders`.

### D. `Sales_Log` (9 rows)
- **Columns & Observed Data:**
  - `Date_PHT` (DATE, ISO `YYYY-MM-DD`): Order / sales date.
  - `Product_Name` (TEXT): Product title with sales keyword suffix (e.g. `LAPTOP COOLER - INPLAY (Cooling)`).
  - `Units_Sold` (INTEGER): Attributed units (1).
  - `Attributed_GMV_PHP` (DECIMAL): GMV attributed.
  - `Logged_At_PHT` (DATE, ISO `YYYY-MM-DD`): Ingest timestamp.
  - `Source` (TEXT): References `order_id`.
  - `product_key` (TEXT): Canonical product key.
  - `est_commission_php`, `settled_commission_php` (DECIMAL): Payout amounts.
  - `orders_count` (INTEGER): Number of orders (1).
- **Target Table:** `sales_daily`.

### E. `Product_Scorecard` (11 rows)
- **Columns & Observed Data:**
  - `week_start` (DATE, ISO `YYYY-MM-DD`): Planning week start (`2026-11-04`).
  - `product_key` (TEXT): Canonical key.
  - `videos_posted`, `total_views`, `avg_views_per_video`: Content metrics.
  - `orders_total`, `orders_delivered_or_settled`, `orders_cancelled`: Pipeline counts.
  - `gmv_total`, `est_commission_total`, `settled_commission_total`, `commission_per_video`: Financial metrics.
  - `orders_per_1000_views`, `cancel_rate`: Efficiency ratios.
  - `trend_vs_last_week` (TEXT): Trend label (`NEW`, `UP`, `DOWN`, `STABLE`).
  - `score` (DECIMAL): Scorecard v1 raw score.
  - `tier` (TEXT): `SCALE`, `STEADY`, `TEST`, `COOLDOWN`.
  - `confidence_flag` (TEXT): `OK` or `LOW_CONFIDENCE`.
- **Target Table:** `scorecards`.

---

## 3. Heuristics & Normalization Rules

1. **Date Ambiguity Heuristic:**
   - ISO `YYYY-MM-DD` format is universally used in the current exports.
   - For user-uploaded TikTok spreadsheets (which occasionally contain `M/D/YYYY` or `D/M/YYYY`):
     - If part 1 > 12 -> part 1 is day, part 2 is month.
     - If part 2 > 12 -> part 2 is day, part 1 is month.
     - If ambiguous (both <= 12), use user setting display timezone (Asia/Manila defaults to standard Philippine format `YYYY-MM-DD` or `MM/DD/YYYY`).
2. **Order ID Protection:**
   - Always stored as `TEXT`.
   - Strip leading apostrophe (`'`) if pasted from spreadsheet formulas.
   - Assert regex `^\d{10,22}$`.
3. **Extra Column Handling:**
   - Any unknown columns during import are packed into `orders.extra` JSON field without loss.
