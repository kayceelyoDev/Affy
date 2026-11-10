import os
import sys

manifest_path = r"\\192.168.1.7\TiktokCreator\legacy_private\old-editor.manifest.txt"
old_editor_dir = r"\\192.168.1.7\video-editor"

if not os.path.exists(manifest_path):
    print(f"[ERROR] Manifest file does not exist: {manifest_path}")
    sys.exit(1)

with open(manifest_path, "r", encoding="utf-8") as f:
    manifest_lines = f.readlines()

print(f"Checking {len(manifest_lines)} entries against live old-editor folder...")

mismatches = 0
for line in manifest_lines:
    line = line.strip()
    if not line or line.startswith("#"):
        continue
    parts = line.split("|")
    if len(parts) >= 3:
        rel_path = parts[0].strip()
        expected_size = int(parts[1].strip())
        expected_mtime = float(parts[2].strip())

        full_path = os.path.join(old_editor_dir, rel_path.replace("/", os.sep))
        if not os.path.exists(full_path):
            print(f"[FAIL] Missing file: {rel_path}")
            mismatches += 1
            continue
        stat = os.stat(full_path)
        if stat.st_size != expected_size:
            print(f"[FAIL] Size mismatch for {rel_path}: expected {expected_size}, got {stat.st_size}")
            mismatches += 1
        elif abs(stat.st_mtime - expected_mtime) > 2.0:
            print(f"[FAIL] Mtime mismatch for {rel_path}: expected {expected_mtime}, got {stat.st_mtime}")
            mismatches += 1

if mismatches == 0:
    print("Old editor folder check PASSED: 100% untouched and matches manifest exactly.")
else:
    print(f"Old editor folder check FAILED: {mismatches} mismatches found.")
    sys.exit(1)
