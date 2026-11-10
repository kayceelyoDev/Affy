from datetime import datetime
from typing import Optional, List
from sqlalchemy import String, Integer, Float, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.core.database import Base

class User(Base):
    __tablename__ = "users"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

class Setting(Base):
    __tablename__ = "settings"
    
    key: Mapped[str] = mapped_column(String(128), primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    is_secret: Mapped[bool] = mapped_column(Boolean, default=False)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class SecretVault(Base):
    __tablename__ = "secrets_vault"
    
    key: Mapped[str] = mapped_column(String(128), primary_key=True)
    ciphertext: Mapped[str] = mapped_column(Text, nullable=False)  # Base64 encoded
    nonce: Mapped[str] = mapped_column(String(64), nullable=False)       # Base64 encoded
    tag: Mapped[str] = mapped_column(String(64), nullable=False)         # Base64 encoded
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Schedule(Base):
    __tablename__ = "schedules"
    
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    cron_expression: Mapped[str] = mapped_column(String(64), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    timezone: Mapped[str] = mapped_column(String(64), default="Asia/Manila")
    next_run_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_run_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_status: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)

class Run(Base):
    __tablename__ = "runs"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    job_name: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    trigger_type: Mapped[str] = mapped_column(String(32), default="scheduled")
    status: Mapped[str] = mapped_column(String(32), default="pending", index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    logs: Mapped[List["RunLog"]] = relationship("RunLog", back_populates="run", cascade="all, delete-orphan")

class RunLog(Base):
    __tablename__ = "run_logs"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[str] = mapped_column(String(36), ForeignKey("runs.id"), index=True, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    level: Mapped[str] = mapped_column(String(16), default="INFO")
    message: Mapped[str] = mapped_column(Text, nullable=False)
    
    run: Mapped["Run"] = relationship("Run", back_populates="logs")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    actor: Mapped[str] = mapped_column(String(64), default="system")
    details_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

# -------------------------------------------------------------
# B3: CATALOG, PRODUCTS, CLIPS & ALIASES
# -------------------------------------------------------------

class Product(Base):
    __tablename__ = "products"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    category: Mapped[str] = mapped_column(String(64), index=True, default="General")
    folder_path: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    commission_rate: Mapped[float] = mapped_column(Float, default=0.10)
    margin_rate: Mapped[float] = mapped_column(Float, default=0.30)
    target_demographic: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    hook_ideas: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    clips: Mapped[List["Clip"]] = relationship("Clip", back_populates="product", cascade="all, delete-orphan")
    aliases: Mapped[List["Alias"]] = relationship("Alias", back_populates="product")

class Clip(Base):
    __tablename__ = "clips"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(Integer, ForeignKey("products.id"), index=True, nullable=False)
    file_path: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    filename: Mapped[str] = mapped_column(String(128), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    duration_seconds: Mapped[float] = mapped_column(Float, default=0.0)
    width: Mapped[int] = mapped_column(Integer, default=1080)
    height: Mapped[int] = mapped_column(Integer, default=1920)
    fps: Mapped[float] = mapped_column(Float, default=30.0)
    codec: Mapped[str] = mapped_column(String(32), default="h264")
    is_hdr: Mapped[bool] = mapped_column(Boolean, default=False)
    has_audio: Mapped[bool] = mapped_column(Boolean, default=True)
    is_silent: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(32), default="usable") # usable, damaged, archived
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    product: Mapped["Product"] = relationship("Product", back_populates="clips")
    tags: Mapped[List["ClipTag"]] = relationship("ClipTag", back_populates="clip", cascade="all, delete-orphan")

class Alias(Base):
    __tablename__ = "aliases"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("products.id"), index=True, nullable=True)
    raw_alias: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    normalized_alias: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=1.0)
    status: Mapped[str] = mapped_column(String(32), default="linked") # linked, pending_review, rejected
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    product: Mapped[Optional["Product"]] = relationship("Product", back_populates="aliases")

class ClipTag(Base):
    __tablename__ = "clip_tags"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    clip_id: Mapped[int] = mapped_column(Integer, ForeignKey("clips.id"), index=True, nullable=False)
    tag: Mapped[str] = mapped_column(String(64), index=True, nullable=False)

    clip: Mapped["Clip"] = relationship("Clip", back_populates="tags")
