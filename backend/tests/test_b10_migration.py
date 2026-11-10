import os
import pytest
import csv
from pathlib import Path
from datetime import datetime, timezone
from sqlalchemy import select

from backend.app.core.database import AsyncSessionLocal
from backend.app.models.models import Product, Order, Post, SalesDaily, Scorecard, Alias
from scripts.import_sheets_csv import (
    SheetImporter,
    clean_order_id,
    normalize_date_str,
    parse_safe_float,
)
from scripts.shadow_mode_compare import run_shadow_simulation


def test_order_id_string_preservation_and_uncertainty_detection():
    # Valid 18-digit order ID
    clean_id, uncertain = clean_order_id("585351858153883034")
    assert clean_id == "585351858153883034"
    assert uncertain is False

    # Leading apostrophe from spreadsheet formula
    clean_id2, uncertain2 = clean_order_id("'585315787298407843")
    assert clean_id2 == "585315787298407843"
    assert uncertain2 is False

    # Scientific notation float loss
    clean_id3, uncertain3 = clean_order_id("5.85352E+17")
    assert uncertain3 is True

    # Truncated zeros due to IEEE 754 precision loss
    clean_id4, uncertain4 = clean_order_id("585351858000000000")
    assert uncertain4 is True


def test_date_normalization_and_ambiguity_heuristic():
    # ISO Standard
    d1, ambig1 = normalize_date_str("2026-11-04")
    assert d1 == "2026-11-04"
    assert ambig1 is False

    # Unambiguous DD/MM/YYYY (first part > 12)
    d2, ambig2 = normalize_date_str("25/08/2026")
    assert d2 == "2026-08-25"
    assert ambig2 is False

    # Unambiguous MM/DD/YYYY (second part > 12)
    d3, ambig3 = normalize_date_str("08/25/2026")
    assert d3 == "2026-08-25"
    assert ambig3 is False

    # Ambiguous MM/DD/YYYY (both <= 12) - should normalize to standard MM/DD and flag ambiguity
    d4, ambig4 = normalize_date_str("04/05/2026")
    assert d4 == "2026-04-05"
    assert ambig4 is True


@pytest.mark.asyncio
async def test_sheet_importer_idempotency_and_zero_data_loss(tmp_path):
    # Setup synthetic CSV sheets
    sheets_dir = tmp_path / "sheets"
    sheets_dir.mkdir(parents=True, exist_ok=True)
    report_file = tmp_path / "report.md"

    # 1. Product Master
    pm_file = sheets_dir / "Product_Master.csv"
    with open(pm_file, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["product_key", "display_name", "drive_folder_name", "clip_count", "tiktok_name_aliases", "default_commission_rate", "active", "date_added"])
        writer.writerow(["SYNTHETIC TEST PRODUCT", "SYNTHETIC TEST PRODUCT", "SYNTHETIC TEST PRODUCT", "6", "alias 1, alias 2", "0.08", "TRUE", "2026-11-01"])

    # 2. Content Log
    cl_file = sheets_dir / "Content_Log.csv"
    with open(cl_file, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["Date_PHT", "Time_PHT", "Product_Name", "File_Name", "Hook_Style", "Buffer_Post_ID", "Caption", "Views", "product_key", "video_id", "tiktok_link", "likes", "comments", "shares", "last_synced_date"])
        writer.writerow(["2026-11-05", "09:00:00", "SYNTHETIC TEST PRODUCT", "test.mp4", "Classic Hook", "buf_test_12345", "Test caption #fyp", "", "SYNTHETIC TEST PRODUCT", "", "", "", "", "", ""])

    # 3. Orders Log
    ol_file = sheets_dir / "Orders_Log.csv"
    with open(ol_file, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["order_id", "first_seen_date", "last_updated_date", "status_stage", "settle_date_est", "settle_date_changes", "product_key", "product_name_raw", "price", "quantity", "gmv", "is_shop_ads", "video_caption_raw", "matched_video_id", "commission_rate", "est_commission", "actual_commission", "notes", "unknown_extra_col"])
        writer.writerow(["585999888777666555", "2026-11-02", "2026-11-04", "SETTLED", "2026-11-06", "0", "SYNTHETIC TEST PRODUCT", "Synthetic Raw Title", "100.0", "1", "100.0", "True", "", "", "0.08", "8.0", "8.0", "TAG_OK", "EXTRA_VALUE_PRESERVED"])

    # Pass 1: Initial import
    importer = SheetImporter(sheets_dir)
    stats1 = await importer.import_all()
    importer.generate_report(report_file)

    assert stats1["Product_Master"]["read"] == 1
    assert stats1["Product_Master"]["imported"] == 1
    assert stats1["Content_Log"]["imported"] == 1
    assert stats1["Orders_Log"]["imported"] == 1
    assert report_file.exists()

    # Verify order extra field preservation
    async with AsyncSessionLocal() as session:
        ord_res = await session.execute(select(Order).where(Order.order_id == "585999888777666555"))
        ord_obj = ord_res.scalars().first()
        assert ord_obj is not None
        assert "EXTRA_VALUE_PRESERVED" in ord_obj.extra_json

    # Pass 2: Second run (IDEMPOTENCY VERIFICATION)
    importer2 = SheetImporter(sheets_dir)
    stats2 = await importer2.import_all()

    # Zero new rows should be imported on the second run!
    assert stats2["Product_Master"]["imported"] == 0
    assert stats2["Product_Master"]["merged"] == 1
    assert stats2["Content_Log"]["imported"] == 0
    assert stats2["Content_Log"]["merged"] == 1
    assert stats2["Orders_Log"]["imported"] == 0
    assert stats2["Orders_Log"]["merged"] == 1


@pytest.mark.asyncio
async def test_shadow_mode_simulation_and_dry_run_safety(tmp_path):
    report_path = tmp_path / "shadow_mode_test_report.md"
    results = await run_shadow_simulation(days=2, output_path=report_path)

    assert len(results) == 2
    for day in results:
        assert day["autopilot_slots_count"] == 6
        assert len(day["slots"]) == 6

    assert report_path.exists()
    content = report_path.read_text(encoding="utf-8")
    assert "dry_run=True" in content
    assert "READY FOR CUTOVER" in content


def test_cutover_and_migration_artifacts_exist():
    root = Path(__file__).resolve().parent.parent.parent
    cutover_md = root / "docs/migration/cutover.md"
    reconcil_md = root / "docs/migration/reconciliation_report.md"
    shadow_md = root / "docs/migration/shadow_mode_report.md"

    assert cutover_md.exists(), "docs/migration/cutover.md missing"
    assert reconcil_md.exists(), "docs/migration/reconciliation_report.md missing"
    assert shadow_md.exists(), "docs/migration/shadow_mode_report.md missing"

    cutover_text = cutover_md.read_text(encoding="utf-8")
    assert "Workflow 3" in cutover_text
    assert "Workflow 4" in cutover_text
    assert "Workflow 2" in cutover_text
    assert "Workflow 1" in cutover_text
    assert "Rollback Plan" in cutover_text
