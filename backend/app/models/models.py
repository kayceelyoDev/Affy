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

# -------------------------------------------------------------
# B4: ORDERS, SALES, UPLOADS, EXTRACTIONS & AI USAGE
# -------------------------------------------------------------

class Post(Base):
    __tablename__ = "posts"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("products.id"), index=True, nullable=True)
    render_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    buffer_post_id: Mapped[Optional[str]] = mapped_column(String(64), unique=True, index=True, nullable=True)
    tiktok_video_id: Mapped[Optional[str]] = mapped_column(String(64), unique=True, index=True, nullable=True)
    caption: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    caption_fingerprint: Mapped[Optional[str]] = mapped_column(String(64), index=True, nullable=True)
    hook_style: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    style_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    media_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    mode: Mapped[str] = mapped_column(String(32), default="queue") # queue, exact
    scheduled_for: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    posted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="draft") # draft, scheduled, published, failed
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    extra_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    product: Mapped[Optional["Product"]] = relationship("Product")

class Order(Base):
    __tablename__ = "orders"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False) # TEXT, strictly 10-22 digits
    status_stage: Mapped[str] = mapped_column(String(64), index=True, default="unpaid") # unpaid, to_ship, shipped, delivered, settled, cancelled, refunded
    product_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("products.id"), index=True, nullable=True)
    product_name_raw: Mapped[str] = mapped_column(String(255), nullable=False)
    price: Mapped[float] = mapped_column(Float, default=0.0)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    gmv: Mapped[float] = mapped_column(Float, default=0.0)
    commission_rate: Mapped[float] = mapped_column(Float, default=0.10)
    est_commission: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    actual_commission: Mapped[Optional[float]] = mapped_column(Float, nullable=True) # Null if unsettled
    settle_date_est: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    settle_date_changes: Mapped[int] = mapped_column(Integer, default=0)
    is_shop_ads: Mapped[bool] = mapped_column(Boolean, default=False)
    matched_post_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("posts.id"), nullable=True)
    confidence: Mapped[float] = mapped_column(Float, default=1.0)
    order_date: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    extra_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    product: Mapped[Optional["Product"]] = relationship("Product")
    matched_post: Mapped[Optional["Post"]] = relationship("Post")

class SalesDaily(Base):
    __tablename__ = "sales_daily"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    date: Mapped[str] = mapped_column(String(16), index=True, nullable=False) # YYYY-MM-DD
    product_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("products.id"), index=True, nullable=True)
    orders_count: Mapped[int] = mapped_column(Integer, default=0)
    gmv: Mapped[float] = mapped_column(Float, default=0.0)
    est_commission: Mapped[float] = mapped_column(Float, default=0.0)
    settled_commission: Mapped[float] = mapped_column(Float, default=0.0)
    refunds_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class Upload(Base):
    __tablename__ = "uploads"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    file_hash: Mapped[str] = mapped_column(String(64), index=True, nullable=False) # SHA256
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(64), default="unknown") # image_orders, image_products, spreadsheet_orders, spreadsheet_content
    storage_path: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="pending") # pending, processing, completed, review_required, failed
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    extractions: Mapped[List["Extraction"]] = relationship("Extraction", back_populates="upload", cascade="all, delete-orphan")

class Extraction(Base):
    __tablename__ = "extractions"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    upload_id: Mapped[int] = mapped_column(Integer, ForeignKey("uploads.id"), index=True, nullable=False)
    image_index: Mapped[int] = mapped_column(Integer, default=0)
    model_used: Mapped[str] = mapped_column(String(64), default="gemini-1.5-flash")
    prompt_version: Mapped[str] = mapped_column(String(32), default="v1.0")
    raw_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    confidence: Mapped[float] = mapped_column(Float, default=1.0)
    review_status: Mapped[str] = mapped_column(String(32), default="auto_approved") # auto_approved, pending_review, manually_approved, rejected
    order_id_extracted: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    upload: Mapped["Upload"] = relationship("Upload", back_populates="extractions")

class AIUsage(Base):
    __tablename__ = "ai_usage"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    model: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    key_label: Mapped[str] = mapped_column(String(64), default="default")
    task: Mapped[str] = mapped_column(String(64), default="vision_extraction")
    day: Mapped[str] = mapped_column(String(16), index=True, nullable=False) # YYYY-MM-DD
    requests_count: Mapped[int] = mapped_column(Integer, default=0)
    tokens_input: Mapped[int] = mapped_column(Integer, default=0)
    tokens_output: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# -------------------------------------------------------------
# B5: METRICS, SCORECARDS & API USAGE
# -------------------------------------------------------------

class PostMetricDaily(Base):
    __tablename__ = 'post_metrics_daily'
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    post_id: Mapped[int] = mapped_column(Integer, ForeignKey('posts.id'), index=True, nullable=False)
    date: Mapped[str] = mapped_column(String(16), index=True, nullable=False) # YYYY-MM-DD
    views: Mapped[int] = mapped_column(Integer, default=0)
    likes: Mapped[int] = mapped_column(Integer, default=0)
    comments: Mapped[int] = mapped_column(Integer, default=0)
    shares: Mapped[int] = mapped_column(Integer, default=0)
    source: Mapped[str] = mapped_column(String(32), default='buffer') # buffer, tiktok_display, csv
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    post: Mapped['Post'] = relationship('Post')

