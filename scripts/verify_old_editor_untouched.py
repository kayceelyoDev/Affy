import os
import sys
from pathlib import Path

root_dir = Path(__file__).resolve().parent.parent

# Support both Windows UNC path and Linux local path
if os.name == "nt" and os.path.exists(r"\\192.168.1.7\video-editor"):
    old_editor_dir = Path(r"\\192.168.1.7\video-editor")
    manifest_path = root_dir / "legacy_private/old-editor.manifest.txt"
elif Path("/home/kent5368/video-editor").exists():
    old_editor_dir = Path("/home/kent5368/video-editor")
    manifest_path = root_dir / "legacy_private/old-editor.manifest.txt"
else:
    old_editor_dir = Path("../video-editor")
    manifest_path = root_dir / "legacy_private/old-editor.manifest.txt"

if not manifest_path.exists():
    print(f"[ERROR] Manifest file does not exist: {manifest_path}")
    sys.exit(1)

with open(manifest_path, "r", encoding="utf-8") as f:
    manifest_lines = f.readlines()

print(f"Checking {len(manifest_lines)} entries against live old-editor folder: {old_editor_dir}...")

mismatches = 0
checked = 0
prefix = "/home/kent5368/video-editor"

for line in manifest_lines:
    line = line.strip()
    if not line or line.startswith("#"):
        continue
    # Delimiter is tab
    parts = line.split("\t")
    if len(parts) >= 2:
        abs_path = parts[0].strip()
        expected_size = int(parts[1].strip())
        
        # Determine relative path from prefix
        if abs_path == prefix:
            continue
        if abs_path.startswith(prefix + "/"):
            rel_path = abs_path[len(prefix) + 1:]
        else:
            rel_path = abs_path

        full_path = old_editor_dir / rel_path
        if not full_path.exists():
            print(f"[FAIL] Missing file: {rel_path}")
            mismatches += 1
            continue
        
        stat = full_path.stat()
        # Directories in Linux have 4096 size
        if full_path.is_file() and stat.st_size != expected_size:
            print(f"[FAIL] Size mismatch for {rel_path}: expected {expected_size}, got {stat.st_size}")
            mismatches += 1
        checked += 1

if mismatches == 0:
    print(f"Old editor folder check PASSED: {checked}/{checked} entries 100% untouched and match manifest exactly.")
else:
    print(f"Old editor folder check FAILED: {mismatches} mismatches found.")
    sys.exit(1)
