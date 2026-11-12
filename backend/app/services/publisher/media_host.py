import os
import time
import uuid
from abc import ABC, abstractmethod
from typing import Optional, Dict
from datetime import datetime, timedelta

from backend.app.core.logging import logger

# In-memory token store for TunnelMediaHostProvider: token -> (file_path, expiry_epoch)
_TUNNEL_TOKEN_STORE: Dict[str, tuple[str, float]] = {}

def get_tunnel_token_file(token: str) -> Optional[str]:
    """Retrieves valid file path if token is active and unexpired."""
    entry = _TUNNEL_TOKEN_STORE.get(token)
    if not entry:
        return None
    file_path, expiry = entry
    if time.time() > expiry:
        del _TUNNEL_TOKEN_STORE[token]
        return None
    return file_path


class MediaHostProvider(ABC):
    @abstractmethod
    async def upload_video(self, file_path: str, public_id: Optional[str] = None) -> str:
        """Uploads video file and returns a publicly reachable URL."""
        pass

    @abstractmethod
    async def delete_video(self, media_ref: str) -> bool:
        """Deletes video from storage."""
        pass

    @abstractmethod
    async def cleanup_expired(self, max_age_days: int = 14) -> int:
        """Cleans up expired hosted media assets."""
        pass


class MockMediaHostProvider(MediaHostProvider):
    def __init__(self):
        self.uploaded_files: Dict[str, str] = {} # media_ref -> file_path

    async def upload_video(self, file_path: str, public_id: Optional[str] = None) -> str:
        ref = public_id or f"mock_vid_{uuid.uuid4().hex[:8]}"
        mock_url = f"https://res.cloudinary.com/autopilot-demo/video/upload/{ref}.mp4"
        self.uploaded_files[ref] = file_path
        logger.info("MockMediaHost uploaded video", path=file_path, url=mock_url)
        return mock_url

    async def delete_video(self, media_ref: str) -> bool:
        if media_ref in self.uploaded_files:
            del self.uploaded_files[media_ref]
            logger.info("MockMediaHost deleted video", ref=media_ref)
            return True
        return False

    async def cleanup_expired(self, max_age_days: int = 14) -> int:
        count = len(self.uploaded_files)
        self.uploaded_files.clear()
        return count


class TunnelMediaHostProvider(MediaHostProvider):
    def __init__(self, base_url: str = "http://localhost:8000", token_ttl_seconds: int = 7200):
        self.base_url = base_url.rstrip("/")
        self.token_ttl = token_ttl_seconds

    async def upload_video(self, file_path: str, public_id: Optional[str] = None) -> str:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Video file not found for hosting: {file_path}")

        token = f"t_{uuid.uuid4().hex}"
        expiry = time.time() + self.token_ttl
        _TUNNEL_TOKEN_STORE[token] = (file_path, expiry)

        url = f"{self.base_url}/api/media/temp/{token}"
        logger.info("TunnelMediaHost issued tokenized video URL", url=url, token=token, expiry=expiry)
        return url

    async def delete_video(self, media_ref: str) -> bool:
        # media_ref can be token or full URL
        token = media_ref.split("/")[-1]
        if token in _TUNNEL_TOKEN_STORE:
            del _TUNNEL_TOKEN_STORE[token]
            logger.info("TunnelMediaHost revoked token", token=token)
            return True
        return False

    async def cleanup_expired(self, max_age_days: int = 14) -> int:
        now = time.time()
        expired = [t for t, (_, exp) in _TUNNEL_TOKEN_STORE.items() if now > exp]
        for t in expired:
            del _TUNNEL_TOKEN_STORE[t]
        return len(expired)


class CloudinaryMediaHostProvider(MediaHostProvider):
    def __init__(
        self,
        cloud_name: Optional[str] = None,
        api_key: Optional[str] = None,
        api_secret: Optional[str] = None,
        delete_after_post: bool = False,
    ):
        self.cloud_name = cloud_name or os.getenv("CLOUDINARY_CLOUD_NAME", "")
        self.api_key = api_key or os.getenv("CLOUDINARY_API_KEY", "")
        self.api_secret = api_secret or os.getenv("CLOUDINARY_API_SECRET", "")
        self.delete_after_post = delete_after_post

    async def upload_video(self, file_path: str, public_id: Optional[str] = None) -> str:
        if not self.cloud_name or not self.api_key or not self.api_secret:
            logger.warning("Cloudinary credentials unset; falling back to Mock provider")
            mock = MockMediaHostProvider()
            return await mock.upload_video(file_path, public_id)

        import httpx
        url = f"https://api.cloudinary.com/v1_1/{self.cloud_name}/video/upload"
        timestamp = str(int(time.time()))
        pid = public_id or f"vid_{uuid.uuid4().hex[:12]}"
        
        import hashlib
        to_sign = f"public_id={pid}&timestamp={timestamp}{self.api_secret}"
        signature = hashlib.sha1(to_sign.encode("utf-8")).hexdigest()

        with open(file_path, "rb") as f:
            files = {"file": f}
            data = {
                "api_key": self.api_key,
                "timestamp": timestamp,
                "public_id": pid,
                "signature": signature,
            }
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(url, data=data, files=files)
                resp.raise_for_status()
                res_json = resp.json()
                secure_url = res_json.get("secure_url", res_json.get("url"))
                logger.info("Uploaded video to Cloudinary", url=secure_url, pid=pid)
                return secure_url

    async def delete_video(self, media_ref: str) -> bool:
        if not self.cloud_name or not self.api_key or not self.api_secret:
            return True
        import httpx
        import hashlib
        pid = media_ref.split("/")[-1].split(".")[0]
        url = f"https://api.cloudinary.com/v1_1/{self.cloud_name}/video/destroy"
        timestamp = str(int(time.time()))
        to_sign = f"public_id={pid}&timestamp={timestamp}{self.api_secret}"
        signature = hashlib.sha1(to_sign.encode("utf-8")).hexdigest()

        data = {
            "api_key": self.api_key,
            "timestamp": timestamp,
            "public_id": pid,
            "signature": signature,
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, data=data)
            return resp.status_code == 200

    async def cleanup_expired(self, max_age_days: int = 14) -> int:
        logger.info("Cloudinary auto-cleanup cycle executed", max_age_days=max_age_days)
        return 0


def get_media_host(provider_name: Optional[str] = None, base_url: str = "http://localhost:8000") -> MediaHostProvider:
    name = (provider_name or os.getenv("MEDIA_HOST_PROVIDER", "mock")).lower()
    if name == "cloudinary":
        return CloudinaryMediaHostProvider()
    elif name == "tunnel":
        return TunnelMediaHostProvider(base_url=base_url)
    return MockMediaHostProvider()
