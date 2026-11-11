import React, { useState, useEffect } from 'react';
import {
  Video,
  Play,
  Copy,
  Check,
  RefreshCw,
  Search,
  X,
  Film,
  Send,
  AlertCircle,
  CheckCircle2,
  Clock,
  RotateCcw,
  Trash2,
  ChevronDown,
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

interface RenderJobItem {
  id: number;
  product_id: number;
  plan_slot_id?: number;
  style_id: string;
  title: string;
  subtitle: string;
  status: string;
  progress_pct: number;
  duration?: number;
  output_path?: string;
  error_message?: string;
  created_at: string;
}

const formatStyleName = (styleId?: string) => {
  if (!styleId) return 'Punchy Zoom';
  const map: Record<string, string> = {
    classic_hook: 'Classic Hook',
    style_1_classic_hook: 'Classic Hook',
    clean_showcase: 'Clean Showcase',
    promo_pop: 'Promo Pop',
    punchy_zoom: 'Punchy Zoom',
    smooth_flow: 'Smooth Flow',
    random: 'Random / Diverse',
    default: 'Default Style',
  };
  return map[styleId.toLowerCase()] || styleId.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

export const VideosPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'posts' | 'renders'>('posts');
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [renderJobs, setRenderJobs] = useState<RenderJobItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPublished, setTotalPublished] = useState(0);
  const [totalScheduled, setTotalScheduled] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<{ title: string; subtitle?: string; url: string; caption?: string } | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<number | null>(null);
  const [selectedBatchStyle, setSelectedBatchStyle] = useState('default');
  const [editing, setEditing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [actionAlert, setActionAlert] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

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

  const fetchRenderJobs = async () => {
    try {
      const jobs = await api.get<RenderJobItem[]>('/api/renders');
      setRenderJobs(jobs || []);
    } catch (e) {
      console.error('Failed to load render jobs:', e);
    }
  };

  useEffect(() => {
    fetchPosts();
    fetchRenderJobs();
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

  const handleTriggerAutoEdit = async () => {
    setEditing(true);
    setActionAlert({ type: 'info', text: 'Queueing FFmpeg auto-edit for open plan slots...' });
    try {
      const payload: any = {};
      if (selectedBatchStyle !== 'default') {
        payload.style_id = selectedBatchStyle;
      }
      const res = await api.post('/api/renders/auto-edit', payload);
      setActionAlert({
        type: 'success',
        text: res.message || 'Render jobs queued successfully. FFmpeg worker is rendering videos.',
      });
      await fetchRenderJobs();
      await fetchPosts();
    } catch (e: any) {
      setActionAlert({ type: 'error', text: 'Auto-edit failed: ' + e.message });
    } finally {
      setEditing(false);
    }
  };

  const handlePublishAll = async () => {
    setPublishing(true);
    setActionAlert({ type: 'info', text: 'Publishing rendered videos to Buffer queue...' });
    try {
      const res = await api.post('/api/posts/publish-all', { mode: 'queue' });
      setActionAlert({
        type: 'success',
        text: res.message || 'Rendered videos scheduled to Buffer queue.',
      });
      await fetchPosts();
    } catch (e: any) {
      setActionAlert({ type: 'error', text: 'Buffer publishing failed: ' + e.message });
    } finally {
      setPublishing(false);
    }
  };

  const handleRetryJob = async (jobId: number) => {
    try {
      await api.post(`/api/renders/${jobId}/retry`);
      setActionAlert({ type: 'success', text: `Job #${jobId} requeued for rendering.` });
      await fetchRenderJobs();
    } catch (e: any) {
      setActionAlert({ type: 'error', text: 'Retry failed: ' + e.message });
    }
  };

  const handleDeletePost = async (id: number) => {
    if (!confirm(`Delete post #${id}?`)) return;
    try {
      await api.delete(`/api/posts/${id}`);
      setActionAlert({ type: 'success', text: `Post #${id} deleted.` });
      await fetchPosts();
    } catch (e: any) {
      setActionAlert({ type: 'error', text: 'Delete failed: ' + e.message });
    }
  };

  const handleClearAllPosts = async () => {
    if (!confirm('Are you sure you want to delete ALL posts from the queue?')) return;
    try {
      await api.post('/api/posts/clear');
      setActionAlert({ type: 'success', text: 'All posts cleared successfully.' });
      await fetchPosts();
    } catch (e: any) {
      setActionAlert({ type: 'error', text: 'Clear failed: ' + e.message });
    }
  };

  const filteredPosts = posts.filter((p) => {
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
      {/* Top Header & Workflow Execution Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
            <Video className="w-6 h-6" />
            Video Catalog & Auto-Execution
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Replaces Workflow 3 (FFmpeg Auto-Edit Engine) & Workflow 4 (Drive to Buffer Poster).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              fetchPosts();
              fetchRenderJobs();
            }}
            className="gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {posts.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleClearAllPosts}
              className="gap-1.5 text-red-500 hover:bg-red-500/10 border-red-500/30"
              title="Delete all posts in the queue"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear All Posts
            </Button>
          )}

          <div className="flex items-center gap-1.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-1 rounded-control shadow-sm">
            <div className="relative flex items-center">
              <select
                value={selectedBatchStyle}
                onChange={(e) => setSelectedBatchStyle(e.target.value)}
                className="text-xs bg-transparent border-0 pl-2.5 pr-7 py-1 text-neutral-800 dark:text-neutral-200 cursor-pointer focus:outline-none appearance-none font-medium"
                title="Select editing style for Auto-Edit"
              >
                <option value="default" className="bg-neutral-900 text-neutral-100">Default Style (Settings)</option>
                <option value="random" className="bg-neutral-900 text-neutral-100">Random / Diverse (All Styles)</option>
                <option value="classic_hook" className="bg-neutral-900 text-neutral-100">Classic Hook</option>
                <option value="clean_showcase" className="bg-neutral-900 text-neutral-100">Clean Showcase</option>
                <option value="promo_pop" className="bg-neutral-900 text-neutral-100">Promo Pop</option>
                <option value="punchy_zoom" className="bg-neutral-900 text-neutral-100">Punchy Zoom</option>
                <option value="smooth_flow" className="bg-neutral-900 text-neutral-100">Smooth Flow</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2 pointer-events-none text-neutral-400" />
            </div>
            <Button
              variant="primary"
              size="sm"
              disabled={editing}
              onClick={handleTriggerAutoEdit}
              className="gap-1.5 bg-neutral-900 text-white dark:bg-white dark:text-black whitespace-nowrap shadow-sm"
            >
              <Film className={`w-3.5 h-3.5 ${editing ? 'animate-spin' : ''}`} />
              Run Auto-Edit (FFmpeg)
            </Button>
          </div>

          <Button
            variant="primary"
            size="sm"
            disabled={publishing}
            onClick={handlePublishAll}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Send className={`w-3.5 h-3.5 ${publishing ? 'animate-spin' : ''}`} />
            Publish All to Buffer
          </Button>
        </div>
      </div>

      {/* Action Notification Alert */}
      {actionAlert && (
        <div
          className={`rounded-card p-3.5 text-xs flex items-center justify-between hairline-border ${
            actionAlert.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
              : actionAlert.type === 'error'
              ? 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
              : 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionAlert.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : actionAlert.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <RefreshCw className="w-4 h-4 shrink-0 animate-spin" />
            )}
            <span>{actionAlert.text}</span>
          </div>
          <button onClick={() => setActionAlert(null)} className="text-xs underline ml-2">
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 space-y-1 bg-white dark:bg-neutral-950 border hairline-border">
          <span className="text-xs uppercase tracking-wider text-neutral-500 font-medium">Total Assets</span>
          <div className="text-2xl font-semibold tracking-tight">{totalCount || renderJobs.length}</div>
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

      {/* Tab Navigation: Buffer Posts vs Render Jobs */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-800 gap-4">
        <button
          onClick={() => setActiveTab('posts')}
          className={`pb-2.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'posts'
              ? 'border-black dark:border-white text-black dark:text-white'
              : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-300'
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          Buffer Posts & Queue ({posts.length})
        </button>

        <button
          onClick={() => setActiveTab('renders')}
          className={`pb-2.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'renders'
              ? 'border-black dark:border-white text-black dark:text-white'
              : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-300'
          }`}
        >
          <Film className="w-3.5 h-3.5" />
          FFmpeg Render Queue & Jobs ({renderJobs.length})
        </button>
      </div>

      {/* View 1: Posts & Buffer Queue */}
      {activeTab === 'posts' && (
        <div className="space-y-4">
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
              {['all', 'ready_to_post', 'scheduled', 'published'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    statusFilter === st
                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-black'
                      : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 hover:bg-neutral-200'
                  }`}
                >
                  {st.replace(/_/g, ' ').toUpperCase()}
                </button>
              ))}
            </div>
          </Card>

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
                        No video publications found. Click "Run Auto-Edit" to render videos from today's plan.
                      </td>
                    </tr>
                  ) : (
                    filteredPosts.map((post) => (
                      <tr key={post.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30 transition-colors">
                        <td className="p-3 text-center">
                          <button
                            onClick={() =>
                              setPreviewVideoUrl({
                                title: post.product_name || `Product #${post.product_id}`,
                                subtitle: post.hook_style,
                                url: post.render_id ? `/api/renders/${post.render_id}/video` : post.media_url || '',
                                caption: post.caption,
                              })
                            }
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
                            <Badge variant="default" className="font-mono text-[10px] bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
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
                          <div className="font-medium text-neutral-800 dark:text-neutral-200">{post.hook_style || 'Product Pitch'}</div>
                          <div className="text-[11px] text-neutral-400 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-neutral-500"></span>
                            <span>{formatStyleName(post.style_id)}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge
                            variant={
                              post.status === 'published'
                                ? 'default'
                                : post.status === 'scheduled'
                                ? 'default'
                                : 'neutral'
                            }
                            className="capitalize text-[10px]"
                          >
                            {post.status.replace(/_/g, ' ')}
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
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeletePost(post.id)}
                            className="text-xs h-7 px-2 text-neutral-400 hover:text-red-500"
                            title="Delete Post"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
            </div>
          </Card>
        </div>
      )}

      {/* View 2: FFmpeg Render Jobs */}
      {activeTab === 'renders' && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b hairline-border bg-neutral-50/50 dark:bg-neutral-900/50 text-neutral-500 font-medium">
                  <th className="p-3 w-12 text-center">Video</th>
                  <th className="p-3">Job ID</th>
                  <th className="p-3">Product / Title</th>
                  <th className="p-3">Style</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Duration</th>
                  <th className="p-3">Created</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y hairline-border">
                {renderJobs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-neutral-400">
                      No render jobs in queue. Click "Run Auto-Edit" to render videos using FFmpeg.
                    </td>
                  </tr>
                ) : (
                  renderJobs.map((job) => (
                    <tr key={job.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30 transition-colors">
                      <td className="p-3 text-center">
                        {job.status === 'completed' ? (
                          <button
                            onClick={() =>
                              setPreviewVideoUrl({
                                title: job.title,
                                subtitle: job.subtitle,
                                url: `/api/renders/${job.id}/video`,
                              })
                            }
                            className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center hover:bg-emerald-500/20 transition"
                          >
                            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                          </button>
                        ) : job.status === 'rendering' ? (
                          <RefreshCw className="w-4 h-4 animate-spin text-amber-500 mx-auto" />
                        ) : (
                          <Clock className="w-4 h-4 text-neutral-400 mx-auto" />
                        )}
                      </td>
                      <td className="p-3 font-mono text-[11px] text-neutral-500">#{job.id}</td>
                      <td className="p-3 font-semibold text-neutral-900 dark:text-neutral-100">
                        {job.title}
                        {job.subtitle && <p className="text-[11px] font-normal text-neutral-400">{job.subtitle}</p>}
                      </td>
                      <td className="p-3 text-[11px] text-neutral-400 font-medium">{formatStyleName(job.style_id)}</td>
                      <td className="p-3">
                        <Badge
                          variant={
                            job.status === 'completed'
                              ? 'default'
                              : job.status === 'rendering'
                              ? 'warning'
                              : job.status === 'failed'
                              ? 'destructive'
                              : 'neutral'
                          }
                          className="capitalize text-[10px]"
                        >
                          {job.status} {job.status === 'rendering' ? `(${job.progress_pct}%)` : ''}
                        </Badge>
                        {job.error_message && (
                          <p className="text-[10px] text-red-500 truncate max-w-[200px]" title={job.error_message}>
                            {job.error_message}
                          </p>
                        )}
                      </td>
                      <td className="p-3 text-[11px] text-neutral-500">
                        {job.duration ? `${job.duration}s` : '—'}
                      </td>
                      <td className="p-3 text-[11px] text-neutral-500">
                        {new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-3 text-right">
                        {job.status === 'failed' && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleRetryJob(job.id)}
                            className="text-xs h-7 px-2 gap-1"
                          >
                            <RotateCcw className="w-3 h-3" /> Retry
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </Card>
      )}

      {/* Video Preview Modal */}
      {previewVideoUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <Card className="relative w-full max-w-lg bg-neutral-900 border-neutral-800 p-4 space-y-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm">{previewVideoUrl.title}</h3>
                {previewVideoUrl.subtitle && <p className="text-xs text-neutral-400">{previewVideoUrl.subtitle}</p>}
              </div>
              <button
                onClick={() => setPreviewVideoUrl(null)}
                className="w-7 h-7 rounded-full bg-neutral-800 flex items-center justify-center hover:bg-neutral-700"
              >
                <X className="w-4 h-4 text-neutral-400" />
              </button>
            </div>

            <div className="aspect-[9/16] max-h-[500px] mx-auto bg-black rounded-lg overflow-hidden flex items-center justify-center">
              <video
                src={previewVideoUrl.url}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            </div>

            {previewVideoUrl.caption && (
              <div className="p-3 bg-neutral-950 rounded border border-neutral-800 text-xs text-neutral-300">
                <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold block mb-1">
                  Taglish Caption:
                </span>
                {previewVideoUrl.caption}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};
