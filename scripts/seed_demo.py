"""
CLI Script to seed synthetic creator data for demo mode.
Usage:
    python scripts/seed_demo.py
"""

import sys
import asyncio
from pathlib import Path

root_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root_dir))

from backend.app.core.database import AsyncSessionLocal, engine, Base
from backend.app.services.demo import DemoSeeder


async def main():
    print("==================================================")
    print("Affiliate Autopilot: Synthetic Demo Mode Seeder")
    print("==================================================")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        stats = await DemoSeeder.seed_demo_data(session)

    print("Demo Data Summary:")
    for k, v in stats.items():
        print(f" - {k.capitalize()}: {v}")
    print("==================================================")
    print("Demo mode seed complete! Log in with 'demo_admin' / 'demo1234'.")
    print("==================================================")


if __name__ == "__main__":
    asyncio.run(main())
