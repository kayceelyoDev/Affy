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
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const DashboardPage: React.FC = () => {
  const [syncing, setSyncing] = useState(false);
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

  const handleTriggerDriveSync = async () => {
    setSyncing(true);
    try {
      await api.post('/api/storage/sync');
      await fetchDashboardData();
    } catch (e) {
      console.error(e);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Creator Dashboard</h1>
          <p className="text-sm text-neutral-500">
            Real-time pipeline overview, today's 6-slot video distribution, and affiliate commission velocity.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={syncing}
            onClick={handleTriggerDriveSync}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            Sync Drive
          </Button>
          <Link to="/planner">
            <Button variant="primary" size="sm" className="flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5" />
              Manage Plan
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 space-y-1">
          <div className="flex items-center justify-between text-neutral-500 text-xs font-medium">
            <span>Today's Posts Quota</span>
            <CalendarDays className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="text-2xl font-bold tracking-tight">
            {todaySlots.filter((s) => s.status === 'posted').length} / {todaySlots.length || 6}
          </div>
          <div className="text-[11px] text-neutral-400">
            {todaySlots.filter((s) => s.status === 'rendered').length} ready to publish
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

      {/* Today's Plan Schedule */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">Today's Content Plan</h2>
            <p className="text-xs text-neutral-500">6 strategic time slots scheduled for TikTok affiliate publishing.</p>
          </div>
          <Link to="/planner">
            <Button variant="ghost" size="sm" className="text-xs">
              View Strategy Quotas →
            </Button>
          </Link>
        </div>

        {todaySlots.length === 0 ? (
          <div className="text-center py-8 space-y-3">
            <Clock className="w-8 h-8 text-neutral-300 dark:text-neutral-700 mx-auto" />
            <p className="text-xs text-neutral-500">No slots planned for today yet.</p>
            <Link to="/planner">
              <Button variant="secondary" size="sm">
                Generate Today's Plan
              </Button>
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {todaySlots.map((slot: any) => (
              <div key={slot.id} className="py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="font-mono text-xs font-semibold px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-800">
                    {slot.slot_time}
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-neutral-900 dark:text-white">
                      {slot.product?.name || `Product #${slot.product_id}`}
                    </h3>
                    <p className="text-[11px] text-neutral-500">
                      Style: <span className="font-medium text-neutral-700 dark:text-neutral-300">{slot.style_id}</span> · Hook: {slot.hook_style}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      slot.status === 'posted'
                        ? 'neutral'
                        : slot.status === 'rendered'
                        ? 'neutral'
                        : 'neutral'
                    }
                  >
                    {slot.status.toUpperCase()}
                  </Badge>

                  {slot.status === 'rendered' && (
                    <Link to="/videos">
                      <Button variant="primary" size="sm" className="text-xs py-1 px-2.5">
                        Publish
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Quick Links & Service Health */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <Video className="w-4 h-4" />
            <span>Video Engine</span>
          </div>
          <p className="text-xs text-neutral-500">
            Auto-editor worker active with Anton font, beat-cut sync, and 5 built-in styles.
          </p>
          <Link to="/styles">
            <Button variant="secondary" size="sm" className="w-full text-xs mt-2">
              Style Studio →
            </Button>
          </Link>
        </Card>

        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <UploadCloud className="w-4 h-4" />
            <span>Spreadsheet & OCR Ingest</span>
          </div>
          <p className="text-xs text-neutral-500">
            Upload CSV order logs or screenshots. Zero-AI spreadsheet ingestion.
          </p>
          <Link to="/upload">
            <Button variant="secondary" size="sm" className="w-full text-xs mt-2">
              Upload Files →
            </Button>
          </Link>
        </Card>

        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <ExternalLink className="w-4 h-4" />
            <span>Telegram Bot</span>
          </div>
          <p className="text-xs text-neutral-500">
            Interactive approvals and pulse checks via <code>/today</code>, <code>/status</code>, <code>/sales</code>.
          </p>
          <Link to="/settings">
            <Button variant="secondary" size="sm" className="w-full text-xs mt-2">
              Bot Settings →
            </Button>
          </Link>
        </Card>
      </div>
    </div>
  );
};
