import React, { useState, useEffect, useRef } from 'react';
import { Button, Card, Input, Badge } from '../components/ui';
import {
  Play,
  Copy,
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
  Move,
  X,
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

export const StyleStudioPage: React.FC = () => {
  const [styles, setStyles] = useState<StyleSpecData[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<StyleSpecData | null>(null);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [musicTracks, setMusicTracks] = useState<MusicTrackItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [selectedMusicTrack, setSelectedMusicTrack] = useState<string>('random');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [settingDefaultLoading, setSettingDefaultLoading] = useState(false);
  const [savingStyleLoading, setSavingStyleLoading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [titleText, setTitleText] = useState('ATTACK SHARK X11');
  const [subtitleText, setSubtitleText] = useState('VIRAL WIRELESS GAMING MOUSE');
  const [actionAlert, setActionAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // New Custom Style Modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newStyleName, setNewStyleName] = useState('');
  const [newStyleBase, setNewStyleBase] = useState('punchy_zoom');

  // Dragging state in phone canvas
  const phoneCanvasRef = useRef<HTMLDivElement>(null);
  const [draggingLayer, setDraggingLayer] = useState<string | null>(null);

  useEffect(() => {
    fetchStyles();
    fetchProducts();
    fetchMusicTracks();
  }, []);

  const fetchStyles = async () => {
    try {
      const data = await api.get<StyleSpecData[]>('/api/styles');
      const list = data || [];
      setStyles(list);
      if (list.length > 0) {
        const def = list.find((s) => s.is_default) || list[0];
        setSelectedStyle((prev) => {
          if (!prev) return def;
          return list.find((s) => s.id === prev.id) || def;
        });
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

  const handleSelectStyle = (s: StyleSpecData) => {
    setSelectedStyle(s);
    setHasUnsavedChanges(false);
    setPreviewUrl(null);
  };

  // Update a text layer property in current style spec
  const handleUpdateLayer = (layerName: string, updates: Partial<TextLayerConfig>) => {
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

  // Convert color to standard hex format for HTML display
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

  // Convert hex color back to FFmpeg format (e.g. 0xEFD34C for yellow or #FFFFFF)
  const formatColorForFFmpeg = (hex: string) => {
    if (hex.startsWith('#')) {
      return '0x' + hex.slice(1).toUpperCase();
    }
    return hex;
  };

  // Save current style customizations to backend
  const handleSaveStyle = async () => {
    if (!selectedStyle) return;
    setSavingStyleLoading(true);
    try {
      await api.put(`/api/styles/${selectedStyle.id}`, {
        spec: selectedStyle.spec,
      });
      setHasUnsavedChanges(false);
      setActionAlert({
        type: 'success',
        message: `Style "${selectedStyle.name}" updated successfully. All future renders will use your custom colors and positions.`,
      });
      await fetchStyles();
    } catch (err: any) {
      setActionAlert({
        type: 'error',
        message: 'Failed to save style: ' + (err.message || 'Unknown error'),
      });
    } finally {
      setSavingStyleLoading(false);
    }
  };

  // Reset style to factory default
  const handleResetStyle = async () => {
    if (!selectedStyle) return;
    if (!confirm(`Reset "${selectedStyle.name}" back to factory default template values?`)) return;
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

  // Create new custom style
  const handleCreateCustomStyle = async () => {
    if (!newStyleName.trim()) return;
    try {
      const res = await api.post('/api/styles/create-custom', {
        name: newStyleName.trim(),
        base_style_id: newStyleBase,
      });
      await fetchStyles();
      setShowNewModal(false);
      setNewStyleName('');
      setActionAlert({
        type: 'success',
        message: `Custom style "${res.name}" created! You can now adjust colors, fonts, and positions.`,
      });
    } catch (err: any) {
      setActionAlert({
        type: 'error',
        message: 'Failed to create style: ' + (err.message || 'Unknown error'),
      });
    }
  };

  // Delete custom style
  const handleDeleteCustomStyle = async (id: string, name: string) => {
    if (!confirm(`Delete custom style "${name}"?`)) return;
    try {
      await api.delete(`/api/styles/${id}`);
      await fetchStyles();
      setActionAlert({ type: 'success', message: `Custom style "${name}" deleted.` });
    } catch (err: any) {
      setActionAlert({ type: 'error', message: 'Delete failed: ' + (err.message || 'Cannot delete built-in style') });
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

  const handleDuplicate = async (id: string) => {
    try {
      await api.post(`/api/styles/${id}/duplicate`);
      await fetchStyles();
      setActionAlert({ type: 'success', message: 'Style duplicated successfully.' });
    } catch (err: any) {
      setActionAlert({ type: 'error', message: 'Duplicate failed: ' + (err.message || 'Unknown error') });
    }
  };

  const handlePreviewRender = async () => {
    if (!selectedStyle) return;
    try {
      setPreviewLoading(true);
      setActionAlert(null);
      const data = await api.post('/api/styles/preview', {
        style_id: selectedStyle.id,
        product_id: selectedProductId,
        music_track: selectedMusicTrack,
        title: titleText,
        subtitle: subtitleText,
        sample_duration: 6.0,
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

  // Handle Drag on Phone Mockup Canvas to reposition text Y coordinate
  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!draggingLayer || !phoneCanvasRef.current || !selectedStyle) return;
    const rect = phoneCanvasRef.current.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    // Map phone mockup height (498px) to 1920px video canvas
    const rawY = Math.round((offsetY / rect.height) * 1920);
    const clampedY = Math.max(120, Math.min(1720, rawY));
    handleUpdateLayer(draggingLayer, { position_y: clampedY });
  };

  const handleCanvasMouseUp = () => {
    setDraggingLayer(null);
  };

  const titleLayer = selectedStyle?.spec?.text_layers?.find((l) => l.name === 'title');
  const subtitleLayer = selectedStyle?.spec?.text_layers?.find((l) => l.name === 'subtitle');
  const captionLayer = selectedStyle?.spec?.text_layers?.find((l) => l.name === 'clip_caption');
  const ctaLayer = selectedStyle?.spec?.text_layers?.find((l) => l.name === 'cta');
  const secondaryLayer = subtitleLayer || captionLayer;
  const secondaryLayerName = subtitleLayer ? 'subtitle' : (captionLayer ? 'clip_caption' : 'subtitle');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Sliders className="h-6 w-6" /> Style Studio
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Build, customize colors, drag typography, and preview real-time TikTok styles with beat-cutting and motion effects.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowNewModal(true)}
            className="text-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> New Custom Style
          </Button>

          {selectedStyle && (
            selectedStyle.is_default ? (
              <Badge variant="default" className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 px-3 py-1.5 text-xs flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5" /> Active Default Style
              </Badge>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSetDefaultStyle}
                disabled={settingDefaultLoading}
                className="text-xs"
              >
                <Check className="h-3.5 w-3.5 mr-1 text-neutral-400" />
                Set as Default Style
              </Button>
            )
          )}

          <Button
            variant="primary"
            size="sm"
            onClick={handleSaveStyle}
            disabled={savingStyleLoading || !hasUnsavedChanges}
            className={`text-xs gap-1.5 ${hasUnsavedChanges ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
          >
            <Save className="h-3.5 w-3.5" />
            {savingStyleLoading ? 'Saving...' : hasUnsavedChanges ? 'Save Changes' : 'Saved'}
          </Button>

          <Button variant="primary" size="sm" onClick={handlePreviewRender} disabled={previewLoading}>
            <Play className="h-4 w-4 mr-1.5" />
            {previewLoading ? 'Rendering 5s Preview...' : 'Preview Render'}
          </Button>
        </div>
      </div>

      {/* Notification banner */}
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Style Selector, Asset Source & Visual Customizer */}
        <div className="lg:col-span-7 space-y-6">
          {/* Style Selector Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {styles.map((s) => {
              const isSelected = selectedStyle?.id === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => handleSelectStyle(s)}
                  className={`p-3 text-left rounded-lg border transition-all relative ${
                    isSelected
                      ? 'border-neutral-900 dark:border-white bg-neutral-100 dark:bg-neutral-800 font-medium shadow-sm'
                      : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900 text-neutral-500'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-mono">
                      {s.is_custom ? 'CUSTOM' : 'STYLE'}
                    </span>
                    {s.is_default && (
                      <span className="px-1.5 py-0.5 text-[9px] uppercase font-mono tracking-wider rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        DEFAULT
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">{s.name}</div>
                  <div className="text-[11px] text-neutral-400 mt-1.5 flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px] px-1 py-0">{s.crop_mode}</Badge>
                    {s.transitions_enabled && <Badge variant="secondary" className="text-[10px] px-1 py-0">Transitions</Badge>}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Form Settings & Live Visual Customizer */}
          {selectedStyle && (
            <Card className="space-y-5">
              <div className="border-b border-neutral-200 dark:border-neutral-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-base font-semibold flex items-center gap-2">
                    <span>{selectedStyle.name}</span>
                    {hasUnsavedChanges && (
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded">
                        Unsaved Edits
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">{selectedStyle.description}</div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => selectedStyle && handleDuplicate(selectedStyle.id)}
                    className="text-xs h-7 px-2"
                    title="Clone as new style"
                  >
                    <Copy className="w-3 h-3 mr-1" /> Duplicate
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleResetStyle}
                    className="text-xs h-7 px-2"
                    title="Restore factory template values"
                  >
                    <RotateCcw className="w-3 h-3 mr-1" /> Reset Default
                  </Button>
                  {selectedStyle.is_custom && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleDeleteCustomStyle(selectedStyle.id, selectedStyle.name)}
                      className="text-xs h-7 px-2 text-red-400 hover:bg-red-500/10 border-red-500/30"
                      title="Delete this custom style"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Asset Sources (Product, Music & Universal Framing Mode) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-400 flex items-center gap-1.5">
                    <Folder className="w-3.5 h-3.5 text-neutral-400" />
                    Product Footage
                  </label>
                  <select
                    value={selectedProductId || ''}
                    onChange={(e) => handleProductSelect(Number(e.target.value))}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-neutral-600 cursor-pointer"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id} className="bg-neutral-900 text-neutral-100">
                        {p.name} {p.clip_count ? `(${p.clip_count} clips)` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-400 flex items-center gap-1.5">
                    <Music className="w-3.5 h-3.5 text-neutral-400" />
                    Background Music Track
                  </label>
                  <select
                    value={selectedMusicTrack}
                    onChange={(e) => setSelectedMusicTrack(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-neutral-600 cursor-pointer"
                  >
                    <option value="random" className="bg-neutral-900 text-neutral-100">
                      Random Track (Automatic Beat Rotation)
                    </option>
                    {musicTracks.map((t) => (
                      <option key={t.id} value={t.filename} className="bg-neutral-900 text-neutral-100">
                        {t.name} ({t.size_kb} KB)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-400 flex items-center gap-1.5">
                    <Video className="w-3.5 h-3.5 text-neutral-400" />
                    Framing / Crop Mode
                  </label>
                  <select
                    value={selectedStyle.spec?.clip_rules?.crop_mode || selectedStyle.crop_mode || 'auto'}
                    onChange={(e) => handleCropModeChange(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-neutral-600 cursor-pointer"
                  >
                    <option value="auto" className="bg-neutral-900 text-neutral-100">
                      Auto (Smart Ambient Glow for Landscape, Full Bleed for Vertical)
                    </option>
                    <option value="contain_blur" className="bg-neutral-900 text-neutral-100">
                      Contain Blur (Ambient Glow Backdrop)
                    </option>
                    <option value="cover" className="bg-neutral-900 text-neutral-100">
                      Full Bleed Cover (Classic Zoom Crop)
                    </option>
                  </select>
                </div>
              </div>

              {/* Sample Hook Texts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-500">Preview Title (Line 1 Hook)</label>
                  <Input
                    value={titleText}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitleText(e.target.value)}
                    placeholder="Line 1 Hook"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-500">Preview Subtitle (Line 2 Subhook)</label>
                  <Input
                    value={subtitleText}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSubtitleText(e.target.value)}
                    placeholder="Line 2 Detail"
                  />
                </div>
              </div>

              {/* Visual Typography Customizer & Sliders */}
              <div className="border-t border-neutral-200 dark:border-neutral-800 pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-neutral-300">
                    Typography, Colors & Position Editor:
                  </span>
                  <span className="text-[11px] text-neutral-500">
                    Tip: You can also drag text directly on the phone canvas!
                  </span>
                </div>

                {/* Title Layer Editor */}
                {titleLayer && (
                  <div className="p-3.5 rounded-lg border border-neutral-800 bg-neutral-900/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-neutral-200 uppercase tracking-wider">
                        Title / Main Hook Layer
                      </span>
                      <span className="text-[11px] font-mono text-neutral-400">
                        Y: {titleLayer.position_y}px | Size: {titleLayer.max_size}px
                      </span>
                    </div>

                    {/* Color selection */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-neutral-400">Color Palette</label>
                      <div className="flex flex-wrap items-center gap-2">
                        {PRESET_COLORS.map((c) => {
                          const isActive = normalizeHexColor(titleLayer.color).toLowerCase() === c.hex.toLowerCase();
                          return (
                            <button
                              key={c.hex}
                              onClick={() => handleUpdateLayer('title', { color: formatColorForFFmpeg(c.hex) })}
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] border transition ${
                                isActive ? 'border-white bg-neutral-800 text-white font-medium' : 'border-neutral-800 text-neutral-400 hover:border-neutral-600'
                              }`}
                            >
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.hex }} />
                              {c.name}
                            </button>
                          );
                        })}
                        <div className="flex items-center gap-1 ml-auto">
                          <input
                            type="color"
                            value={normalizeHexColor(titleLayer.color)}
                            onChange={(e) => handleUpdateLayer('title', { color: formatColorForFFmpeg(e.target.value) })}
                            className="w-6 h-6 rounded border-0 bg-transparent cursor-pointer"
                            title="Custom Color Picker"
                          />
                          <span className="font-mono text-xs text-neutral-400">
                            {normalizeHexColor(titleLayer.color).toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Font size & Vertical Position Sliders */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-neutral-400">
                          <span>Max Font Size</span>
                          <span className="font-mono">{titleLayer.max_size}px</span>
                        </div>
                        <input
                          type="range"
                          min="60"
                          max="160"
                          step="2"
                          value={titleLayer.max_size}
                          onChange={(e) => handleUpdateLayer('title', { max_size: Number(e.target.value) })}
                          className="w-full accent-white h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-neutral-400">
                          <span>Vertical Position (Y)</span>
                          <span className="font-mono">{titleLayer.position_y}px</span>
                        </div>
                        <input
                          type="range"
                          min="120"
                          max="1600"
                          step="10"
                          value={titleLayer.position_y}
                          onChange={(e) => handleUpdateLayer('title', { position_y: Number(e.target.value) })}
                          className="w-full accent-white h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Subtitle / Caption Layer Editor */}
                {secondaryLayer && (
                  <div className="p-3.5 rounded-lg border border-neutral-800 bg-neutral-900/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-neutral-200 uppercase tracking-wider">
                        {secondaryLayerName === 'subtitle' ? 'Subtitle / Line 2 Subhook' : 'Clip Caption Layer'}
                      </span>
                      <span className="text-[11px] font-mono text-neutral-400">
                        Y: {secondaryLayer.position_y}px | Size: {secondaryLayer.max_size}px
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] text-neutral-400">Color Palette</label>
                      <div className="flex flex-wrap items-center gap-2">
                        {PRESET_COLORS.map((c) => {
                          const isActive = normalizeHexColor(secondaryLayer.color).toLowerCase() === c.hex.toLowerCase();
                          return (
                            <button
                              key={c.hex}
                              onClick={() => handleUpdateLayer(secondaryLayerName, { color: formatColorForFFmpeg(c.hex) })}
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] border transition ${
                                isActive ? 'border-white bg-neutral-800 text-white font-medium' : 'border-neutral-800 text-neutral-400 hover:border-neutral-600'
                              }`}
                            >
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.hex }} />
                              {c.name}
                            </button>
                          );
                        })}
                        <div className="flex items-center gap-1 ml-auto">
                          <input
                            type="color"
                            value={normalizeHexColor(secondaryLayer.color)}
                            onChange={(e) => handleUpdateLayer(secondaryLayerName, { color: formatColorForFFmpeg(e.target.value) })}
                            className="w-6 h-6 rounded border-0 bg-transparent cursor-pointer"
                          />
                          <span className="font-mono text-xs text-neutral-400">
                            {normalizeHexColor(secondaryLayer.color).toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-neutral-400">
                          <span>Max Font Size</span>
                          <span className="font-mono">{secondaryLayer.max_size}px</span>
                        </div>
                        <input
                          type="range"
                          min="40"
                          max="140"
                          step="2"
                          value={secondaryLayer.max_size}
                          onChange={(e) => handleUpdateLayer(secondaryLayerName, { max_size: Number(e.target.value) })}
                          className="w-full accent-white h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-neutral-400">
                          <span>Vertical Position (Y)</span>
                          <span className="font-mono">{secondaryLayer.position_y}px</span>
                        </div>
                        <input
                          type="range"
                          min="150"
                          max="1750"
                          step="10"
                          value={secondaryLayer.position_y}
                          onChange={(e) => handleUpdateLayer(secondaryLayerName, { position_y: Number(e.target.value) })}
                          className="w-full accent-white h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Pro Transitions & Motion Engine */}
                <div className="border-t border-neutral-200 dark:border-neutral-800 pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-neutral-400" /> Professional Motion & Transitions
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono capitalize">
                      {selectedStyle.cut_mode.replace('_', ' ')}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded border border-neutral-800 bg-neutral-900/40 space-y-1">
                      <div className="text-[11px] font-medium text-neutral-400">Camera Motion Sequence</div>
                      <div className="text-xs font-semibold text-neutral-200">
                        {selectedStyle.id === 'punchy_zoom'
                          ? 'Explosive Snap Punch (1.28x) + Whip Pans & Macro Zoom'
                          : selectedStyle.id === 'smooth_flow'
                          ? '4-Way Continuous Luxury Gimbal Drift (Zoom + Pan L/R)'
                          : selectedStyle.id === 'clean_showcase'
                          ? 'Ambient Blur Backdrop + Slow Float'
                          : 'High-Conversion Slide + CTA Pop'}
                      </div>
                    </div>

                    <div className="p-3 rounded border border-neutral-800 bg-neutral-900/40 space-y-1">
                      <div className="text-[11px] font-medium text-neutral-400">Cut Transition Effect</div>
                      <div className="text-xs font-semibold text-neutral-200">
                        {selectedStyle.id === 'punchy_zoom'
                          ? 'Optical White Flash Hit on Beat Drop (0.08s)'
                          : selectedStyle.id === 'smooth_flow'
                          ? 'Silky Soft Dissolve & Seamless Crossfade'
                          : selectedStyle.id === 'clean_showcase'
                          ? 'Soft Crossfade with Blurred Frame Fill'
                          : 'Dynamic Slide In with Highlight Accent'}
                      </div>
                    </div>
                  </div>

                  {/* Rhythm & Pacing */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                    <div className="p-2 rounded bg-neutral-900/60 border border-neutral-800">
                      <span className="text-neutral-500 block">Cut Timing</span>
                      <span className="font-semibold text-neutral-200">
                        {selectedStyle.id === 'punchy_zoom' ? 'Fast (1.3s – 2 Beats)' : selectedStyle.id === 'smooth_flow' ? 'Melodic (2.6s – 4 Beats)' : '2.2s Beat-Synced'}
                      </span>
                    </div>
                    <div className="p-2 rounded bg-neutral-900/60 border border-neutral-800">
                      <span className="text-neutral-500 block">Audio Beat Lock</span>
                      <span className="font-semibold text-emerald-400">100% Transient Synced</span>
                    </div>
                    <div className="p-2 rounded bg-neutral-900/60 border border-neutral-800 col-span-2 sm:col-span-1">
                      <span className="text-neutral-500 block">Canvas</span>
                      <span className="font-semibold text-neutral-200 font-mono">1080x1920 (30fps)</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Right: Phone-shaped 9:16 Interactive Preview Canvas */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div
            ref={phoneCanvasRef}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            className="relative w-[280px] h-[498px] rounded-[36px] border-4 border-neutral-800 bg-black overflow-hidden shadow-2xl flex flex-col justify-between p-4 text-center select-none"
          >
            {/* Phone notch */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-4 bg-neutral-800 rounded-full z-20 pointer-events-none"></div>

            {/* Rendering Progress Animation Overlay */}
            {previewLoading && (
              <div className="absolute inset-0 bg-neutral-950/95 z-40 flex flex-col items-center justify-center p-6 text-center select-none backdrop-blur-sm animate-fadeIn">
                <div className="relative mb-5">
                  <div className="w-16 h-16 rounded-full border-2 border-neutral-800 border-t-white animate-spin"></div>
                  <Video className="w-6 h-6 text-white absolute inset-0 m-auto animate-pulse" />
                </div>
                <div className="text-xs font-semibold uppercase tracking-wider text-white">Rendering FFmpeg Preview</div>
                <div className="text-[11px] text-neutral-400 mt-2 max-w-[200px] leading-relaxed">
                  Slicing vertical clips, detecting audio beats & burning typography...
                </div>
                <div className="w-36 h-1 bg-neutral-800 rounded-full mt-4 overflow-hidden">
                  <div className="w-full h-full bg-gradient-to-r from-neutral-600 via-white to-neutral-600 animate-pulse"></div>
                </div>
              </div>
            )}

            {/* Video preview / Interactive simulated canvas */}
            {previewUrl ? (
              <div className="absolute inset-0 bg-black flex items-center justify-center">
                <video
                  key={previewUrl}
                  src={previewUrl}
                  autoPlay
                  loop
                  controls
                  playsInline
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <>
                <div className="absolute inset-0 bg-gradient-to-b from-neutral-900 via-neutral-950 to-neutral-900 opacity-90 flex flex-col items-center justify-center pointer-events-none">
                  <Video className="h-10 w-10 text-neutral-600 mb-2" />
                  <span className="text-[11px] text-neutral-500 font-mono">Live 9:16 Canvas</span>
                </div>

                {/* Draggable Title Layer */}
                <div
                  onMouseDown={() => setDraggingLayer('title')}
                  style={{
                    position: 'absolute',
                    top: `${((titleLayer?.position_y || 240) / 1920) * 100}%`,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '90%',
                    cursor: 'grab',
                  }}
                  className={`group select-none transition-shadow rounded p-1 ${
                    draggingLayer === 'title' ? 'ring-1 ring-white bg-white/10' : 'hover:ring-1 hover:ring-neutral-600'
                  }`}
                  title="Click and drag up or down to reposition"
                >
                  <div
                    className="font-bold tracking-tight text-center drop-shadow-md leading-tight"
                    style={{
                      fontFamily: 'Impact, Anton, sans-serif',
                      color: normalizeHexColor(titleLayer?.color || '#EFD34C'),
                      fontSize: `${Math.round(((titleLayer?.max_size || 120) / 1080) * 280)}px`,
                      WebkitTextStroke: '1px black',
                    }}
                  >
                    {titleText}
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition text-[9px] text-neutral-400 font-mono mt-0.5 flex items-center justify-center gap-1">
                    <Move className="w-2.5 h-2.5" /> Drag Y: {titleLayer?.position_y}px
                  </div>
                </div>

                {/* Draggable Subtitle / Caption Layer */}
                {secondaryLayer && (
                  <div
                    onMouseDown={() => setDraggingLayer(secondaryLayerName)}
                    style={{
                      position: 'absolute',
                      top: `${(((secondaryLayer?.position_y || 380) / 1920) * 100)}%`,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '90%',
                      cursor: 'grab',
                    }}
                    className={`group select-none transition-shadow rounded p-1 ${
                      draggingLayer === secondaryLayerName ? 'ring-1 ring-white bg-white/10' : 'hover:ring-1 hover:ring-neutral-600'
                    }`}
                    title="Click and drag up or down to reposition"
                  >
                    <div
                      className="font-bold tracking-tight text-center drop-shadow-md text-white leading-tight"
                      style={{
                        fontFamily: 'Impact, Anton, sans-serif',
                        color: normalizeHexColor(secondaryLayer?.color || '#FFFFFF'),
                        fontSize: `${Math.round((((secondaryLayer?.max_size || 90) / 1080) * 280))}px`,
                        WebkitTextStroke: '1px black',
                      }}
                    >
                      {subtitleText}
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition text-[9px] text-neutral-400 font-mono mt-0.5 flex items-center justify-center gap-1">
                      <Move className="w-2.5 h-2.5" /> Drag Y: {secondaryLayer?.position_y}px
                    </div>
                  </div>
                )}

                {/* Bottom CTA Layer (if present in style) */}
                {ctaLayer && (
                  <div
                    style={{
                      position: 'absolute',
                      top: `${((ctaLayer.position_y || 1600) / 1920) * 100}%`,
                      left: '50%',
                      transform: 'translateX(-50%)',
                    }}
                    className="z-10 select-none"
                  >
                    <div className="inline-block px-3 py-1 bg-red-600 text-white font-bold text-[10px] rounded uppercase tracking-wider border border-yellow-400 shadow">
                      Tap Basket to Order
                    </div>
                  </div>
                )}

                {/* Bottom Safe Area guide */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[9px] text-neutral-500 font-mono pointer-events-none">
                  Safe Area 1080x1920
                </div>
              </>
            )}
          </div>

          <div className="text-xs text-neutral-500 mt-3 text-center space-y-2">
            <div>
              {previewUrl ? (
                <div className="flex items-center gap-2 justify-center">
                  <Button variant="secondary" size="sm" onClick={() => setPreviewUrl(null)} className="text-xs">
                    <RotateCcw className="w-3.5 h-3.5 mr-1" /> Edit Layout & Layers
                  </Button>
                  <Button variant="primary" size="sm" onClick={handlePreviewRender} disabled={previewLoading} className="text-xs">
                    <Play className="w-3.5 h-3.5 mr-1" /> Re-Render Preview
                  </Button>
                </div>
              ) : (
                <span>Drag text on canvas or use sliders, then click <strong>Preview Render</strong>.</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* New Custom Style Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <Card className="relative w-full max-w-md bg-neutral-900 border-neutral-800 p-5 space-y-4 text-white">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <Plus className="w-4 h-4" /> Create New Custom Style
              </h3>
              <button
                onClick={() => setShowNewModal(false)}
                className="w-7 h-7 rounded-full bg-neutral-800 flex items-center justify-center hover:bg-neutral-700"
              >
                <X className="w-4 h-4 text-neutral-400" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-400">Style Name</label>
                <Input
                  value={newStyleName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewStyleName(e.target.value)}
                  placeholder="e.g. Neon Yellow Punch"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-400">Base Template to Copy</label>
                <select
                  value={newStyleBase}
                  onChange={(e) => setNewStyleBase(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2 text-xs text-neutral-100 focus:outline-none cursor-pointer"
                >
                  <option value="punchy_zoom">Punchy Zoom (Fast cuts + zoom punches)</option>
                  <option value="smooth_flow">Smooth Flow (Soft dissolves + slow drift)</option>
                  <option value="classic_hook">Classic Hook (High-converting yellow Anton)</option>
                  <option value="clean_showcase">Clean Showcase (Blurred background fill)</option>
                  <option value="promo_pop">Promo Pop (CTA banner + slide transitions)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
              <Button variant="secondary" size="sm" onClick={() => setShowNewModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleCreateCustomStyle} disabled={!newStyleName.trim()}>
                Create Style
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
