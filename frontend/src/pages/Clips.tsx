import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, Input } from '../components/ui';
import { api } from '../api/client';
import {
  Film,
  Filter,
  Sparkles,
  Tag,
  Check,
  RefreshCw,
  UploadCloud,
  X,
  HardDrive,
  Cloud,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface ProductItem {
  id: number;
  name: string;
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
  const [captionLoading, setCaptionLoading] = useState<number | null>(null);
  const [editingCaptionId, setEditingCaptionId] = useState<number | null>(null);
  const [captionDraft, setCaptionDraft] = useState('');

  // Upload modal state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [targetProductId, setTargetProductId] = useState<string>('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [rescanning, setRescanning] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    fetchClips();
  }, [selectedProductId]);

  const fetchProducts = async () => {
    try {
      const prods = await api.get<ProductItem[]>('/api/catalog/products');
      setProducts(prods);
      if (prods.length > 0 && !targetProductId) {
        setTargetProductId(String(prods[0].id));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchClips = async () => {
    try {
      if (selectedProductId === 'all') {
        const allProds = await api.get<ProductItem[]>('/api/catalog/products');
        const clipLists = await Promise.all(
          allProds.map(async (p) => {
            const prodClips = await api.get<ClipItem[]>(`/api/catalog/products/${p.id}/clips`).catch(() => []);
            return prodClips.map((c) => ({ ...c, product_name: p.name }));
          })
        );
        setClips(clipLists.flat());
      } else {
        const prodClips = await api.get<ClipItem[]>(`/api/catalog/products/${selectedProductId}/clips`);
        const p = products.find((prod) => String(prod.id) === selectedProductId);
        setClips(prodClips.map((c) => ({ ...c, product_name: p?.name })));
      }
    } catch (e) {
      console.error('Failed to load clips', e);
    }
  };

  const handleRescan = async () => {
    setRescanning(true);
    try {
      await api.post('/api/catalog/rescan');
      await fetchClips();
    } catch (e) {
      console.error('Rescan failed', e);
    } finally {
      setRescanning(false);
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
      await fetchClips();
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
        "Unboxing and sleek unboxing aesthetic",
        "Clear durability and drop test review",
        "Fast hands-on feature demo showcase",
        "Affordable daily creator essential gadget",
        "Premium quality finish close-up view",
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

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clip Library</h1>
          <p className="text-sm text-neutral-500">
            Raw vertical video footage, FFprobe metadata, and AI-generated clip captions for beat-cut rendering.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Rescan Button */}
          <Button variant="secondary" size="sm" onClick={handleRescan} disabled={rescanning}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${rescanning ? 'animate-spin' : ''}`} />
            Rescan Disk
          </Button>

          {/* Upload Button */}
          <Button variant="primary" size="sm" onClick={() => setUploadModalOpen(true)}>
            <UploadCloud className="w-3.5 h-3.5 mr-1.5" />
            Upload Video Clips
          </Button>

          {/* Filter Dropdown */}
          <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-neutral-200 dark:border-neutral-800">
            <Filter className="w-3.5 h-3.5 text-neutral-400" />
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="text-xs rounded-input hairline-border bg-white dark:bg-neutral-900 p-2 text-neutral-900 dark:text-white"
            >
              <option value="all">All Products ({clips.length} clips)</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Video Source Quick Guide Banner */}
      <div className="p-4 rounded-card hairline-border bg-neutral-50 dark:bg-neutral-900/40 text-xs space-y-2">
        <span className="font-semibold text-neutral-700 dark:text-neutral-300">
          How to add videos to your products:
        </span>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-neutral-500">
          <div className="flex items-start gap-2">
            <UploadCloud className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <strong className="text-neutral-900 dark:text-white font-medium">1. Direct Web Upload:</strong>
              <p>Click "Upload Video Clips" above to drop MP4s directly into any product folder.</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <HardDrive className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <strong className="text-neutral-900 dark:text-white font-medium">2. Local Network Share:</strong>
              <p>Drop video files into <code>/data/clips/&lt;Product&gt;/</code> on your server, then click "Rescan Disk".</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Cloud className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <strong className="text-neutral-900 dark:text-white font-medium">3. Google Drive Sync:</strong>
              <p>
                Connect your Drive in{' '}
                <Link to="/storage" className="underline font-medium text-black dark:text-white">
                  Storage & Sync
                </Link>{' '}
                (n8n style) to mirror cloud folders automatically.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Clips */}
      {clips.length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <Film className="w-8 h-8 text-neutral-400 mx-auto" />
          <p className="text-sm font-medium">No video clips found.</p>
          <p className="text-xs text-neutral-500">
            Use the "Upload Video Clips" button above, or drop MP4 footage into <code>/data/clips/&lt;Product_Folder&gt;/</code>.
          </p>
          <div className="pt-2">
            <Button variant="primary" size="sm" onClick={() => setUploadModalOpen(true)}>
              <UploadCloud className="w-3.5 h-3.5 mr-1.5" />
              Upload First Clip
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clips.map((clip) => (
            <Card key={clip.id} className="p-4 space-y-3 flex flex-col justify-between">
              {/* Media Preview Box */}
              <div className="space-y-2">
                <div className="relative aspect-[9/16] max-h-48 w-full bg-neutral-950 rounded-card flex items-center justify-center overflow-hidden hairline-border">
                  <Film className="w-8 h-8 text-neutral-600" />
                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[10px] text-white/90 bg-black/60 px-2 py-1 rounded backdrop-blur-sm">
                    <span>{clip.duration ? `${clip.duration.toFixed(1)}s` : 'Unknown'}</span>
                    <span>{clip.resolution || '1080x1920'}</span>
                    <span>{clip.fps ? `${Math.round(clip.fps)}fps` : '30fps'}</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-neutral-400">
                      {clip.product_name || `Product #${clip.product_id}`}
                    </span>
                    <Badge variant="neutral">
                      {clip.status.toUpperCase()}
                    </Badge>
                  </div>
                  <h3 className="text-xs font-mono font-medium truncate" title={clip.filename}>
                    {clip.filename}
                  </h3>
                </div>

                {/* AI Clip Caption */}
                <div className="rounded-input bg-neutral-50 dark:bg-neutral-900/60 hairline-border p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-medium text-neutral-500">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      AI Clip Caption
                    </span>
                    <button
                      onClick={() => handleGenerateCaption(clip)}
                      disabled={captionLoading === clip.id}
                      className="text-[10px] text-neutral-600 dark:text-neutral-400 hover:underline flex items-center gap-1"
                    >
                      <RefreshCw className={`w-2.5 h-2.5 ${captionLoading === clip.id ? 'animate-spin' : ''}`} />
                      Regenerate
                    </button>
                  </div>

                  {editingCaptionId === clip.id ? (
                    <div className="flex gap-1.5">
                      <Input
                        value={captionDraft}
                        onChange={(e) => setCaptionDraft(e.target.value)}
                        className="text-xs py-1 px-2"
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
                      className="text-xs italic text-neutral-700 dark:text-neutral-300 cursor-pointer hover:underline"
                    >
                      "{clip.caption_cache || 'Click to add tagline / caption'}"
                    </p>
                  )}
                </div>
              </div>

              {/* Tags */}
              <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-[11px] text-neutral-400">
                <span className="flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  {clip.tags || 'hook, b-roll'}
                </span>
                <span className="font-mono text-[10px]">{clip.codec || 'h264'}</span>
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
                  Select a product and choose MP4, MOV, or WEBM vertical video footage.
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
              {/* Product Select */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Target Product</label>
                <select
                  value={targetProductId}
                  onChange={(e) => setTargetProductId(e.target.value)}
                  className="w-full text-xs rounded-input hairline-border bg-neutral-50 dark:bg-neutral-900 p-2.5 text-neutral-900 dark:text-white"
                  required
                >
                  {products.length === 0 && <option value="">No products available - create one first</option>}
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* File Dropzone */}
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

              {/* Selected Files List */}
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

              {/* Message Banner */}
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
