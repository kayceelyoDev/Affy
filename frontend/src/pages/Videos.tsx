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
  Sparkles,
  Music,
  Sliders,
  Calendar,
  Lock,
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

interface StyleOption {
  id: string;
  name: string;
  is_custom?: boolean;
}

interface TemplateOption {
  id: string;
  name: string;
  fixed_music_track: string;
  base_style_id: string;
  crop_mode: string;
}

interface MusicOption {
  id: string;
  filename: string;
  name: string;
  size_kb?: number;
}

interface RemixModalState {
  isOpen: boolean;
  jobId?: number;
  postId?: number;
  productId?: number;
  productName: string;
  videoUrl: string;
  styleId: string;
  musicTrack: string;
  title: string;
  subtitle: string;
  caption?: string;
  duration?: number;
  status?: string;
}

const formatStyleName = (styleId?: string) => {
  if (!styleId) return 'Punchy Zoom';
  const clean = styleId.replace('template:', '');
  const map: Record<string, string> = {
    classic_hook: 'Classic Hook',
    style_1_classic_hook: 'Classic Hook',
    clean_showcase: 'Clean Showcase',
    promo_pop: 'Promo Pop',
    punchy_zoom: 'Punchy Zoom',
    smooth_flow: 'Smooth Flow',
    tpl_viral_deal_drop: 'Viral Deal Drop',
    tpl_aesthetic_showcase: 'Aesthetic Showcase',
    tpl_promo_pop: 'Flash Promo Pop',
    random: 'Random / Diverse',
    default: 'Default Style',
  };
  return map[clean.toLowerCase()] || clean.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

export const VideosPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'posts' | 'renders'>('posts');
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [renderJobs, setRenderJobs] = useState<RenderJobItem[]>([]);
  const [stylesList, setStylesList] = useState<StyleOption[]>([]);
  const [templatesList, setTemplatesList] = useState<TemplateOption[]>([]);
  const [musicList, setMusicList] = useState<MusicOption[]>([]);
  const [defaultStyleName, setDefaultStyleName] = useState<string>('Punchy Zoom');
  const [selectedBatchStyle, setSelectedBatchStyle] = useState('default');
  
  const [totalCount, setTotalCount] = useState(0);
  const [totalPublished, setTotalPublished] = useState(0);
  const [totalScheduled, setTotalScheduled] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [actionAlert, setActionAlert] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Video Preview & Interactive Remix Modal
  const [remixModal, setRemixModal] = useState<RemixModalState | null>(null);
  const [isRemixing, setIsRemixing] = useState(false);

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

  const fetchMetadata = async () => {
    try {
      const [stylesData, templatesData, musicData, settingsData] = await Promise.all([
        api.get<any[]>('/api/styles').catch(() => []),
        api.get<any[]>('/api/styles/templates').catch(() => []),
        api.get<any[]>('/api/styles/music-tracks').catch(() => []),
        api.get<any[]>('/api/settings').catch(() => []),
      ]);

      if (stylesData) setStylesList(stylesData);
      if (templatesData) setTemplatesList(templatesData);
      if (musicData) setMusicList(musicData);

      // Determine default style
      const defSetting = settingsData?.find((s: any) => s.key === 'DEFAULT_RENDER_STYLE')?.value;
      if (defSetting) {
        const cleanDef = defSetting.replace('template:', '');
        const matchedTpl = templatesData?.find((t: any) => t.id === cleanDef);
        const matchedStyle = stylesData?.find((s: any) => s.id === cleanDef);
        if (matchedTpl) {
          setDefaultStyleName(matchedTpl.name);
        } else if (matchedStyle) {
          setDefaultStyleName(matchedStyle.name);
        } else {
          setDefaultStyleName(formatStyleName(cleanDef));
        }
      }
    } catch (e) {
      console.error('Failed to load studio metadata:', e);
    }
  };

  useEffect(() => {
    fetchPosts();
    fetchRenderJobs();
    fetchMetadata();
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

  // Open the interactive video remix modal
  const openRemixModal = (item: {
    jobId?: number;
    postId?: number;
    productId?: number;
    productName?: string;
    videoUrl?: string;
    styleId?: string;
    title?: string;
    subtitle?: string;
    caption?: string;
    duration?: number;
    status?: string;
  }) => {
    const activeStyle = item.styleId || 'punchy_zoom';
    const isTpl = templatesList.find((t) => t.id === activeStyle);
    const initialMusic = isTpl ? isTpl.fixed_music_track : (musicList[0]?.filename || '');

    setRemixModal({
      isOpen: true,
      jobId: item.jobId,
      postId: item.postId,
      productId: item.productId,
      productName: item.productName || item.title || 'Product Video',
      videoUrl: item.videoUrl || (item.jobId ? `/api/renders/${item.jobId}/video?v=${Date.now()}` : ''),
      styleId: activeStyle,
      musicTrack: initialMusic,
      title: item.title || item.productName || 'VIRAL AFFILIATE FIND',
      subtitle: item.subtitle || 'LIMITED TIME CREATOR DEAL',
      caption: item.caption,
      duration: item.duration,
      status: item.status,
    });
  };

  // Execute live video remix / regeneration
  const handleExecuteRemix = async () => {
    if (!remixModal) return;
    setIsRemixing(true);
    setActionAlert(null);
    try {
      const res = await api.post('/api/renders/remix', {
        job_id: remixModal.jobId,
        post_id: remixModal.postId,
        product_id: remixModal.productId,
        style_id: remixModal.styleId,
        music_track: remixModal.musicTrack,
        title: remixModal.title,
        subtitle: remixModal.subtitle,
      });

      if (res && res.ok) {
        setRemixModal((prev) =>
          prev
            ? {
                ...prev,
                jobId: res.job_id,
                postId: res.post_id || prev.postId,
                videoUrl: `${res.preview_url}&t=${Date.now()}`,
                duration: res.duration,
                title: res.title,
                subtitle: res.subtitle,
                styleId: res.style_id,
                musicTrack: res.music_track,
              }
            : null
        );
        setActionAlert({
          type: 'success',
          text: `Video remixed in ${res.duration}s with ${formatStyleName(res.style_id)}! Player updated.`,
        });
        await fetchPosts();
        await fetchRenderJobs();
      }
    } catch (err: any) {
      setActionAlert({
        type: 'error',
        text: 'Remix failed: ' + (err.message || 'Check video clips and music availability'),
      });
    } finally {
      setIsRemixing(false);
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

  const selectedTemplate = templatesList.find((t) => t.id === remixModal?.styleId);

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
          {/* Direct link to Today's Plan */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              window.location.href = '/plan';
            }}
            className="gap-1.5"
            title="Inspect or adjust Today's slot allocations"
          >
            <Calendar className="w-3.5 h-3.5 text-neutral-400" />
            View Today's Plan
          </Button>

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

          {/* Style Selector with Templates & Styles */}
          <div className="flex items-center gap-1.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-1 rounded-control shadow-sm">
            <div className="relative flex items-center">
              <select
                value={selectedBatchStyle}
                onChange={(e) => setSelectedBatchStyle(e.target.value)}
                className="text-xs bg-transparent border-0 pl-2.5 pr-7 py-1 text-neutral-800 dark:text-neutral-200 cursor-pointer focus:outline-none appearance-none font-medium max-w-[200px] truncate"
                title="Select editing style or template for Auto-Edit"
              >
                <option value="default" className="bg-neutral-900 text-neutral-100">
                  Default ({defaultStyleName})
                </option>
                <option value="random" className="bg-neutral-900 text-neutral-100">
                  Random / Diverse (All Styles)
                </option>

                {templatesList.length > 0 && (
                  <optgroup label="CapCut-Style Templates (Fixed Audio)">
                    {templatesList.map((tpl) => (
                      <option key={tpl.id} value={tpl.id} className="bg-neutral-900 text-neutral-100">
                        {tpl.name}
                      </option>
                    ))}
                  </optgroup>
                )}

                <optgroup label="Universal Motion Styles">
                  {stylesList.map((s) => (
                    <option key={s.id} value={s.id} className="bg-neutral-900 text-neutral-100">
                      {s.name}
                    </option>
                  ))}
                </optgroup>
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

      {/* Tabs Switcher: Buffer Posts vs FFmpeg Jobs */}
      <div className="flex items-center gap-6 border-b border-neutral-200 dark:border-neutral-800">
        <button
          onClick={() => setActiveTab('posts')}
          className={`flex items-center gap-2 pb-3 text-xs font-semibold tracking-wider uppercase border-b-2 transition-colors ${
            activeTab === 'posts'
              ? 'border-neutral-900 text-neutral-900 dark:border-white dark:text-white'
              : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          Buffer Posts & Queue ({posts.length})
        </button>
        <button
          onClick={() => setActiveTab('renders')}
          className={`flex items-center gap-2 pb-3 text-xs font-semibold tracking-wider uppercase border-b-2 transition-colors ${
            activeTab === 'renders'
              ? 'border-neutral-900 text-neutral-900 dark:border-white dark:text-white'
              : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
          }`}
        >
          <Film className="w-3.5 h-3.5" />
          FFmpeg Render Queue & Jobs ({renderJobs.length})
        </button>
      </div>

      {/* Content View: Posts Table */}
      {activeTab === 'posts' && (
        <Card className="overflow-hidden bg-white dark:bg-neutral-950 border hairline-border">
          <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Search product, caption, fingerprint..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs pl-9 pr-4 py-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-input focus:outline-none focus:ring-1 focus:ring-neutral-400"
              />
            </div>

            <div className="flex items-center gap-1.5">
              {['all', 'ready_to_post', 'scheduled', 'published'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`text-[11px] font-medium px-2.5 py-1 rounded-control uppercase tracking-wider transition-colors ${
                    statusFilter === st
                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-black font-semibold'
                      : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
                  }`}
                >
                  {st.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 text-[11px] uppercase tracking-wider">
                  <th className="p-3 text-left w-10">Play</th>
                  <th className="p-3 text-left">Product</th>
                  <th className="p-3 text-left">Taglish Caption & Fingerprint</th>
                  <th className="p-3 text-left">Hook & Style</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Buffer Post ID</th>
                  <th className="p-3 text-left">Schedule Time</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-900">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-xs text-neutral-500">
                      Loading video publications...
                    </td>
                  </tr>
                ) : filteredPosts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-xs text-neutral-500">
                      No video publications found. Click "Run Auto-Edit" to render videos from today's plan.
                    </td>
                  </tr>
                ) : (
                  filteredPosts.map((post) => (
                    <tr
                      key={post.id}
                      className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/50 transition-colors cursor-pointer"
                      onClick={() =>
                        openRemixModal({
                          postId: post.id,
                          jobId: post.render_id,
                          productId: post.product_id,
                          productName: post.product_name,
                          videoUrl: post.media_url,
                          styleId: post.style_id,
                          title: post.product_name,
                          subtitle: post.hook_style,
                          caption: post.caption,
                          status: post.status,
                        })
                      }
                    >
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() =>
                            openRemixModal({
                              postId: post.id,
                              jobId: post.render_id,
                              productId: post.product_id,
                              productName: post.product_name,
                              videoUrl: post.media_url,
                              styleId: post.style_id,
                              title: post.product_name,
                              subtitle: post.hook_style,
                              caption: post.caption,
                              status: post.status,
                            })
                          }
                          className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                          title="Preview & Remix video"
                        >
                          <Play className="w-3.5 h-3.5 text-neutral-700 dark:text-neutral-300 ml-0.5" />
                        </button>
                      </td>
                      <td className="p-3 font-medium text-xs text-neutral-900 dark:text-neutral-100 whitespace-nowrap">
                        {post.product_name || `Product #${post.product_id}`}
                      </td>
                      <td className="p-3 text-xs max-w-sm">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="font-mono text-[10px] bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-600 dark:text-neutral-400">
                            {post.caption_fingerprint || 'NO-FP'}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyCaption(post.id, post.caption);
                            }}
                            className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                            title="Copy full caption with fingerprint"
                          >
                            {copiedId === post.id ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        <p className="line-clamp-2 text-neutral-600 dark:text-neutral-400 text-[11px] leading-relaxed">
                          {post.caption || '—'}
                        </p>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <div className="text-xs font-medium text-neutral-800 dark:text-neutral-200">
                          {post.hook_style || 'Direct Pitch'}
                        </div>
                        <div className="text-[10px] text-neutral-400 font-mono mt-0.5">
                          {formatStyleName(post.style_id)}
                        </div>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <Badge
                          variant={post.status === 'scheduled' ? 'warning' : 'neutral'}
                          className={`capitalize text-[10px] ${
                            post.status === 'published' ? 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10' : ''
                          }`}
                        >
                          {post.status.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="p-3 text-xs font-mono text-neutral-500">
                        {post.buffer_post_id ? (
                          <span className="text-[11px]">{post.buffer_post_id.slice(0, 14)}...</span>
                        ) : (
                          <span className="text-neutral-400 italic">None</span>
                        )}
                      </td>
                      <td className="p-3 text-[11px] text-neutral-500 whitespace-nowrap">
                        {post.scheduled_for ? (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-neutral-400" />
                            {new Date(post.scheduled_for).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        ) : (
                          'Buffer Queue'
                        )}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              openRemixModal({
                                postId: post.id,
                                jobId: post.render_id,
                                productId: post.product_id,
                                productName: post.product_name,
                                videoUrl: post.media_url,
                                styleId: post.style_id,
                                title: post.product_name,
                                subtitle: post.hook_style,
                                caption: post.caption,
                                status: post.status,
                              })
                            }
                            className="h-7 px-2 text-xs text-neutral-400 hover:text-white"
                            title="Remix & Re-render"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={regeneratingId === post.id}
                            onClick={() => handleRegenerate(post.id)}
                            className="h-7 px-2 text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                            title="Regenerate Taglish Caption & Hook"
                          >
                            <RefreshCw
                              className={`w-3.5 h-3.5 ${regeneratingId === post.id ? 'animate-spin' : ''}`}
                            />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeletePost(post.id)}
                            className="h-7 px-2 text-xs text-neutral-400 hover:text-red-500"
                            title="Delete Post"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </Card>
      )}

      {/* Content View: FFmpeg Render Jobs */}
      {activeTab === 'renders' && (
        <Card className="overflow-hidden bg-white dark:bg-neutral-950 border hairline-border">
          <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Active & Completed Render Jobs ({renderJobs.length})
            </span>
            <Button size="sm" variant="secondary" onClick={fetchRenderJobs} className="gap-1.5 text-xs">
              <RefreshCw className="w-3 h-3" /> Refresh Queue
            </Button>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 text-[11px] uppercase tracking-wider">
                  <th className="p-3 text-left w-10">Play</th>
                  <th className="p-3 text-left">Job ID</th>
                  <th className="p-3 text-left">Product</th>
                  <th className="p-3 text-left">Title Hook / Subtitle</th>
                  <th className="p-3 text-left">Style / Template</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Duration</th>
                  <th className="p-3 text-left">Created</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-900">
                {renderJobs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-xs text-neutral-500">
                      No render jobs in queue. Click "Run Auto-Edit" to render video slots.
                    </td>
                  </tr>
                ) : (
                  renderJobs.map((job) => (
                    <tr
                      key={job.id}
                      className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/50 transition-colors cursor-pointer"
                      onClick={() => {
                        if (job.status === 'completed') {
                          openRemixModal({
                            jobId: job.id,
                            productId: job.product_id,
                            title: job.title,
                            subtitle: job.subtitle,
                            styleId: job.style_id,
                            duration: job.duration,
                          });
                        }
                      }}
                    >
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        {job.status === 'completed' ? (
                          <button
                            onClick={() =>
                              openRemixModal({
                                jobId: job.id,
                                productId: job.product_id,
                                title: job.title,
                                subtitle: job.subtitle,
                                styleId: job.style_id,
                                duration: job.duration,
                              })
                            }
                            className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                          >
                            <Play className="w-3.5 h-3.5 text-neutral-700 dark:text-neutral-300 ml-0.5" />
                          </button>
                        ) : (
                          <Clock className="w-4 h-4 text-neutral-400" />
                        )}
                      </td>
                      <td className="p-3 font-mono text-xs text-neutral-500">#{job.id}</td>
                      <td className="p-3 text-xs font-medium text-neutral-800 dark:text-neutral-200">
                        Product #{job.product_id}
                      </td>
                      <td className="p-3 text-xs max-w-xs">
                        <div className="font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                          {job.title}
                        </div>
                        <div className="text-[11px] text-neutral-500 truncate">{job.subtitle}</div>
                      </td>
                      <td className="p-3 text-xs font-mono text-neutral-500">
                        {formatStyleName(job.style_id)}
                      </td>
                      <td className="p-3">
                        <Badge
                          variant={job.status === 'failed' ? 'destructive' : 'neutral'}
                          className={`capitalize text-[10px] ${
                            job.status === 'completed'
                              ? 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10'
                              : job.status === 'rendering'
                              ? 'text-amber-500 border-amber-500/30 bg-amber-500/10'
                              : ''
                          }`}
                        >
                          {job.status} {job.status === 'rendering' ? `(${job.progress_pct}%)` : ''}
                        </Badge>
                        {job.error_message && (
                          <p
                            className="text-[10px] text-red-500 truncate max-w-[200px]"
                            title={job.error_message}
                          >
                            {job.error_message}
                          </p>
                        )}
                      </td>
                      <td className="p-3 text-[11px] text-neutral-500">
                        {job.duration ? `${job.duration}s` : '—'}
                      </td>
                      <td className="p-3 text-[11px] text-neutral-500">
                        {new Date(job.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {job.status === 'completed' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                openRemixModal({
                                  jobId: job.id,
                                  productId: job.product_id,
                                  title: job.title,
                                  subtitle: job.subtitle,
                                  styleId: job.style_id,
                                  duration: job.duration,
                                })
                              }
                              className="text-xs h-7 px-2 gap-1"
                              title="Remix & Re-render"
                            >
                              <Sliders className="w-3 h-3" /> Remix
                            </Button>
                          )}
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
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </Card>
      )}

      {/* Post-Generation Preview & Interactive Remix Modal */}
      {remixModal && remixModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-4xl bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl p-6 text-white max-h-[92vh] flex flex-col md:flex-row gap-6 overflow-hidden">
            {/* Close Button */}
            <button
              onClick={() => setRemixModal(null)}
              className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-neutral-300" />
            </button>

            {/* Left Column: Video Player */}
            <div className="w-full md:w-[42%] flex flex-col items-center justify-center bg-black/60 rounded-lg p-2 border border-neutral-800/80">
              <div className="relative aspect-[9/16] w-full max-h-[520px] rounded-lg overflow-hidden bg-black flex items-center justify-center shadow-inner">
                {isRemixing ? (
                  <div className="flex flex-col items-center gap-3 p-6 text-center">
                    <RefreshCw className="w-8 h-8 animate-spin text-amber-400" />
                    <span className="text-xs font-medium text-neutral-300">
                      Re-rendering video with custom style & beat cuts...
                    </span>
                    <span className="text-[10px] text-neutral-500">FFmpeg 1080x1920 (Anton Font)</span>
                  </div>
                ) : remixModal.videoUrl ? (
                  <video
                    key={remixModal.videoUrl}
                    src={remixModal.videoUrl}
                    controls
                    autoPlay
                    loop
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-xs text-neutral-500">No video output file available</div>
                )}
              </div>

              {/* Video stats bar */}
              <div className="w-full mt-2 flex items-center justify-between text-[11px] text-neutral-400 px-1">
                <span>1080x1920 (30fps)</span>
                <span>{remixModal.duration ? `${remixModal.duration}s duration` : 'Active'}</span>
                <span className="font-mono text-[10px] bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-300">
                  {formatStyleName(remixModal.styleId)}
                </span>
              </div>
            </div>

            {/* Right Column: Interactive Studio & Remix Controls */}
            <div className="w-full md:w-[58%] flex flex-col justify-between space-y-4 overflow-y-auto pr-1">
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold flex items-center gap-1 mb-1">
                    <Sparkles className="w-3 h-3" /> Post-Generation Video Studio
                  </span>
                  <h2 className="text-lg font-bold text-white truncate">{remixModal.productName}</h2>
                  <p className="text-xs text-neutral-400">
                    Remix this video's style, template, music, or text overlays, then re-render instantly.
                  </p>
                </div>

                {/* Style / Template Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                    <Film className="w-3.5 h-3.5 text-neutral-400" />
                    Style or Template
                  </label>
                  <select
                    value={remixModal.styleId}
                    onChange={(e) => {
                      const newStyle = e.target.value;
                      const matchedTpl = templatesList.find((t) => t.id === newStyle);
                      setRemixModal((prev) =>
                        prev
                          ? {
                              ...prev,
                              styleId: newStyle,
                              musicTrack: matchedTpl ? matchedTpl.fixed_music_track : prev.musicTrack,
                            }
                          : null
                      );
                    }}
                    className="w-full text-xs bg-neutral-800 border border-neutral-700 rounded-input p-2.5 text-neutral-100 focus:outline-none focus:border-amber-400"
                  >
                    {templatesList.length > 0 && (
                      <optgroup label="CapCut-Style Templates (Fixed Audio)">
                        {templatesList.map((tpl) => (
                          <option key={tpl.id} value={tpl.id}>
                            {tpl.name} (Fixed Audio: {tpl.fixed_music_track.replace('downloadsv2', 'Beat V2').replace('download', 'Track')})
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="Universal Motion Styles">
                      {stylesList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {/* Music Track Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                    <Music className="w-3.5 h-3.5 text-neutral-400" />
                    Background Music
                  </label>
                  {selectedTemplate ? (
                    <div className="flex items-center gap-2 p-2.5 rounded-input bg-neutral-800/60 border border-neutral-700/80 text-xs">
                      <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="text-neutral-300">
                        Locked to Template Audio: <strong>{selectedTemplate.fixed_music_track}</strong>
                      </span>
                    </div>
                  ) : (
                    <select
                      value={remixModal.musicTrack}
                      onChange={(e) =>
                        setRemixModal((prev) => (prev ? { ...prev, musicTrack: e.target.value } : null))
                      }
                      className="w-full text-xs bg-neutral-800 border border-neutral-700 rounded-input p-2.5 text-neutral-100 focus:outline-none focus:border-amber-400"
                    >
                      {musicList.map((m) => (
                        <option key={m.id} value={m.filename}>
                          {m.name} ({m.size_kb} KB)
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Title & Subtitle Overlays */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-neutral-300">Title Hook (Line 1)</label>
                    <Input
                      value={remixModal.title}
                      onChange={(e) =>
                        setRemixModal((prev) => (prev ? { ...prev, title: e.target.value } : null))
                      }
                      placeholder="e.g. INPLAY BK680"
                      className="bg-neutral-800 border-neutral-700 text-xs text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-neutral-300">Subtitle / Callout (Line 2)</label>
                    <Input
                      value={remixModal.subtitle}
                      onChange={(e) =>
                        setRemixModal((prev) => (prev ? { ...prev, subtitle: e.target.value } : null))
                      }
                      placeholder="e.g. MUST-HAVE CREATOR DEAL"
                      className="bg-neutral-800 border-neutral-700 text-xs text-white"
                    />
                  </div>
                </div>

                {/* Taglish Caption display if available */}
                {remixModal.caption && (
                  <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800 text-xs text-neutral-300">
                    <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold block mb-1">
                      Current Buffer Taglish Caption:
                    </span>
                    <p className="line-clamp-2 text-neutral-400">{remixModal.caption}</p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-neutral-800 flex items-center justify-end gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setRemixModal(null)}
                  disabled={isRemixing}
                  className="text-xs"
                >
                  Close
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={isRemixing}
                  onClick={handleExecuteRemix}
                  className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-black font-semibold text-xs shadow-md"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRemixing ? 'animate-spin' : ''}`} />
                  {isRemixing ? 'Regenerating & Rendering...' : 'Regenerate / Remix Video'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
