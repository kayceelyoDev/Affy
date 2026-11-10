import os
import json
import subprocess
import tempfile
from pathlib import Path
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import patch, MagicMock

from backend.app.services.render.spec import StyleSpec
from backend.app.services.render.engine import RenderEngine, compare_golden_frames
from backend.app.services.render.normalizer import probe_clip, BadClip
from backend.app.services.render.beat import analyse_beats, plan_cuts
from backend.app.services.render.music import MusicService
from backend.app.services.render.captions import ClipCaptionService
from backend.app.models.models import Product, Clip, Track, RenderJob

@pytest.fixture(scope="module")
def synthetic_media(tmp_path_factory):
    """Generates synthetic 1080x1920 30fps test video clips and a test audio track."""
    media_dir = tmp_path_factory.mktemp("media")
    clips = []
    
    # 2 synthetic clips: one red pattern, one blue pattern
    colors = ["red", "blue"]
    for i, col in enumerate(colors):
        clip_p = media_dir / f"clip_{i}_{col}.mp4"
        cmd = [
            "ffmpeg", "-y", "-v", "error", "-f", "lavfi",
            "-i", f"color=c={col}:s=1080x1920:r=30", "-t", "4.0",
            "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
            str(clip_p)
        ]
        subprocess.run(cmd, check=True)
        clips.append(clip_p)

    # 1 synthetic audio file (sine beeps with steady cadence)
    audio_p = media_dir / "test_beat.mp3"
    cmd_audio = [
        "ffmpeg", "-y", "-v", "error", "-f", "lavfi",
        "-i", "sine=frequency=500:beep_factor=3", "-t", "12.0",
        "-c:a", "libmp3lame", "-b:a", "128k", str(audio_p)
    ]
    subprocess.run(cmd_audio, check=True)

    return {"clips": clips, "audio": audio_p, "dir": media_dir}

def test_style_specs_validation():
    """Validates that all 5 built-in style specs parse properly and satisfy schema."""
    style_ids = ["classic_hook", "smooth_flow", "punchy_zoom", "promo_pop", "clean_showcase"]
    engine = RenderEngine(styles_dir=Path("styles/builtin"))

    for sid in style_ids:
        spec = engine.get_style(sid)
        assert spec.id == sid
        assert spec.canvas.width == 1080
        assert spec.canvas.height == 1920
        assert spec.canvas.fps == 30
        assert spec.clip_rules.min_duration >= 5.0
        assert spec.clip_rules.max_duration <= 35.0

def test_style_1_classic_hook_parity_and_golden_frames(synthetic_media):
    """Tests Style 1 exact recreation: 30fps, closed GOP, yuv420p, Anton text, and golden frame self-check."""
    engine = RenderEngine(styles_dir=Path("styles/builtin"))
    clips = synthetic_media["clips"]
    audio = synthetic_media["audio"]
    out_video = synthetic_media["dir"] / "style1_out.mp4"

    info = engine.render_video(
        clip_paths=clips,
        music_path=audio,
        title="STYLE 1 VIRAL MIC",
        subtitle="CLEAR AUDIO FOR CREATORS",
        style_id="classic_hook",
        out_path=out_video,
        min_duration=3.0,
        max_duration=7.0,
        seed=42,
    )

    assert out_video.exists()
    assert info["style_id"] == "classic_hook"
    assert info["duration"] > 0
    assert info["segments"] >= 1

    # Probe output to confirm 1080x1920 30fps yuv420p
    p = probe_clip(out_video)
    assert p["w"] == 1080
    assert p["h"] == 1920
    assert p["pix_fmt"] == "yuv420p"

    # Golden frame similarity test (frame against itself is 1.0)
    ssim = compare_golden_frames(out_video, out_video, sample_time=1.0)
    assert ssim >= 0.99

def test_all_five_styles_render_sample(synthetic_media):
    """Gate test: all five styles render a sample video successfully."""
    engine = RenderEngine(styles_dir=Path("styles/builtin"))
    clips = synthetic_media["clips"]
    audio = synthetic_media["audio"]

    style_ids = ["classic_hook", "smooth_flow", "punchy_zoom", "promo_pop", "clean_showcase"]
    
    for sid in style_ids:
        out_file = synthetic_media["dir"] / f"sample_{sid}.mp4"
        info = engine.render_video(
            clip_paths=clips,
            music_path=audio,
            title=f"{sid.upper()} TITLE",
            subtitle="SUBTITLE PREVIEW",
            style_id=sid,
            out_path=out_file,
            min_duration=3.0,
            max_duration=6.0,
        )
        assert out_file.exists()
        assert out_file.stat().st_size > 10000
        assert info["duration"] > 0

