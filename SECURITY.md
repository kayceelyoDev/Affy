# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability within Affiliate Autopilot, please do NOT create a public issue. Send an email to the project maintainers with:

1. Description of the vulnerability and attack vector.
2. Reproduction steps or proof of concept.
3. Affected components (backend, frontend, bot, worker).

We will acknowledge receipt within 48 hours and work with you on a coordinated disclosure and patch release.

## Security Architecture Principles

- **Zero Hardcoded Secrets:** No tokens, API keys, webhook URLs, or passwords exist in repository code, git history, or Docker images.
- **AES-256-GCM Vault:** All external credentials (Buffer, Gemini, Telegram, Cloudinary, Drive) are encrypted at rest with authenticated AES-256-GCM.
- **Argon2id Authentication:** Admin session credentials hashed using memory-hard Argon2id.
- **CSRF & Rate Limiting:** All state-changing mutation endpoints enforce double-submit CSRF cookies and per-IP login rate limiting.
- **Input Validation & Sandboxing:** File uploads validated by magic bytes and SHA-256 checksums; media downloads protected against Server-Side Request Forgery (SSRF) and path traversal.
