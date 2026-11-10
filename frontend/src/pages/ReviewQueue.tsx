import React, { useState, useEffect } from "react";
import { Check, X, RefreshCw, Edit3 } from "lucide-react";
import { Button, Card, Badge, Input } from "../components/ui";

interface ReviewItem {
  extraction_id: number;
  upload_id: number;
  filename: string;
  image_index: number;
  model_used: string;
  prompt_version: string;
  confidence: number;
  extracted_data: {
    order_id?: string;
    status_stage?: string;
    product_name_raw?: string;
    price?: number;
    quantity?: number;
    commission_rate?: number;
    est_commission?: number;
    actual_commission?: number;
    settle_date_est?: string;
  };
  created_at: string;
}

export const ReviewQueuePage: React.FC = () => {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeItem, setActiveItem] = useState<ReviewItem | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ingest/review-queue");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        if (data.items && data.items.length > 0) {
          selectItem(data.items[0]);
        } else {
          setActiveItem(null);
        }
      }
    } catch (err) {
      console.error("Failed to load review queue", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const selectItem = (item: ReviewItem) => {
    setActiveItem(item);
    setEditForm({
      order_id: item.extracted_data.order_id || "",
      status_stage: item.extracted_data.status_stage || "unpaid",
      product_name_raw: item.extracted_data.product_name_raw || "",
      price: item.extracted_data.price || 0.0,
      quantity: item.extracted_data.quantity || 1,
      commission_rate: item.extracted_data.commission_rate || 0.10,
      est_commission: item.extracted_data.est_commission || 0.0,
      actual_commission: item.extracted_data.actual_commission || null,
      settle_date_est: item.extracted_data.settle_date_est || "",
    });
  };

  const handleApprove = async () => {
    if (!activeItem) return;
    try {
      const res = await fetch(`/api/ingest/review-queue/${activeItem.extraction_id}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": "client-token",
        },
        body: JSON.stringify(editForm),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Approval failed");
      }

      setActionMsg(`Order ${editForm.order_id} approved and saved.`);
      fetchQueue();
    } catch (err: any) {
      setActionMsg(`Error: ${err.message}`);
    }
  };

  const handleReject = async () => {
    if (!activeItem) return;
    try {
      const res = await fetch(`/api/ingest/review-queue/${activeItem.extraction_id}/reject`, {
        method: "POST",
        headers: {
          "X-CSRF-Token": "client-token",
        },
      });

      if (!res.ok) throw new Error("Rejection failed");
      setActionMsg(`Extraction ${activeItem.extraction_id} rejected.`);
      fetchQueue();
    } catch (err: any) {
      setActionMsg(`Error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Extraction Review Queue
          </h1>
          <p className="text-sm text-neutral-500">
            Low-confidence OCR extractions, blurred screenshots, or uncertain order IDs requiring one-tap review.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchQueue}>
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh Queue ({items.length})
        </Button>
      </div>

      {actionMsg && (
        <div className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-md text-xs border border-neutral-300 dark:border-neutral-700">
          {actionMsg}
        </div>
      )}

      {items.length === 0 && !loading && (
        <Card className="p-12 text-center">
          <Check className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <h3 className="text-base font-semibold text-neutral-800 dark:text-neutral-200">
            Review Queue Clean
          </h3>
          <p className="text-xs text-neutral-400 mt-1">
            All extracted orders have passed automated validation and confidence thresholds.
          </p>
        </Card>
      )}

      {items.length > 0 && activeItem && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Queue List & Screenshot View */}
          <div className="lg:col-span-5 space-y-4">
            <Card className="p-4">
              <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                Pending Items ({items.length})
              </h3>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {items.map((it) => (
                  <button
                    key={it.extraction_id}
                    onClick={() => selectItem(it)}
                    className={`w-full text-left p-2.5 rounded-md border text-xs transition-colors ${
                      activeItem.extraction_id === it.extraction_id
                        ? "border-neutral-900 dark:border-white bg-neutral-50 dark:bg-neutral-800 font-semibold"
                        : "border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate">{it.filename}</span>
                      <Badge variant="warning">
                        {Math.round(it.confidence * 100)}% conf
                      </Badge>
                    </div>
                    <div className="text-neutral-400 mt-1">
                      Order: {it.extracted_data.order_id || "Uncertain"}
                    </div>
                  </button>
                ))}
              </div>
            </Card>

            <Card className="p-4 text-center">
              <div className="text-xs text-neutral-500 mb-2 font-medium">Screenshot Inspection</div>
              <div className="w-full h-72 bg-neutral-100 dark:bg-neutral-800 rounded-md flex items-center justify-center border border-neutral-200 dark:border-neutral-700 overflow-hidden relative">
                <div className="text-xs text-neutral-400 p-4">
                  [Mobile Screenshot Preview]
                  <div className="mt-1 font-mono">{activeItem.filename}</div>
                  <div className="text-[11px] text-neutral-500 mt-2">
                    Model: {activeItem.model_used} ({activeItem.prompt_version})
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column: Editable Extraction Form */}
          <div className="lg:col-span-7">
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center space-x-2">
                  <Edit3 className="w-4 h-4 text-neutral-500" />
                  <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm">
                    Review & Correct Extracted Fields
                  </h3>
                </div>
                <Badge variant="warning">
                  Confidence {Math.round(activeItem.confidence * 100)}%
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-neutral-500 font-medium mb-1">
                    Order ID (Strictly 10-22 Digits)
                  </label>
                  <Input
                    value={editForm.order_id || ""}
                    onChange={(e) => setEditForm({ ...editForm, order_id: e.target.value })}
                    className="font-mono"
                  />
                </div>

                <div>
                  <label className="block text-neutral-500 font-medium mb-1">Status Stage</label>
                  <select
                    className="w-full px-3 py-2 border rounded-md bg-white dark:bg-neutral-900 text-xs"
                    value={editForm.status_stage}
                    onChange={(e) => setEditForm({ ...editForm, status_stage: e.target.value })}
                  >
                    <option value="unpaid">Awaiting Payment (Unpaid)</option>
                    <option value="to_ship">To Ship (Processing)</option>
                    <option value="shipped">In Transit (Shipped)</option>
                    <option value="delivered">Delivered</option>
                    <option value="settled">Completed / Settled</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="refunded">Refunded / Returned</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-neutral-500 font-medium mb-1">Raw Product Title</label>
                  <Input
                    value={editForm.product_name_raw || ""}
                    onChange={(e) => setEditForm({ ...editForm, product_name_raw: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-neutral-500 font-medium mb-1">Price</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editForm.price || 0}
                    onChange={(e) => setEditForm({ ...editForm, price: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                <div>
                  <label className="block text-neutral-500 font-medium mb-1">Quantity</label>
                  <Input
                    type="number"
                    value={editForm.quantity || 1}
                    onChange={(e) => setEditForm({ ...editForm, quantity: parseInt(e.target.value) || 1 })}
                  />
                </div>

                <div>
                  <label className="block text-neutral-500 font-medium mb-1">Commission Rate</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editForm.commission_rate || 0.10}
                    onChange={(e) => setEditForm({ ...editForm, commission_rate: parseFloat(e.target.value) || 0.10 })}
                  />
                </div>

                <div>
                  <label className="block text-neutral-500 font-medium mb-1">Estimated Commission</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editForm.est_commission || ""}
                    onChange={(e) => setEditForm({ ...editForm, est_commission: parseFloat(e.target.value) || null })}
                  />
                </div>

                <div>
                  <label className="block text-neutral-500 font-medium mb-1">
                    Actual Settled Commission (Null if unsettled)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editForm.actual_commission ?? ""}
                    placeholder="-"
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        actual_commission: e.target.value === "" ? null : parseFloat(e.target.value),
                      })
                    }
                  />
                </div>

                <div>
                  <label className="block text-neutral-500 font-medium mb-1">Estimated Settle Date</label>
                  <Input
                    value={editForm.settle_date_est || ""}
                    placeholder="YYYY-MM-DD"
                    onChange={(e) => setEditForm({ ...editForm, settle_date_est: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                <Button variant="secondary" size="sm" onClick={handleReject}>
                  <X className="w-4 h-4 mr-1 text-red-500" /> Reject
                </Button>
                <Button size="sm" onClick={handleApprove}>
                  <Check className="w-4 h-4 mr-1 text-emerald-500" /> Confirm & Approve Order
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};
