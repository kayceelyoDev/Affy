import React, { useState, useEffect, useRef } from 'react';
import { Button, Card, Input, Badge } from '../components/ui';
import {
  Play,
  Sliders,
  Video,
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
} from 'lucide-react';
import { api } from '../api/client';

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
        setTitleText(defaultProd.name.split('-')[0].trim());
        setSubtitleText('VIRAL MUST-HAVE DEAL');
      }
    } catch (err) {
      console.error('Failed to load products', err);
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

  const currentTemplateSlots = selectedTemplate?.slots || [];
  const currentSelectedSlot = currentTemplateSlots[selectedSlotIndex] || currentTemplateSlots[0] || null;
  const currentTotalDuration = selectedTemplate?.target_duration || currentTemplateSlots.reduce((a, b) => a + b.duration, 0);

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
          {/* Timeline Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-200 dark:border-neutral-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5" />
                  CapCut Multi-Track Timeline
                </span>
                <span className="text-xs font-mono bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 px-2 py-0.5 rounded">
                  {currentTemplateSlots.length} Slots • {currentTotalDuration.toFixed(1)}s Total
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                Edit slot durations, cut transitions, and camera motion effects. When new clips are assigned, the cuts stay strictly on this timeline.
              </p>
            </div>

            <div className="flex items-center gap-2">
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
                className="text-xs gap-1 text-red-500 hover:text-red-600"
                title="Delete currently selected slot (min 2)"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </Button>
            </div>
          </div>

          {/* Visual Multi-Track Canvas */}
          <div className="space-y-2 bg-neutral-900 rounded-xl p-4 border border-neutral-800 text-neutral-100 overflow-x-auto shadow-inner">
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
                  const flexWidth = Math.max(120, slot.duration * 130);
                  const transObj = TRANSITION_OPTIONS.find((t) => t.id === slot.transition);
                  const IconComponent = transObj?.icon || Zap;

                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedSlotIndex(idx)}
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

                      <div className="space-y-1">
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
            <div className="w-full flex items-center justify-between mb-4">
              <span className="text-xs uppercase tracking-wider text-neutral-500 font-bold">
                9:16 Live Canvas Preview
              </span>
              <Button
                size="sm"
                variant="primary"
                disabled={previewLoading}
                onClick={handlePreviewRender}
                className="text-xs gap-1.5 bg-neutral-900 text-white dark:bg-white dark:text-black font-semibold shadow-sm"
              >
                {previewLoading ? (
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5 ml-0.5" />
                )}
                {previewLoading ? 'Rendering 5s Preview...' : 'Preview Render (5s)'}
              </Button>
            </div>

            {/* Mobile Phone Mockup Frame */}
            <div className="relative w-full max-w-[280px] aspect-[9/16] rounded-[38px] p-2 bg-neutral-900 dark:bg-neutral-950 shadow-2xl border-4 border-neutral-800">
              <div
                ref={phoneCanvasRef}
                className="relative w-full h-full rounded-[30px] overflow-hidden bg-neutral-900 flex flex-col items-center justify-start select-none"
              >
                {/* Phone Speaker Notch */}
                <div className="absolute top-2 w-20 h-4 bg-neutral-950 rounded-full z-30" />

                {/* Video Render Output if available */}
                {previewUrl ? (
                  <video
                    key={previewUrl}
                    src={previewUrl}
                    controls
                    autoPlay
                    loop
                    className="w-full h-full object-cover z-10"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-neutral-500 space-y-2">
                    <Video className="w-8 h-8 opacity-40" />
                    <span className="text-xs font-medium">Live 9:16 Canvas</span>
                    <span className="text-[10px] text-neutral-600">
                      Drag text layers or click Preview Render to see 5-second dynamic cuts.
                    </span>
                  </div>
                )}

                {/* Interactive Drag Text Layers (Displayed on canvas when no video is playing) */}
                {!previewUrl && (
                  <>
                    {/* Title Layer */}
                    <div
                      onMouseDown={(e) => handleMouseDown('title', e)}
                      style={{
                        top: `${(activeTitleY / 1920) * 100}%`,
                        color: normalizeHexColor(activeTitleColor),
                        fontSize: `${Math.round((activeTitleSize / 1920) * 440)}px`,
                      }}
                      className="absolute w-[86%] text-center font-bold tracking-tight uppercase cursor-move hover:outline hover:outline-dashed hover:outline-amber-400 rounded px-1 transition-all z-20"
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
                      }}
                      className="absolute w-[86%] text-center font-bold uppercase tracking-tight cursor-move hover:outline hover:outline-dashed hover:outline-amber-400 rounded px-1 transition-all z-20"
                    >
                      {subtitleText}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Quick Actions underneath phone */}
            <div className="w-full mt-4 flex items-center justify-between text-xs text-neutral-500">
              <span className="text-[11px]">Safe Area: 1080x1920</span>
              {previewUrl && (
                <button
                  onClick={() => setPreviewUrl(null)}
                  className="text-xs text-amber-500 hover:underline flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" /> Edit Layout & Layers
                </button>
              )}
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
    </div>
  );
};
