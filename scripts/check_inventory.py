#!/usr/bin/env python3
"""Check that all 148 nodes from the four legacy n8n workflows are covered in inventory.md."""

import json
import os
import re
import sys
from pathlib import Path

WORKFLOW_FILES = {
    "Workflow 1 - Smart Nightly Orders": "legacy_private/workflows/workflow_1_smart_nightly_orders.json",
    "Workflow 2 - Sunday Strategy Engine": "legacy_private/workflows/workflow_2_sunday_strategy_engine.json",
    "Workflow 3 - Auto-edit product videos": "legacy_private/workflows/workflow_3_auto_edit_product_videos.json",
    "Workflow 4 - TikTok poster": "legacy_private/workflows/workflow_4_google_drive_to_gemini_to_buffer_tiktok_poster.json",
}

EXPECTED_COUNTS = {
    "Workflow 1 - Smart Nightly Orders": 60,
    "Workflow 2 - Sunday Strategy Engine": 23,
    "Workflow 3 - Auto-edit product videos": 32,
    "Workflow 4 - TikTok poster": 33,
}

EXPECTED_TOTAL = 148


def check():
    repo_root = Path(__file__).resolve().parent.parent
    total_nodes = 0
    all_node_names = []

    print("Checking workflow files...")
    for label, rel_path in WORKFLOW_FILES.items():
        file_path = repo_root / rel_path
        if not file_path.exists():
            print(f"ERROR: {file_path} not found")
            sys.exit(1)

        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        nodes = data.get("nodes", [])
        count = len(nodes)
        total_nodes += count
        expected = EXPECTED_COUNTS[label]
        status = "OK" if count == expected else f"MISMATCH (expected {expected})"
        print(f"  {label}: {count} nodes [{status}]")

        for n in nodes:
            name = n.get("name", "Unnamed")
            all_node_names.append((label, name, n.get("type", "unknown")))

    print(f"\nTotal workflow nodes: {total_nodes} (expected {EXPECTED_TOTAL})")
    if total_nodes != EXPECTED_TOTAL:
        print(f"ERROR: Expected {EXPECTED_TOTAL} nodes, found {total_nodes}")
        sys.exit(1)

    # Check inventory.md coverage
    inventory_path = repo_root / "docs" / "migration" / "inventory.md"
    if not inventory_path.exists():
        print(f"ERROR: {inventory_path} not found")
        sys.exit(1)

    with open(inventory_path, "r", encoding="utf-8") as f:
        inv_text = f.read()

    missing = []
    for label, name, ntype in all_node_names:
        # Check if the node name is referenced in the inventory markdown
        escaped_name = re.escape(name)
        if not re.search(escaped_name, inv_text):
            missing.append(f"{label} -> {name}")

    if missing:
        print(f"\nWARNING: {len(missing)} nodes missing from inventory.md:")
        for m in missing[:10]:
            print(f"  - {m}")
        if len(missing) > 10:
            print(f"  ... and {len(missing) - 10} more")
        sys.exit(1)

    print(f"\nInventory check PASSED: All {total_nodes} nodes accounted for in docs/migration/inventory.md")


if __name__ == "__main__":
    check()