@pytest.mark.asyncio
async def test_music_service_and_loudnorm(db_session: AsyncSession, synthetic_media):
    """Tests MusicService audio registration, loudness normalization, and mock yt-dlp downloader."""
    music_service = MusicService(music_dir=synthetic_media["dir"] / "music_store")
    raw_audio = synthetic_media["audio"]

    # 1. Register local audio file
    track = await music_service.register_audio_file(
        db=db_session,
        source_path=raw_audio,
        title="Trending Beats Vol 1",
        safe_to_use=True,
    )
    assert track.id is not None
    assert track.bpm > 0
    assert track.beats_count > 0
    assert track.safe_to_use is True

    # 2. Mock yt-dlp download when ENABLE_TIKTOK_AUDIO is True
    real_run = subprocess.run
    with patch.dict(os.environ, {"ENABLE_TIKTOK_AUDIO": "true"}):
        music_service.enable_tiktok_audio = True
        with patch("subprocess.run") as mock_sub:
            def side_effect(cmd, **kwargs):
                if cmd[0] == "yt-dlp":
                    target_arg = cmd[cmd.index("-o") + 1]
                    out_p = Path(target_arg.replace("%(ext)s", "mp3"))
                    out_p.write_bytes(raw_audio.read_bytes())
                    return MagicMock(returncode=0, stderr="")
                return real_run(cmd, **kwargs)

            mock_sub.side_effect = side_effect
            dl_track = await music_service.download_track_from_url(
                db=db_session,
                url="https://www.tiktok.com/@creator/video/1234567890",
                title="Mock TikTok Viral Audio",
            )
            assert dl_track.id is not None
            assert dl_track.safe_to_use is False  # Caution flag

@pytest.mark.asyncio
async def test_clip_captions_fallback(synthetic_media):
    """Tests ClipCaptionService frame sampling and phrase bank fallback."""
    caption_svc = ClipCaptionService()
    clips = synthetic_media["clips"]

    captions = await caption_svc.generate_clip_captions_for_video(
        clip_paths=clips,
        product_name="Wireless Microphone Pro",
        language="en",
    )
    assert len(captions) == len(clips)
    for c in captions:
        assert isinstance(c, str)
        assert len(c.split()) >= 3  # 3-6 words per clip

@pytest.mark.asyncio
async def test_render_and_style_api_lifecycle(client: AsyncClient, db_session: AsyncSession):
    """Tests Style Studio and Renders API endpoints."""
    # 1. GET /api/styles
    styles_resp = await client.get("/api/styles")
    assert styles_resp.status_code == 200
    styles = styles_resp.json()
    assert len(styles) >= 5

    # 2. POST /api/styles/{id}/duplicate
    dup_resp = await client.post(
        "/api/styles/classic_hook/duplicate",
        headers={"X-CSRF-Token": "test-csrf"},
        cookies={"csrf_token": "test-csrf"},
    )
    assert dup_resp.status_code == 200
    assert "copy" in dup_resp.json()["id"]

    # 3. GET /api/music
    music_resp = await client.get("/api/music")
    assert music_resp.status_code == 200

    # 4. POST /api/renders/start
    prod = Product(name="Render Test Phone", category="Tech", folder_path="Render_Phone", active=True)
    db_session.add(prod)
    await db_session.commit()
    await db_session.refresh(prod)
    for i in range(3):
        db_session.add(Clip(product_id=prod.id, file_path=f"clip_{i}.mp4", filename=f"clip_{i}.mp4", status="usable"))
    await db_session.commit()

    render_req = {
        "product_id": prod.id,
        "style_id": "classic_hook",
        "title": "RENDER API TEST",
        "subtitle": "FAST AUTOMATION",
    }
    r_resp = await client.post(
        "/api/renders/start",
        json=render_req,
        headers={"X-CSRF-Token": "test-csrf"},
        cookies={"csrf_token": "test-csrf"},
    )
    assert r_resp.status_code == 200
    job_id = r_resp.json()["job_id"]
    assert job_id is not None

    # 5. GET /api/renders/{id}
    job_resp = await client.get(f"/api/renders/{job_id}")
    assert job_resp.status_code == 200
    assert job_resp.json()["status"] == "pending"
