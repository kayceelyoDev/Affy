import React, { useState, useEffect } from "react";
import {
  Calendar,
  Lock,
  Unlock,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Film,
  Send,
  AlertCircle,
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
  const [selectedBatchStyle, setSelectedBatchStyle] = useState<string>("default");
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ text: string; error?: boolean } | null>(null);

  const fetchTodayPlan = async () => {
    try {
      const data = await api.get<PlanResponse>("/api/planner/today");
      setPlan(data);
    } catch (err: any) {
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
      setActionMsg({
        text: dryRunMode
          ? "Dry-run plan generated successfully (nothing saved or rendered)."
          : "Today's plan generated and saved with Sunday Strategy allocations.",
      });
    } catch (err: any) {
      setActionMsg({ text: `Error: ${err.message}`, error: true });
    } finally {
      setGenerating(false);
    }
  };

  const handleRunAutoEdit = async (slotId?: number, slotStyle?: string) => {
    setEditing(true);
    setActionMsg(null);
    try {
      const payload: any = {};
      if (slotId) {
        payload.slot_id = slotId;
        if (slotStyle) payload.style_id = slotStyle;
      } else if (selectedBatchStyle !== "default") {
        payload.style_id = selectedBatchStyle;
      }
      const res = await api.post("/api/renders/auto-edit", payload);
      setActionMsg({ text: res.message || "FFmpeg auto-edit jobs queued successfully." });
      await fetchTodayPlan();
    } catch (err: any) {
      setActionMsg({ text: `Auto-edit error: ${err.message}`, error: true });
    } finally {
      setEditing(false);
    }
  };

  const handleUpdateSlotStyle = async (slotId: number, styleId: string) => {
    try {
      await api.put(`/api/planner/slots/${slotId}`, { style_id: styleId });
      setPlan((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          slots: prev.slots.map((s) => (s.id === slotId ? { ...s, style_id: styleId } : s)),
        };
      });
      setActionMsg({ text: `Slot #${slotId} style updated to ${styleId.replace(/_/g, " ")}.` });
    } catch (err: any) {
      setActionMsg({ text: `Failed to update style: ${err.message}`, error: true });
    }
  };

  const handlePublishAll = async (slotId?: number) => {
    setPublishing(true);
    setActionMsg(null);
    try {
      if (slotId) {
        await api.post("/api/posts/publish-slot", { slot_id: slotId, mode: "queue" });
        setActionMsg({ text: `Slot #${slotId} scheduled to Buffer queue.` });
      } else {
        const res = await api.post("/api/posts/publish-all", { mode: "queue" });
        setActionMsg({ text: res.message || "All rendered videos scheduled to Buffer queue." });
      }
      await fetchTodayPlan();
    } catch (err: any) {
      setActionMsg({ text: `Publish error: ${err.message}`, error: true });
    } finally {
      setPublishing(false);
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
      setActionMsg({ text: "All slots approved for rendering and Buffer publication." });
      fetchTodayPlan();
    } catch (err: any) {
      setActionMsg({ text: `Approval failed: ${err.message}`, error: true });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-neutral-400" />
            Today's Strategy Content Plan ({plan?.date ?? "Loading..."})
          </h1>
          <p className="text-sm text-neutral-500">
            Replaces Workflow 2 (Strategy Engine) & triggers Workflow 3 (Auto-Edit FFmpeg) and Workflow 4 (Buffer Poster).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={fetchTodayPlan}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
          </Button>

          <Button size="sm" variant="secondary" disabled={generating} onClick={handleGeneratePlan}>
            <Sparkles className={`w-3.5 h-3.5 mr-1.5 ${generating ? 'animate-spin' : ''}`} />
            {generating ? "Generating..." : "Generate Plan"}
          </Button>

          <div className="flex items-center gap-1.5 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-control">
            <select
              value={selectedBatchStyle}
              onChange={(e) => setSelectedBatchStyle(e.target.value)}
              className="text-xs bg-transparent border-0 px-2 py-1 text-neutral-800 dark:text-neutral-200 cursor-pointer focus:outline-none"
              title="Select rendering style"
            >
              <option value="default" className="bg-neutral-900 text-neutral-100">Default Style (Settings)</option>
              <option value="random" className="bg-neutral-900 text-neutral-100">Random / Diverse (All Styles)</option>
              <option value="classic_hook" className="bg-neutral-900 text-neutral-100">Classic Hook</option>
              <option value="clean_showcase" className="bg-neutral-900 text-neutral-100">Clean Showcase</option>
              <option value="promo_pop" className="bg-neutral-900 text-neutral-100">Promo Pop</option>
              <option value="punchy_zoom" className="bg-neutral-900 text-neutral-100">Punchy Zoom</option>
              <option value="smooth_flow" className="bg-neutral-900 text-neutral-100">Smooth Flow</option>
            </select>
            <Button
              size="sm"
              variant="primary"
              disabled={editing}
              onClick={() => handleRunAutoEdit()}
              className="bg-neutral-900 text-white dark:bg-white dark:text-black whitespace-nowrap"
            >
              <Film className={`w-3.5 h-3.5 mr-1.5 ${editing ? 'animate-spin' : ''}`} />
              Run Auto-Edit All
            </Button>
          </div>

          <Button
            size="sm"
            variant="primary"
            disabled={publishing}
            onClick={() => handlePublishAll()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Send className={`w-3.5 h-3.5 mr-1.5 ${publishing ? 'animate-spin' : ''}`} />
            Publish All to Buffer
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
              Auto-Approve Slots
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
              Dry-Run Mode (Simulation only)
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
        <div
          className={`p-3.5 rounded-card text-xs flex items-center gap-2 hairline-border ${
            actionMsg.error
              ? 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
          }`}
        >
          {actionMsg.error ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
          <span>{actionMsg.text}</span>
        </div>
      )}

      {/* 6 Strategy Quota Slots Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plan?.slots.map((slot) => {
          const isPending = slot.status === "pending" || slot.status === "approved";
          const isRendering = slot.status === "rendering";
          const isRendered = slot.status === "rendered";
          const isPosted = slot.status === "posted" || slot.status === "published";

          return (
            <Card
              key={slot.slot_index}
              className={`p-5 relative border transition-all flex flex-col justify-between ${
                slot.locked
                  ? "border-neutral-900 dark:border-white shadow-sm"
                  : "border-neutral-200 dark:border-neutral-800"
              }`}
            >
              <div>
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
                        title={slot.locked ? "Slot Locked" : "Lock Slot"}
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
                        isPosted
                          ? "default"
                          : isRendered
                          ? "default"
                          : isRendering
                          ? "warning"
                          : "neutral"
                      }
                    >
                      {slot.status ? slot.status.toUpperCase() : "PENDING"}
                    </Badge>
                  </div>
                </div>

                {/* Product Title */}
                <div className="mb-2">
                  <div className="text-[11px] text-neutral-400 uppercase tracking-wider font-semibold">
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
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-neutral-400 shrink-0">Style:</span>
                    <select
                      value={slot.style_id?.replace(/^style_\d+_/, '') || 'classic_hook'}
                      onChange={(e) => handleUpdateSlotStyle(slot.id, e.target.value)}
                      disabled={isRendering || isRendered || isPosted}
                      className="text-[11px] font-medium rounded bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 px-2 py-0.5 text-neutral-800 dark:text-neutral-200 cursor-pointer focus:outline-none max-w-[150px] truncate"
                      title="Change style for this specific video"
                    >
                      <option value="classic_hook" className="bg-neutral-900 text-neutral-100">Classic Hook</option>
                      <option value="clean_showcase" className="bg-neutral-900 text-neutral-100">Clean Showcase</option>
                      <option value="promo_pop" className="bg-neutral-900 text-neutral-100">Promo Pop</option>
                      <option value="punchy_zoom" className="bg-neutral-900 text-neutral-100">Punchy Zoom</option>
                      <option value="smooth_flow" className="bg-neutral-900 text-neutral-100">Smooth Flow</option>
                    </select>
                  </div>
                </div>

                {/* Strategy Reason */}
                <div className="text-[11px] text-neutral-400 italic line-clamp-2 border-t border-neutral-100 dark:border-neutral-800 pt-2 mb-4">
                  "{slot.reason}"
                </div>
              </div>

              {/* Slot Action Button */}
              <div className="border-t border-neutral-100 dark:border-neutral-800 pt-3">
                {isPending && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="w-full text-xs flex items-center justify-center gap-1.5"
                    disabled={editing}
                    onClick={() => handleRunAutoEdit(slot.id, slot.style_id)}
                  >
                    <Film className="w-3.5 h-3.5" />
                    Auto-Edit This Slot
                  </Button>
                )}

                {isRendering && (
                  <div className="flex items-center justify-center gap-2 text-xs text-amber-500 py-1">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Rendering with FFmpeg...</span>
                  </div>
                )}

                {isRendered && (
                  <Button
                    size="sm"
                    variant="primary"
                    className="w-full text-xs flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={publishing}
                    onClick={() => handlePublishAll(slot.id)}
                  >
                    <Send className="w-3.5 h-3.5" />
                    Publish to Buffer
                  </Button>
                )}

                {isPosted && (
                  <div className="text-center text-xs text-emerald-600 dark:text-emerald-400 py-1 flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Scheduled to Buffer</span>
                  </div>
                )}
              </div>
            </Card>
          );
        })}

        {(!plan || plan.slots.length === 0) && (
          <div className="col-span-full py-12 text-center text-neutral-400">
            No plan slots generated for today. Click "Generate Plan" to build 6 strategy slots.
          </div>
        )}
      </div>
    </div>
  );
};
