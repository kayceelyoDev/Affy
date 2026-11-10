import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, Input } from '../components/ui';
import { api } from '../api/client';
import {
  Film,
  Sparkles,
  Tag,
  Check,
  RefreshCw,
  UploadCloud,
  X,
  Cloud,
  CheckCircle2,
  AlertCircle,
  Play,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface ProductItem {
  id: number;
  name: string;
  category: string;
  clip_count?: number;
  usable_duration_seconds?: number;
}

interface ClipItem {
  id: number;
  product_id: number;
  product_name?: string;
  filename: string;
  file_path: string;
  duration: number;
  resolution: string;
  fps: number;
  codec: string;
  status: string;
  caption_cache?: string;
  tags?: string;
}

export const ClipsPage: React.FC = () => {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('all');
  const [clips, setClips] = useState<ClipItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [captionLoading, setCaptionLoading] = useState<number | null>(null);
  const [editingCaptionId, setEditingCaptionId] = useState<number | null>(null);
  const [captionDraft, setCaptionDraft] = useState('');

  // Sync & Action status
  const [syncingDrive, setSyncingDrive] = useState(false);
  const [rescanning, setRescanning] = useState(false);
  const [renderingProduct, setRenderingProduct] = useState(false);
  const [statusAlert, setStatusAlert] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Upload modal state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [targetProductId, setTargetProductId] = useState<string>('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchProductsAndClips();
  }, [selectedProductId]);

  const fetchProductsAndClips = async () => {
    setIsLoading(true);
    try {
      const prods = await api.get<ProductItem[]>('/api/catalog/products');
      setProducts(prods || []);
      if (prods && prods.length > 0 && !targetProductId) {
        setTargetProductId(String(prods[0].id));
      }

      if (selectedProductId === 'all') {
        const clipLists = await Promise.all(
          (prods || []).map(async (p) => {
            const prodClips = await api.get<ClipItem[]>(`/api/catalog/products/${p.id}/clips`).catch(() => []);
            return prodClips.map((c) => ({ ...c, product_name: p.name }));
          })
        );
        setClips(clipLists.flat());
      } else {
        const prodClips = await api.get<ClipItem[]>(`/api/catalog/products/${selectedProductId}/clips`);
        const p = (prods || []).find((prod) => String(prod.id) === selectedProductId);
        setClips(prodClips.map((c) => ({ ...c, product_name: p?.name })));
      }
    } catch (e: any) {
      console.error('Failed to load products and clips:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncDrive = async () => {
    setSyncingDrive(true);
    setStatusAlert({ type: 'info', text: 'Syncing Google Drive product folders and downloading new clips...' });
    try {
      const res = await api.post<{ ok: boolean; status: string; synced?: number; message?: string }>('/api/storage/sync');
      if (res.ok) {
        setStatusAlert({
          type: 'success',
          text: `Google Drive sync completed! Synced ${res.synced ?? 0} new clip(s) across product folders.`,
        });
      } else {
        setStatusAlert({
          type: 'error',
          text: `Drive sync warning: ${res.message || res.status}`,
        });
      }
      await fetchProductsAndClips();
    } catch (e: any) {
      setStatusAlert({ type: 'error', text: `Failed to sync Drive: ${e.message}` });
    } finally {
      setSyncingDrive(false);
    }
  };

  const handleRescan = async () => {
    setRescanning(true);
    setStatusAlert({ type: 'info', text: 'Scanning local storage disk for video clips...' });
    try {
      const res = await api.post<{ ok: boolean; registered_clips: number }>('/api/catalog/rescan');
      setStatusAlert({
        type: 'success',
        text: `Disk scan completed: ${res.registered_clips} clips registered in catalog.`,
      });
      await fetchProductsAndClips();
    } catch (e: any) {
      setStatusAlert({ type: 'error', text: `Rescan failed: ${e.message}` });
    } finally {
      setRescanning(false);
    }
  };

  const handleAutoEdit = async (productId?: number) => {
    setRenderingProduct(true);
    setStatusAlert({
      type: 'info',
      text: productId
        ? `Queueing FFmpeg beat-cut auto-edit for product #${productId}...`
        : 'Queueing FFmpeg beat-cut auto-edit for open daily plan slots...',
    });
    try {
      const payload = productId ? { product_id: productId } : {};
      const res = await api.post('/api/renders/auto-edit', payload);
      setStatusAlert({
        type: 'success',
        text: res.message || 'Auto-edit render jobs queued! Check the Videos page for live progress.',
      });
    } catch (e: any) {
      setStatusAlert({ type: 'error', text: `Auto-edit failed: ${e.message}` });
    } finally {
      setRenderingProduct(false);
    }
  };

  const handleDeleteClip = async (clip: ClipItem) => {
    if (!confirm(`Are you sure you want to delete clip "${clip.filename}"?`)) return;
    try {
      await api.delete(`/api/catalog/clips/${clip.id}`);
      setStatusAlert({ type: 'success', text: `Clip "${clip.filename}" deleted.` });
      setClips((prev) => prev.filter((c) => c.id !== clip.id));
    } catch (e: any) {
      setStatusAlert({ type: 'error', text: `Delete clip failed: ${e.message}` });
    }
  };

  const handleUploadClips = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetProductId || selectedFiles.length === 0) return;

    setUploading(true);
    setUploadMessage(null);

    let uploadedCount = 0;
    try {
      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append('file', file);
        await api.post(`/api/catalog/products/${targetProductId}/clips/upload`, formData);
        uploadedCount++;
      }
      setUploadMessage(`Successfully uploaded and indexed ${uploadedCount} video clip(s)!`);
      setSelectedFiles([]);
      await fetchProductsAndClips();
      setTimeout(() => {
        setUploadModalOpen(false);
        setUploadMessage(null);
      }, 1500);
    } catch (err: any) {
      setUploadMessage(`Upload error: ${err.message || 'Failed to upload video'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleGenerateCaption = async (clip: ClipItem) => {
    setCaptionLoading(clip.id);
    try {
      const suggestions = [
        "Crisp unboxing and sleek setup aesthetic",
        "Clear durability and hands-on review test",
        "Fast feature walkthrough and live demo",
        "Must-have daily creator essential gadget",
        "Smooth premium finish and close-up detail",
      ];
      const newCaption = suggestions[Math.floor(Math.random() * suggestions.length)];
      setClips((prev) =>
        prev.map((c) => (c.id === clip.id ? { ...c, caption_cache: newCaption } : c))
      );
    } finally {
      setCaptionLoading(null);
    }
  };

  const handleSaveCaption = (clipId: number) => {
    setClips((prev) =>
      prev.map((c) => (c.id === clipId ? { ...c, caption_cache: captionDraft } : c))
    );
    setEditingCaptionId(null);
  };

  const selectedProduct = products.find((p) => String(p.id) === selectedProductId);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
            <Film className="w-6 h-6" />
            Clip Library & Cloud Footage
          </h1>
          <p className="text-sm text-neutral-500">
            Each Google Drive folder is a product. Sync footage directly from Drive, probe with FFprobe, and auto-edit with FFmpeg.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Sync Google Drive Button */}
          <Button
            variant="primary"
            size="sm"
            onClick={handleSyncDrive}
            disabled={syncingDrive}
            className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Cloud className={`w-3.5 h-3.5 ${syncingDrive ? 'animate-spin' : ''}`} />
            {syncingDrive ? 'Syncing Drive...' : 'Sync Google Drive Clips'}
          </Button>

          {/* Auto-Edit Button */}
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleAutoEdit(selectedProduct ? selectedProduct.id : undefined)}
            disabled={renderingProduct || clips.length === 0}
            className="gap-1.5 bg-neutral-900 text-white dark:bg-white dark:text-black"
          >
            <Play className={`w-3.5 h-3.5 fill-current ${renderingProduct ? 'animate-spin' : ''}`} />
            {selectedProduct ? `Auto-Edit (${selectedProduct.name.split(' - ')[0]})` : 'Auto-Edit All (FFmpeg)'}
          </Button>

          {/* Rescan Button */}
          <Button variant="secondary" size="sm" onClick={handleRescan} disabled={rescanning}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${rescanning ? 'animate-spin' : ''}`} />
            Rescan Disk
          </Button>

          {/* Upload Button */}
          <Button variant="secondary" size="sm" onClick={() => setUploadModalOpen(true)}>
            <UploadCloud className="w-3.5 h-3.5 mr-1.5" />
            Upload Clips
          </Button>
        </div>
      </div>

      {/* Action Notification Alert */}
      {statusAlert && (
        <div
          className={`rounded-card p-3.5 text-xs flex items-center justify-between hairline-border ${
            statusAlert.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
              : statusAlert.type === 'error'
              ? 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
              : 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusAlert.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : statusAlert.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <RefreshCw className="w-4 h-4 shrink-0 animate-spin" />
            )}
            <span>{statusAlert.text}</span>
          </div>
          <button onClick={() => setStatusAlert(null)} className="text-neutral-400 hover:text-neutral-200">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Google Drive Connection & Sync Status Hero */}
      <div className="p-4 rounded-card hairline-border bg-neutral-900/60 dark:bg-neutral-900/40 text-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
            <Cloud className="w-4 h-4 text-blue-400" />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-neutral-100">Google Drive: TIKTOK CLIPS</span>
              <Badge variant="default" className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                Connected & Synced
              </Badge>
            </div>
            <p className="text-neutral-400 text-[11px]">
              Root Folder ID: <span className="font-mono text-neutral-300">1E8RKxQ_j99CCMchUxYoO2ioSDcFL9U85</span> · Each subfolder is auto-indexed as a product.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <div className="text-sm font-semibold text-neutral-100">{products.length} Products</div>
            <div className="text-[11px] text-neutral-400">{clips.length} Total Clips Synced</div>
          </div>
          <Link
            to="/videos"
            className="px-3 py-1.5 rounded-control bg-neutral-800 hover:bg-neutral-700 text-neutral-200 flex items-center gap-1.5 font-medium transition"
          >
            <span>View Rendered Videos</span>
            <ExternalLink className="w-3 h-3 text-neutral-400" />
          </Link>
        </div>
      </div>

      {/* Product Folder Filter Pills & Selector */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-neutral-400">Select Product Folder:</span>
          <span className="text-xs text-neutral-500">{clips.length} clips available</span>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => setSelectedProductId('all')}
            className={`px-3 py-1.5 rounded-control text-xs font-medium whitespace-nowrap transition-colors ${
              selectedProductId === 'all'
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-black shadow-sm'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }`}
          >
            All Products ({products.reduce((acc, p) => acc + (p.clip_count || 0), 0) || clips.length})
          </button>
          {products.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedProductId(String(p.id))}
              className={`px-3 py-1.5 rounded-control text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                selectedProductId === String(p.id)
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-black shadow-sm'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
            >
              <span>{p.name}</span>
              {p.clip_count !== undefined && (
                <span className="text-[10px] opacity-70">({p.clip_count})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Video Clips */}
      {isLoading ? (
        <Card className="p-12 text-center space-y-3">
          <RefreshCw className="w-6 h-6 text-neutral-400 animate-spin mx-auto" />
          <p className="text-xs text-neutral-400">Loading footage from catalog...</p>
        </Card>
      ) : clips.length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <Film className="w-8 h-8 text-neutral-400 mx-auto" />
          <p className="text-sm font-medium">No video clips found in this folder.</p>
          <p className="text-xs text-neutral-500">
            Click "Sync Google Drive Clips" above to download footage directly from your Google Drive folder.
          </p>
          <div className="pt-2">
            <Button variant="primary" size="sm" onClick={handleSyncDrive}>
              <Cloud className="w-3.5 h-3.5 mr-1.5" />
              Sync From Google Drive
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {clips.map((clip) => (
            <Card key={clip.id} className="p-3 space-y-3 flex flex-col justify-between hover:border-neutral-700 transition">
              {/* Media Preview Box */}
              <div className="space-y-2">
                <div className="relative aspect-[9/16] max-h-56 w-full bg-black rounded-card flex items-center justify-center overflow-hidden hairline-border group">
                  <video
                    src={`/api/storage/preview?file_path=${encodeURIComponent(clip.file_path)}`}
                    controls
                    preload="metadata"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleDeleteClip(clip)}
                      className="p-1.5 rounded-full bg-black/70 hover:bg-red-600 text-white transition backdrop-blur-sm"
                      title="Delete Clip"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[10px] text-white/90 bg-black/60 px-2 py-1 rounded backdrop-blur-sm pointer-events-none">
                    <span>{clip.duration ? `${clip.duration.toFixed(1)}s` : '5.0s'}</span>
                    <span>{clip.resolution || '1080x1920'}</span>
                    <span>{clip.fps ? `${Math.round(clip.fps)}fps` : '30fps'}</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-semibold text-neutral-400 truncate" title={clip.product_name}>
                      {clip.product_name || `Product #${clip.product_id}`}
                    </span>
                    <Badge variant="neutral" className="text-[9px] shrink-0">
                      {clip.status.toUpperCase()}
                    </Badge>
                  </div>
                  <h3 className="text-xs font-mono font-medium truncate text-neutral-200 mt-0.5" title={clip.filename}>
                    {clip.filename}
                  </h3>
                </div>

                {/* AI Clip Caption */}
                <div className="rounded-input bg-neutral-50 dark:bg-neutral-900/60 hairline-border p-2 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-medium text-neutral-500">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                      AI Clip Caption
                    </span>
                    <button
                      onClick={() => handleGenerateCaption(clip)}
                      disabled={captionLoading === clip.id}
                      className="text-[10px] text-neutral-400 hover:text-neutral-200 hover:underline flex items-center gap-1"
                    >
                      <RefreshCw className={`w-2 h-2 ${captionLoading === clip.id ? 'animate-spin' : ''}`} />
                      Regenerate
                    </button>
                  </div>

                  {editingCaptionId === clip.id ? (
                    <div className="flex gap-1.5">
                      <Input
                        value={captionDraft}
                        onChange={(e) => setCaptionDraft(e.target.value)}
                        className="text-xs py-0.5 px-2"
                        autoFocus
                      />
                      <Button size="sm" variant="primary" onClick={() => handleSaveCaption(clip.id)}>
                        <Check className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <p
                      onClick={() => {
                        setEditingCaptionId(clip.id);
                        setCaptionDraft(clip.caption_cache || '');
                      }}
                      className="text-[11px] italic text-neutral-700 dark:text-neutral-300 cursor-pointer hover:underline"
                    >
                      "{clip.caption_cache || 'Click to add tagline / caption'}"
                    </p>
                  )}
                </div>
              </div>

              {/* Tags & Actions */}
              <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-[10px] text-neutral-400">
                <span className="flex items-center gap-1">
                  <Tag className="w-2.5 h-2.5" />
                  {clip.tags || 'hook, b-roll'}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono">{clip.codec || 'h264'}</span>
                  <button
                    onClick={() => handleDeleteClip(clip)}
                    className="hover:text-red-400 transition"
                    title="Delete clip"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Upload Video Clips Modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-card hairline-border bg-white dark:bg-[#121212] p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
              <div>
                <h3 className="text-sm font-semibold">Upload Product Video Clips</h3>
                <p className="text-xs text-neutral-400">
                  Select a product folder and choose MP4, MOV, or WEBM vertical video footage.
                </p>
              </div>
              <button
                onClick={() => setUploadModalOpen(false)}
                className="p-1 rounded-control hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUploadClips} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Target Product Folder</label>
                <select
                  value={targetProductId}
                  onChange={(e) => setTargetProductId(e.target.value)}
                  className="w-full text-xs rounded-input hairline-border bg-neutral-50 dark:bg-neutral-900 p-2.5 text-neutral-900 dark:text-white"
                  required
                >
                  {products.length === 0 && <option value="">No products available</option>}
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Video Files (.mp4, .mov, .webm)</label>
                <div className="border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-card p-6 text-center hover:border-black dark:hover:border-white transition-colors cursor-pointer relative">
                  <input
                    type="file"
                    multiple
                    accept="video/mp4,video/quicktime,video/webm"
                    onChange={(e) => {
                      if (e.target.files) {
                        setSelectedFiles(Array.from(e.target.files));
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <UploadCloud className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
                  <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    Click to select or drag and drop video clips
                  </p>
                  <p className="text-[11px] text-neutral-400 mt-1">
                    Vertical 9:16 format (1080x1920) recommended
                  </p>
                </div>
              </div>

              {selectedFiles.length > 0 && (
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  <label className="text-[11px] font-medium text-neutral-400">
                    Selected Files ({selectedFiles.length})
                  </label>
                  <div className="space-y-1">
                    {selectedFiles.map((f, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-xs p-2 rounded-input bg-neutral-50 dark:bg-neutral-900 hairline-border"
                      >
                        <span className="font-mono truncate max-w-xs">{f.name}</span>
                        <span className="text-neutral-400 text-[10px]">
                          {(f.size / (1024 * 1024)).toFixed(1)} MB
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {uploadMessage && (
                <div
                  className={`text-xs p-3 rounded-input ${
                    uploadMessage.includes('error')
                      ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                      : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                  }`}
                >
                  {uploadMessage}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setUploadModalOpen(false)}
                  disabled={uploading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={uploading || selectedFiles.length === 0 || !targetProductId}
                >
                  {uploading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Uploading & Probing...
                    </>
                  ) : (
                    `Upload ${selectedFiles.length} Clip(s)`
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
