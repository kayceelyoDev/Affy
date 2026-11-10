import os
import pytest
from pathlib import Path
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select

from backend.app.main import app
from backend.app.core.database import AsyncSessionLocal
from backend.app.models.models import Product, Order, Plan, Scorecard
from backend.app.services.demo import DemoSeeder


@pytest.mark.asyncio
async def test_demo_mode_status_and_seed_api():
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"X-CSRF-Token": "csrf_test_token"},
        cookies={"csrf_token": "csrf_test_token"}
    ) as ac:
        # Check demo status endpoint
        res = await ac.get("/api/demo/status")
        assert res.status_code == 200
        data = res.json()
        assert "demo_mode" in data

        # Trigger demo seed endpoint
        seed_res = await ac.post("/api/demo/seed")
        assert seed_res.status_code == 200
        seed_data = seed_res.json()
        assert seed_data["status"] == "success"
        assert "stats" in seed_data
        assert seed_data["stats"]["products"] >= 0


@pytest.mark.asyncio
async def test_demo_seeder_dataset_completeness():
    async with AsyncSessionLocal() as session:
        stats = await DemoSeeder.seed_demo_data(session)
        assert isinstance(stats, dict)

        # Verify products exist
        prod_res = await session.execute(select(Product))
        products = prod_res.scalars().all()
        assert len(products) >= 6

        # Verify orders exist
        ord_res = await session.execute(select(Order))
        orders = ord_res.scalars().all()
        assert len(orders) >= 20

        # Verify scorecards exist
        sc_res = await session.execute(select(Scorecard))
        scorecards = sc_res.scalars().all()
        assert len(scorecards) >= 6

        # Verify daily plan exists
        plan_res = await session.execute(select(Plan))
        plans = plan_res.scalars().all()
        assert len(plans) >= 1


def test_open_source_and_community_governance_files():
    root = Path(__file__).resolve().parent.parent.parent

    required_files = [
        root / "LICENSE",
        root / "README.md",
        root / "CONTRIBUTING.md",
        root / "CHANGELOG.md",
        root / "SECURITY.md",
        root / "docs/SECURITY_AUDIT.md",
        root / "docs/THIRD_PARTY_LICENSES.md",
        root / ".github/workflows/ci.yml",
        root / ".github/dependabot.yml",
    ]

    for rf in required_files:
        assert rf.exists(), f"Required open-source file missing: {rf}"
        content = rf.read_text(encoding="utf-8")
        assert len(content) > 20, f"File appears empty: {rf}"


def test_old_editor_untouched_manifest_check():
    root = Path(__file__).resolve().parent.parent.parent
    manifest = root / "legacy_private/old-editor.manifest.txt"
    assert manifest.exists(), "Old editor manifest missing from legacy_private"
    content = manifest.read_text(encoding="utf-8")
    assert "video-editor" in content
    assert len(content.splitlines()) >= 50
