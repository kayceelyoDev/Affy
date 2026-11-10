import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, Input } from '../components/ui';
import { api } from '../api/client';
import { Film, Filter, Sparkles, Tag, Check, RefreshCw } from 'lucide-react';

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
    } catch (e) {
      console.error(e);
    }
  };

  const fetchClips = async () => {
    try {
      if (selectedProductId === 'all') {
        // Fetch clips across all products
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

  const handleGenerateCaption = async (clip: ClipItem) => {
    setCaptionLoading(clip.id);
    try {
      // Simulate Gemini Flash-Lite vision caption extraction
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

        {/* Filter Dropdown */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-neutral-400" />
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

      {/* Grid of Clips */}
      {clips.length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <Film className="w-8 h-8 text-neutral-400 mx-auto" />
          <p className="text-sm font-medium">No video clips found.</p>
          <p className="text-xs text-neutral-500">
            Drop MP4 footage into <code>/data/clips/&lt;Product_Folder&gt;/</code> or trigger Google Drive Sync.
          </p>
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
                    <Badge variant={clip.status === 'usable' ? 'neutral' : 'neutral'}>
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
    </div>
  );
};
