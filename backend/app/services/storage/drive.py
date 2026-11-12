import os
import json
import io
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, Tuple, List
from backend.app.services.storage.base import StorageProvider, FileInfo, ChangeInfo
from backend.app.core.logging import logger

class DriveStorageProvider(StorageProvider):
    """Google Drive v3 Storage Provider using service account credentials."""

    def __init__(self, service_account_json: Optional[str] = None, root_folder_id: Optional[str] = None):
        self.creds_json = service_account_json
        self.root_folder_id = root_folder_id
        self._service = None

    def _get_service(self):
        if self._service:
            return self._service
        if not self.creds_json:
            raise ValueError("Google Drive service account JSON not configured.")
        try:
            from google.oauth2 import service_account
            from googleapiclient.discovery import build
            info = json.loads(self.creds_json)
            creds = service_account.Credentials.from_service_account_info(
                info, scopes=["https://www.googleapis.com/auth/drive"]
            )
            self._service = build("drive", "v3", credentials=creds)
            return self._service
        except ImportError:
            raise RuntimeError("google-api-python-client not installed in environment.")

    async def list(self, path: str = "") -> list[FileInfo]:
        service = self._get_service()
        # Query files in root folder or subfolder
        q = f"'{self.root_folder_id}' in parents and trashed = false"
        res = service.files().list(q=q, fields="files(id, name, mimeType, size, modifiedTime)").execute()
        files = res.get("files", [])
        
        results: list[FileInfo] = []
        for f in files:
            is_dir = f.get("mimeType") == "application/vnd.google-apps.folder"
            size = int(f.get("size", 0))
            mtime_str = f.get("modifiedTime", "")
            try:
                mtime = datetime.fromisoformat(mtime_str.replace("Z", "+00:00"))
            except Exception:
                mtime = datetime.now(timezone.utc)
            results.append(FileInfo(
                path=f.get("name"),
                name=f.get("name"),
                size_bytes=size,
                modified_at=mtime,
                is_dir=is_dir,
                remote_id=f.get("id"),
            ))
        return results

    async def stat(self, path: str) -> FileInfo:
        service = self._get_service()
        clean = path.split("/")[-1]
        q = f"name = '{clean}' and trashed = false"
        res = service.files().list(q=q, fields="files(id, name, mimeType, size, modifiedTime)").execute()
        files = res.get("files", [])
        if not files:
            raise FileNotFoundError(f"Drive file not found: {path}")
        f = files[0]
        return FileInfo(
            path=path,
            name=f.get("name"),
            size_bytes=int(f.get("size", 0)),
            modified_at=datetime.now(timezone.utc),
            is_dir=f.get("mimeType") == "application/vnd.google-apps.folder",
            remote_id=f.get("id"),
        )

    async def download(self, remote_path: str, local_dest: str) -> str:
        service = self._get_service()
        file_info = await self.stat(remote_path)
        from googleapiclient.http import MediaIoBaseDownload
        request = service.files().get_media(fileId=file_info.remote_id)
        os.makedirs(os.path.dirname(os.path.abspath(local_dest)), exist_ok=True)
        with open(local_dest, "wb") as f:
            downloader = MediaIoBaseDownload(f, request)
            done = False
            while not done:
                _, done = downloader.next_chunk()
        return local_dest

    async def upload(self, local_src: str, remote_path: str) -> FileInfo:
        service = self._get_service()
        from googleapiclient.http import MediaFileUpload
        filename = remote_path.split("/")[-1]
        metadata = {"name": filename, "parents": [self.root_folder_id]}
        media = MediaFileUpload(local_src, resumable=True)
        created = service.files().create(body=metadata, media_body=media, fields="id, name, size, modifiedTime").execute()
        return FileInfo(
            path=remote_path,
            name=created.get("name"),
            size_bytes=int(created.get("size", 0)),
            modified_at=datetime.now(timezone.utc),
            remote_id=created.get("id"),
        )

    async def rename(self, old_path: str, new_path: str) -> FileInfo:
        service = self._get_service()
        info = await self.stat(old_path)
        new_name = new_path.split("/")[-1]
        updated = service.files().update(fileId=info.remote_id, body={"name": new_name}, fields="id, name").execute()
        return await self.stat(new_path)

    async def move(self, src_path: str, dest_dir: str) -> FileInfo:
        # Google Drive move adjusts parents list
        return await self.rename(src_path, f"{dest_dir}/{src_path.split('/')[-1]}")

    async def delete(self, path: str, to_trash: bool = True) -> bool:
        service = self._get_service()
        info = await self.stat(path)
        if to_trash:
            service.files().update(fileId=info.remote_id, body={"trashed": True}).execute()
        else:
            service.files().delete(fileId=info.remote_id).execute()
        return True

    async def changes(self, since_token: Optional[str] = None) -> Tuple[List[ChangeInfo], str]:
        service = self._get_service()
        token = since_token
        if not token:
            token = service.changes().getStartPageToken().execute().get("startPageToken")
            return [], token

        res = service.changes().list(pageToken=token, fields="newStartPageToken, nextPageToken, changes(fileId, removed, file(id, name, size, modifiedTime, trashed))").execute()
        new_token = res.get("newStartPageToken") or res.get("nextPageToken", token)
        
        changes_list: list[ChangeInfo] = []
        for c in res.get("changes", []):
            f = c.get("file", {})
            if c.get("removed") or f.get("trashed"):
                changes_list.append(ChangeInfo(
                    path=f.get("name", "unknown"),
                    change_type="delete",
                    timestamp=datetime.now(timezone.utc),
                ))
            else:
                info = FileInfo(
                    path=f.get("name", "unknown"),
                    name=f.get("name", "unknown"),
                    size_bytes=int(f.get("size", 0)),
                    modified_at=datetime.now(timezone.utc),
                    remote_id=f.get("id"),
                )
                changes_list.append(ChangeInfo(
                    path=f.get("name", "unknown"),
                    change_type="upsert",
                    file_info=info,
                    timestamp=datetime.now(timezone.utc),
                ))
        return changes_list, new_token
