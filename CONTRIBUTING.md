# Contributing to Affiliate Autopilot

Thank you for your interest in contributing to Affiliate Autopilot!

## Development Guidelines

1. **Python Standards:**
   - Python 3.12+
   - Format with `ruff` or `black`
   - Type hints with `mypy`
   - Async-first for FastAPI endpoints and DB queries

2. **Frontend Standards:**
   - React 18, TypeScript, Tailwind CSS
   - High information density, monochromatic B&W theme
   - Accessibility (WCAG AA) and mobile responsiveness

3. **Security:**
   - Never commit API keys, tokens, passwords, chat IDs, or folder IDs.
   - Run `gitleaks` pre-commit checks prior to staging commits.
   - All external API tokens must reside in the encrypted secrets vault.

4. **Testing:**
   - Unit tests alongside new features under `backend/tests/` and `frontend/src/__tests__/`.
