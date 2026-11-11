import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Button, Card, Input, Badge } from '../components/ui';
import {
  Play,
  Pause,
  Sliders,
  Check,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  Folder,
  Music,
  Save,
  Plus,
  Trash2,
  X,
  Sparkles,
  Film,
  Lock,
  Layers,
  Zap,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Scissors,
  Copy,
  Volume2,
  VolumeX,
  Upload,
  Eye,
  Download,
} from 'lucide-react';
import { api } from '../api/client';

export interface ClipItem {
  id: number;
  product_id: number;
  filename: string;
  file_path: string;
  duration: number;
  resolution?: string;
  fps?: number;
  codec?: string;
  status?: string;
  tags?: string;
}

interface TextLayerConfig {
  name: string;
  font_file?: string;
  color: string;
  stroke_color?: string;
  stroke_width?: number;
  position_y: number;
  max_size: number;
  width_ratio?: number;
  box?: boolean;
  box_color?: string;
  box_border_w?: number;
  animation?: string;
}

interface StyleSpecData {
  id: string;
  name: string;
  description: string;
  crop_mode: string;
  cut_mode: string;
  transitions_enabled: boolean;
  is_default?: boolean;
  is_custom?: boolean;
  spec: {
    id?: string;
    name?: string;
    description?: string;
    canvas?: any;
    clip_rules?: any;
    cut_logic?: any;
    transitions?: any;
    text_layers?: TextLayerConfig[];
    graphics?: any[];
    motion?: any;
    audio?: any;
  };
}

export interface TimelineSlotData {
  slot_index: number;
  duration: number;
  transition: 'snap_zoom' | 'whip_left' | 'whip_right' | 'swish_up' | 'dissolve' | 'none';
  motion: 'zoom_punch' | 'macro_focus' | 'overview' | 'float_drift' | 'slow_zoom' | 'none';
  crop_mode: 'auto' | 'contain_blur' | 'cover';
  label?: string;
  clip_id?: number;
  clip_path?: string;
  clip_filename?: string;
}

export interface TemplateData {
  id: string;
  name: string;
  description?: string;
  fixed_music_track: string;
  base_style_id: string;
  crop_mode: string;
  title_color: string;
  title_font_size: number;
  title_y: number;
  subtitle_color: string;
  subtitle_font_size: number;
  subtitle_y: number;
  target_duration: number;
  is_default?: boolean;
  is_custom?: boolean;
  slots?: TimelineSlotData[];
}

interface ProductItem {
  id: number;
  name: string;
  category?: string;
  commission_rate?: number;
  clip_count?: number;
}

interface MusicTrackItem {
  id: string;
  filename: string;
  name: string;
  size_kb: number;
}

const PRESET_COLORS = [
  { name: 'TikTok Yellow', hex: '#EFD34C' },
  { name: 'Pure White', hex: '#FFFFFF' },
  { name: 'Punchy Red', hex: '#FF3B30' },
  { name: 'Neon Cyan', hex: '#00F0FF' },
  { name: 'Vibrant Green', hex: '#30D158' },
  { name: 'Orange Pop', hex: '#FF9500' },
];

const TRANSITION_OPTIONS = [
  { id: 'snap_zoom', label: 'Snap Zoom', desc: 'Kinetic ease-out punch entry', icon: Zap },
  { id: 'whip_left', label: 'Whip Left', desc: 'Lateral whip pan from right', icon: ArrowLeft },
  { id: 'whip_right', label: 'Whip Right', desc: 'Lateral whip pan from left', icon: ArrowRight },
  { id: 'swish_up', label: 'Swish Up', desc: 'Vertical upward swish', icon: ArrowUp },
  { id: 'dissolve', label: 'Film Dissolve', desc: 'Soft film crossfade dissolve', icon: Sparkles },
  { id: 'none', label: 'Hard Cut', desc: 'Instant cut without transition', icon: Scissors },
];

const MOTION_OPTIONS = [
  { id: 'zoom_punch', label: 'Zoom Punch', desc: 'Beat-synced dynamic punch' },
  { id: 'macro_focus', label: 'Macro Detail Focus', desc: 'Forward push on textures & buttons' },
  { id: 'overview', label: 'Overview Pullback', desc: 'Cinematic pull-back reveal' },
  { id: 'float_drift', label: 'Float Drift', desc: 'Continuous silky luxury gimbal glide' },
  { id: 'slow_zoom', label: 'Slow Zoom', desc: 'Gentle creeping push-in' },
  { id: 'none', label: 'Steady (None)', desc: 'Static locked frame' },
];

