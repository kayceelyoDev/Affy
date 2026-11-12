import os
import pytest
import pytest_asyncio
import tempfile
from pathlib import Path
from httpx import AsyncClient, ASGITransport
from backend.app.core.database import Base, engine, AsyncSessionLocal
from backend.app.core.config import settings
from backend.app.services.vault import SecretsVaultService
from backend.app.core.security import hash_password, verify_password, create_session_token, verify_session_token
from backend.app.models.models import User, Setting, SecretVault, Schedule
from backend.app.services.scheduler import app_scheduler
from backend.app.main import app

@pytest.fixture
def tmp_key_file():
    with tempfile.NamedTemporaryFile(delete=False) as f:
        path = Path(f.name)
    yield path
    if path.exists():
        path.unlink()

@pytest.mark.asyncio
async def test_vault_encryption_roundtrip(tmp_key_file):
    vault = SecretsVaultService(key_path=tmp_key_file)
    plaintext = "sk-live-super-secret-buffer-token-12345"
    
    # Encrypt
    ct, nonce, tag = vault.encrypt(plaintext)
    assert ct != plaintext
    assert len(nonce) > 0
    assert len(tag) > 0

    # Decrypt
    decrypted = vault.decrypt(ct, nonce, tag)
    assert decrypted == plaintext

    # Masking
    masked = vault.mask_secret(plaintext)
    assert "super-secret" not in masked
    assert masked.endswith("2345")
    assert "••••" in masked

@pytest.mark.asyncio
async def test_password_hashing_and_session():
    pwd = "MyStrongSecurePassword!2026"
    pwd_hash = hash_password(pwd)
    
    assert pwd_hash != pwd
    assert verify_password(pwd_hash, pwd) is True
    assert verify_password(pwd_hash, "WrongPassword") is False

    # Session token
    token = create_session_token("admin")
    assert verify_session_token(token) == "admin"
    assert verify_session_token("invalid:token") is None

@pytest.mark.asyncio
async def test_api_health_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["ok"] is True
        assert "Affiliate Autopilot" in data["name"]

@pytest.mark.asyncio
async def test_login_and_masked_secrets_api():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # First-time login creates admin
        login_res = await ac.post("/api/auth/login", json={"username": "admin", "password": "initial_admin_password"})
        assert login_res.status_code == 200
        csrf_token = login_res.json()["csrf_token"]
        assert csrf_token is not None

        # Authenticated call to /api/auth/me
        me_res = await ac.get("/api/auth/me")
        assert me_res.status_code == 200
        assert me_res.json()["username"] == "admin"
        assert me_res.json()["authenticated"] is True

        # Store a secret via API
        secret_key = "BUFFER_ACCESS_TOKEN"
        raw_secret_val = "buffer_secret_token_abcdef123456"
        update_res = await ac.put(
            f"/api/settings/{secret_key}",
            json={"value": raw_secret_val, "is_secret": True},
            headers={"X-CSRF-Token": csrf_token}
        )
        assert update_res.status_code == 200
        assert update_res.json()["masked"].endswith("3456")

        # List settings and verify raw secret is NEVER returned
        settings_res = await ac.get("/api/settings")
        assert settings_res.status_code == 200
        all_settings = settings_res.json()
        buffer_setting = next((s for s in all_settings if s["key"] == secret_key), None)
        assert buffer_setting is not None
        assert buffer_setting["is_secret"] is True
        assert buffer_setting["value"] != raw_secret_val
        assert "••••" in buffer_setting["value"]
        assert raw_secret_val not in buffer_setting["value"]

@pytest.mark.asyncio
async def test_schedules_and_runs_api():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Login
        login_res = await ac.post("/api/auth/login", json={"username": "admin", "password": "initial_admin_password"})
        csrf_token = login_res.json()["csrf_token"]

        # List schedules
        sched_res = await ac.get("/api/schedules")
        assert sched_res.status_code == 200
        schedules = sched_res.json()
        assert len(schedules) >= 5

        # Trigger immediate run for nightly_orders_sync with CSRF token
        run_res = await ac.post(
            "/api/schedules/nightly_orders_sync/run",
            headers={"X-CSRF-Token": csrf_token}
        )
        assert run_res.status_code == 200
        run_id = run_res.json()["run_id"]
        assert run_id is not None

        # Check run details
        run_detail_res = await ac.get(f"/api/runs/{run_id}")
        assert run_detail_res.status_code == 200
        run_data = run_detail_res.json()
        assert run_data["id"] == run_id
        assert run_data["job_name"] == "nightly_orders_sync"
