from abc import ABC, abstractmethod
from datetime import datetime
from typing import Optional, Tuple, List
from pydantic import BaseModel

class FileInfo(BaseModel):
    path: str
    name: str
    size_bytes: int
    modified_at: datetime
    is_dir: bool = False
    mime_type: Optional[str] = None
    checksum: Optional[str] = None
    remote_id: Optional[str] = None

class ChangeInfo(BaseModel):
    path: str
    change_type: str  # "upsert" or "delete"
    file_info: Optional[FileInfo] = None
    timestamp: datetime

class StorageProvider(ABC):
    """Abstract interface for storage providers (Local filesystem and Google Drive)."""

    @abstractmethod
    async def list(self, path: str = "") -> List[FileInfo]:
        """List files and directories in the specified path."""
        pass

    @abstractmethod
    async def stat(self, path: str) -> FileInfo:
        """Get file metadata."""
        pass

    @abstractmethod
    async def download(self, remote_path: str, local_dest: str) -> str:
        """Download file to local destination."""
        pass

    @abstractmethod
    async def upload(self, local_src: str, remote_path: str) -> FileInfo:
        """Upload local file to remote storage."""
        pass

    @abstractmethod
    async def rename(self, old_path: str, new_path: str) -> FileInfo:
        """Rename file in place."""
        pass

    @abstractmethod
    async def move(self, src_path: str, dest_dir: str) -> FileInfo:
        """Move file to target directory."""
        pass

    @abstractmethod
    async def delete(self, path: str, to_trash: bool = True) -> bool:
        """Delete file or move to /trash."""
        pass

    @abstractmethod
    async def changes(self, since_token: Optional[str] = None) -> Tuple[List[ChangeInfo], str]:
        """Retrieve changes since token. Returns (changes, new_token)."""
        pass
