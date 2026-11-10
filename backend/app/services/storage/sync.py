import asyncio
from datetime import datetime
from typing import Optional
from backend.app.services.storage.base import StorageProvider
from backend.app.services.storage.local import LocalStorageProvider
from backend.app.services.storage.cache import lru_cache
from backend.app.core.logging import logger

class StorageSyncService:
    def __init__(self, local_provider: LocalStorageProvider, remote_provider: Optional[StorageProvider] = None):
        self.local = local_provider
        self.remote = remote_provider
        self.last_sync_time: Optional[datetime] = None
        self.sync_token: Optional[str] = None
        self.is_syncing: bool = False

    async def sync_now(self) -> dict:
        """Execute a manual or scheduled sync cycle."""
        if self.is_syncing:
            return {"ok": False, "status": "already_syncing"}

        self.is_syncing = True
        logger.info("Storage sync cycle initiated")
        synced_count = 0
        error_count = 0

        try:
            from backend.app.core.database import AsyncSessionLocal
            from backend.app.services.vault import vault_service
            from backend.app.models.models import Setting
            from sqlalchemy import select

            async with AsyncSessionLocal() as session:
                sa_token = await vault_service.get_secret(session, "GOOGLE_DRIVE_SERVICE_ACCOUNT")
                folder_stmt = select(Setting).where(Setting.key == "GOOGLE_DRIVE_FOLDER_ID")
                folder_rec = (await session.execute(folder_stmt)).scalar_one_or_none()
                folder_id = folder_rec.value if folder_rec else None

                if sa_token and folder_id:
                    import json
                    from backend.app.services.storage.drive_api import list_drive_subfolders_and_clips, download_file_from_drive
                    from backend.app.services.catalog.service import catalog_service

                    try:
                        sa_info = json.loads(sa_token)
                        drive_items = await list_drive_subfolders_and_clips(sa_info, folder_id)
                        for item in drive_items:
                            folder_name = item["folder_name"]
                            for clip in item["clips"]:
                                clip_name = clip["name"]
                                cid = clip["id"]
                                dest_file = self.local.root / "clips" / folder_name / clip_name
                                if not dest_file.exists():
                                    logger.info("Downloading new clip from Drive", folder=folder_name, clip=clip_name)
                                    await download_file_from_drive(sa_info, cid, dest_file)
                                    synced_count += 1

                        await catalog_service.scan_clips_directory(session, self.local)
                        lru_cache.evict_if_needed()
                        self.last_sync_time = datetime.utcnow()
                        return {"ok": True, "status": "drive_synced", "synced": synced_count}
                    except Exception as de:
                        logger.error("Drive sync error", error=str(de))
                        return {"ok": False, "status": "drive_error", "message": str(de), "synced": 0}

            if not self.remote:
                # No remote provider configured; local scan and cache maintenance only
                from backend.app.core.database import AsyncSessionLocal
                from backend.app.services.catalog.service import catalog_service
                async with AsyncSessionLocal() as session:
                    await catalog_service.scan_clips_directory(session, self.local)
                lru_cache.evict_if_needed()
                self.last_sync_time = datetime.utcnow()
                return {"ok": True, "status": "local_only", "synced": 0}

            # Fetch changes from remote
            backoff = 1.0
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    changes, new_token = await self.remote.changes(self.sync_token)
                    self.sync_token = new_token
                    break
                except Exception as e:
                    if "429" in str(e) or "503" in str(e):
                        logger.warning("Storage rate limit encountered, backing off", seconds=backoff, attempt=attempt)
                        await asyncio.sleep(backoff)
                        backoff *= 2
                    else:
                        raise e

            # Reconcile changes
            for ch in changes:
                try:
                    if ch.change_type == "delete":
                        await self.local.delete(ch.path, to_trash=True)
                        synced_count += 1
                    elif ch.change_type == "upsert" and ch.file_info:
                        # Check local state for conflicts
                        try:
                            local_stat = await self.local.stat(ch.path)
                            # Conflict resolution: newest mtime wins
                            if ch.file_info.modified_at > local_stat.modified_at:
                                temp_dest = str(self.local.root / "cache" / "sync_tmp")
                                downloaded = await self.remote.download(ch.path, temp_dest)
                                await self.local.upload(downloaded, ch.path)
                                synced_count += 1
                        except FileNotFoundError:
                            # File does not exist locally; download and save
                            temp_dest = str(self.local.root / "cache" / "sync_tmp")
                            downloaded = await self.remote.download(ch.path, temp_dest)
                            await self.local.upload(downloaded, ch.path)
                            synced_count += 1
                except Exception as e:
                    logger.error("Error syncing change item", path=ch.path, error=str(e))
                    error_count += 1

            self.last_sync_time = datetime.utcnow()
            return {
                "ok": True,
                "status": "completed",
                "synced": synced_count,
                "errors": error_count,
                "timestamp": self.last_sync_time.isoformat()
            }
        finally:
            self.is_syncing = False

storage_sync_service = StorageSyncService(local_provider=LocalStorageProvider())
