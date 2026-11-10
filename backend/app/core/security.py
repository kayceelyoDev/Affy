import os
import time
import hmac
import hashlib
import secrets
from typing import Optional
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import Request, HTTPException, status
from backend.app.core.config import settings

# Argon2id password hasher with secure parameters
ph = PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=4,
    hash_len=32,
    salt_len=16,
)

# Sliding window login rate limiter
_login_attempts: dict[str, list[float]] = {}

def hash_password(password: str) -> str:
    return ph.hash(password)

def verify_password(hash_str: str, password: str) -> bool:
    try:
        return ph.verify(hash_str, password)
    except VerifyMismatchError:
        return False
    except Exception:
        return False

def check_login_rate_limit(client_ip: str) -> None:
    now = time.time()
    window = 60.0 # 1 minute
    attempts = _login_attempts.get(client_ip, [])
    # Filter attempts within the window
    attempts = [t for t in attempts if now - t < window]
    if len(attempts) >= settings.LOGIN_RATE_LIMIT_PER_MINUTE:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please wait 1 minute before retrying.",
        )
    attempts.append(now)
    _login_attempts[client_ip] = attempts

def _get_session_secret() -> bytes:
    key_path = settings.SESSION_KEY_PATH
    if key_path.exists():
        key = key_path.read_bytes().strip()
        if len(key) >= 32:
            return key
    new_secret = secrets.token_bytes(32)
    key_path.parent.mkdir(parents=True, exist_ok=True)
    key_path.write_bytes(new_secret)
    return new_secret

def create_session_token(username: str) -> str:
    """Create HMAC-signed timestamped session token: username:timestamp:signature"""
    secret = _get_session_secret()
    timestamp = str(int(time.time()))
    payload = f"{username}:{timestamp}".encode("utf-8")
    sig = hmac.new(secret, payload, hashlib.sha256).hexdigest()
    return f"{username}:{timestamp}:{sig}"

def verify_session_token(token: str) -> Optional[str]:
    """Verify HMAC signature and expiration. Returns username if valid."""
    if not token or ":" not in token:
        return None
    parts = token.split(":")
    if len(parts) != 3:
        return None
    username, timestamp_str, sig = parts
    try:
        timestamp = int(timestamp_str)
    except ValueError:
        return None

    now = int(time.time())
    if now - timestamp > settings.SESSION_MAX_AGE_SECONDS or timestamp > now + 60:
        return None

    secret = _get_session_secret()
    expected_sig = hmac.new(secret, f"{username}:{timestamp_str}".encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(sig, expected_sig):
        return None

    return username

def generate_csrf_token() -> str:
    return secrets.token_urlsafe(32)

def verify_csrf(request: Request) -> None:
    """Verify CSRF token for mutating HTTP verbs."""
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return
    cookie_csrf = request.cookies.get("csrf_token")
    header_csrf = request.headers.get("X-CSRF-Token")
    if not cookie_csrf or not header_csrf or not hmac.compare_digest(cookie_csrf, header_csrf):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF token validation failed.",
        )
