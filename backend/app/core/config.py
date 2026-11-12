import os
from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Affiliate Autopilot"
    PROJECT_VERSION: str = "0.1.0"
    ENVIRONMENT: str = "production"
    DEBUG: bool = False
    DEMO_MODE: bool = False
    
    # Server & Network
    HOST: str = "0.0.0.0"
    PORT: int = 8090
    CORS_ORIGINS: list[str] = [
        "http://localhost:8090",
        "http://127.0.0.1:8090",
        "http://localhost:8091",
        "http://127.0.0.1:8091",
        "http://192.168.1.7:8090",
        "http://192.168.1.7:8091",
    ]
    
    # Paths
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent.parent
    DATA_DIR: Path = Path(os.getenv("DATA_DIR", str(BASE_DIR / "data")))
    DB_PATH: Path = DATA_DIR / "autopilot.db"
    VAULT_KEY_PATH: Path = DATA_DIR / ".vault.key"
    SESSION_KEY_PATH: Path = DATA_DIR / ".session.key"
    
    # Regional defaults
    TIMEZONE: str = "Asia/Manila"
    CURRENCY: str = "PHP"
    LOCALE: str = "en_PH"
    
    # Security
    SESSION_MAX_AGE_SECONDS: int = 86400 * 7  # 7 days
    LOGIN_RATE_LIMIT_PER_MINUTE: int = 5
    
    @property
    def DATABASE_URL(self) -> str:
        return f"sqlite+aiosqlite:///{self.DB_PATH.as_posix()}"

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()

# Ensure data directory exists
settings.DATA_DIR.mkdir(parents=True, exist_ok=True)
