# Blockers and Mitigations Log

This document records any blockers encountered during build batches, their cause, mitigation strategy, and resolution status.

---

## Active Blockers

*None currently active.*

---

## Resolved / Mitigated Items

### BLK-001: Git Safe Directory on Shared Samba Mount
- **Issue:** `fatal: not in a git directory` when running git commands across Windows UNC and Ubuntu server paths.
- **Root Cause:** Git security check flagged directory ownership mismatch across CIFS/Samba mount.
- **Resolution:** Ran `git config --global --add safe.directory '*'` on both Windows host and Ubuntu server environment.

### BLK-002: PowerShell Inline Python Argument Parsing
- **Issue:** Inline `python -c "..."` commands containing single/double quotes failed in PowerShell execution.
- **Root Cause:** PowerShell parameter interpolation strips or breaks inner quotes.
- **Resolution:** Adopted standalone Python scripts (e.g. `scripts/extract_prompt.py`, `scripts/analyze_sheets.py`) instead of inline expressions.
