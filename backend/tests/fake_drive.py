import os
import uuid
from datetime import datetime, timezone
from typing import Optional, Tuple, List
from backend.app.services.storage.base import StorageProvider, FileInfo, ChangeInfo

class FakeDriveStorageProvider(StorageProvider):
    """In-memory Google Drive fake that satisfies the exact StorageProvider contract."""

    def __init__(self):
        # path -> dict(id, path, name, data, size, mtime, is_dir, in_trash)
        self.files: dict[str, dict] = {}
        self.change_history: list[dict] = []
        # Pre-seed standard root directories
        self._create_dir("clips")
        self._create_dir("renders")
        self._create_dir("archive")
        self._create_dir("trash")

    def _create_dir(self, path: str):
        clean = path.strip("/")
        self.files[clean] = {
            "id": f"folder_{uuid.uuid4().hex[:8]}",
            "path": clean,
            "name": clean.split("/")[-1],
            "data": b"",
            "size": 0,
            "mtime": datetime.now(timezone.utc),
            "is_dir": True,
            "in_trash": False,
        }

    async def list(self, path: str = "") -> list[FileInfo]:
        clean = path.strip("/")
        results: list[FileInfo] = []
        for p, data in self.files.items():
            if data["in_trash"]:
                continue
            parent = "/".join(p.split("/")[:-1])
            if parent == clean and p != clean:
                results.append(FileInfo(
                    path=data["path"],
                    name=data["name"],
                    size_bytes=data["size"],
                    modified_at=data["mtime"],
                    is_dir=data["is_dir"],
                    remote_id=data["id"],
                ))
        return results

    async def stat(self, path: str) -> FileInfo:
        clean = path.strip("/")
        if clean not in self.files or self.files[clean]["in_trash"]:
            raise FileNotFoundError(f"Drive file not found: {path}")
        d = self.files[clean]
        return FileInfo(
            path=d["path"],
            name=d["name"],
            size_bytes=d["size"],
            modified_at=d["mtime"],
            is_dir=d["is_dir"],
            remote_id=d["id"],
        )

    async def download(self, remote_path: str, local_dest: str) -> str:
        clean = remote_path.strip("/")
        if clean not in self.files or self.files[clean]["in_trash"]:
            raise FileNotFoundError(f"Drive file not found: {remote_path}")
        data = self.files[clean]["data"]
        os.makedirs(os.path.dirname(os.path.abspath(local_dest)), exist_ok=True)
        with open(local_dest, "wb") as f:
            f.write(data)
        return local_dest

    async def upload(self, local_src: str, remote_path: str) -> FileInfo:
        clean = remote_path.strip("/")
        with open(local_src, "rb") as f:
            data = f.read()

        file_id = f"file_{uuid.uuid4().hex[:8]}"
        mtime = datetime.now(timezone.utc)
        record = {
            "id": file_id,
            "path": clean,
            "name": clean.split("/")[-1],
            "data": data,
            "size": len(data),
            "mtime": mtime,
            "is_dir": False,
            "in_trash": False,
        }
        self.files[clean] = record
        self.change_history.append({"type": "upsert", "path": clean, "record": record, "time": mtime})
        return await self.stat(clean)

    async def rename(self, old_path: str, new_path: str) -> FileInfo:
        old_clean = old_path.strip("/")
        new_clean = new_path.strip("/")
        if old_clean not in self.files:
            raise FileNotFoundError(f"Drive file not found: {old_path}")
        record = self.files.pop(old_clean)
        record["path"] = new_clean
        record["name"] = new_clean.split("/")[-1]
        record["mtime"] = datetime.now(timezone.utc)
        self.files[new_clean] = record
        self.change_history.append({"type": "upsert", "path": new_clean, "record": record, "time": record["mtime"]})
        return await self.stat(new_clean)

    async def move(self, src_path: str, dest_dir: str) -> FileInfo:
        src_clean = src_path.strip("/")
        dest_clean = dest_dir.strip("/")
        if src_clean not in self.files:
            raise FileNotFoundError(f"Drive file not found: {src_path}")
        filename = src_clean.split("/")[-1]
        new_path = f"{dest_clean}/{filename}" if dest_clean else filename
        return await self.rename(src_clean, new_path)

    async def delete(self, path: str, to_trash: bool = True) -> bool:
        clean = path.strip("/")
        if clean not in self.files:
            return False
        if to_trash:
            self.files[clean]["in_trash"] = True
            ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            trash_path = f"trash/{ts}_{self.files[clean]['name']}"
            record = self.files.pop(clean)
            record["path"] = trash_path
            record["in_trash"] = True
            self.files[trash_path] = record
            self.change_history.append({"type": "delete", "path": clean, "time": datetime.now(timezone.utc)})
        else:
            del self.files[clean]
            self.change_history.append({"type": "delete", "path": clean, "time": datetime.now(timezone.utc)})
        return True

    async def changes(self, since_token: Optional[str] = None) -> Tuple[List[ChangeInfo], str]:
        start_idx = int(since_token) if since_token and since_token.isdigit() else 0
        selected = self.change_history[start_idx:]
        new_token = str(len(self.change_history))

        changes_list: list[ChangeInfo] = []
        for ch in selected:
            if ch["type"] == "upsert":
                r = ch["record"]
                info = FileInfo(
                    path=r["path"],
                    name=r["name"],
                    size_bytes=r["size"],
                    modified_at=r["mtime"],
                    is_dir=r["is_dir"],
                    remote_id=r["id"],
                )
                changes_list.append(ChangeInfo(
                    path=r["path"],
                    change_type="upsert",
                    file_info=info,
                    timestamp=ch["time"],
                ))
            else:
                changes_list.append(ChangeInfo(
                    path=ch["path"],
                    change_type="delete",
                    timestamp=ch["time"],
                ))
        return changes_list, new_token
