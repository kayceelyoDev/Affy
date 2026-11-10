import os
import shutil
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Tuple, List
from backend.app.services.storage.base import StorageProvider, FileInfo, ChangeInfo
from backend.app.core.config import settings

class LocalStorageProvider(StorageProvider):
    def __init__(self, root_dir: Optional[Path] = None):
        self.root = (root_dir or settings.DATA_DIR).resolve()
        self.trash_dir = self.root / "trash"
        self.trash_dir.mkdir(parents=True, exist_ok=True)
        self.change_journal: list[ChangeInfo] = []
        # Standard folder tree
        (self.root / "clips").mkdir(parents=True, exist_ok=True)
        (self.root / "renders").mkdir(parents=True, exist_ok=True)
        (self.root / "archive").mkdir(parents=True, exist_ok=True)

    def _resolve_safe(self, rel_path: str) -> Path:
        """Resolve path and ensure no directory traversal outside root."""
        clean = rel_path.lstrip("/\\")
        full_path = (self.root / clean).resolve()
        if not str(full_path).startswith(str(self.root)):
            raise ValueError(f"Path traversal detected: {rel_path}")
        return full_path

    async def list(self, path: str = "") -> list[FileInfo]:
        target = self._resolve_safe(path)
        if not target.exists() or not target.is_dir():
            return []

        results: list[FileInfo] = []
        for entry in os.scandir(target):
            st = entry.stat()
            rel = Path(entry.path).relative_to(self.root).as_posix()
            results.append(FileInfo(
                path=rel,
                name=entry.name,
                size_bytes=st.st_size if entry.is_file() else 0,
                modified_at=datetime.fromtimestamp(st.st_mtime, timezone.utc),
                is_dir=entry.is_dir(),
            ))
        return results

    async def stat(self, path: str) -> FileInfo:
        target = self._resolve_safe(path)
        if not target.exists():
            raise FileNotFoundError(f"File not found: {path}")
        st = target.stat()
        return FileInfo(
            path=Path(target).relative_to(self.root).as_posix(),
            name=target.name,
            size_bytes=st.st_size if target.is_file() else 0,
            modified_at=datetime.fromtimestamp(st.st_mtime, timezone.utc),
            is_dir=target.is_dir(),
        )

    async def download(self, remote_path: str, local_dest: str) -> str:
        src = self._resolve_safe(remote_path)
        if not src.exists():
            raise FileNotFoundError(f"Source file not found: {remote_path}")
        dest = Path(local_dest).resolve()
        dest.parent.mkdir(parents=True, exist_ok=True)
        if src != dest:
            shutil.copy2(src, dest)
        return str(dest)

    async def upload(self, local_src: str, remote_path: str) -> FileInfo:
        src = Path(local_src).resolve()
        if not src.exists():
            raise FileNotFoundError(f"Local source not found: {local_src}")
        dest = self._resolve_safe(remote_path)
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)
        info = await self.stat(remote_path)
        self.change_journal.append(ChangeInfo(
            path=remote_path,
            change_type="upsert",
            file_info=info,
            timestamp=info.modified_at,
        ))
        return info

    async def rename(self, old_path: str, new_path: str) -> FileInfo:
        src = self._resolve_safe(old_path)
        dest = self._resolve_safe(new_path)
        if not src.exists():
            raise FileNotFoundError(f"Source not found: {old_path}")
        dest.parent.mkdir(parents=True, exist_ok=True)
        os.rename(src, dest)
        return await self.stat(new_path)

    async def move(self, src_path: str, dest_dir: str) -> FileInfo:
        src = self._resolve_safe(src_path)
        if not src.exists():
            raise FileNotFoundError(f"Source not found: {src_path}")
        target_dir = self._resolve_safe(dest_dir)
        target_dir.mkdir(parents=True, exist_ok=True)
        dest = target_dir / src.name
        shutil.move(src, dest)
        rel = dest.relative_to(self.root).as_posix()
        return await self.stat(rel)

    async def delete(self, path: str, to_trash: bool = True) -> bool:
        target = self._resolve_safe(path)
        if not target.exists():
            return False

        if to_trash:
            ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            dest = self.trash_dir / f"{ts}_{target.name}"
            shutil.move(target, dest)
        else:
            if target.is_dir():
                shutil.rmtree(target)
            else:
                target.unlink()

        self.change_journal.append(ChangeInfo(
            path=path,
            change_type="delete",
            timestamp=datetime.now(timezone.utc),
        ))
        return True

    async def changes(self, since_token: Optional[str] = None) -> Tuple[List[ChangeInfo], str]:
        if self.change_journal:
            start_idx = int(since_token) if since_token and since_token.isdigit() else 0
            selected = self.change_journal[start_idx:]
            return selected, str(len(self.change_journal))

        since_time = float(since_token) if since_token and "." in since_token else 0.0
        now_ts = datetime.now(timezone.utc).timestamp()
        changes_list: list[ChangeInfo] = []

        for root_p, _, files in os.walk(self.root):
            if "trash" in root_p:
                continue
            for f in files:
                full = Path(root_p) / f
                mtime = full.stat().st_mtime
                if mtime > since_time:
                    rel = full.relative_to(self.root).as_posix()
                    info = await self.stat(rel)
                    changes_list.append(ChangeInfo(
                        path=rel,
                        change_type="upsert",
                        file_info=info,
                        timestamp=info.modified_at,
                    ))

        return changes_list, str(now_ts)
