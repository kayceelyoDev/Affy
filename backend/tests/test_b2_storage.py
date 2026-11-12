import os
import tempfile
import pytest
import pytest_asyncio
from pathlib import Path
from httpx import AsyncClient, ASGITransport
from backend.app.services.storage.local import LocalStorageProvider
from backend.app.services.storage.cache import LRUCacheManager
from backend.tests.fake_drive import FakeDriveStorageProvider
from backend.app.services.storage.sync import StorageSyncService
from backend.app.main import app

@pytest.fixture
def tmp_storage_dir():
    with tempfile.TemporaryDirectory() as td:
        yield Path(td)

@pytest.fixture
def sample_file():
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as f:
        f.write(b"MOCK_VIDEO_DATA_FOR_AFFILIATE_TEST_CLIP")
        path = f.name
    yield path
    if os.path.exists(path):
        os.unlink(path)

# -------------------------------------------------------------
# CONTRACT TESTS (Run against both Local and Fake Drive)
# -------------------------------------------------------------
@pytest.mark.parametrize("provider_type", ["local", "drive_fake"])
@pytest.mark.asyncio
async def test_storage_provider_contract(provider_type, tmp_storage_dir, sample_file):
    if provider_type == "local":
        provider = LocalStorageProvider(root_dir=tmp_storage_dir)
    else:
        provider = FakeDriveStorageProvider()

    # 1. Upload
    uploaded = await provider.upload(sample_file, "clips/Gadgets/test_clip_01.mp4")
    assert uploaded.name == "test_clip_01.mp4"
    assert uploaded.size_bytes > 0

    # 2. Stat
    stat_info = await provider.stat("clips/Gadgets/test_clip_01.mp4")
    assert stat_info.name == "test_clip_01.mp4"
    assert stat_info.size_bytes == uploaded.size_bytes

    # 3. List
    files = await provider.list("clips/Gadgets")
    assert any(f.name == "test_clip_01.mp4" for f in files)

    # 4. Rename
    renamed = await provider.rename("clips/Gadgets/test_clip_01.mp4", "clips/Gadgets/test_clip_renamed.mp4")
    assert renamed.name == "test_clip_renamed.mp4"
    with pytest.raises(FileNotFoundError):
        await provider.stat("clips/Gadgets/test_clip_01.mp4")

    # 5. Move
    moved = await provider.move("clips/Gadgets/test_clip_renamed.mp4", "archive/2026-11-10")
    assert moved.name == "test_clip_renamed.mp4"

    # 6. Delete to trash
    deleted = await provider.delete("archive/2026-11-10/test_clip_renamed.mp4", to_trash=True)
    assert deleted is True

    # 7. Changes tracking
    changes, new_token = await provider.changes()
    assert len(changes) > 0
    assert new_token is not None

# -------------------------------------------------------------
# LRU CACHE & LOCKING TESTS
# -------------------------------------------------------------
def test_lru_cache_eviction_and_job_locks(tmp_storage_dir):
    # Max cache capacity: 300 bytes (small quota for deterministic eviction testing)
    cache = LRUCacheManager(cache_dir=tmp_storage_dir, max_bytes=300)

    # Put File 1 (100 bytes)
    cache.put("file1.mp4", b"A" * 100)
    assert cache.get_current_size() == 100

    # Put File 2 (100 bytes) and lock it for active rendering job!
    cache.put("file2.mp4", b"B" * 100)
    cache.lock_file("file2.mp4")
    assert cache.is_locked("file2.mp4") is True
    assert cache.get_current_size() == 200

    # Put File 3 (100 bytes)
    cache.put("file3.mp4", b"C" * 100)
    assert cache.get_current_size() == 300

    # Put File 4 (100 bytes) -> Total would be 400 bytes > 300 bytes quota!
    # Cache MUST evict oldest unlocked file (file1.mp4), but MUST NOT evict locked file (file2.mp4)!
    cache.put("file4.mp4", b"D" * 100)

    assert not (tmp_storage_dir / "file1.mp4").exists(), "Oldest unlocked file1.mp4 should have been evicted"
    assert (tmp_storage_dir / "file2.mp4").exists(), "Locked file2.mp4 MUST NOT be evicted"
    assert (tmp_storage_dir / "file3.mp4").exists()
    assert (tmp_storage_dir / "file4.mp4").exists()
    assert cache.get_current_size() <= 300

    # Now unlock file2.mp4 and add File 5 (150 bytes)
    cache.unlock_file("file2.mp4")
    cache.put("file5.mp4", b"E" * 150)
    # Now file2 is eligible for eviction
    assert not (tmp_storage_dir / "file2.mp4").exists(), "Unlocked file2.mp4 is now evictable"

# -------------------------------------------------------------
# STORAGE API & SYNC TESTS
# -------------------------------------------------------------
@pytest.mark.asyncio
async def test_storage_api_and_sync():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Login
        login_res = await ac.post("/api/auth/login", json={"username": "admin", "password": "initial_admin_password"})
        csrf_token = login_res.json()["csrf_token"]

        # Meters
        meters_res = await ac.get("/api/storage/meters")
        assert meters_res.status_code == 200
        data = meters_res.json()
        assert "local_total_bytes" in data
        assert "local_free_bytes" in data
        assert data["cache_max_bytes"] > 0

        # Files list
        files_res = await ac.get("/api/storage/files?path=clips")
        assert files_res.status_code == 200
        assert isinstance(files_res.json(), list)

        # Trigger manual sync
        sync_res = await ac.post("/api/storage/sync", headers={"X-CSRF-Token": csrf_token})
        assert sync_res.status_code == 200
        sync_data = sync_res.json()
        assert sync_data["ok"] is True
