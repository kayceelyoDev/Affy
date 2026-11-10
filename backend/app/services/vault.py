import os
import base64
import stat
from pathlib import Path
from typing import Optional
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.app.core.config import settings
from backend.app.models.models import SecretVault, AuditLog

class SecretsVaultService:
    def __init__(self, key_path: Optional[Path] = None):
        self.key_path = key_path or settings.VAULT_KEY_PATH
        self._master_key: Optional[bytes] = None

    def _get_master_key(self) -> bytes:
        if self._master_key:
            return self._master_key

        if self.key_path.exists():
            key = self.key_path.read_bytes().strip()
            if len(key) == 32:
                self._master_key = key
                return self._master_key
            # Handle base64 encoded 32-byte key
            try:
                decoded = base64.b64decode(key)
                if len(decoded) == 32:
                    self._master_key = decoded
                    return self._master_key
            except Exception:
                pass

        # Generate new 256-bit AES key
        new_key = AESGCM.generate_key(bit_length=256)
        self.key_path.parent.mkdir(parents=True, exist_ok=True)
        self.key_path.write_bytes(new_key)
        
        # Enforce strict 0600 file permissions on POSIX systems
        try:
            os.chmod(self.key_path, stat.S_IRUSR | stat.S_IWUSR)
        except Exception:
            pass

        self._master_key = new_key
        return self._master_key

    def encrypt(self, plaintext: str) -> tuple[str, str, str]:
        """Encrypt plaintext string using AES-256-GCM. Returns (ciphertext_b64, nonce_b64, tag_b64)."""
        key = self._get_master_key()
        aesgcm = AESGCM(key)
        nonce = os.urandom(12) # 96-bit nonce for GCM
        # AESGCM.encrypt appends 16-byte tag to the ciphertext
        encrypted = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
        ciphertext = encrypted[:-16]
        tag = encrypted[-16:]

        return (
            base64.b64encode(ciphertext).decode("utf-8"),
            base64.b64encode(nonce).decode("utf-8"),
            base64.b64encode(tag).decode("utf-8"),
        )

    def decrypt(self, ciphertext_b64: str, nonce_b64: str, tag_b64: str) -> str:
        """Decrypt ciphertext string using AES-256-GCM."""
        key = self._get_master_key()
        aesgcm = AESGCM(key)
        ciphertext = base64.b64decode(ciphertext_b64)
        nonce = base64.b64decode(nonce_b64)
        tag = base64.b64decode(tag_b64)

        data = ciphertext + tag
        decrypted = aesgcm.decrypt(nonce, data, None)
        return decrypted.decode("utf-8")

    @staticmethod
    def mask_secret(value: str) -> str:
        """Never return raw secrets to the client. Returns masked string showing at most 4 trailing chars."""
        if not value:
            return ""
        if len(value) <= 6:
            return "••••••"
        visible_tail = value[-4:]
        prefix = value[:2] if len(value) > 16 else ""
        if prefix:
            return f"{prefix}••••••••{visible_tail}"
        return f"••••••••••••{visible_tail}"

    async def get_secret(self, db: AsyncSession, key: str) -> Optional[str]:
        """Retrieve and decrypt secret for internal system execution."""
        stmt = select(SecretVault).where(SecretVault.key == key)
        result = await db.execute(stmt)
        record = result.scalar_one_or_none()
        if not record:
            return None
        return self.decrypt(record.ciphertext, record.nonce, record.tag)

    async def set_secret(self, db: AsyncSession, key: str, plaintext: str, actor: str = "admin") -> None:
        """Encrypt and store secret, recording an audit entry."""
        ciphertext, nonce, tag = self.encrypt(plaintext)
        stmt = select(SecretVault).where(SecretVault.key == key)
        result = await db.execute(stmt)
        record = result.scalar_one_or_none()

        if record:
            record.ciphertext = ciphertext
            record.nonce = nonce
            record.tag = tag
        else:
            record = SecretVault(key=key, ciphertext=ciphertext, nonce=nonce, tag=tag)
            db.add(record)

        audit = AuditLog(
            action="SECRET_UPDATED",
            actor=actor,
            details_json=f'{{"key": "{key}", "action": "set_or_replace"}}',
        )
        db.add(audit)
        await db.commit()

vault_service = SecretsVaultService()
