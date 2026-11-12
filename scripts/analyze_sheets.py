#!/usr/bin/env python3
import csv
import re
from pathlib import Path

sheets_dir = Path("legacy_private/sheets")
for p in sorted(sheets_dir.glob("*.csv")):
    with open(p, "r", encoding="utf-8", errors="replace") as f:
        reader = list(csv.reader(f))
    if not reader:
        print(f"=== {p.name}: EMPTY ===")
        continue
    header = reader[0]
    rows = reader[1:]
    print(f"=== {p.name} ===")
    print(f"Rows: {len(rows)}, Columns: {len(header)}")
    print("Columns:", header)
    if "order_id" in header:
        idx = header.index("order_id")
        ids = [r[idx] for r in rows if len(r) > idx]
        invalid = [i for i in ids if not re.match(r"^\d{10,22}$", i.replace("'", ""))]
        print(f"Order IDs: total={len(ids)}, invalid_or_rounded={invalid}")
    # Date checking
    for col_idx, col_name in enumerate(header):
        low = col_name.lower()
        if any(w in low for w in ["date", "pht", "time", "week"]):
            vals = [r[col_idx] for r in rows if len(r) > col_idx and r[col_idx].strip()]
            date_formats = set()
            for v in vals:
                if re.match(r"^\d{4}-\d{2}-\d{2}$", v):
                    date_formats.add("YYYY-MM-DD")
                elif re.match(r"^\d{1,2}/\d{1,2}/\d{4}$", v):
                    date_formats.add("M/D/YYYY or D/M/YYYY")
                elif re.match(r"^\d{2}:\d{2}:\d{2}$", v):
                    date_formats.add("HH:MM:SS")
                else:
                    date_formats.add(f"other({v[:15]})")
            print(f"  Col '{col_name}': {len(vals)} non-empty. Formats: {date_formats}")
    print()