export const StyleStudioPage: React.FC = () => {
  // Main Studio Mode Switcher: Templates vs Universal Styles
  const [studioMode, setStudioMode] = useState<'templates' | 'styles'>('templates');

  // Templates State
  const [templates, setTemplates] = useState<TemplateData[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateData | null>(null);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number>(0);
  const [showNewTemplateModal, setShowNewTemplateModal] = useState(false);
  const [newTplName, setNewTplName] = useState('');
  const [newTplMusic, setNewTplMusic] = useState('downloadsv2 (1).mp3');
  const [newTplBase, setNewTplBase] = useState('punchy_zoom');
  const [newTplCrop, setNewTplCrop] = useState('auto');

  // Styles State
  const [styles, setStyles] = useState<StyleSpecData[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<StyleSpecData | null>(null);
  const [showNewStyleModal, setShowNewStyleModal] = useState(false);
  const [newStyleName, setNewStyleName] = useState('');
  const [newStyleBase, setNewStyleBase] = useState('punchy_zoom');

  // Shared Data
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [musicTracks, setMusicTracks] = useState<MusicTrackItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [selectedMusicTrack, setSelectedMusicTrack] = useState<string>('random');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [settingDefaultLoading, setSettingDefaultLoading] = useState(false);
  const [savingLoading, setSavingLoading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [titleText, setTitleText] = useState('ATTACK SHARK X11');
  const [subtitleText, setSubtitleText] = useState('VIRAL WIRELESS GAMING MOUSE');
  const [actionAlert, setActionAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Product clips & Real-time Playback State
  const [productClips, setProductClips] = useState<ClipItem[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [previewMode, setPreviewMode] = useState<'realtime' | 'rendered'>('realtime');
  const [showClipPickerModal, setShowClipPickerModal] = useState(false);
  const [clipPickerSlotIndex, setClipPickerSlotIndex] = useState<number | null>(null);
  const [uploadingClip, setUploadingClip] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const timelineTrackRef = useRef<HTMLDivElement>(null);
  const clipFileInputRef = useRef<HTMLInputElement>(null);

  // Phone Canvas Dragging State
  const phoneCanvasRef = useRef<HTMLDivElement>(null);
  const [draggingLayer, setDraggingLayer] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates();
    fetchStyles();
    fetchProducts();
    fetchMusicTracks();
  }, []);

  const fetchTemplates = async () => {
    try {
      const data = await api.get<TemplateData[]>('/api/styles/templates');
      const list = data || [];
      setTemplates(list);
      if (list.length > 0 && !selectedTemplate) {
        const def = list.find((t) => t.is_default) || list[0];
        setSelectedTemplate(def);
        setSelectedSlotIndex(0);
      }
    } catch (err) {
      console.error('Failed to load templates', err);
    }
  };

  const fetchStyles = async () => {
    try {
      const data = await api.get<StyleSpecData[]>('/api/styles');
      const list = data || [];
      setStyles(list);
      if (list.length > 0 && !selectedStyle) {
        const def = list.find((s) => s.is_default) || list[0];
        setSelectedStyle(def);
      }
    } catch (err) {
      console.error('Failed to load styles', err);
    }
  };

  const fetchProducts = async () => {
    try {
      const prods = await api.get<ProductItem[]>('/api/catalog/products');
      if (prods && prods.length > 0) {
        setProducts(prods);
        const defaultProd = prods.find((p) => (p.clip_count || 0) > 0) || prods[0];
        setSelectedProductId(defaultProd.id);
        fetchProductClips(defaultProd.id);
        setTitleText(defaultProd.name.split('-')[0].trim());
        setSubtitleText('VIRAL MUST-HAVE DEAL');
      }
    } catch (err) {
      console.error('Failed to load products', err);
    }
  };

  const fetchProductClips = async (prodId: number) => {
    try {
      const clips = await api.get<ClipItem[]>(`/api/catalog/products/${prodId}/clips`);
      setProductClips(clips || []);
    } catch (err) {
      console.error('Failed to load product clips', err);
    }
  };

  const fetchMusicTracks = async () => {
    try {
      const tracks = await api.get<MusicTrackItem[]>('/api/styles/music-tracks');
      if (tracks) {
        setMusicTracks(tracks);
        if (tracks.length > 0) {
          setNewTplMusic(tracks[0].filename);
        }
      }
    } catch (err) {
      console.error('Failed to load music tracks', err);
    }
  };

  const handleProductSelect = (prodId: number) => {
    setSelectedProductId(prodId);
    fetchProductClips(prodId);
    const prod = products.find((p) => p.id === prodId);
    if (prod) {
      const cleanTitle = prod.name.length > 28 ? prod.name.split('-')[0].trim() : prod.name;
      setTitleText(cleanTitle);
      setSubtitleText('LIMITED TIME CREATOR DEAL');
    }
  };

  const handleSelectTemplate = (tpl: TemplateData) => {
    setSelectedTemplate(tpl);
    setSelectedSlotIndex(0);
    setHasUnsavedChanges(false);
    setPreviewUrl(null);
  };

  const handleSelectStyle = (s: StyleSpecData) => {
    setSelectedStyle(s);
    setHasUnsavedChanges(false);
    setPreviewUrl(null);
  };

  const normalizeHexColor = (colorStr?: string) => {
    if (!colorStr) return '#FFFFFF';
    if (colorStr.startsWith('0x')) return '#' + colorStr.slice(2);
    if (colorStr.startsWith('#')) return colorStr;
    if (colorStr.toLowerCase() === 'white') return '#FFFFFF';
    if (colorStr.toLowerCase() === 'black') return '#000000';
    if (colorStr.toLowerCase() === 'yellow') return '#EFD34C';
    if (colorStr.toLowerCase() === 'red') return '#FF3B30';
    return colorStr;
  };

  const formatColorForFFmpeg = (hex: string) => {
    if (hex.startsWith('#')) {
      return '0x' + hex.slice(1).toUpperCase();
    }
    return hex;
  };

  // ------------------ REAL-TIME PLAYBACK & TIMELINE CALCULATIONS ------------------
  const currentTemplateSlots = selectedTemplate?.slots || [];

  const slotRanges = useMemo(() => {
    let accumulated = 0;
    return currentTemplateSlots.map((slot, index) => {
      const start = accumulated;
      const end = accumulated + slot.duration;
      accumulated = end;
      // Resolve clip path: explicitly assigned or modulo default from productClips
      const fallbackClip = productClips.length > 0 ? productClips[index % productClips.length] : null;
      const assignedPath = slot.clip_path || (fallbackClip ? fallbackClip.file_path : '');
      const assignedFilename = slot.clip_filename || (fallbackClip ? fallbackClip.filename : `Clip #${index + 1}`);
      return {
        index,
        start,
        end,
        duration: slot.duration,
        slot,
        clipPath: assignedPath,
        clipFilename: assignedFilename,
      };
    });
  }, [currentTemplateSlots, productClips]);

  const currentTotalDuration = useMemo(() => {
    if (slotRanges.length === 0) return selectedTemplate?.target_duration || 6.0;
    return Math.round(slotRanges[slotRanges.length - 1].end * 10) / 10;
  }, [slotRanges, selectedTemplate]);

  // Active slot based on currentTime
  const activeSlotRange = useMemo(() => {
    if (slotRanges.length === 0) return null;
    const found = slotRanges.find((r) => currentTime >= r.start && currentTime < r.end);
    return found || slotRanges[slotRanges.length - 1];
  }, [slotRanges, currentTime]);

  const activeSlotLocalTime = activeSlotRange ? Math.max(0, currentTime - activeSlotRange.start) : 0;
  const isEnteringSlot = activeSlotLocalTime < 0.35;

  // Video source sync
  useEffect(() => {
    if (!videoRef.current || !activeSlotRange?.clipPath) return;
    const targetSrc = `/api/storage/preview/${encodeURIComponent(activeSlotRange.clipPath)}`;
    const currentVideoSrc = videoRef.current.getAttribute('data-src');

    if (currentVideoSrc !== targetSrc) {
      videoRef.current.setAttribute('data-src', targetSrc);
      videoRef.current.src = targetSrc;
      videoRef.current.currentTime = activeSlotLocalTime;
      if (isPlaying) {
        videoRef.current.play().catch(() => {});
      }
    } else {
      if (Math.abs(videoRef.current.currentTime - activeSlotLocalTime) > 0.35) {
        videoRef.current.currentTime = activeSlotLocalTime;
      }
    }
  }, [activeSlotRange?.clipPath, Math.floor(activeSlotLocalTime * 2)]);

  // Animation frame loop for real-time playhead progression
  useEffect(() => {
    if (!isPlaying) {
      if (videoRef.current) videoRef.current.pause();
      if (audioRef.current) audioRef.current.pause();
      return;
    }

    let animationId: number;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      setCurrentTime((prev) => {
        const next = prev + delta;
        if (next >= currentTotalDuration) {
          // Loop back seamlessly to start
          if (videoRef.current) {
            videoRef.current.currentTime = 0;
            videoRef.current.play().catch(() => {});
          }
          if (audioRef.current) {
            audioRef.current.currentTime = 0;
            if (!isMuted) audioRef.current.play().catch(() => {});
          }
          return 0;
        }
        return next;
      });

      animationId = requestAnimationFrame(loop);
    };

    if (videoRef.current && videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
    }
    if (audioRef.current && !isMuted) {
      if (Math.abs(audioRef.current.currentTime - currentTime) > 0.3) {
        audioRef.current.currentTime = currentTime;
      }
      if (audioRef.current.paused) {
        audioRef.current.play().catch(() => {});
      }
    }

    animationId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationId);
  }, [isPlaying, currentTotalDuration, isMuted]);

  // Audio track update
  useEffect(() => {
    if (!audioRef.current) return;
    if (selectedTemplate?.fixed_music_track) {
      audioRef.current.src = `/api/styles/music-stream/${encodeURIComponent(selectedTemplate.fixed_music_track)}`;
      audioRef.current.currentTime = currentTime;
      if (isPlaying && !isMuted) {
        audioRef.current.play().catch(() => {});
      }
    }
  }, [selectedTemplate?.fixed_music_track]);

  // Spacebar play/pause shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSeek = (newTime: number) => {
    const clamped = Math.max(0, Math.min(newTime, currentTotalDuration));
    setCurrentTime(clamped);
    if (audioRef.current) {
      audioRef.current.currentTime = clamped;
    }
    const targetRange = slotRanges.find((r) => clamped >= r.start && clamped < r.end) || slotRanges[slotRanges.length - 1];
    if (targetRange) {
      setSelectedSlotIndex(targetRange.index);
      if (videoRef.current) {
        videoRef.current.currentTime = Math.max(0, clamped - targetRange.start);
      }
    }
  };

  const handleTimelineMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineTrackRef.current) return;
    const rect = timelineTrackRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    handleSeek(ratio * currentTotalDuration);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const moveX = moveEvent.clientX - rect.left;
      const moveRatio = Math.max(0, Math.min(1, moveX / rect.width));
      handleSeek(moveRatio * currentTotalDuration);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleSplitSlotAtPlayhead = () => {
    if (!selectedTemplate || !selectedTemplate.slots || !activeSlotRange) return;
    const splitOffset = currentTime - activeSlotRange.start;
    const remaining = activeSlotRange.duration - splitOffset;

    if (splitOffset < 0.25 || remaining < 0.25) {
      setActionAlert({
        type: 'error',
        message: 'Cannot cut: playhead must be at least 0.3s from clip edges.',
      });
      return;
    }

    const currentSlots = selectedTemplate.slots;
    const targetSlot = currentSlots[activeSlotRange.index];
    const dur1 = Math.round(splitOffset * 10) / 10;
    const dur2 = Math.round(remaining * 10) / 10;

    const slot1: TimelineSlotData = {
      ...targetSlot,
      duration: dur1,
      label: targetSlot.label ? `${targetSlot.label} A` : `Cut ${activeSlotRange.index + 1}A`,
    };
    const slot2: TimelineSlotData = {
      ...targetSlot,
      slot_index: activeSlotRange.index + 1,
      duration: dur2,
      label: targetSlot.label ? `${targetSlot.label} B` : `Cut ${activeSlotRange.index + 1}B`,
    };

    const newSlots = [
      ...currentSlots.slice(0, activeSlotRange.index),
      slot1,
      slot2,
      ...currentSlots.slice(activeSlotRange.index + 1),
    ].map((s, i) => ({ ...s, slot_index: i }));

    const totalDur = newSlots.reduce((acc, curr) => acc + curr.duration, 0);
    const updatedTpl = {
      ...selectedTemplate,
      slots: newSlots,
      target_duration: Math.round(totalDur * 10) / 10,
    };

    setSelectedTemplate(updatedTpl);
    setTemplates((prev) => prev.map((t) => (t.id === updatedTpl.id ? updatedTpl : t)));
    setHasUnsavedChanges(true);
    setSelectedSlotIndex(activeSlotRange.index + 1);
    setActionAlert({
      type: 'success',
      message: `Cut clip at ${currentTime.toFixed(1)}s into ${dur1}s and ${dur2}s cuts!`,
    });
  };

  const handleAssignClip = (slotIdx: number, clip: ClipItem) => {
    handleUpdateSlot(slotIdx, {
      clip_id: clip.id,
      clip_path: clip.file_path,
      clip_filename: clip.filename,
      label: clip.filename.replace(/\.[^/.]+$/, ''),
    });
    setShowClipPickerModal(false);
    setActionAlert({
      type: 'success',
      message: `Assigned "${clip.filename}" to Slot #${slotIdx + 1}!`,
    });
  };

  const handleUploadClip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProductId) return;
    setUploadingClip(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.post(`/api/catalog/products/${selectedProductId}/clips/upload`, formData);
      await fetchProductClips(selectedProductId);
      setActionAlert({ type: 'success', message: `Uploaded "${file.name}" to product clips!` });
    } catch (err: any) {
      setActionAlert({ type: 'error', message: 'Upload failed: ' + (err.message || 'Unknown error') });
    } finally {
      setUploadingClip(false);
      if (clipFileInputRef.current) clipFileInputRef.current.value = '';
    }
  };

  const getSlotMotionStyle = () => {
    if (!activeSlotRange) return {};
    const motion = activeSlotRange.slot.motion;
    const dur = activeSlotRange.duration || 1.0;
    const progress = Math.min(1, activeSlotLocalTime / dur);

    let baseTransform = '';
    if (motion === 'zoom_punch') {
      const scale = 1.05 + progress * 0.1;
      baseTransform = `scale(${scale})`;
    } else if (motion === 'macro_focus') {
      baseTransform = 'scale(1.18)';
    } else if (motion === 'float_drift') {
      const x = Math.sin(progress * Math.PI) * 2;
      const y = Math.cos(progress * Math.PI) * 1.5;
      baseTransform = `translate(${x}%, ${y}%) scale(1.05)`;
    } else if (motion === 'slow_zoom') {
      const scale = 1.0 + progress * 0.08;
      baseTransform = `scale(${scale})`;
    } else {
      baseTransform = 'scale(1.0)';
    }

    let transitionTransform = '';
    let opacity = 1.0;
    if (isEnteringSlot) {
      const tProgress = activeSlotLocalTime / 0.35;
      const t = activeSlotRange.slot.transition;
      if (t === 'snap_zoom') {
        const s = 1.25 - tProgress * 0.25;
        transitionTransform = `scale(${s})`;
      } else if (t === 'whip_left') {
        const tx = (1 - tProgress) * 35;
        transitionTransform = `translateX(${tx}%)`;
      } else if (t === 'whip_right') {
        const tx = (1 - tProgress) * -35;
        transitionTransform = `translateX(${tx}%)`;
      } else if (t === 'swish_up') {
        const ty = (1 - tProgress) * 35;
        transitionTransform = `translateY(${ty}%)`;
      } else if (t === 'dissolve') {
        opacity = 0.2 + tProgress * 0.8;
      }
    }

    return {
      transform: transitionTransform || baseTransform,
      opacity,
      transition: isEnteringSlot ? 'none' : 'transform 0.1s linear',
    };
  };

  // ------------------ TEMPLATE TIMELINE SLOT ACTIONS ------------------

  const handleUpdateSlot = (idx: number, updates: Partial<TimelineSlotData>) => {
    if (!selectedTemplate) return;
    const currentSlots = selectedTemplate.slots || [];
    const newSlots = currentSlots.map((s, i) => (i === idx ? { ...s, ...updates } : s));
    const totalDur = newSlots.reduce((acc, curr) => acc + curr.duration, 0);
    setSelectedTemplate({
      ...selectedTemplate,
      slots: newSlots,
      target_duration: Math.round(totalDur * 10) / 10,
    });
    setHasUnsavedChanges(true);
  };

  const handleAddSlot = () => {
    if (!selectedTemplate) return;
    const currentSlots = selectedTemplate.slots || [];
    const newIndex = currentSlots.length;
    const newSlot: TimelineSlotData = {
      slot_index: newIndex,
      duration: 1.2,
      transition: 'snap_zoom',
      motion: 'zoom_punch',
      crop_mode: (selectedTemplate.crop_mode as any) || 'auto',
      label: `Slot #${newIndex + 1}`,
    };
    const newSlots = [...currentSlots, newSlot];
    const totalDur = newSlots.reduce((acc, curr) => acc + curr.duration, 0);
    setSelectedTemplate({
      ...selectedTemplate,
      slots: newSlots,
      target_duration: Math.round(totalDur * 10) / 10,
    });
    setSelectedSlotIndex(newIndex);
    setHasUnsavedChanges(true);
  };

  const handleDuplicateSlot = (idx: number) => {
    if (!selectedTemplate) return;
    const currentSlots = selectedTemplate.slots || [];
    if (idx < 0 || idx >= currentSlots.length) return;
    const target = currentSlots[idx];
    const duplicated: TimelineSlotData = {
      ...target,
      slot_index: idx + 1,
      label: `${target.label || 'Cut Slot'} (Copy)`,
    };
    const newSlots = [
      ...currentSlots.slice(0, idx + 1),
      duplicated,
      ...currentSlots.slice(idx + 1),
    ].map((s, i) => ({
      ...s,
      slot_index: i,
    }));
    const totalDur = newSlots.reduce((acc, curr) => acc + curr.duration, 0);
    setSelectedTemplate({
      ...selectedTemplate,
      slots: newSlots,
      target_duration: Math.round(totalDur * 10) / 10,
    });
    setSelectedSlotIndex(idx + 1);
    setHasUnsavedChanges(true);
  };

  const handleDeleteSlot = (idx: number) => {
    if (!selectedTemplate) return;
    const currentSlots = selectedTemplate.slots || [];
    if (currentSlots.length <= 2) {
      setActionAlert({
        type: 'error',
        message: 'A CapCut template requires at least 2 clip slots for transitions and beat cuts.',
      });
      return;
    }
    const newSlots = currentSlots
      .filter((_, i) => i !== idx)
      .map((s, i) => ({
        ...s,
        slot_index: i,
      }));
    const totalDur = newSlots.reduce((acc, curr) => acc + curr.duration, 0);
    setSelectedTemplate({
      ...selectedTemplate,
      slots: newSlots,
      target_duration: Math.round(totalDur * 10) / 10,
    });
    setSelectedSlotIndex(Math.max(0, idx - 1));
    setHasUnsavedChanges(true);
  };

  const handleUpdateTemplateProperty = (field: keyof TemplateData, val: any) => {
    if (!selectedTemplate) return;
    setSelectedTemplate((prev) => (prev ? { ...prev, [field]: val } : null));
    setHasUnsavedChanges(true);
  };

  const handleSaveTemplate = async () => {
    if (!selectedTemplate) return;
    setSavingLoading(true);
    try {
      await api.put(`/api/styles/templates/${selectedTemplate.id}`, selectedTemplate);
      setHasUnsavedChanges(false);
      setActionAlert({
        type: 'success',
        message: `Template "${selectedTemplate.name}" saved! Timeline blueprint (${selectedTemplate.slots?.length || 0} slots, ${selectedTemplate.target_duration}s) will be applied to all future videos.`,
      });
      await fetchTemplates();
    } catch (err: any) {
      setActionAlert({
        type: 'error',
        message: 'Failed to save template: ' + (err.message || 'Unknown error'),
      });
    } finally {
      setSavingLoading(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (!newTplName.trim()) return;
    try {
      const res = await api.post('/api/styles/templates', {
        name: newTplName.trim(),
        fixed_music_track: newTplMusic,
        base_style_id: newTplBase,
        crop_mode: newTplCrop,
        title_color: '#EFD34C',
        title_font_size: 130,
        title_y: 240,
        subtitle_color: '#FFFFFF',
        subtitle_font_size: 60,
        subtitle_y: 380,
      });
      await fetchTemplates();
      if (res && res.template) {
        setSelectedTemplate(res.template);
        setSelectedSlotIndex(0);
      }
      setShowNewTemplateModal(false);
      setNewTplName('');
      setActionAlert({
        type: 'success',
        message: `Template "${res.template?.name || newTplName}" created! Customize its timeline slots, cuts, and typography.`,
      });
    } catch (err: any) {
      setActionAlert({
        type: 'error',
        message: 'Failed to create template: ' + (err.message || 'Unknown error'),
      });
    }
  };

  const handleDeleteTemplate = async (id: string, name: string) => {
    if (!confirm(`Delete template "${name}"?`)) return;
    try {
      await api.delete(`/api/styles/templates/${id}`);
      await fetchTemplates();
      setActionAlert({ type: 'success', message: `Template "${name}" deleted.` });
    } catch (err: any) {
      setActionAlert({
        type: 'error',
        message: 'Delete failed: ' + (err.message || 'Cannot delete default template'),
      });
    }
  };

  const handleSetDefaultTemplate = async () => {
    if (!selectedTemplate) return;
    setSettingDefaultLoading(true);
    try {
      await api.post(`/api/styles/templates/${selectedTemplate.id}/set-default`);
      setTemplates((prev) =>
        prev.map((t) => ({
          ...t,
          is_default: t.id === selectedTemplate.id,
        }))
      );
      setSelectedTemplate((prev) => (prev ? { ...prev, is_default: true } : null));
      setActionAlert({
        type: 'success',
        message: `Template "${selectedTemplate.name}" is now the global default for all video renders.`,
      });
    } catch (err: any) {
      setActionAlert({
        type: 'error',
        message: 'Failed to set default template: ' + (err.message || 'Unknown error'),
      });
    } finally {
      setSettingDefaultLoading(false);
    }
  };

  // ------------------ UNIVERSAL STYLE ACTIONS ------------------

  const handleUpdateStyleLayer = (layerName: string, updates: Partial<TextLayerConfig>) => {
    if (!selectedStyle) return;
    const currentLayers = selectedStyle.spec?.text_layers || [];
    const exists = currentLayers.some((l) => l.name === layerName);
    let updatedLayers;
    if (exists) {
      updatedLayers = currentLayers.map((layer) => {
        if (layer.name === layerName) {
          return { ...layer, ...updates };
        }
        return layer;
      });
    } else {
      updatedLayers = [
        ...currentLayers,
        {
          name: layerName,
          font_file: 'fonts/Anton-Regular.ttf',
          color: '#FFFFFF',
          stroke_color: 'black@0.95',
          stroke_width: 4,
          position_y: layerName === 'subtitle' ? 380 : 960,
          max_size: 110,
          width_ratio: 0.82,
          box: false,
          animation: 'none',
          ...updates,
        },
      ];
    }

    const updatedStyle: StyleSpecData = {
      ...selectedStyle,
      spec: {
        ...selectedStyle.spec,
        text_layers: updatedLayers,
      },
    };

    setSelectedStyle(updatedStyle);
    setHasUnsavedChanges(true);
  };

  const handleCropModeChange = (mode: string) => {
    if (studioMode === 'templates' && selectedTemplate) {
      handleUpdateTemplateProperty('crop_mode', mode);
      return;
    }
    if (!selectedStyle) return;
    const updatedStyle: StyleSpecData = {
      ...selectedStyle,
      crop_mode: mode,
      spec: {
        ...selectedStyle.spec,
        clip_rules: {
          ...selectedStyle.spec?.clip_rules,
          crop_mode: mode,
        },
      },
    };
    setSelectedStyle(updatedStyle);
    setHasUnsavedChanges(true);
  };

  const handleSaveStyle = async () => {
    if (!selectedStyle) return;
    setSavingLoading(true);
    try {
      await api.put(`/api/styles/${selectedStyle.id}`, {
        spec: selectedStyle.spec,
      });
      setHasUnsavedChanges(false);
      setActionAlert({
        type: 'success',
        message: `Style "${selectedStyle.name}" updated successfully.`,
      });
      await fetchStyles();
    } catch (err: any) {
      setActionAlert({
        type: 'error',
        message: 'Failed to save style: ' + (err.message || 'Unknown error'),
      });
    } finally {
      setSavingLoading(false);
    }
  };

  const handleResetStyle = async () => {
    if (!selectedStyle) return;
    if (!confirm(`Reset "${selectedStyle.name}" back to factory default values?`)) return;
    try {
      await api.post(`/api/styles/${selectedStyle.id}/reset`);
      await fetchStyles();
      setHasUnsavedChanges(false);
      setPreviewUrl(null);
      setActionAlert({
        type: 'success',
        message: `Style "${selectedStyle.name}" restored to factory defaults.`,
      });
    } catch (err: any) {
      setActionAlert({
        type: 'error',
        message: 'Reset failed: ' + (err.message || 'Unknown error'),
      });
    }
  };

  const handleCreateCustomStyle = async () => {
    if (!newStyleName.trim()) return;
    try {
      const res = await api.post('/api/styles/create-custom', {
        name: newStyleName.trim(),
        base_style_id: newStyleBase,
      });
      await fetchStyles();
      setShowNewStyleModal(false);
      setNewStyleName('');
      setActionAlert({
        type: 'success',
        message: `Custom style "${res.name}" created!`,
      });
    } catch (err: any) {
      setActionAlert({
        type: 'error',
        message: 'Failed to create style: ' + (err.message || 'Unknown error'),
      });
    }
  };

  const handleDeleteCustomStyle = async (id: string, name: string) => {
    if (!confirm(`Delete custom style "${name}"?`)) return;
    try {
      await api.delete(`/api/styles/${id}`);
      await fetchStyles();
      setActionAlert({ type: 'success', message: `Custom style "${name}" deleted.` });
    } catch (err: any) {
      setActionAlert({
        type: 'error',
        message: 'Delete failed: ' + (err.message || 'Cannot delete built-in style'),
      });
    }
  };

  const handleSetDefaultStyle = async () => {
    if (!selectedStyle) return;
    setSettingDefaultLoading(true);
    try {
      await api.post(`/api/styles/${selectedStyle.id}/set-default`);
      setStyles((prev) =>
        prev.map((s) => ({
          ...s,
          is_default: s.id === selectedStyle.id,
        }))
      );
      setSelectedStyle((prev) => (prev ? { ...prev, is_default: true } : null));
      setActionAlert({
        type: 'success',
        message: `${selectedStyle.name} is now the default style for all automated renders.`,
      });
    } catch (err: any) {
      setActionAlert({
        type: 'error',
        message: 'Failed to set default style: ' + (err.message || 'Unknown error'),
      });
    } finally {
      setSettingDefaultLoading(false);
    }
  };

  // ------------------ PREVIEW RENDER ------------------

  const handlePreviewRender = async () => {
    const targetId = studioMode === 'templates' ? selectedTemplate?.id : selectedStyle?.id;
    if (!targetId) return;

    try {
      setPreviewLoading(true);
      setActionAlert(null);
      const data = await api.post('/api/styles/preview', {
        style_id: targetId,
        product_id: selectedProductId,
        music_track: studioMode === 'templates' ? undefined : selectedMusicTrack,
        title: titleText,
        subtitle: subtitleText,
        sample_duration: studioMode === 'templates' ? (selectedTemplate?.target_duration || 6.0) : 6.0,
      });

      if (data && data.preview_url) {
        setPreviewUrl(data.preview_url);
        setActionAlert({
          type: 'success',
          message: `Preview rendered in ${data.duration}s with ${data.segments} beat cuts using "${data.music_used}"!`,
        });
      }
    } catch (err: any) {
      setActionAlert({
        type: 'error',
        message: 'Preview error: ' + (err.message || 'Check clips and audio availability.'),
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  // ------------------ CANVAS DRAGGING HANDLERS ------------------

  const handleMouseDown = (layer: string, e: React.MouseEvent) => {
    e.preventDefault();
    setDraggingLayer(layer);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingLayer || !phoneCanvasRef.current) return;
    const rect = phoneCanvasRef.current.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const clampedY = Math.max(20, Math.min(rect.height - 40, offsetY));
    const newY = Math.round((clampedY / rect.height) * 1920);

    if (studioMode === 'templates') {
      if (draggingLayer === 'title') {
        handleUpdateTemplateProperty('title_y', newY);
      } else if (draggingLayer === 'subtitle') {
        handleUpdateTemplateProperty('subtitle_y', newY);
      }
    } else {
      handleUpdateStyleLayer(draggingLayer, { position_y: newY });
    }
  };

  const handleMouseUp = () => {
    setDraggingLayer(null);
  };

  const activeTitleColor =
    studioMode === 'templates'
      ? selectedTemplate?.title_color || '#EFD34C'
      : selectedStyle?.spec?.text_layers?.find((l) => l.name === 'title')?.color || '#EFD34C';

  const activeSubtitleColor =
    studioMode === 'templates'
      ? selectedTemplate?.subtitle_color || '#FFFFFF'
      : selectedStyle?.spec?.text_layers?.find((l) => l.name === 'subtitle')?.color || '#FFFFFF';

  const activeTitleY =
    studioMode === 'templates'
      ? selectedTemplate?.title_y || 240
      : selectedStyle?.spec?.text_layers?.find((l) => l.name === 'title')?.position_y || 230;

  const activeSubtitleY =
    studioMode === 'templates'
      ? selectedTemplate?.subtitle_y || 380
      : selectedStyle?.spec?.text_layers?.find((l) => l.name === 'subtitle')?.position_y || 380;

  const activeTitleSize =
    studioMode === 'templates'
      ? selectedTemplate?.title_font_size || 130
      : selectedStyle?.spec?.text_layers?.find((l) => l.name === 'title')?.max_size || 125;

  const activeSubtitleSize =
    studioMode === 'templates'
      ? selectedTemplate?.subtitle_font_size || 60
      : selectedStyle?.spec?.text_layers?.find((l) => l.name === 'subtitle')?.max_size || 80;

  const activeCropMode =
    studioMode === 'templates'
      ? selectedTemplate?.crop_mode || 'auto'
      : selectedStyle?.crop_mode || 'cover';

  const currentSelectedSlot = currentTemplateSlots[selectedSlotIndex] || currentTemplateSlots[0] || null;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-16" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
      {/* Studio Header & Top Mode Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
            <Sliders className="w-6 h-6" />
            Style Studio & CapCut Template Engine
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Build and edit timeline blueprints with exact clip cut durations, transitions, and motions. Replace footage seamlessly.
          </p>
        </div>

        {/* Tab Switcher: Templates vs Universal Styles */}
        <div className="flex items-center gap-1.5 bg-neutral-100 dark:bg-neutral-900 p-1 rounded-control border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <button
            onClick={() => {
              setStudioMode('templates');
              setPreviewUrl(null);
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-control text-xs font-semibold uppercase tracking-wider transition-all ${
              studioMode === 'templates'
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-black shadow-sm'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            CapCut-Style Templates ({templates.length})
          </button>
          <button
            onClick={() => {
              setStudioMode('styles');
              setPreviewUrl(null);
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-control text-xs font-semibold uppercase tracking-wider transition-all ${
              studioMode === 'styles'
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-black shadow-sm'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Universal Motion Styles ({styles.length})
          </button>
        </div>
      </div>

      {/* Alert Notification */}
      {actionAlert && (
        <div
          className={`rounded-card p-3.5 text-xs flex items-center justify-between hairline-border ${
            actionAlert.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
              : 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionAlert.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{actionAlert.message}</span>
          </div>
          <button onClick={() => setActionAlert(null)} className="text-xs underline ml-2">
            Dismiss
          </button>
        </div>
      )}

      {/* ===================== MODE 1: CAPCUT-STYLE TEMPLATES SELECTOR ===================== */}
      {studioMode === 'templates' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                CapCut-Style Templates (Fixed Audio & Multi-Track Timeline)
              </span>
              <p className="text-xs text-neutral-400">
                Blueprints with exact timeline cut lengths, transitions, and motions. When applying to new clips, timings stay strictly locked.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowNewTemplateModal(true)}
              className="gap-1.5 text-xs shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              New Template
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {templates.map((tpl) => {
              const isSelected = selectedTemplate?.id === tpl.id;
              const slotCount = tpl.slots?.length || 0;
              return (
                <div
                  key={tpl.id}
                  onClick={() => handleSelectTemplate(tpl)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer relative ${
                    isSelected
                      ? 'border-neutral-900 bg-neutral-900/5 dark:border-white dark:bg-white/5 ring-1 ring-neutral-900 dark:ring-white shadow-md'
                      : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 hover:border-neutral-400 dark:hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                      {tpl.name}
                    </span>
                    {tpl.is_default && (
                      <Badge variant="neutral" className="text-[10px] uppercase font-bold shrink-0 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                        Default
                      </Badge>
                    )}
                  </div>

                  <p className="text-xs text-neutral-500 line-clamp-2 mb-3 leading-relaxed">
                    {tpl.description || 'Pre-configured beat cuts and layout.'}
                  </p>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-mono bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 px-2 py-0.5 rounded flex items-center gap-1">
                      <Music className="w-3 h-3 text-amber-500" />
                      {tpl.fixed_music_track.replace('downloadsv2', 'Beat V2').replace('download', 'Track')}
                    </span>
                    <span className="text-[10px] font-mono bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 px-2 py-0.5 rounded flex items-center gap-1">
                      <Film className="w-3 h-3 text-neutral-400" />
                      {slotCount} Cuts ({tpl.target_duration}s)
                    </span>
                    <span className="text-[10px] font-mono bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 px-2 py-0.5 rounded">
                      {tpl.crop_mode}
                    </span>
                  </div>

                  {tpl.is_custom && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTemplate(tpl.id, tpl.name);
                      }}
                      className="absolute bottom-3 right-3 text-neutral-400 hover:text-red-500 transition-colors"
                      title="Delete Custom Template"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================== MODE 2: UNIVERSAL MOTION STYLES SELECTOR ===================== */}
      {studioMode === 'styles' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Universal Motion Styles (Dynamic Audio Compatible)
              </span>
              <p className="text-xs text-neutral-400">
                Algorithmic kinetic zooms and swishes. Compatible with rotating, diverse, or random background audio.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowNewStyleModal(true)}
              className="gap-1.5 text-xs shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              New Custom Style
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {styles.map((s) => {
              const isSelected = selectedStyle?.id === s.id;
              return (
                <div
                  key={s.id}
                  onClick={() => handleSelectStyle(s)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer relative ${
                    isSelected
                      ? 'border-neutral-900 bg-neutral-900/5 dark:border-white dark:bg-white/5 ring-1 ring-neutral-900 dark:ring-white shadow-md'
                      : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 hover:border-neutral-400 dark:hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <span className="text-xs font-bold text-neutral-900 dark:text-white truncate">{s.name}</span>
                    {s.is_default && (
                      <Badge variant="neutral" className="text-[9px] uppercase font-bold shrink-0 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                        Default
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1 mt-2">
                    <span className="text-[10px] font-mono bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 px-1.5 py-0.5 rounded">
                      {s.crop_mode}
                    </span>
                    {s.transitions_enabled && (
                      <span className="text-[10px] font-mono bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 px-1.5 py-0.5 rounded">
                        Transitions
                      </span>
                    )}
                  </div>

                  {s.is_custom && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCustomStyle(s.id, s.name);
                      }}
                      className="absolute bottom-2.5 right-2.5 text-neutral-400 hover:text-red-500 transition-colors"
                      title="Delete Custom Style"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================== CAPCUT MULTI-TRACK TIMELINE EDITOR (FOR TEMPLATES) ===================== */}
      {studioMode === 'templates' && selectedTemplate && (
        <Card className="p-6 bg-white dark:bg-neutral-950 border hairline-border space-y-6">
          {/* Timeline Header & Transport Toolbar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5" />
                  CapCut Multi-Track Timeline
                </span>
                <span className="text-xs font-mono bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 px-2 py-0.5 rounded">
                  {currentTemplateSlots.length} Slots • {currentTotalDuration.toFixed(1)}s Total
                </span>
                <span className="text-xs font-mono bg-amber-400/20 text-amber-400 border border-amber-400/30 px-2 py-0.5 rounded font-bold">
                  Playhead: {currentTime.toFixed(1)}s
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                Real-time CapCut editor: scrub playhead, split cuts, swap clip footage, and customize transitions live.
              </p>
            </div>

            {/* CapCut Quick Actions Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
                title="Play / Pause Timeline (Spacebar)"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                {isPlaying ? 'Pause' : 'Play Live'}
              </button>

              <Button
                size="sm"
                variant="secondary"
                onClick={handleSplitSlotAtPlayhead}
                className="text-xs gap-1 font-semibold text-amber-400 hover:text-amber-300"
                title="Split current clip at playhead position into two cuts"
              >
                <Scissors className="w-3.5 h-3.5" /> Split Clip
              </Button>

              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setClipPickerSlotIndex(selectedSlotIndex);
                  setShowClipPickerModal(true);
                }}
                className="text-xs gap-1 font-semibold text-cyan-400 hover:text-cyan-300"
                title="Select or upload footage for this slot"
              >
                <Folder className="w-3.5 h-3.5" /> Swap Footage
              </Button>

              <Button
                size="sm"
                variant="secondary"
                onClick={handleAddSlot}
                className="text-xs gap-1"
                title="Add a new cut slot to the end of the timeline"
              >
                <Plus className="w-3.5 h-3.5" /> Add Slot
              </Button>

              <Button
                size="sm"
                variant="secondary"
                disabled={currentTemplateSlots.length === 0}
                onClick={() => handleDuplicateSlot(selectedSlotIndex)}
                className="text-xs gap-1"
                title="Duplicate currently selected slot"
              >
                <Copy className="w-3.5 h-3.5" /> Duplicate
              </Button>

              <Button
                size="sm"
                variant="secondary"
                disabled={currentTemplateSlots.length <= 2}
                onClick={() => handleDeleteSlot(selectedSlotIndex)}
                className="text-xs gap-1 text-red-500 hover:text-red-600 disabled:opacity-40"
                title="Delete currently selected slot (min 2)"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </Button>

              <button
                onClick={() => setIsMuted(!isMuted)}
                className={`p-1.5 rounded-lg border text-xs flex items-center transition-all ${
                  isMuted
                    ? 'border-red-500/40 bg-red-500/10 text-red-400'
                    : 'border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-800 text-neutral-400 hover:text-white'
                }`}
                title={isMuted ? 'Unmute Audio Preview' : 'Mute Audio Preview'}
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Visual Multi-Track Canvas with Scrubbing Playhead */}
          <div
            ref={timelineTrackRef}
            onMouseDown={handleTimelineMouseDown}
            className="space-y-2 bg-neutral-900 rounded-xl p-4 border border-neutral-800 text-neutral-100 overflow-x-auto shadow-inner relative select-none cursor-pointer"
          >
            {/* Interactive Scrubbing Playhead Needle */}
            <div
              style={{
                left: `calc(96px + ${(currentTime / Math.max(0.1, currentTotalDuration)) * 100}% * (1 - 96px / 100%))`,
              }}
              className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-30 pointer-events-none transition-[left] duration-75"
            >
              <div className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-amber-400 rotate-45 rounded-sm shadow-md flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-black rounded-full" />
              </div>
            </div>

            {/* Time Ruler Track */}
            <div className="flex items-center text-[10px] font-mono text-neutral-400 pl-24 pb-1 border-b border-neutral-800">
              {Array.from({ length: Math.ceil(currentTotalDuration) + 1 }).map((_, sec) => (
                <div key={sec} className="flex-1 flex flex-col items-start min-w-[70px]">
                  <span className="text-neutral-500">{sec}.0s</span>
                  <div className="w-full flex items-center gap-1 mt-0.5">
                    <span className="w-0.5 h-2 bg-neutral-700" />
                    <span className="flex-1 border-t border-dotted border-neutral-800" />
                  </div>
                </div>
              ))}
            </div>

            {/* Audio Waveform Track */}
            <div className="flex items-center gap-3">
              <div className="w-20 shrink-0 text-[11px] font-bold text-neutral-400 flex items-center gap-1">
                <Music className="w-3 h-3 text-amber-400" />
                Audio
              </div>
              <div className="flex-1 flex items-center bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 text-xs text-amber-300">
                <div className="flex items-center gap-2 truncate">
                  <Lock className="w-3 h-3 shrink-0 text-amber-400" />
                  <span className="font-semibold truncate">
                    {selectedTemplate.fixed_music_track.replace('downloadsv2', 'Beat V2').replace('download', 'Affiliate Track')}
                  </span>
                  <span className="text-[10px] text-amber-400/80 font-mono">
                    (Locked Template Beat • Fadeout at {(currentTotalDuration - 1.2).toFixed(1)}s)
                  </span>
                </div>
              </div>
            </div>

            {/* Video Clips & Slots Track */}
            <div className="flex items-center gap-3 pt-1">
              <div className="w-20 shrink-0 text-[11px] font-bold text-neutral-400 flex items-center gap-1">
                <Film className="w-3 h-3 text-neutral-300" />
                Video Cuts
              </div>
              <div className="flex-1 flex items-center gap-1.5 overflow-x-auto py-1">
                {currentTemplateSlots.map((slot, idx) => {
                  const isSelected = selectedSlotIndex === idx;
                  const flexWidth = Math.max(130, slot.duration * 135);
                  const transObj = TRANSITION_OPTIONS.find((t) => t.id === slot.transition);
                  const IconComponent = transObj?.icon || Zap;

                  return (
                    <div
                      key={idx}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSlotIndex(idx);
                        handleSeek(slotRanges[idx]?.start || 0);
                      }}
                      style={{ width: `${flexWidth}px` }}
                      className={`h-24 rounded-lg p-2.5 transition-all cursor-pointer flex flex-col justify-between shrink-0 select-none relative ${
                        isSelected
                          ? 'bg-amber-400/20 border-2 border-amber-400 shadow-lg text-white'
                          : 'bg-neutral-800/80 border border-neutral-700/80 hover:bg-neutral-800 hover:border-neutral-500 text-neutral-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-xs font-bold truncate">
                          #{idx + 1} {slot.label || `Slot ${idx + 1}`}
                        </span>
                        <span className="text-[10px] font-mono bg-black/50 px-1.5 py-0.5 rounded text-amber-300 font-bold shrink-0">
                          {slot.duration}s
                        </span>
                      </div>

                      {/* Footage Name & Swap Button */}
                      <div className="flex items-center justify-between text-[9px] text-neutral-400 bg-black/40 px-1.5 py-0.5 rounded truncate">
                        <div className="flex items-center gap-1 truncate">
                          <Film className="w-3 h-3 text-cyan-400 shrink-0" />
                          <span className="truncate">{slotRanges[idx]?.clipFilename || `Clip #${idx + 1}`}</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setClipPickerSlotIndex(idx);
                            setShowClipPickerModal(true);
                          }}
                          className="text-amber-400 hover:text-white p-0.5 rounded hover:bg-white/10 shrink-0"
                          title="Change footage for this slot"
                        >
                          <Folder className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1 text-[10px] text-neutral-300 truncate">
                          <IconComponent className="w-3 h-3 text-amber-400 shrink-0" />
                          <span className="truncate">{transObj?.label || slot.transition}</span>
                        </div>
                        <div className="text-[9px] text-neutral-400 truncate bg-black/30 px-1 py-0.5 rounded">
                          {slot.motion.replace('_', ' ')}
                        </div>
                      </div>

                      {isSelected && (
                        <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-1.5 bg-amber-400 rounded-full" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Persistent Typography Track */}
            <div className="flex items-center gap-3 pt-1">
              <div className="w-20 shrink-0 text-[11px] font-bold text-neutral-400 flex items-center gap-1">
                <Sliders className="w-3 h-3 text-cyan-400" />
                Text Burn
              </div>
              <div className="flex-1 flex flex-col gap-1">
                <div className="flex items-center justify-between bg-cyan-500/10 border border-cyan-500/30 rounded px-2.5 py-1 text-[11px] text-cyan-300">
                  <span className="font-semibold">Title Hook (Line 1)</span>
                  <span className="text-[10px] text-neutral-400 font-mono">
                    Continuous 0.0s ➔ {currentTotalDuration.toFixed(1)}s (No cut-blink)
                  </span>
                </div>
                <div className="flex items-center justify-between bg-neutral-800 border border-neutral-700 rounded px-2.5 py-1 text-[11px] text-neutral-300">
                  <span className="font-semibold">Subtitle Callout (Line 2)</span>
                  <span className="text-[10px] text-neutral-400 font-mono">
                    Continuous 0.0s ➔ {currentTotalDuration.toFixed(1)}s
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Selected Slot Inspector Panel */}
          {currentSelectedSlot && (
            <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
                    Slot #{selectedSlotIndex + 1} Cut Inspector
                  </span>
                  <span className="text-xs font-mono bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 px-2 py-0.5 rounded">
                    {currentSelectedSlot.duration}s
                  </span>
                </div>
                <span className="text-[11px] text-neutral-500">
                  Assigned product footage clip #{selectedSlotIndex + 1}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Slot Label & Duration */}
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                      Slot Label / Hook Role
                    </label>
                    <Input
                      value={currentSelectedSlot.label || ''}
                      onChange={(e) => handleUpdateSlot(selectedSlotIndex, { label: e.target.value })}
                      placeholder="e.g. Opening Hook, Beat Drop, Port Detail"
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-neutral-700 dark:text-neutral-300 font-semibold">
                      <span>Cut Duration</span>
                      <span className="font-mono text-amber-500">{currentSelectedSlot.duration}s</span>
                    </div>
                    <input
                      type="range"
                      min="0.4"
                      max="3.5"
                      step="0.1"
                      value={currentSelectedSlot.duration}
                      onChange={(e) => handleUpdateSlot(selectedSlotIndex, { duration: Number(e.target.value) })}
                      className="w-full accent-amber-500"
                    />
                    <div className="flex items-center gap-1 pt-1">
                      {[0.8, 1.0, 1.2, 1.5, 2.0].map((preset) => (
                        <button
                          key={preset}
                          onClick={() => handleUpdateSlot(selectedSlotIndex, { duration: preset })}
                          className={`text-[10px] px-2 py-0.5 rounded border transition-all ${
                            currentSelectedSlot.duration === preset
                              ? 'bg-neutral-900 text-white dark:bg-white dark:text-black font-bold'
                              : 'border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                          }`}
                        >
                          {preset}s
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Transition into Next Cut */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    Cut Transition
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {TRANSITION_OPTIONS.map((t) => {
                      const IconComp = t.icon;
                      const isActive = currentSelectedSlot.transition === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => handleUpdateSlot(selectedSlotIndex, { transition: t.id as any })}
                          className={`p-2 rounded-lg border text-left transition-all flex flex-col justify-between ${
                            isActive
                              ? 'border-neutral-900 dark:border-white bg-neutral-900 text-white dark:bg-white dark:text-black font-semibold shadow-sm'
                              : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 text-xs">
                            <IconComp className="w-3.5 h-3.5 shrink-0" />
                            <span>{t.label}</span>
                          </div>
                          <span className="text-[9px] opacity-70 line-clamp-1 mt-0.5">{t.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Camera Motion / Dynamic Effect */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                    <Film className="w-3.5 h-3.5 text-neutral-400" />
                    Camera Motion Effect
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {MOTION_OPTIONS.map((m) => {
                      const isActive = currentSelectedSlot.motion === m.id;
                      return (
                        <button
                          key={m.id}
                          onClick={() => handleUpdateSlot(selectedSlotIndex, { motion: m.id as any })}
                          className={`p-2 rounded-lg border text-left transition-all flex flex-col justify-between ${
                            isActive
                              ? 'border-neutral-900 dark:border-white bg-neutral-900 text-white dark:bg-white dark:text-black font-semibold shadow-sm'
                              : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300'
                          }`}
                        >
                          <span className="text-xs">{m.label}</span>
                          <span className="text-[9px] opacity-70 line-clamp-1 mt-0.5">{m.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ===================== SHARED VISUAL EDITOR & CANVAS ===================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): Configuration & Layer Controls */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="p-6 space-y-6 bg-white dark:bg-neutral-950 border hairline-border">
            {/* Header with Save & Default buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-200 dark:border-neutral-800">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
                    {studioMode === 'templates' ? selectedTemplate?.name : selectedStyle?.name}
                  </h2>
                  {hasUnsavedChanges && (
                    <Badge variant="warning" className="text-[10px]">
                      Unsaved Edits
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {studioMode === 'templates'
                    ? selectedTemplate?.description
                    : selectedStyle?.description || 'Universal TikTok video style with beat-cuts.'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {studioMode === 'templates' ? (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={settingDefaultLoading || selectedTemplate?.is_default}
                      onClick={handleSetDefaultTemplate}
                      className="text-xs gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {selectedTemplate?.is_default ? 'Active Default' : 'Set as Default Template'}
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={savingLoading || !hasUnsavedChanges}
                      onClick={handleSaveTemplate}
                      className="text-xs gap-1.5 bg-neutral-900 text-white dark:bg-white dark:text-black font-semibold"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Save Template
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={settingDefaultLoading || selectedStyle?.is_default}
                      onClick={handleSetDefaultStyle}
                      className="text-xs gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {selectedStyle?.is_default ? 'Active Default' : 'Set as Default Style'}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handleResetStyle}
                      className="text-xs gap-1"
                      title="Reset to factory values"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reset
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={savingLoading || !hasUnsavedChanges}
                      onClick={handleSaveStyle}
                      className="text-xs gap-1.5 bg-neutral-900 text-white dark:bg-white dark:text-black font-semibold"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Save Changes
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Test Product Footage & Audio Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                  <Folder className="w-3.5 h-3.5 text-neutral-400" />
                  Product Footage for Test Cuts
                </label>
                <select
                  value={selectedProductId || ''}
                  onChange={(e) => handleProductSelect(Number(e.target.value))}
                  className="w-full text-xs rounded-input bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-2.5 text-neutral-800 dark:text-neutral-200 focus:outline-none"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.clip_count || 0} clips)
                    </option>
                  ))}
                </select>
              </div>

              {/* Music Selection or Fixed Audio Pill */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                  <Music className="w-3.5 h-3.5 text-neutral-400" />
                  Background Audio Track
                </label>
                {studioMode === 'templates' ? (
                  <div className="flex items-center gap-2 p-2.5 rounded-input bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs">
                    <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="text-neutral-700 dark:text-neutral-300 font-medium truncate">
                      Fixed to: <strong>{selectedTemplate?.fixed_music_track}</strong>
                    </span>
                  </div>
                ) : (
                  <select
                    value={selectedMusicTrack}
                    onChange={(e) => setSelectedMusicTrack(e.target.value)}
                    className="w-full text-xs rounded-input bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-2.5 text-neutral-800 dark:text-neutral-200 focus:outline-none"
                  >
                    <option value="random">Random from Library</option>
                    {musicTracks.map((m) => (
                      <option key={m.id} value={m.filename}>
                        {m.name} ({m.size_kb} KB)
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Framing & Crop Mode */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5 text-neutral-400" />
                Default Framing & Crop Mode
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'auto', label: 'Auto (Universal Smart)', desc: 'Detects vertical/horizontal automatically' },
                  { id: 'contain_blur', label: 'Contain Blur (Ambient Glow)', desc: 'Fit clip with blurred backdrop' },
                  { id: 'cover', label: 'Cover (Full Bleed)', desc: 'Center crop to full 1080x1920' },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleCropModeChange(m.id)}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      activeCropMode === m.id
                        ? 'border-neutral-900 dark:border-white bg-neutral-100 dark:bg-neutral-900 font-medium'
                        : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 text-neutral-500'
                    }`}
                  >
                    <div className="text-xs font-semibold text-neutral-900 dark:text-white">{m.label}</div>
                    <div className="text-[10px] text-neutral-400 mt-0.5">{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Typography & Hook Editor */}
            <div className="space-y-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
              <span className="text-xs uppercase tracking-wider text-neutral-500 font-bold block">
                Typography, Colors & Overlay Layout
              </span>

              {/* Hook text inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Title Hook (Line 1)
                  </label>
                  <Input
                    value={titleText}
                    onChange={(e) => setTitleText(e.target.value)}
                    placeholder="e.g. INPLAY BK680"
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Subtitle Hook (Line 2)
                  </label>
                  <Input
                    value={subtitleText}
                    onChange={(e) => setSubtitleText(e.target.value)}
                    placeholder="e.g. LIMITED TIME CREATOR DEAL"
                    className="text-xs"
                  />
                </div>
              </div>

              {/* Title Layer Controls */}
              <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                    TITLE / MAIN HOOK LAYER
                  </span>
                  <span className="font-mono text-[10px] text-neutral-400">
                    Y: {activeTitleY}px | Size: {activeTitleSize}px
                  </span>
                </div>

                {/* Color Palette */}
                <div className="space-y-1">
                  <span className="text-[11px] text-neutral-400">Color Palette:</span>
                  <div className="flex flex-wrap items-center gap-2">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c.hex}
                        onClick={() => {
                          if (studioMode === 'templates') {
                            handleUpdateTemplateProperty('title_color', c.hex);
                          } else {
                            handleUpdateStyleLayer('title', { color: formatColorForFFmpeg(c.hex) });
                          }
                        }}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-all ${
                          normalizeHexColor(activeTitleColor).toUpperCase() === c.hex.toUpperCase()
                            ? 'ring-2 ring-neutral-900 dark:ring-white font-semibold bg-neutral-200 dark:bg-neutral-800'
                            : 'bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200/80 text-neutral-600 dark:text-neutral-300'
                        }`}
                      >
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.hex }} />
                        {c.name}
                      </button>
                    ))}
                    <div className="flex items-center gap-1 font-mono text-[11px] text-neutral-500 ml-auto">
                      <span>{normalizeHexColor(activeTitleColor)}</span>
                    </div>
                  </div>
                </div>

                {/* Sliders */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-neutral-500">
                      <span>Max Font Size</span>
                      <span className="font-mono">{activeTitleSize}px</span>
                    </div>
                    <input
                      type="range"
                      min="70"
                      max="170"
                      value={activeTitleSize}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (studioMode === 'templates') {
                          handleUpdateTemplateProperty('title_font_size', val);
                        } else {
                          handleUpdateStyleLayer('title', { max_size: val });
                        }
                      }}
                      className="w-full accent-neutral-900 dark:accent-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-neutral-500">
                      <span>Vertical Position (Y)</span>
                      <span className="font-mono">{activeTitleY}px</span>
                    </div>
                    <input
                      type="range"
                      min="80"
                      max="1400"
                      value={activeTitleY}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (studioMode === 'templates') {
                          handleUpdateTemplateProperty('title_y', val);
                        } else {
                          handleUpdateStyleLayer('title', { position_y: val });
                        }
                      }}
                      className="w-full accent-neutral-900 dark:accent-white"
                    />
                  </div>
                </div>
              </div>

              {/* Subtitle Layer Controls */}
              <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                    SUBTITLE / CALLOUT LAYER
                  </span>
                  <span className="font-mono text-[10px] text-neutral-400">
                    Y: {activeSubtitleY}px | Size: {activeSubtitleSize}px
                  </span>
                </div>

                {/* Color Palette */}
                <div className="space-y-1">
                  <span className="text-[11px] text-neutral-400">Color Palette:</span>
                  <div className="flex flex-wrap items-center gap-2">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c.hex}
                        onClick={() => {
                          if (studioMode === 'templates') {
                            handleUpdateTemplateProperty('subtitle_color', c.hex);
                          } else {
                            handleUpdateStyleLayer('subtitle', { color: formatColorForFFmpeg(c.hex) });
                          }
                        }}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-all ${
                          normalizeHexColor(activeSubtitleColor).toUpperCase() === c.hex.toUpperCase()
                            ? 'ring-2 ring-neutral-900 dark:ring-white font-semibold bg-neutral-200 dark:bg-neutral-800'
                            : 'bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200/80 text-neutral-600 dark:text-neutral-300'
                        }`}
                      >
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.hex }} />
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sliders */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-neutral-500">
                      <span>Max Font Size</span>
                      <span className="font-mono">{activeSubtitleSize}px</span>
                    </div>
                    <input
                      type="range"
                      min="40"
                      max="120"
                      value={activeSubtitleSize}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (studioMode === 'templates') {
                          handleUpdateTemplateProperty('subtitle_font_size', val);
                        } else {
                          handleUpdateStyleLayer('subtitle', { max_size: val });
                        }
                      }}
                      className="w-full accent-neutral-900 dark:accent-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-neutral-500">
                      <span>Vertical Position (Y)</span>
                      <span className="font-mono">{activeSubtitleY}px</span>
                    </div>
                    <input
                      type="range"
                      min="150"
                      max="1600"
                      value={activeSubtitleY}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (studioMode === 'templates') {
                          handleUpdateTemplateProperty('subtitle_y', val);
                        } else {
                          handleUpdateStyleLayer('subtitle', { position_y: val });
                        }
                      }}
                      className="w-full accent-neutral-900 dark:accent-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column (5 cols): Interactive 9:16 Mobile Phone Canvas */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="p-6 bg-white dark:bg-neutral-950 border hairline-border flex flex-col items-center">
            {/* Header with Preview Mode Switcher & Render Button */}
            <div className="w-full flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider text-neutral-500 font-bold flex items-center gap-1">
                  <Film className="w-3.5 h-3.5 text-amber-500" />
                  {previewMode === 'realtime' ? 'Live CapCut Canvas' : 'Exported MP4'}
                </span>
                {previewUrl && (
                  <div className="flex items-center bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-0.5 text-[10px]">
                    <button
                      onClick={() => setPreviewMode('realtime')}
                      className={`px-2 py-0.5 rounded font-semibold transition-all ${
                        previewMode === 'realtime'
                          ? 'bg-amber-400 text-black shadow-sm'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      Live Real-Time
                    </button>
                    <button
                      onClick={() => setPreviewMode('rendered')}
                      className={`px-2 py-0.5 rounded font-semibold transition-all ${
                        previewMode === 'rendered'
                          ? 'bg-amber-400 text-black shadow-sm'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      Exported MP4
                    </button>
                  </div>
                )}
              </div>

              <Button
                size="sm"
                variant="primary"
                disabled={previewLoading}
                onClick={handlePreviewRender}
                className="text-xs gap-1.5 bg-neutral-900 text-white dark:bg-white dark:text-black font-semibold shadow-sm"
                title="Render final high-bitrate vertical video with FFmpeg"
              >
                {previewLoading ? (
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5 ml-0.5" />
                )}
                {previewLoading ? 'Rendering FFmpeg MP4...' : 'Render Video (FFmpeg)'}
              </Button>
            </div>

            {/* Mobile Phone Mockup Frame */}
            <div className="relative w-full max-w-[290px] aspect-[9/16] rounded-[38px] p-2 bg-neutral-900 dark:bg-neutral-950 shadow-2xl border-4 border-neutral-800">
              <div
                ref={phoneCanvasRef}
                className="relative w-full h-full rounded-[30px] overflow-hidden bg-black flex flex-col items-center justify-start select-none"
              >
                {/* Phone Speaker Notch */}
                <div className="absolute top-2 w-20 h-4 bg-neutral-950 rounded-full z-30" />

                {/* Real-time Video Layer */}
                {previewMode === 'realtime' ? (
                  <div className="w-full h-full relative overflow-hidden bg-black flex items-center justify-center">
                    {/* Active Slot Video */}
                    {activeSlotRange?.clipPath ? (
                      <div className="w-full h-full relative overflow-hidden flex items-center justify-center">
                        {/* Ambient Blur Backdrop if contain_blur */}
                        {activeSlotRange.slot.crop_mode === 'contain_blur' && (
                          <video
                            src={`/api/storage/preview/${encodeURIComponent(activeSlotRange.clipPath)}`}
                            muted
                            className="absolute inset-0 w-full h-full object-cover blur-md opacity-40 scale-125 pointer-events-none"
                          />
                        )}
                        <video
                          ref={videoRef}
                          src={`/api/storage/preview/${encodeURIComponent(activeSlotRange.clipPath)}`}
                          playsInline
                          muted
                          style={getSlotMotionStyle()}
                          className={`relative z-10 w-full h-full pointer-events-none ${
                            activeSlotRange.slot.crop_mode === 'contain_blur' ? 'object-contain' : 'object-cover'
                          }`}
                        />
                      </div>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-neutral-500 space-y-2">
                        <Film className="w-8 h-8 opacity-40 animate-pulse text-amber-400" />
                        <span className="text-xs font-medium text-neutral-300">Loading Clip Footage...</span>
                        <span className="text-[10px] text-neutral-500">Select product clips to see live cuts</span>
                      </div>
                    )}

                    {/* Synchronized Audio */}
                    <audio ref={audioRef} muted={isMuted} />

                    {/* HUD Info Badge on Video */}
                    <div className="absolute top-8 left-3 right-3 flex items-center justify-between z-30 pointer-events-none">
                      <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2 py-1 rounded-full text-[10px] text-white border border-white/10 font-mono">
                        <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
                        <span>Slot {activeSlotRange ? activeSlotRange.index + 1 : 1}/{slotRanges.length}</span>
                        <span className="text-amber-400">• {activeSlotRange?.slot.label || 'Cut'}</span>
                      </div>
                      <div className="bg-black/60 backdrop-blur-md px-2 py-1 rounded-full text-[10px] text-amber-300 border border-white/10 font-mono font-bold">
                        {currentTime.toFixed(1)}s / {currentTotalDuration.toFixed(1)}s
                      </div>
                    </div>

                    {/* Real-time Draggable Anton Typography Layers */}
                    {/* Title Hook Layer */}
                    <div
                      onMouseDown={(e) => handleMouseDown('title', e)}
                      style={{
                        top: `${(activeTitleY / 1920) * 100}%`,
                        color: normalizeHexColor(activeTitleColor),
                        fontSize: `${Math.round((activeTitleSize / 1920) * 440)}px`,
                        textShadow: '0 2px 8px rgba(0,0,0,0.95), 0 0 3px #000, 0 0 1px #000',
                        fontFamily: 'Anton, Impact, sans-serif',
                      }}
                      className="absolute w-[90%] left-[5%] text-center font-bold tracking-tight uppercase cursor-move hover:outline hover:outline-dashed hover:outline-amber-400 rounded px-1 transition-all z-20 select-none pointer-events-auto"
                    >
                      {titleText}
                    </div>

                    {/* Subtitle Layer */}
                    <div
                      onMouseDown={(e) => handleMouseDown('subtitle', e)}
                      style={{
                        top: `${(activeSubtitleY / 1920) * 100}%`,
                        color: normalizeHexColor(activeSubtitleColor),
                        fontSize: `${Math.round((activeSubtitleSize / 1920) * 440)}px`,
                        textShadow: '0 2px 6px rgba(0,0,0,0.95), 0 0 2px #000',
                        fontFamily: 'Anton, Impact, sans-serif',
                      }}
                      className="absolute w-[90%] left-[5%] text-center font-bold uppercase tracking-tight cursor-move hover:outline hover:outline-dashed hover:outline-amber-400 rounded px-1 transition-all z-20 select-none pointer-events-auto"
                    >
                      {subtitleText}
                    </div>

                    {/* Canvas Play/Pause Click Trigger */}
                    <div
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="absolute inset-0 z-10 cursor-pointer flex items-center justify-center group"
                    >
                      {!isPlaying && (
                        <div className="w-12 h-12 rounded-full bg-black/60 border border-white/20 text-white flex items-center justify-center backdrop-blur-sm group-hover:scale-110 transition-transform">
                          <Play className="w-6 h-6 ml-1 text-amber-400 fill-current" />
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Exported FFmpeg MP4 Output */
                  <video
                    key={previewUrl || 'none'}
                    src={previewUrl || ''}
                    controls
                    autoPlay
                    loop
                    className="w-full h-full object-cover z-10"
                  />
                )}
              </div>
            </div>

            {/* Real-time Transport Toolbar under Phone Mockup */}
            <div className="w-full mt-4 p-3 bg-neutral-900 rounded-xl border border-neutral-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="w-8 h-8 rounded-lg bg-amber-400 hover:bg-amber-300 text-black flex items-center justify-center font-bold transition-all shadow-sm"
                    title="Play / Pause (Spacebar)"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5 fill-current" />}
                  </button>
                  <button
                    onClick={() => handleSeek(0)}
                    className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 flex items-center justify-center transition-all"
                    title="Jump to Start (0s)"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-mono text-xs text-neutral-300 font-semibold pl-1">
                    {currentTime.toFixed(1)}s / {currentTotalDuration.toFixed(1)}s
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                      isMuted ? 'bg-red-500/20 text-red-400' : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                    }`}
                    title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
                  >
                    {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  </button>
                  {previewUrl && (
                    <button
                      onClick={() => setPreviewMode(previewMode === 'realtime' ? 'rendered' : 'realtime')}
                      className="text-xs px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-amber-400 font-semibold flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      {previewMode === 'realtime' ? 'MP4' : 'Live'}
                    </button>
                  )}
                </div>
              </div>

              {/* Quick CapCut Editing Shortcuts */}
              <div className="grid grid-cols-4 gap-1.5 pt-1 border-t border-neutral-800">
                <button
                  onClick={handleSplitSlotAtPlayhead}
                  className="p-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[10px] font-semibold flex items-center justify-center gap-1 transition-all"
                  title="Cut / Split clip at playhead position"
                >
                  <Scissors className="w-3 h-3 text-amber-400" /> Split
                </button>
                <button
                  onClick={() => {
                    setClipPickerSlotIndex(selectedSlotIndex);
                    setShowClipPickerModal(true);
                  }}
                  className="p-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[10px] font-semibold flex items-center justify-center gap-1 transition-all"
                  title="Swap raw video clip for this slot"
                >
                  <Folder className="w-3 h-3 text-cyan-400" /> Swap
                </button>
                <button
                  onClick={() => handleDuplicateSlot(selectedSlotIndex)}
                  className="p-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[10px] font-semibold flex items-center justify-center gap-1 transition-all"
                  title="Duplicate active slot"
                >
                  <Copy className="w-3 h-3 text-emerald-400" /> Clone
                </button>
                <button
                  disabled={currentTemplateSlots.length <= 2}
                  onClick={() => handleDeleteSlot(selectedSlotIndex)}
                  className="p-1.5 rounded bg-neutral-800 hover:bg-red-950 text-red-400 text-[10px] font-semibold flex items-center justify-center gap-1 disabled:opacity-40 transition-all"
                  title="Delete active slot"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            </div>

            {/* Quick Actions underneath phone */}
            <div className="w-full mt-3 flex items-center justify-between text-xs text-neutral-500">
              <span className="text-[11px]">Safe Area: 1080x1920 (9:16)</span>
              <span className="text-[10px] text-neutral-400">Spacebar: Play/Pause</span>
            </div>
          </Card>
        </div>
      </div>

      {/* Modal: New Template */}
      {showNewTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-4 shadow-2xl text-white">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                New CapCut-Style Template
              </h3>
              <button
                onClick={() => setShowNewTemplateModal(false)}
                className="w-7 h-7 rounded-full bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center"
              >
                <X className="w-4 h-4 text-neutral-400" />
              </button>
            </div>
            <p className="text-xs text-neutral-400">
              Create a viral format preset with a locked audio track and layout.
            </p>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-300">Template Name</label>
                <Input
                  value={newTplName}
                  onChange={(e) => setNewTplName(e.target.value)}
                  placeholder="e.g. Flash Deal Drop"
                  className="bg-neutral-800 border-neutral-700 text-xs text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-300">Fixed Background Music Track</label>
                <select
                  value={newTplMusic}
                  onChange={(e) => setNewTplMusic(e.target.value)}
                  className="w-full text-xs rounded-input bg-neutral-800 border border-neutral-700 p-2.5 text-white focus:outline-none"
                >
                  {musicTracks.map((m) => (
                    <option key={m.id} value={m.filename}>
                      {m.name} ({m.size_kb} KB)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-300">Base Motion Style</label>
                <select
                  value={newTplBase}
                  onChange={(e) => setNewTplBase(e.target.value)}
                  className="w-full text-xs rounded-input bg-neutral-800 border border-neutral-700 p-2.5 text-white focus:outline-none"
                >
                  <option value="punchy_zoom">Punchy Zoom (High Energy Beats)</option>
                  <option value="smooth_flow">Smooth Flow (Aesthetic Ambient)</option>
                  <option value="promo_pop">Promo Pop (Flash Discount Focus)</option>
                  <option value="classic_hook">Classic Hook (High-Conversion Pitch)</option>
                  <option value="clean_showcase">Clean Showcase (Minimal Modern)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-300">Framing Mode</label>
                <select
                  value={newTplCrop}
                  onChange={(e) => setNewTplCrop(e.target.value)}
                  className="w-full text-xs rounded-input bg-neutral-800 border border-neutral-700 p-2.5 text-white focus:outline-none"
                >
                  <option value="auto">Auto (Smart Horizontal/Vertical)</option>
                  <option value="contain_blur">Contain Blur (Ambient Backdrop)</option>
                  <option value="cover">Cover (Full Bleed Center Crop)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowNewTemplateModal(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreateTemplate}
                className="text-xs bg-amber-500 hover:bg-amber-600 text-black font-semibold"
              >
                Create Template
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: New Custom Style */}
      {showNewStyleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-4 shadow-2xl text-white">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold flex items-center gap-1.5">
                <Plus className="w-4 h-4" />
                New Custom Style
              </h3>
              <button
                onClick={() => setShowNewStyleModal(false)}
                className="w-7 h-7 rounded-full bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center"
              >
                <X className="w-4 h-4 text-neutral-400" />
              </button>
            </div>
            <p className="text-xs text-neutral-400">
              Duplicate an existing style blueprint to build a customized variant.
            </p>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-300">Style Name</label>
                <Input
                  value={newStyleName}
                  onChange={(e) => setNewStyleName(e.target.value)}
                  placeholder="e.g. Neon Cyber Zoom"
                  className="bg-neutral-800 border-neutral-700 text-xs text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-300">Base Motion Style</label>
                <select
                  value={newStyleBase}
                  onChange={(e) => setNewStyleBase(e.target.value)}
                  className="w-full text-xs rounded-input bg-neutral-800 border border-neutral-700 p-2.5 text-white focus:outline-none"
                >
                  <option value="punchy_zoom">Punchy Zoom</option>
                  <option value="smooth_flow">Smooth Flow</option>
                  <option value="promo_pop">Promo Pop</option>
                  <option value="classic_hook">Classic Hook</option>
                  <option value="clean_showcase">Clean Showcase</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowNewStyleModal(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreateCustomStyle}
                className="text-xs bg-white text-black font-semibold"
              >
                Create Style
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: CapCut Clip Picker */}
      {showClipPickerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4 shadow-2xl text-white max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <Film className="w-4 h-4 text-amber-400" />
                  Select Footage for Slot #{(clipPickerSlotIndex ?? selectedSlotIndex) + 1}
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Choose video footage from product clips or upload a new clip to insert into this cut.
                </p>
              </div>
              <button
                onClick={() => setShowClipPickerModal(false)}
                className="w-7 h-7 rounded-full bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center"
              >
                <X className="w-4 h-4 text-neutral-400" />
              </button>
            </div>

            {/* Upload New Clip Quick Action */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-800/60 border border-dashed border-neutral-700">
              <div className="flex items-center gap-2 text-xs text-neutral-300">
                <Upload className="w-4 h-4 text-amber-400" />
                <span>Upload video footage directly (.mp4, .mov):</span>
              </div>
              <input
                ref={clipFileInputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/webm"
                onChange={handleUploadClip}
                className="hidden"
                id="slot-clip-file-upload"
              />
              <label
                htmlFor="slot-clip-file-upload"
                className="cursor-pointer px-3 py-1.5 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-xs font-semibold text-white flex items-center gap-1.5 transition-all"
              >
                {uploadingClip ? <RotateCcw className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                {uploadingClip ? 'Uploading...' : 'Upload Clip'}
              </label>
            </div>

            {/* Clips Grid */}
            <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-3 pr-1 py-1">
              {productClips.length === 0 ? (
                <div className="col-span-full py-8 text-center text-xs text-neutral-500">
                  No video clips found for this product. Upload one above or select another product!
                </div>
              ) : (
                productClips.map((clip) => {
                  const isCurrentInSlot =
                    currentTemplateSlots[clipPickerSlotIndex ?? selectedSlotIndex]?.clip_path === clip.file_path;

                  return (
                    <div
                      key={clip.id}
                      onClick={() => handleAssignClip(clipPickerSlotIndex ?? selectedSlotIndex, clip)}
                      className={`rounded-xl border p-2.5 transition-all cursor-pointer flex flex-col justify-between group select-none ${
                        isCurrentInSlot
                          ? 'border-amber-400 bg-amber-400/10'
                          : 'border-neutral-800 bg-neutral-950 hover:border-neutral-600 hover:bg-neutral-800/40'
                      }`}
                    >
                      <div className="relative aspect-[9/16] max-h-36 w-full rounded-lg bg-black overflow-hidden flex items-center justify-center mb-2">
                        <video
                          src={`/api/storage/preview/${encodeURIComponent(clip.file_path)}`}
                          muted
                          preload="metadata"
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute bottom-1 right-1 font-mono text-[9px] bg-black/80 px-1 py-0.5 rounded text-neutral-200">
                          {clip.duration.toFixed(1)}s
                        </span>
                        {isCurrentInSlot && (
                          <span className="absolute top-1 left-1 font-mono text-[9px] bg-amber-400 text-black px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                            <Check className="w-2.5 h-2.5" /> In Slot
                          </span>
                        )}
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs font-semibold truncate text-neutral-200" title={clip.filename}>
                          {clip.filename}
                        </p>
                        <div className="flex items-center justify-between text-[10px] text-neutral-400">
                          <span>{clip.resolution || '1080p'}</span>
                          <span>{clip.tags || 'footage'}</span>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant={isCurrentInSlot ? 'primary' : 'secondary'}
                        className="w-full mt-2 text-[11px] h-7"
                      >
                        {isCurrentInSlot ? 'Active Clip' : 'Select Clip'}
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
