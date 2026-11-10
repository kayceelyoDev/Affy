import os
import tempfile
import pytest
from pathlib import Path
from httpx import AsyncClient, ASGITransport
from backend.app.core.database import AsyncSessionLocal
from backend.app.services.catalog.service import catalog_service, probe_video_file, normalize_title, compute_similarity
from backend.app.services.storage.local import LocalStorageProvider
from backend.app.models.models import Product, Clip, Alias
from backend.app.main import app

@pytest.fixture
def temp_catalog_root():
    with tempfile.TemporaryDirectory() as td:
        root = Path(td)
        # Create folder structure
        prod_dir = root / "clips" / "Electronics" / "Portable_Neck_Fan"
        prod_dir.mkdir(parents=True, exist_ok=True)
        # Write dummy clip
        (prod_dir / "clip_01.mp4").write_bytes(b"TEST_VIDEO_BYTES_FOR_PROBE")
        yield root

@pytest.mark.asyncio
async def test_disk_scan_auto_registers_products_and_clips(temp_catalog_root):
    storage = LocalStorageProvider(root_dir=temp_catalog_root)

    async with AsyncSessionLocal() as session:
        registered = await catalog_service.scan_clips_directory(session, storage)
        assert registered == 1

        # Verify product created
        prod_stmt = select_product = await session.execute(
            Product.__table__.select().where(Product.folder_path == "clips/Electronics/Portable_Neck_Fan")
        )
        prod = prod_stmt.fetchone()
        assert prod is not None
        assert prod.name == "Portable Neck Fan"
        assert prod.category == "Electronics"

        # Verify clip created
        clip_stmt = await session.execute(Clip.__table__.select().where(Clip.product_id == prod.id))
        clip = clip_stmt.fetchone()
        assert clip is not None
        assert clip.filename == "clip_01.mp4"
        assert clip.status == "usable"

@pytest.mark.asyncio
async def test_product_rename_renames_disk_folder(temp_catalog_root):
    storage = LocalStorageProvider(root_dir=temp_catalog_root)

    async with AsyncSessionLocal() as session:
        await catalog_service.scan_clips_directory(session, storage)
        prod_stmt = await session.execute(
            Product.__table__.select().where(Product.folder_path == "clips/Electronics/Portable_Neck_Fan")
        )
        prod = prod_stmt.fetchone()

        # Rename product in API/Service
        new_name = "Super Cooling Neck Fan"
        updated_prod = await catalog_service.rename_product(session, prod.id, new_name, storage)

        assert updated_prod.name == new_name
        assert updated_prod.folder_path == "clips/Electronics/Super_Cooling_Neck_Fan"

        # Verify physical disk directory was renamed
        assert not (temp_catalog_root / "clips" / "Electronics" / "Portable_Neck_Fan").exists()
        assert (temp_catalog_root / "clips" / "Electronics" / "Super_Cooling_Neck_Fan").exists()
        assert (temp_catalog_root / "clips" / "Electronics" / "Super_Cooling_Neck_Fan" / "clip_01.mp4").exists()

@pytest.mark.asyncio
async def test_delete_guard_prevents_deletion_with_active_clips(temp_catalog_root):
    storage = LocalStorageProvider(root_dir=temp_catalog_root)

    async with AsyncSessionLocal() as session:
        await catalog_service.scan_clips_directory(session, storage)
        prod_stmt = await session.execute(
            Product.__table__.select().where(Product.name == "Portable Neck Fan")
        )
        prod = prod_stmt.fetchone()

        # Attempt to delete product with clips: MUST FAIL WITH DELETE GUARD
        with pytest.raises(ValueError, match="Delete guard triggered"):
            await catalog_service.delete_product(session, prod.id)

        # Remove clip from DB
        clip = (await session.execute(Clip.__table__.select().where(Clip.product_id == prod.id))).fetchone()
        await session.execute(Clip.__table__.delete().where(Clip.id == clip.id))
        await session.commit()

        # Now deletion succeeds
        deleted = await catalog_service.delete_product(session, prod.id)
        assert deleted is True

@pytest.mark.asyncio
async def test_alias_auto_link_and_review_queue():
    async with AsyncSessionLocal() as session:
        # Create reference product
        p = Product(name="Pro Wireless Magnetic Powerbank", category="Electronics", folder_path="clips/Electronics/Powerbank")
        session.add(p)
        await session.commit()

        # 1. Tricky High-Confidence match (with hashtags, emojis, extra words): Should AUTO-LINK
        tricky_high = "Pro Wireless Magnetic Powerbank 10000mAh Fast Charging 🔥🔥 #tiktokmademebuyit"
        alias1 = await catalog_service.resolve_alias(session, tricky_high, auto_link_threshold=0.85)
        assert alias1.status == "linked"
        assert alias1.product_id == p.id
        assert alias1.confidence >= 0.85

        # 2. Ambiguous / Low-Confidence match: Should go to REVIEW QUEUE
        low_conf = "Universal USB-C Wall Charger Adapter"
        alias2 = await catalog_service.resolve_alias(session, low_conf, auto_link_threshold=0.85)
        assert alias2.status == "pending_review"
        assert alias2.product_id is None
        assert alias2.confidence < 0.85

@pytest.mark.asyncio
async def test_catalog_api_flow():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Login
        login_res = await ac.post("/api/auth/login", json={"username": "admin", "password": "initial_admin_password"})
        csrf_token = login_res.json()["csrf_token"]

        # Create new product
        create_res = await ac.post(
            "/api/catalog/products",
            json={"name": "RGB Mechanical Keyboard", "category": "Gaming", "commission_rate": 0.20},
            headers={"X-CSRF-Token": csrf_token}
        )
        assert create_res.status_code == 200
        prod_data = create_res.json()
        prod_id = prod_data["id"]

        # List products
        list_res = await ac.get("/api/catalog/products")
        assert list_res.status_code == 200
        prods = list_res.json()
        assert any(p["name"] == "RGB Mechanical Keyboard" for p in prods)

        # Get product details
        detail_res = await ac.get(f"/api/catalog/products/{prod_id}")
        assert detail_res.status_code == 200
        assert detail_res.json()["category"] == "Gaming"

        # Delete empty product succeeds
        del_res = await ac.delete(f"/api/catalog/products/{prod_id}", headers={"X-CSRF-Token": csrf_token})
        assert del_res.status_code == 200
