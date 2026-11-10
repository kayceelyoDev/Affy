from typing import List, Optional, Dict, Any, Tuple
from pydantic import BaseModel, Field

class CanvasConfig(BaseModel):
    width: int = 1080
    height: int = 1920
    fps: int = 30
    crf: int = 20
    preset: str = "veryfast"
    pixel_format: str = "yuv420p"

class ClipRules(BaseModel):
    min_count: int = 2
    max_count: int = 15
    target_seg: float = 2.2
    min_duration: float = 10.0
    max_duration: float = 28.0
    crop_mode: str = "cover"  # "cover" (scale+crop) or "contain_blur" (blurred background)

class CutLogic(BaseModel):
    mode: str = "beat_synced"  # "beat_synced" or "fixed"
    fixed_duration: float = 2.0
    beats_per_cut: Optional[int] = None

class TransitionItem(BaseModel):
    type: str = "none"  # "none", "fade", "dissolve", "slideleft", "zoomin", "wipeleft"
    duration: float = 0.3
    weight: float = 1.0

class TransitionConfig(BaseModel):
    enabled: bool = False
    transitions: List[TransitionItem] = Field(default_factory=list)

class TextLayerConfig(BaseModel):
    name: str = "title"  # "title", "subtitle", "cta", "clip_caption"
    font_file: str = "fonts/Anton-Regular.ttf"
    color: str = "0xEFD34C"
    stroke_color: str = "black@0.9"
    stroke_width: int = 2
    position_y: int = 230
    max_size: int = 125
    width_ratio: float = 0.78
    box: bool = False
    box_color: str = ""
    box_border_w: int = 0
    animation: str = "none"  # "none", "fade_out_2s", "karaoke"

class GraphicConfig(BaseModel):
    name: str
    asset_path: str
    x: str = "(w-overlay_w)/2"
    y: str = "h-overlay_h-100"
    start_time: float = 0.0
    end_time: float = 999.0
    animation: str = "none"

class MotionConfig(BaseModel):
    type: str = "none"  # "none", "zoom_punch", "ken_burns", "slow_zoom"
    intensity: float = 1.0

class AudioConfig(BaseModel):
    target_lufs: float = -14.0
    fade_out_sec: float = 1.2
    ducking: bool = False
    normalize: bool = True

class StyleSpec(BaseModel):
    id: str
    name: str
    version: str = "1.0"
    description: str = ""
    canvas: CanvasConfig = Field(default_factory=CanvasConfig)
    clip_rules: ClipRules = Field(default_factory=ClipRules)
    cut_logic: CutLogic = Field(default_factory=CutLogic)
    transitions: TransitionConfig = Field(default_factory=TransitionConfig)
    text_layers: List[TextLayerConfig] = Field(default_factory=list)
    graphics: List[GraphicConfig] = Field(default_factory=list)
    motion: MotionConfig = Field(default_factory=MotionConfig)
    audio: AudioConfig = Field(default_factory=AudioConfig)
