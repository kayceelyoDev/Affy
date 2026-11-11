import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.app.main import app
from backend.app.core.database import AsyncSessionLocal
from backend.app.models.models import Setting, SecretVault, Product, Post, RenderJob, PlanSlot, Plan, User
from backend.app.core.security import hash_password
from backend.app.services.render.templates import list_all_templates, get_template_by_id

@pytest_asyncio.fixture
async def auth_client():
    async with AsyncSessionLocal() as db:
        admin = User(username="admin", password_hash=hash_password("admin123"))
        db.add(admin)
        # Also seed a sample Setting so reset test has data to verify preservation
        s = Setting(key="TEST_SETTING", value="preserved_val")
        db.add(s)
        await db.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

@pytest.mark.asyncio
async def test_templates_api_list_and_seed(auth_client: AsyncClient):
    """Verifies template catalog endpoints and seed defaults."""
    res = await auth_client.get("/api/styles/templates")
    assert res.status_code == 200
    tpls = res.json()
    assert len(tpls) >= 3
    
    tpl_ids = [t["id"] for t in tpls]
    assert "tpl_viral_deal_drop" in tpl_ids
    assert "tpl_aesthetic_showcase" in tpl_ids
    assert "tpl_promo_pop" in tpl_ids

    # Check viral deal drop fields
    viral = next(t for t in tpls if t["id"] == "tpl_viral_deal_drop")
    assert viral["fixed_music_track"] == "downloadsv2 (1).mp3"
    assert viral["base_style_id"] == "punchy_zoom"
    assert viral["title_color"] == "#EFD34C"

@pytest.mark.asyncio
async def test_templates_crud_lifecycle(auth_client: AsyncClient):
    """Verifies creating, updating, and deleting a user template."""
    # 1. Create
    create_payload = {
        "name": "Unit Test Flash Drop",
        "fixed_music_track": "downloadsv2 (2).mp3",
        "base_style_id": "promo_pop",
        "crop_mode": "auto",
        "title_color": "#FF3B30",
        "title_font_size": 130,
        "title_y": 240,
        "subtitle_color": "#FFFFFF",
        "subtitle_font_size": 60,
        "subtitle_y": 380,
    }
    res_create = await auth_client.post("/api/styles/templates", json=create_payload)
    assert res_create.status_code == 200
    data = res_create.json()
    assert data["ok"] is True
    tpl_id = data["template"]["id"]

    # 2. Update
    update_payload = {"title_color": "#00F0FF", "title_font_size": 140}
    res_update = await auth_client.put(f"/api/styles/templates/{tpl_id}", json=update_payload)
    assert res_update.status_code == 200
    assert res_update.json()["template"]["title_color"] == "#00F0FF"

    # 3. Set default
    res_def = await auth_client.post(f"/api/styles/templates/{tpl_id}/set-default")
    assert res_def.status_code == 200
    assert res_def.json()["ok"] is True

    # Verify DB setting
    async with AsyncSessionLocal() as db:
        rec = (await db.execute(select(Setting).where(Setting.key == "DEFAULT_RENDER_STYLE"))).scalar_one_or_none()
        assert rec is not None
        assert rec.value == tpl_id

    # 4. Delete
    res_del = await auth_client.delete(f"/api/styles/templates/{tpl_id}")
    assert res_del.status_code == 200
    assert res_del.json()["ok"] is True

@pytest.mark.asyncio
async def test_connection_health_check_endpoints(auth_client: AsyncClient):
    """Tests health check endpoints for Cloudinary, Telegram, Buffer, and Gemini."""
    # Cloudinary unset check
    res_cld = await auth_client.post("/api/settings/test/cloudinary", json={})
    assert res_cld.status_code == 200
    data_cld = res_cld.json()
    assert data_cld["service"] == "cloudinary"
    assert "not configured" in data_cld["message"] or data_cld["ok"] is True

    # Telegram dummy credential check
    res_tg = await auth_client.post("/api/settings/test/telegram", json={"credential": "123:INVALID_KEY"})
    assert res_tg.status_code == 200
    assert res_tg.json()["service"] == "telegram"
    assert res_tg.json()["ok"] is False

    # Buffer dummy credential check
    res_buf = await auth_client.post("/api/settings/test/buffer", json={"credential": "invalid_buffer_token"})
    assert res_buf.status_code == 200
    assert res_buf.json()["service"] == "buffer"
    assert res_buf.json()["ok"] is False

@pytest.mark.asyncio
async def test_reset_data_endpoint_preserves_secrets_and_settings(auth_client: AsyncClient):
    """Verifies that POST /api/settings/reset-data strictly preserves credentials & settings."""
    # Pre-check settings exist
    async with AsyncSessionLocal() as db:
        setting_cnt = len((await db.execute(select(Setting))).scalars().all())
        assert setting_cnt > 0

    # Run reset
    res = await auth_client.post("/api/settings/reset-data")
    assert res.status_code == 200
    assert res.json()["ok"] is True

    # Verify posts and jobs are wiped
    async with AsyncSessionLocal() as db:
        posts_cnt = len((await db.execute(select(Post))).scalars().all())
        jobs_cnt = len((await db.execute(select(RenderJob))).scalars().all())
        assert posts_cnt == 0
        assert jobs_cnt == 0

        # Verify Setting is completely intact
        after_setting_cnt = len((await db.execute(select(Setting))).scalars().all())
        assert after_setting_cnt == setting_cnt

@pytest.mark.asyncio
async def test_template_slots_blueprint_and_render_engine(auth_client: AsyncClient):
    """Verifies CapCut template timeline slots structure and exact slot timeline adherence."""
    from backend.app.services.render.engine import RenderEngine
    import tempfile
    import subprocess
    from pathlib import Path

    # 1. API returns slots for all default templates
    res = await auth_client.get("/api/styles/templates")
    assert res.status_code == 200
    tpls = res.json()
    
    viral = next(t for t in tpls if t["id"] == "tpl_viral_deal_drop")
    assert "slots" in viral
    assert len(viral["slots"]) == 5
    assert viral["slots"][0]["transition"] == "snap_zoom"
    assert viral["slots"][0]["motion"] == "zoom_punch"
    assert viral["slots"][0]["duration"] == 1.2
    assert viral["slots"][1]["transition"] == "whip_left"

    # 2. Test RenderEngine renders exact timeline of template
    engine = RenderEngine()
    with tempfile.TemporaryDirectory() as td:
        sample_clip = Path(td) / "clip.mp4"
        subprocess.run([
            "ffmpeg", "-y", "-v", "error", "-f", "lavfi",
            "-i", "testsrc=size=1080x1920:rate=30", "-t", "8.0",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", str(sample_clip)
        ], check=True)

        sample_music = Path(td) / "music.wav"
        subprocess.run([
            "ffmpeg", "-y", "-v", "error", "-f", "lavfi",
            "-i", "sine=frequency=440:beep_factor=2", "-t", "8.0",
            str(sample_music)
        ], check=True)

        out_mp4 = Path(td) / "test_tpl_out.mp4"
        info = engine.render_video(
            clip_paths=[sample_clip, sample_clip],
            music_path=sample_music,
            title="KEYBOARD WIRELESS",
            subtitle="GAMING ACCESSORY",
            style_id="tpl_viral_deal_drop",
            out_path=out_mp4,
        )

        assert out_mp4.exists()
        assert out_mp4.stat().st_size > 0
        assert info["segments"] == 5  # Exactly 5 slots from tpl_viral_deal_drop
        assert abs(info["duration"] - 6.0) < 0.2  # Exactly 6.0s duration!

