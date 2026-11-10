"""
First-Run Wizard & N8N Workflow Importer
Extracts plain configuration settings from legacy n8n workflow JSONs,
reads initial secret keys from an ephemeral .env.seed file, encrypts them
into the secrets vault, and initializes the local database.

Usage:
    python scripts/import_from_n8n.py [--seed <path_to_env_seed>]
"""

import os
import sys
import json
import asyncio
from pathlib import Path
from dotenv import dotenv_values

# Ensure backend modules are on sys.path
root_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root_dir))

from backend.app.core.database import AsyncSessionLocal, engine, Base
from backend.app.models.models import Setting, User
from backend.app.services.vault import vault_service
from backend.app.core.security import hash_password
from backend.app.services.scheduler import app_scheduler

WORKFLOW_FILES = [
    root_dir / "legacy_private/workflows/workflow_1_smart_nightly_orders.json",
    root_dir / "legacy_private/workflows/workflow_2_sunday_strategy_engine.json",
    root_dir / "legacy_private/workflows/workflow_3_auto_edit_product_videos.json",
    root_dir / "legacy_private/workflows/workflow_4_google_drive_to_gemini_to_buffer_tiktok_poster.json",
]

async def run_import(seed_path: Path):
    print("==================================================")
    print("Affiliate Autopilot: First-Run Migration Wizard")
    print("==================================================")
    
    # 1. Initialize schema
    print("\n[1/4] Initializing database tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print(" - Database tables verified.")

    # 2. Extract plain settings from workflow JSONs
    print("\n[2/4] Scanning legacy n8n workflows for plain settings...")
    extracted_settings: dict[str, str] = {}
    for wf_path in WORKFLOW_FILES:
        if not wf_path.exists():
            print(f" - Note: {wf_path.name} not found, skipping.")
            continue
        try:
            with open(wf_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            nodes = data.get("nodes", [])
            for node in nodes:
                name = node.get("name", "").lower()
                if "setting" in name or "config" in name:
                    params = node.get("parameters", {})
                    # Check values property if defined
                    values = params.get("values", {})
                    if isinstance(values, dict):
                        for k, v in values.items():
                            if isinstance(v, (str, int, float, bool)):
                                extracted_settings[k] = str(v)
                    # Check direct parameters
                    for k, v in params.items():
                        if k not in ("values", "options", "notice") and isinstance(v, (str, int, float, bool)):
                            extracted_settings[k] = str(v)
            print(f" - Parsed {wf_path.name}")
        except Exception as e:
            print(f" - Error reading {wf_path.name}: {e}")

    print(f" - Discovered {len(extracted_settings)} plain configuration keys from workflows.")

    # 3. Read seed secrets
    print(f"\n[3/4] Checking for ephemeral secrets seed at: {seed_path}...")
    seed_secrets: dict[str, str] = {}
    if seed_path.exists():
        raw_seed = dotenv_values(seed_path)
        for k, v in raw_seed.items():
            if v and str(v).strip():
                seed_secrets[k] = str(v).strip()
        print(f" - Found {len(seed_secrets)} secrets in seed file.")
    else:
        print(" - No seed file found. Secrets can be entered via Web UI Settings page.")

    # 4. Store in database
    print("\n[4/4] Writing settings and encrypting secrets into vault...")
    async with AsyncSessionLocal() as session:
        # Create default admin if not existing
        admin_pass = seed_secrets.get("ADMIN_INITIAL_PASSWORD", "autopilot2026")
        admin_user = User(username="admin", password_hash=hash_password(admin_pass))
        session.add(admin_user)
        try:
            await session.commit()
            print(" - Admin account initialized (username: 'admin').")
        except Exception:
            await session.rollback()

        # Save plain settings
        for k, v in extracted_settings.items():
            s = Setting(key=k, value=v, is_secret=False, description="Imported from n8n workflow")
            session.add(s)
        try:
            await session.commit()
            print(f" - Stored {len(extracted_settings)} plain settings in database.")
        except Exception as e:
            print(f" - Settings commit notice: {e}")
            await session.rollback()

        # Encrypt and store secrets
        stored_secrets = 0
        for k, v in seed_secrets.items():
            if k == "ADMIN_INITIAL_PASSWORD":
                continue
            await vault_service.set_secret(session, k, v, actor="migration_wizard")
            stored_secrets += 1
        print(f" - Stored {stored_secrets} secrets encrypted with AES-256-GCM in vault.")

        # Initialize default schedules
        await app_scheduler.init_schedules()
        print(" - Default production schedules initialized.")

    print("\n==================================================")
    print("Migration Wizard Complete!")
    if seed_path.exists():
        print(f"ACTION REQUIRED: Safely delete the ephemeral seed file: {seed_path}")
        print(f"Command: rm {seed_path}")
    print("==================================================")

def main():
    seed_arg = Path(".env.seed")
    if len(sys.argv) > 2 and sys.argv[1] == "--seed":
        seed_arg = Path(sys.argv[2])
    asyncio.run(run_import(seed_arg))

if __name__ == "__main__":
    main()
