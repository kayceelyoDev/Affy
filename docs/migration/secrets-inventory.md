# Secrets Inventory

This inventory documents all secret, credential, token, and ID variable names required by the legacy n8n workflows and the legacy video editor, mapped to their target configuration in Affiliate Autopilot.

> [!IMPORTANT]
> In accordance with Section 0.6 of the specification, **no actual secret values, tokens, chat IDs, passwords, sheet IDs, or folder IDs are recorded in this repository**. All configuration entries refer strictly to variable names and environment keys. Real values reside exclusively in the owner's encrypted vault or uncommitted local `.env.seed`.

---

## 1. Third-Party Service Credentials

| Variable Name | Service | Purpose | Legacy Node / Source | New App Handling |
|---|---|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Telegram Bot API | Bot authentication for alerts, approvals, and commands | Workflow 1 & 4 Telegram nodes | Encrypted in `secrets_vault`, managed via Settings UI |
| `TELEGRAM_CHAT_ID` | Telegram | Destination chat/channel ID for automated alerts | Workflow 1 & 4 Telegram nodes | Setting in DB (`settings` table) |
| `BUFFER_ACCESS_TOKEN` | Buffer API | Publishing & scheduling GraphQL mutations (`createPost`) | Workflow 4 node `Post to Buffer` | Encrypted in `secrets_vault`, tested via `/api/settings/test/buffer` |
| `BUFFER_CHANNEL_ID` | Buffer | TikTok channel profile ID | Workflow 4 GraphQL body | Setting in DB (`settings` table) |
| `GEMINI_API_KEY` | Google Gemini | Vision extraction (orders/sales) & Caption generation | Workflows 1 & 4 Gemini nodes | Encrypted in `secrets_vault`, rotatable/testable |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary | CDN media host for public video URLs required by Buffer | Workflow 4 node `Upload to Cloudinary` | Setting in DB |
| `CLOUDINARY_API_KEY` | Cloudinary | Cloudinary REST API upload authentication | Workflow 4 upload node | Encrypted in `secrets_vault` |
| `CLOUDINARY_API_SECRET` | Cloudinary | Cloudinary signing key (if using signed uploads) | Workflow 4 upload node | Encrypted in `secrets_vault` |
| `CLOUDINARY_UPLOAD_PRESET`| Cloudinary | Unsigned/signed upload preset | Workflow 4 upload node | Setting in DB |
| `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON` | Google Drive API | Service account key JSON for raw clip & render sync | Workflows 3 & 4 Google Drive nodes | Encrypted in `secrets_vault`, uploaded via Settings UI |
| `GOOGLE_DRIVE_FOLDER_ID_ROOT` | Google Drive | Parent folder ID for TikTok Creator assets | Workflows 3 & 4 | Setting in DB |
| `GOOGLE_DRIVE_FOLDER_ID_RAW` | Google Drive | Raw product clip uploads folder | Workflow 3 | Setting in DB |
| `GOOGLE_DRIVE_FOLDER_ID_RENDERS` | Google Drive | Completed render exports folder | Workflow 4 | Setting in DB |
| `GOOGLE_SHEET_ID_TIKTOK_BRAIN` | Google Sheets | Legacy sheet ID (used during B10 migration only) | Workflows 1, 2, 3, 4 | Migration CLI parameter |
| `TIKTOK_DISPLAY_API_CLIENT_KEY` | TikTok Display API | Optional direct video metrics fetch | New feature (R07) | Encrypted in `secrets_vault` |
| `TIKTOK_DISPLAY_API_CLIENT_SECRET` | TikTok Display API | Optional direct video metrics fetch | New feature (R07) | Encrypted in `secrets_vault` |

---

## 2. Internal Application & Server Security

| Variable Name | Purpose | Scope / Storage |
|---|---|---|
| `MASTER_ENCRYPTION_KEY` | 256-bit AES-GCM key used to encrypt all tokens in `secrets_vault` | Generated on first-run, stored in `data/.vault.key` (0600) or Docker secret |
| `SESSION_SECRET_KEY` | HMAC signing key for Argon2 admin session cookies & CSRF tokens | Stored in `data/.session.key` |
| `ADMIN_PASSWORD_HASH` | Argon2id password hash for local web UI admin access | Stored in `users` table |
| `VIDEO_EDITOR_TOKEN` | Legacy `X-Token` for inter-service communication (deprecated by native Python worker) | `data/.editor.key` |

---

## 3. Seed & Migration Workflow

1. During first-run installation (Batch 1), the owner provides an ephemeral `.env.seed` file containing initial variable assignments.
2. `scripts/import_from_n8n.py` reads:
   - Plain setting identifiers from workflow JSON exports (chat ID, channel ID, folder IDs, preset names).
   - Secret keys from `.env.seed`.
3. Secrets are immediately encrypted into the SQLite `secrets_vault` table using AES-256-GCM.
4. `.env.seed` is safely erased or unlinked.
5. In the Web UI, all secrets are displayed masked (e.g. `sk-****...1a2b`) and can be re-keyed or tested at any time.
