import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  BarChart3,
  DollarSign,
  Eye,
  ShoppingBag,
  RefreshCw,
  Layers,
  ShieldAlert,
} from "lucide-react";
import { Button, Card, Badge, Table } from "../components/ui";
import { api } from "../api/client";

interface AnalyticsOverview {
  total_views: number;
  total_videos: number;
  total_orders: number;
  total_gmv: number;
  orders_per_1000_views: number;
  commission_per_video: number;
  cancel_rate_pct: number;
  cashflow: {
    settled: number;
    settling_soon: number;
    pending_raw: number;
    risk_adjusted_pending: number;
  };
}

interface ScorecardItem {
  id: number;
  period: string;
  product_name: string;
  score: number;
  tier: "SCALE" | "STEADY" | "TEST" | "COOLDOWN";
  trend: "UP" | "DOWN" | "STABLE" | "NEW";
  profile_version: string;
  explanation?: string;
  components?: {
    videos_posted: number;
    total_views: number;
    orders_total: number;
    settled_orders: number;
    weighted_commission: number;
  };
}

interface StylePerformance {
  hook_style: string;
  videos_count: number;
  total_views: number;
  avg_views_per_video: number;
}

export const AnalyticsPage: React.FC = () => {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [scorecards, setScorecards] = useState<ScorecardItem[]>([]);
  const [styles, setStyles] = useState<StylePerformance[]>([]);
  const [scoringTriggered, setScoringTriggered] = useState(false);

  const fetchAnalytics = async () => {
    try {
      const [oData, scData, stData] = await Promise.all([
        api.get<AnalyticsOverview>("/api/analytics/overview").catch(() => null),
        api.get<any>("/api/analytics/scorecards").catch(() => null),
        api.get<any>("/api/analytics/styles").catch(() => null),
      ]);

      if (oData) setOverview(oData);
      if (scData) {
        setScorecards(scData.scorecards || []);
      }
      if (stData) {
        setStyles(stData.styles || []);
      }
    } catch (err) {
      console.error("Failed to load analytics data", err);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const handleRunSundaySync = async () => {
    setScoringTriggered(true);
    try {
      await api.post("/api/analytics/scorecards/run", { period: "weekly", profile_version: "v1" });
      await fetchAnalytics();
    } catch (err) {
      console.error("Scoring run failed", err);
    } finally {
      setScoringTriggered(false);
    }
  };

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case "SCALE":
        return <Badge variant="default">SCALE</Badge>;
      case "STEADY":
        return <Badge variant="secondary">STEADY</Badge>;
      case "COOLDOWN":
        return <Badge variant="destructive">COOLDOWN</Badge>;
      default:
        return <Badge variant="warning">TEST</Badge>;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "UP":
        return <TrendingUp className="w-4 h-4 text-emerald-500 inline mr-1" />;
      case "DOWN":
        return <TrendingDown className="w-4 h-4 text-red-500 inline mr-1" />;
      case "STABLE":
        return <Minus className="w-4 h-4 text-neutral-400 inline mr-1" />;
      default:
        return <Sparkles className="w-4 h-4 text-amber-500 inline mr-1" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Analytics & Sunday Strategy Engine
          </h1>
          <p className="text-sm text-neutral-500">
            Multi-source metrics (Buffer, TikTok Display API, CSV) with deterministic attribution and Sunday Strategy scoring.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={fetchAnalytics}>
            <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
          </Button>
          <Button size="sm" disabled={scoringTriggered} onClick={handleRunSundaySync}>
            <BarChart3 className="w-4 h-4 mr-1.5" /> {scoringTriggered ? "Scoring..." : "Run Sunday Strategy Sync"}
          </Button>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-xs text-neutral-500 font-medium flex items-center justify-between">
            <span>Total Views</span>
            <Eye className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="text-2xl font-bold mt-1 text-neutral-900 dark:text-neutral-100">
            {overview?.total_views.toLocaleString() ?? "0"}
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">
            Across {overview?.total_videos ?? 0} published videos
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs text-neutral-500 font-medium flex items-center justify-between">
            <span>Gross Merchandise (GMV)</span>
            <DollarSign className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="text-2xl font-bold mt-1 text-neutral-900 dark:text-neutral-100">
            ₱{overview?.total_gmv.toLocaleString(undefined, { minimumFractionDigits: 2 }) ?? "0.00"}
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">
            From {overview?.total_orders ?? 0} affiliate orders
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs text-neutral-500 font-medium flex items-center justify-between">
            <span>Orders / 1,000 Views</span>
            <ShoppingBag className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">
            {overview?.orders_per_1000_views.toFixed(2) ?? "0.00"}
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">
            Conversion velocity index
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs text-neutral-500 font-medium flex items-center justify-between">
            <span>Commission / Video</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
            ₱{overview?.commission_per_video.toFixed(2) ?? "0.00"}
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">
            Avg yield per render
          </div>
        </Card>
      </div>

      {/* Cashflow Ledger Card */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-emerald-500" /> Cashflow & Payout Pipeline
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
          <div className="p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-md">
            <span className="text-neutral-500 block mb-1">Settled (Paid Out)</span>
            <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
              ₱{overview?.cashflow.settled.toFixed(2) ?? "0.00"}
            </span>
          </div>

          <div className="p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-md">
            <span className="text-neutral-500 block mb-1">Settling Soon (Delivered)</span>
            <span className="text-base font-bold text-neutral-800 dark:text-neutral-200">
              ₱{overview?.cashflow.settling_soon.toFixed(2) ?? "0.00"}
            </span>
          </div>

          <div className="p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-md">
            <span className="text-neutral-500 block mb-1">Raw Pending Total</span>
            <span className="text-base font-bold text-neutral-800 dark:text-neutral-200">
              ₱{overview?.cashflow.pending_raw.toFixed(2) ?? "0.00"}
            </span>
          </div>

          <div className="p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-md border border-neutral-300 dark:border-neutral-700">
            <span className="text-neutral-500 block mb-1 flex items-center justify-between">
              <span>Risk-Adjusted Expected</span>
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
            </span>
            <span className="text-base font-bold text-amber-600 dark:text-amber-400">
              ₱{overview?.cashflow.risk_adjusted_pending.toFixed(2) ?? "0.00"}
            </span>
            <span className="text-[10px] text-neutral-400 block mt-0.5">
              Reflects {overview?.cancel_rate_pct.toFixed(1)}% cancellation rate
            </span>
          </div>
        </div>
      </Card>

      {/* Product Scorecard Leaderboard */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Product Strategy Scorecards (Sunday Engine)
            </h3>
            <p className="text-xs text-neutral-400">
              Determines daily posting priority tiers: SCALE (active scale), STEADY (maintain cadence), TEST (explore hooks), COOLDOWN (pause).
            </p>
          </div>
        </div>

        <Table>
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-800 text-left text-xs font-semibold text-neutral-500">
              <th className="py-2.5">Product</th>
              <th className="py-2.5">Tier</th>
              <th className="py-2.5">Trend</th>
              <th className="py-2.5 text-right">Score</th>
              <th className="py-2.5 text-right">Videos</th>
              <th className="py-2.5 text-right">Orders</th>
              <th className="py-2.5 text-right">Weighted Comm</th>
              <th className="py-2.5">Reasoning</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 text-xs">
            {scorecards.map((sc) => (
              <tr key={sc.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                <td className="py-3 font-medium text-neutral-900 dark:text-neutral-100">
                  {sc.product_name}
                </td>
                <td className="py-3">{getTierBadge(sc.tier)}</td>
                <td className="py-3">
                  {getTrendIcon(sc.trend)}
                  <span>{sc.trend}</span>
                </td>
                <td className="py-3 text-right font-bold font-mono">{sc.score.toFixed(1)}</td>
                <td className="py-3 text-right text-neutral-500">
                  {sc.components?.videos_posted ?? "-"}
                </td>
                <td className="py-3 text-right text-neutral-500">
                  {sc.components?.orders_total ?? "-"}
                </td>
                <td className="py-3 text-right font-medium text-emerald-600 dark:text-emerald-400">
                  {sc.components ? `₱${sc.components.weighted_commission.toFixed(2)}` : "-"}
                </td>
                <td className="py-3 text-[11px] text-neutral-400 max-w-xs truncate" title={sc.explanation}>
                  {sc.explanation || "-"}
                </td>
              </tr>
            ))}
            {scorecards.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-neutral-400">
                  No scorecards generated yet. Click "Run Sunday Strategy Sync" above.
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>

      {/* Style & Hook Performance */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3 flex items-center gap-2">
          <Layers className="w-4 h-4 text-neutral-400" /> Hook & Style Yield Matrix
        </h3>
        <Table>
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-800 text-left text-xs font-semibold text-neutral-500">
              <th className="py-2">Hook / Style</th>
              <th className="py-2 text-right">Videos Count</th>
              <th className="py-2 text-right">Total Views</th>
              <th className="py-2 text-right">Avg Views / Video</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 text-xs">
            {styles.map((st, i) => (
              <tr key={i}>
                <td className="py-2.5 font-medium">{st.hook_style}</td>
                <td className="py-2.5 text-right">{st.videos_count}</td>
                <td className="py-2.5 text-right font-mono">{st.total_views.toLocaleString()}</td>
                <td className="py-2.5 text-right font-mono font-medium">{st.avg_views_per_video.toLocaleString()}</td>
              </tr>
            ))}
            {styles.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-neutral-400">
                  No video performance logs recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
};
