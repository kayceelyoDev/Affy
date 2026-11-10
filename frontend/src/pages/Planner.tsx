import React, { useState, useEffect } from "react";
import {
  Calendar,
  Lock,
  Unlock,
  CheckCircle2,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { Button, Card, Badge } from "../components/ui";
import { api } from "../api/client";

interface PlanSlotItem {
  id: number;
  slot_index: number;
  scheduled_time: string;
  product_id: number | null;
  product_name: string;
  style_id: string;
  hook_style: string;
  hook_text: string | null;
  reason: string;
  locked: boolean;
  source: string;
  status: string;
}

interface PlanResponse {
  plan_id?: number;
  date: string;
  status: string;
  dry_run: boolean;
  slots_count: number;
  slots: PlanSlotItem[];
}

export const PlannerPage: React.FC = () => {
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [dryRunMode, setDryRunMode] = useState(false);
  const [autoApproveMode, setAutoApproveMode] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const fetchTodayPlan = async () => {
    try {
      const data = await api.get<PlanResponse>("/api/planner/today");
      setPlan(data);
    } catch (err) {
      console.error("Failed to fetch daily plan", err);
    }
  };

  useEffect(() => {
    fetchTodayPlan();
  }, []);

  const handleGeneratePlan = async () => {
    setGenerating(true);
    setActionMsg(null);
    try {
      const data = await api.post("/api/planner/generate", {
        dry_run: dryRunMode,
        auto_approve: autoApproveMode,
        force_regenerate: true,
      });

      setPlan(data);
      setActionMsg(
        dryRunMode
          ? "Dry-run plan generated successfully (nothing saved or rendered)."
          : "Today's plan generated and saved with Sunday Strategy allocations."
      );
    } catch (err: any) {
      setActionMsg(`Error: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleToggleLock = async (slotId: number) => {
    try {
      await api.post(`/api/planner/slots/${slotId}/lock`);
      fetchTodayPlan();
    } catch (err) {
      console.error("Failed to toggle slot lock", err);
    }
  };

  const handleApproveAll = async () => {
    try {
      await api.post("/api/planner/approve");
      setActionMsg("All slots approved for rendering and Buffer publication.");
      fetchTodayPlan();
    } catch (err) {
      console.error("Failed to approve all slots", err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-neutral-400" />
            Today's Daily Plan ({plan?.date ?? "Loading..."})
          </h1>
          <p className="text-sm text-neutral-500">
            6 Strategy Quota slots planned from Sunday Engine scorecards, clip readiness, and exploration shares.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={fetchTodayPlan}>
            <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
          </Button>
          <Button size="sm" disabled={generating} onClick={handleGeneratePlan}>
            <Sparkles className="w-4 h-4 mr-1.5" /> {generating ? "Generating..." : "Generate Plan Now"}
          </Button>
        </div>
      </div>

      {/* Control Bar: Auto-approve & Dry-run toggles */}
      <Card className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-neutral-50 dark:bg-neutral-800/40">
        <div className="flex items-center gap-6 text-xs">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoApproveMode}
              onChange={(e) => setAutoApproveMode(e.target.checked)}
              className="rounded border-neutral-300 dark:border-neutral-700"
            />
            <span className="font-medium text-neutral-800 dark:text-neutral-200">
              Auto-Approve Slots (Default ON with Telegram summary)
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dryRunMode}
              onChange={(e) => setDryRunMode(e.target.checked)}
              className="rounded border-neutral-300 dark:border-neutral-700"
            />
            <span className="font-medium text-neutral-800 dark:text-neutral-200">
              Dry-Run Mode (Simulation only, renders/posts nothing)
            </span>
          </label>
        </div>

        {plan?.status !== "approved" && !dryRunMode && (
          <Button size="sm" onClick={handleApproveAll}>
            <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-500" /> Approve All Today
          </Button>
        )}
      </Card>

      {actionMsg && (
        <div className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-md text-xs border border-neutral-300 dark:border-neutral-700">
          {actionMsg}
        </div>
      )}

      {/* 6 Strategy Quota Slots Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plan?.slots.map((slot) => (
          <Card
            key={slot.slot_index}
            className={`p-5 relative border transition-all ${
              slot.locked
                ? "border-neutral-900 dark:border-white shadow-sm"
                : "border-neutral-200 dark:border-neutral-800"
            }`}
          >
            {/* Header: Time and Slot number */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="font-mono font-semibold">
                  {slot.scheduled_time}
                </Badge>
                <span className="text-xs text-neutral-400 font-medium">
                  Slot #{slot.slot_index + 1}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {slot.id && (
                  <button
                    onClick={() => handleToggleLock(slot.id)}
                    className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    title={slot.locked ? "Slot Locked (Planner will not overwrite)" : "Lock Slot"}
                  >
                    {slot.locked ? (
                      <Lock className="w-4 h-4 text-neutral-900 dark:text-white" />
                    ) : (
                      <Unlock className="w-4 h-4 text-neutral-400" />
                    )}
                  </button>
                )}
                <Badge
                  variant={
                    slot.status === "approved"
                      ? "default"
                      : slot.status === "rendered"
                      ? "secondary"
                      : "warning"
                  }
                >
                  {slot.status}
                </Badge>
              </div>
            </div>

            {/* Product Title */}
            <div className="mb-2">
              <div className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">
                Target Product
              </div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 truncate mt-0.5">
                {slot.product_name}
              </h3>
            </div>

            {/* Hook & Style */}
            <div className="space-y-1.5 text-xs text-neutral-600 dark:text-neutral-300 mb-3 bg-neutral-50 dark:bg-neutral-800/50 p-2.5 rounded-md">
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Hook:</span>
                <span className="font-medium text-neutral-800 dark:text-neutral-200">{slot.hook_style}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Style:</span>
                <span className="font-mono text-[11px] text-neutral-500">{slot.style_id}</span>
              </div>
            </div>

            {/* AI / Rules Reasoning */}
            <div className="text-[11px] text-neutral-400 italic line-clamp-2 border-t border-neutral-100 dark:border-neutral-800 pt-2">
              "{slot.reason}"
            </div>
          </Card>
        ))}

        {(!plan || plan.slots.length === 0) && (
          <div className="col-span-full py-12 text-center text-neutral-400">
            No plan slots generated for today. Click "Generate Plan Now" to build 6 strategy slots.
          </div>
        )}
      </div>
    </div>
  );
};