class Scorecard(Base):
    __tablename__ = 'scorecards'
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    period: Mapped[str] = mapped_column(String(32), index=True, default='weekly')
    product_id: Mapped[int] = mapped_column(Integer, ForeignKey('products.id'), index=True, nullable=False)
    score: Mapped[float] = mapped_column(Float, default=0.0)
    tier: Mapped[str] = mapped_column(String(32), default='TEST') # SCALE, STEADY, TEST, COOLDOWN
    trend: Mapped[str] = mapped_column(String(32), default='NEW') # UP, DOWN, STABLE, NEW
    components_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    profile_version: Mapped[str] = mapped_column(String(16), default='v1') # v1, v2
    explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    product: Mapped['Product'] = relationship('Product')

class APIUsage(Base):
    __tablename__ = 'api_usage'
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    service: Mapped[str] = mapped_column(String(64), index=True, nullable=False) # buffer, tiktok, etc.
    day: Mapped[str] = mapped_column(String(16), index=True, nullable=False) # YYYY-MM-DD
    requests_count: Mapped[int] = mapped_column(Integer, default=0)
    remaining_from_headers: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    reset_timestamp: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# -------------------------------------------------------------
# B6: PLANS & DAILY SLOTS
# -------------------------------------------------------------

class Plan(Base):
    __tablename__ = 'plans'
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    date: Mapped[str] = mapped_column(String(16), unique=True, index=True, nullable=False) # YYYY-MM-DD
    status: Mapped[str] = mapped_column(String(32), default='draft') # draft, approved, in_progress, completed
    dry_run: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    slots: Mapped[List['PlanSlot']] = relationship('PlanSlot', back_populates='plan', cascade='all, delete-orphan')

class PlanSlot(Base):
    __tablename__ = 'plan_slots'
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    plan_id: Mapped[int] = mapped_column(Integer, ForeignKey('plans.id'), index=True, nullable=False)
    slot_index: Mapped[int] = mapped_column(Integer, nullable=False) # 0 to 5
    scheduled_time: Mapped[str] = mapped_column(String(8), default='09:00')
    product_id: Mapped[int] = mapped_column(Integer, ForeignKey('products.id'), index=True, nullable=False)
    style_id: Mapped[str] = mapped_column(String(64), default='style_1_classic_hook')
    hook_style: Mapped[str] = mapped_column(String(64), default='Classic Hook')
    hook_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reason: Mapped[str] = mapped_column(Text, default='Strategy allocation')
    locked: Mapped[bool] = mapped_column(Boolean, default=False)
    source: Mapped[str] = mapped_column(String(32), default='rules') # rules, ai, user
    status: Mapped[str] = mapped_column(String(32), default='pending') # pending, approved, rendered, published, skipped
    render_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    post_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey('posts.id'), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    plan: Mapped['Plan'] = relationship('Plan', back_populates='slots')
    product: Mapped['Product'] = relationship('Product')
    post: Mapped[Optional['Post']] = relationship('Post')

# -------------------------------------------------------------
# B7: RENDERS, MUSIC TRACKS & CLIP CAPTIONS
# -------------------------------------------------------------

class RenderJob(Base):
    __tablename__ = 'render_jobs'
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    plan_slot_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey('plan_slots.id'), nullable=True)
    product_id: Mapped[int] = mapped_column(Integer, ForeignKey('products.id'), index=True, nullable=False)
    style_id: Mapped[str] = mapped_column(String(64), default='classic_hook')
    title: Mapped[str] = mapped_column(String(255), default='')
    subtitle: Mapped[str] = mapped_column(String(255), default='')
    status: Mapped[str] = mapped_column(String(32), default='pending') # pending, rendering, completed, failed
    progress_pct: Mapped[int] = mapped_column(Integer, default=0)
    output_path: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    duration: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    clips_count: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    log_tail: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    product: Mapped['Product'] = relationship('Product')
    plan_slot: Mapped[Optional['PlanSlot']] = relationship('PlanSlot')

class Track(Base):
    __tablename__ = 'tracks'
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_path: Mapped[str] = mapped_column(String(512), nullable=False)
    duration: Mapped[float] = mapped_column(Float, default=0.0)
    bpm: Mapped[float] = mapped_column(Float, default=120.0)
    beats_count: Mapped[int] = mapped_column(Integer, default=0)
    beats_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tags: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    safe_to_use: Mapped[bool] = mapped_column(Boolean, default=True)
    source_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    license_note: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class ClipCaption(Base):
    __tablename__ = 'clip_captions'
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    clip_id: Mapped[int] = mapped_column(Integer, ForeignKey('clips.id'), index=True, nullable=False)
    product_id: Mapped[int] = mapped_column(Integer, ForeignKey('products.id'), index=True, nullable=False)
    language: Mapped[str] = mapped_column(String(16), default='en')
    caption_text: Mapped[str] = mapped_column(String(255), nullable=False)
    model_used: Mapped[str] = mapped_column(String(64), default='gemini-1.5-flash')
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    clip: Mapped['Clip'] = relationship('Clip')
    product: Mapped['Product'] = relationship('Product')
