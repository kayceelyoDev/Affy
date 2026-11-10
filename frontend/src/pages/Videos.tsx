import React, { useState, useEffect } from 'react';
import {
  Video,
  Play,
  Copy,
  Check,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { Button, Card, Input, Badge, Table } from '../components/ui';
import { api } from '../api/client';

interface PostItem {
  id: number;
  product_id?: number;
  product_name?: string;
  render_id?: number;
  buffer_post_id?: string;
  tiktok_video_id?: string;
  caption?: string;
  caption_fingerprint?: string;
  hook_style?: string;
  style_id?: string;
  media_url?: string;
  mode: string;
  scheduled_for?: string;
  posted_at?: string;
  status: string;
  created_at: string;
}

export const VideosPage: React.FC = () => {
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPublished, setTotalPublished] = useState(0);
  const [totalScheduled, setTotalScheduled] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [previewPost, setPreviewPost] = useState<PostItem | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<number | null>(null);

  const fetchPosts = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      const data = await api.get<any>(`/api/posts?${params.toString()}`);
      if (data) {
        setPosts(data.posts || []);
        setTotalCount(data.total_count || 0);
        setTotalPublished(data.total_published || 0);
        setTotalScheduled(data.total_scheduled || 0);
      }
    } catch (e) {
      console.error('Failed to load posts:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [statusFilter]);

  const copyCaption = (id: number, text?: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRegenerate = async (id: number) => {
    setRegeneratingId(id);
    try {
      await api.post(`/api/posts/${id}/regenerate-caption`);
      await fetchPosts();
    } catch (e) {
      console.error('Failed to regenerate caption:', e);
    } finally {
      setRegeneratingId(null);
    }
  };

  const filteredPosts = posts.filter(p => {
    const q = search.toLowerCase();
    return (
      (p.product_name && p.product_name.toLowerCase().includes(q)) ||
      (p.caption && p.caption.toLowerCase().includes(q)) ||
      (p.caption_fingerprint && p.caption_fingerprint.toLowerCase().includes(q)) ||
      (p.hook_style && p.hook_style.toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
            <Video className="w-6 h-6" />
            Video Catalog & Publications
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Rendered TikTok assets, Buffer queue scheduling status, and attribution fingerprints.
          </p>
        </div>
        <Button onClick={fetchPosts} variant="secondary" className="gap-2">
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Feed
        </Button>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 space-y-1 bg-white dark:bg-neutral-950 border hairline-border">
          <span className="text-xs uppercase tracking-wider text-neutral-500 font-medium">Total Assets</span>
          <div className="text-2xl font-semibold tracking-tight">{totalCount}</div>
        </Card>
        <Card className="p-4 space-y-1 bg-white dark:bg-neutral-950 border hairline-border">
          <span className="text-xs uppercase tracking-wider text-neutral-500 font-medium">Scheduled in Buffer</span>
          <div className="text-2xl font-semibold tracking-tight text-amber-500">{totalScheduled}</div>
        </Card>
        <Card className="p-4 space-y-1 bg-white dark:bg-neutral-950 border hairline-border">
          <span className="text-xs uppercase tracking-wider text-neutral-500 font-medium">Published Live</span>
          <div className="text-2xl font-semibold tracking-tight text-emerald-500">{totalPublished}</div>
        </Card>
        <Card className="p-4 space-y-1 bg-white dark:bg-neutral-950 border hairline-border">
          <span className="text-xs uppercase tracking-wider text-neutral-500 font-medium">Attribution Mode</span>
          <div className="text-sm font-semibold tracking-tight text-neutral-700 dark:text-neutral-300">
            Caption Fingerprints Active
          </div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 w-full sm:w-80">
          <Search className="w-4 h-4 text-neutral-400" />
          <Input
            placeholder="Search product, caption, fingerprint..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {['all', 'scheduled', 'published', 'draft', 'failed'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                statusFilter === st
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-black'
                  : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 hover:bg-neutral-200'
              }`}
            >
              {st.charAt(0).toUpperCase() + st.slice(1)}
            </button>
          ))}
        </div>
      </Card>

      {/* Videos Master Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b hairline-border bg-neutral-50/50 dark:bg-neutral-900/50 text-neutral-500 font-medium">
                <th className="p-3 w-12 text-center">Play</th>
                <th className="p-3">Product</th>
                <th className="p-3 w-72">Taglish Caption & Fingerprint</th>
                <th className="p-3">Hook & Style</th>
                <th className="p-3">Status</th>
                <th className="p-3">Buffer Post ID</th>
                <th className="p-3">Schedule Time</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y hairline-border">
              {filteredPosts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-neutral-400">
                    No video publications found for selected criteria.
                  </td>
                </tr>
              ) : (
                filteredPosts.map((post) => (
                  <tr key={post.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30 transition-colors">
                    <td className="p-3 text-center">
                      <button
                        onClick={() => setPreviewPost(post)}
                        className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center hover:bg-neutral-200 dark:hover:bg-neutral-700 transition"
                      >
                        <Play className="w-3.5 h-3.5 fill-current text-neutral-900 dark:text-white ml-0.5" />
                      </button>
                    </td>
                    <td className="p-3 font-semibold text-neutral-900 dark:text-neutral-100">
                      {post.product_name}
                    </td>
                    <td className="p-3 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="font-mono text-[10px] bg-neutral-50 dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300">
                          {post.caption_fingerprint || 'NO-FP'}
                        </Badge>
                        <button
                          onClick={() => copyCaption(post.id, post.caption)}
                          className="text-neutral-400 hover:text-neutral-600 transition"
                          title="Copy Caption"
                        >
                          {copiedId === post.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <p className="line-clamp-2 text-neutral-600 dark:text-neutral-400 text-[11px] leading-relaxed">
                        {post.caption || 'No caption generated.'}
                      </p>
                    </td>
                    <td className="p-3 space-y-1">
                      <div className="font-medium text-neutral-800 dark:text-neutral-200">{post.hook_style}</div>
                      <div className="text-[10px] text-neutral-400">{post.style_id}</div>
                    </td>
                    <td className="p-3">
                      <Badge
                        variant={
                          post.status === 'published'
                            ? 'default'
                            : post.status === 'scheduled'
                            ? 'outline'
                            : 'destructive'
                        }
                        className="capitalize text-[10px]"
                      >
                        {post.status}
                      </Badge>
                    </td>
                    <td className="p-3 font-mono text-[11px] text-neutral-500">
                      {post.buffer_post_id ? (
                        <span className="truncate max-w-[120px] block" title={post.buffer_post_id}>
                          {post.buffer_post_id}
                        </span>
                      ) : (
                        <span className="text-neutral-400 italic">None</span>
                      )}
                    </td>
                    <td className="p-3 text-neutral-500 text-[11px]">
                      {post.scheduled_for ? new Date(post.scheduled_for).toLocaleString() : 'Buffer Queue'}
                    </td>
                    <td className="p-3 text-right space-x-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRegenerate(post.id)}
                        disabled={regeneratingId === post.id}
                        className="text-xs h-7 px-2"
                        title="Regenerate Taglish Caption & Fingerprint"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${regeneratingId === post.id ? 'animate-spin' : ''}`} />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      </Card>

      {/* Video Preview Modal */}
      {previewPost && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <Card className="relative w-full max-w-lg bg-neutral-900 border-neutral-800 p-4 space-y-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm">{previewPost.product_name}</h3>
                <p className="text-xs text-neutral-400">{previewPost.caption_fingerprint} · {previewPost.hook_style}</p>
              </div>
              <button
                onClick={() => setPreviewPost(null)}
                className="w-7 h-7 rounded-full bg-neutral-800 flex items-center justify-center hover:bg-neutral-700"
              >
                <X className="w-4 h-4 text-neutral-400" />
              </button>
            </div>

            <div className="aspect-[9/16] max-h-[500px] mx-auto bg-black rounded-lg overflow-hidden flex items-center justify-center">
              {previewPost.render_id ? (
                <video
                  src={`/api/renders/${previewPost.render_id}/video`}
                  controls
                  autoPlay
                  className="w-full h-full object-contain"
                />
              ) : previewPost.media_url ? (
                <video
                  src={previewPost.media_url}
                  controls
                  autoPlay
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center text-xs text-neutral-500">Video source unavailable</div>
              )}
            </div>

            <div className="p-3 bg-neutral-950 rounded border border-neutral-800 text-xs text-neutral-300">
              <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold block mb-1">
                Post Caption:
              </span>
              {previewPost.caption}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
