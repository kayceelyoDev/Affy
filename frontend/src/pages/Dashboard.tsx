import React, { useState, useEffect } from 'react';
import { Card, Button, Badge } from '../components/ui';
import { api } from '../api/client';
import {
  CalendarDays,
  TrendingUp,
  HardDrive,
  RefreshCw,
  Video,
  UploadCloud,
  Clock,
  AlertCircle,
  ExternalLink,
  Sparkles,
  Send,
  Film,
  CheckCircle2,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const DashboardPage: React.FC = () => {
  const [syncing, setSyncing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [actionAlert, setActionAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const [stats, setStats] = useState({
    productsCount: 0,
    clipsCount: 0,
    ordersCount: 0,
    todayGmv: 0,
    estCommission: 0,
    pendingReviews: 0,
  });
  const [todaySlots, setTodaySlots] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // 1. Fetch products
      const products = await api.get('/api/catalog/products').catch(() => []);
      const totalClips = products.reduce((acc: number, p: any) => acc + (p.clip_count || 0), 0);

      // 2. Fetch today's plan
      const planRes = await api.get('/api/planner/today').catch(() => null);
      const slots = planRes?.slots || [];
      setTodaySlots(slots);

      // 3. Fetch orders
      const ordersRes = await api.get('/api/orders?limit=100').catch(() => ({ orders: [] }));
      const orders = ordersRes.orders || [];
      const totalGmv = orders.reduce((acc: number, o: any) => acc + (o.gmv || 0), 0);
      const totalComm = orders.reduce((acc: number, o: any) => acc + (o.est_commission || 0), 0);

      // 4. Fetch pending review aliases
      const aliases = await api.get('/api/catalog/aliases?status_filter=pending_review').catch(() => []);

      setStats({
        productsCount: products.length,
        clipsCount: totalClips,
        ordersCount: orders.length,
        todayGmv: Math.round(totalGmv),
        estCommission: Math.round(totalComm),
        pendingReviews: aliases.length,
      });
    } catch (e) {
      console.error('Error loading dashboard data', e);
    }
  };

  const handleGeneratePlan = async () => {
    setGeneratingPlan(true);
    setActionAlert({ type: 'info', message: 'Generating strategic 6-slot plan for today...' });
    try {
      await api.post('/api/planner/generate', { force_regenerate: true });
      setActionAlert({ type: 'success', message: 'Generated daily plan with 6 strategic slots.' });
      await fetchDashboardData();
    } catch (e: any) {
      setActionAlert({ type: 'error', message: 'Plan generation failed: ' + e.message });
    } finally {
      setGeneratingPlan(false);
    }
  };

  const handleTriggerAutoEdit = async (slotId?: number) => {
    setEditing(true);
    setActionAlert({
      type: 'info',
      message: slotId ? `Queuing FFmpeg render for slot #${slotId}...` : 'Scanning slots and queuing FFmpeg auto-edits...',
    });
    try {
      const res = await api.post('/api/renders/auto-edit', slotId ? { slot_id: slotId } : {});
      setActionAlert({
        type: 'success',
        message: res.message || 'Render jobs queued successfully. FFmpeg worker is rendering videos.',
      });
      await fetchDashboardData();
    } catch (e: any) {
      setActionAlert({ type: 'error', message: 'Auto-edit failed: ' + e.message });
    } finally {
      setEditing(false);
    }
  };

  const handlePublishAll = async (slotId?: number) => {
    setPublishing(true);
    setActionAlert({
      type: 'info',
      message: slotId ? `Publishing slot #${slotId} to Buffer...` : 'Publishing all ready rendered videos to Buffer queue...',
    });
    try {
      if (slotId) {
        await api.post('/api/posts/publish-slot', { slot_id: slotId, mode: 'queue' });
        setActionAlert({ type: 'success', message: `Slot #${slotId} scheduled to Buffer.` });
      } else {
        const res = await api.post('/api/posts/publish-all', { mode: 'queue' });
        setActionAlert({
          type: 'success',
          message: res.message || 'Posts scheduled to Buffer queue successfully.',
        });
      }
      await fetchDashboardData();
    } catch (e: any) {
      setActionAlert({ type: 'error', message: 'Buffer publishing failed: ' + e.message });
    } finally {
      setPublishing(false);
    }
  };

  const handleTriggerDriveSync = async () => {
    setSyncing(true);
    setActionAlert({ type: 'info', message: 'Syncing footage from Google Drive...' });
    try {
      const res = await api.post('/api/storage/sync');
      if (res.drive_error) {
        setActionAlert({ type: 'error', message: 'Google Drive: ' + res.drive_error });
      } else {
        setActionAlert({
          type: 'success',
          message: `Drive sync complete. ${res.new_clips_synced || 0} new clips indexed.`,
        });
      }
      await fetchDashboardData();
    } catch (e: any) {
      setActionAlert({ type: 'error', message: 'Drive sync error: ' + e.message });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Top Banner & Primary Workflow Triggers */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Creator Dashboard</h1>
          <p className="text-sm text-neutral-500">
            Replaces the 4 n8n workflows: Smart Orders Ingest, Sunday Strategy, Auto-Edit FFmpeg, & Buffer Poster.
          </p>
        </div>

        {/* Primary Workflow Execution Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={syncing}
            onClick={handleTriggerDriveSync}
            className="flex items-center gap-1.5"
            title="Workflow Ingest: Sync raw video clips from Google Drive or local storage"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            Sync Drive
          </Button>

          <Button
            variant="secondary"
            size="sm"
            disabled={generatingPlan}
            onClick={handleGeneratePlan}
            className="flex items-center gap-1.5"
            title="Workflow 2: Generate 6 daily plan slots with Sunday Strategy scorecard allocation"
          >
            <Sparkles className={`w-3.5 h-3.5 ${generatingPlan ? 'animate-spin' : ''}`} />
            Generate Plan
          </Button>

          <Button
            variant="primary"
            size="sm"
            disabled={editing}
            onClick={() => handleTriggerAutoEdit()}
            className="flex items-center gap-1.5 bg-neutral-900 text-white dark:bg-white dark:text-black hover:opacity-90"
            title="Workflow 3: Auto-Edit eligible product videos using FFmpeg with Anton font and beat cuts"
          >
            <Film className={`w-3.5 h-3.5 ${editing ? 'animate-spin' : ''}`} />
            Run Auto-Edit (FFmpeg)
          </Button>

          <Button
            variant="primary"
            size="sm"
            disabled={publishing}
            onClick={() => handlePublishAll()}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            title="Workflow 4: Publish rendered videos to Buffer queue with Gemini Taglish captions"
          >
            <Send className={`w-3.5 h-3.5 ${publishing ? 'animate-spin' : ''}`} />
            Publish to Buffer
          </Button>
        </div>
      </div>

      {/* Action Notification Alert Banner */}
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
            <span>{actionAlert.message}</span>
          </div>
          <button onClick={() => setActionAlert(null)} className="text-xs underline ml-2">
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 space-y-1">
          <div className="flex items-center justify-between text-neutral-500 text-xs font-medium">
            <span>Today's Posts Quota</span>
            <CalendarDays className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="text-2xl font-bold tracking-tight">
            {todaySlots.filter((s) => s.status === 'posted' || s.status === 'published').length} / {todaySlots.length || 6}
          </div>
          <div className="text-[11px] text-neutral-400">
            {todaySlots.filter((s) => s.status === 'rendered').length} rendered & ready to publish
          </div>
        </Card>

        <Card className="p-4 space-y-1">
          <div className="flex items-center justify-between text-neutral-500 text-xs font-medium">
            <span>Affiliate Revenue</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight">
            ₱{stats.todayGmv.toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400">
            ₱{stats.estCommission.toLocaleString()} est. commission
          </div>
        </Card>

        <Card className="p-4 space-y-1">
          <div className="flex items-center justify-between text-neutral-500 text-xs font-medium">
            <span>Products & Clips</span>
            <HardDrive className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="text-2xl font-bold tracking-tight">
            {stats.productsCount} <span className="text-xs font-normal text-neutral-400">products</span>
          </div>
          <div className="text-[11px] text-neutral-400">
            {stats.clipsCount} active raw clips in storage
          </div>
        </Card>

        <Card className="p-4 space-y-1">
          <div className="flex items-center justify-between text-neutral-500 text-xs font-medium">
            <span>Review Queue</span>
            <AlertCircle className={`w-4 h-4 ${stats.pendingReviews > 0 ? 'text-amber-500' : 'text-neutral-400'}`} />
          </div>
          <div className="text-2xl font-bold tracking-tight">
            {stats.pendingReviews}
          </div>
          <div className="text-[11px] text-neutral-400">
            {stats.pendingReviews > 0 ? (
              <Link to="/review" className="text-amber-500 underline">
                Resolve unmatched aliases
              </Link>
            ) : (
              'All aliases linked'
            )}
          </div>
        </Card>
      </div>

      {/* Today's Content Plan with Direct Action Triggers */}
      <Card className="p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">Today's Content Plan & Video Queue</h2>
            <p className="text-xs text-neutral-500">
              6 strategic time slots scheduled for TikTok affiliate publishing. Render and publish individually or in batch.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/planner">
              <Button variant="ghost" size="sm" className="text-xs">
                Strategy Matrix →
              </Button>
            </Link>
          </div>
        </div>

        {todaySlots.length === 0 ? (
          <div className="text-center py-10 space-y-3">
            <Clock className="w-8 h-8 text-neutral-300 dark:text-neutral-700 mx-auto" />
            <p className="text-xs text-neutral-500">No content slots planned for today yet.</p>
            <Button variant="secondary" size="sm" onClick={handleGeneratePlan} disabled={generatingPlan}>
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              Generate Today's Plan
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {todaySlots.map((slot: any) => {
              const isRendered = slot.status === 'rendered';
              const isRendering = slot.status === 'rendering';
              const isPosted = slot.status === 'posted' || slot.status === 'published';
              const isPending = slot.status === 'pending' || slot.status === 'approved';

              return (
                <div key={slot.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="font-mono text-xs font-semibold px-2.5 py-1 rounded bg-neutral-100 dark:bg-neutral-800 shrink-0">
                      {slot.scheduled_time || `Slot #${slot.slot_index + 1}`}
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-neutral-900 dark:text-white">
                        {slot.product_name || `Product #${slot.product_id || '—'}`}
                      </h3>
                      <p className="text-[11px] text-neutral-500">
                        Hook: <span className="text-neutral-700 dark:text-neutral-300 font-medium">{slot.hook_style}</span>
                        {slot.reason && <span className="hidden md:inline"> · {slot.reason}</span>}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant={
                        isPosted
                          ? 'default'
                          : isRendered
                          ? 'default'
                          : isRendering
                          ? 'warning'
                          : 'neutral'
                      }
                    >
                      {slot.status ? slot.status.toUpperCase() : 'PENDING'}
                    </Badge>

                    {/* Step 1: Render Video if Pending/Approved */}
                    {isPending && (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={editing}
                        onClick={() => handleTriggerAutoEdit(slot.id)}
                        className="text-xs py-1 px-2.5 flex items-center gap-1"
                        title="Render video for this slot using FFmpeg"
                      >
                        <Film className="w-3 h-3" />
                        Auto-Edit
                      </Button>
                    )}

                    {/* Step 2: Show rendering spinner */}
                    {isRendering && (
                      <div className="flex items-center gap-1.5 text-xs text-amber-500">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Rendering...</span>
                      </div>
                    )}

                    {/* Step 3: Publish to Buffer if Rendered */}
                    {isRendered && (
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={publishing}
                        onClick={() => handlePublishAll(slot.id)}
                        className="text-xs py-1 px-2.5 flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                        title="Upload to MediaHost & Schedule on Buffer with Gemini Taglish caption"
                      >
                        <Send className="w-3 h-3" />
                        Publish to Buffer
                      </Button>
                    )}

                    {/* Step 4: Posted link */}
                    {isPosted && (
                      <Link to="/videos">
                        <Button variant="ghost" size="sm" className="text-xs py-1 px-2">
                          View Post →
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Quick Links & Service Health */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <Video className="w-4 h-4" />
            <span>FFmpeg Video Engine</span>
          </div>
          <p className="text-xs text-neutral-500">
            Auto-editor worker active with Anton font, beat-cut sync, and 5 built-in styles.
          </p>
          <div className="flex gap-2 pt-1">
            <Link to="/videos" className="flex-1">
              <Button variant="secondary" size="sm" className="w-full text-xs">
                Video Queue →
              </Button>
            </Link>
            <Link to="/styles" className="flex-1">
              <Button variant="ghost" size="sm" className="w-full text-xs">
                Style Studio
              </Button>
            </Link>
          </div>
        </Card>

        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <UploadCloud className="w-4 h-4" />
            <span>Spreadsheet & OCR Ingest</span>
          </div>
          <p className="text-xs text-neutral-500">
            Smart Inspect for TikTok Studio CSV and Commission XLSX. Zero-AI fast parsing.
          </p>
          <Link to="/upload">
            <Button variant="secondary" size="sm" className="w-full text-xs mt-1">
              Upload Files →
            </Button>
          </Link>
        </Card>

        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <ExternalLink className="w-4 h-4" />
            <span>Telegram Bot & Approvals</span>
          </div>
          <p className="text-xs text-neutral-500">
            Interactive approvals and cashflow checks via <code>/today</code>, <code>/status</code>, <code>/sales</code>.
          </p>
          <Link to="/settings">
            <Button variant="secondary" size="sm" className="w-full text-xs mt-1">
              Bot Settings →
            </Button>
          </Link>
        </Card>
      </div>
    </div>
  );
};
