import React, { useState, useEffect } from "react";
import { UploadCloud, RefreshCw, FileText, Image as ImageIcon, Zap } from "lucide-react";
import { Button, Card, Badge, Table } from "../components/ui";

interface QuotaStats {
  daily_requests_used: number;
  daily_limit: number;
  remaining_today: number;
  reset_time: string;
}

interface UploadItem {
  id: number;
  filename: string;
  file_type: string;
  status: string;
  file_hash: string;
  created_at: string;
}

export const UploadPage: React.FC = () => {
  const [quota, setQuota] = useState<QuotaStats | null>(null);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const fetchStatsAndUploads = async () => {
    try {
      const qRes = await fetch("/api/ai/quota");
      if (qRes.ok) setQuota(await qRes.json());

      const uRes = await fetch("/api/ingest/uploads");
      if (uRes.ok) {
        const data = await uRes.json();
        setUploads(data.uploads || []);
      }
    } catch (err) {
      console.error("Failed to load upload data", err);
    }
  };

  useEffect(() => {
    fetchStatsAndUploads();
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const handleUploadAndProcess = async () => {
    if (selectedFiles.length === 0) return;
    setUploading(true);
    setMessage(null);

    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => formData.append("files", file));

      const upRes = await fetch("/api/ingest/upload", {
        method: "POST",
        headers: { "X-CSRF-Token": "client-token" },
        body: formData,
      });

      if (!upRes.ok) throw new Error("Upload failed");
      const upData = await upRes.json();
      const uploadedIds = upData.uploads.map((u: any) => u.id);

      setUploading(false);
      setProcessing(true);

      const procRes = await fetch("/api/ingest/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": "client-token",
        },
        body: JSON.stringify({ upload_ids: uploadedIds }),
      });

      if (!procRes.ok) throw new Error("Batch processing failed");
      const procSummary = await procRes.json();

      setMessage(
        `Batch processed: ${procSummary.image_orders_auto_approved} orders auto-approved, ` +
        `${procSummary.spreadsheet_orders_ingested} spreadsheet orders ingested, ` +
        `${procSummary.items_queued_for_review} sent to Review Queue with ${procSummary.ai_api_calls_made} Gemini calls.`
      );

      setSelectedFiles([]);
      fetchStatsAndUploads();
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setUploading(false);
      setProcessing(false);
    }
  };

  const quotaPercent = quota ? Math.min(100, Math.round((quota.daily_requests_used / quota.daily_limit) * 100)) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Data Upload & OCR Ingest
          </h1>
          <p className="text-sm text-neutral-500">
            Batch-upload TikTok Shop screenshots and order spreadsheets with automated deduplication.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchStatsAndUploads}>
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Quota Meter */}
      <Card className="p-5 border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Zap className="w-5 h-5 text-amber-500" />
            <span className="font-semibold text-neutral-800 dark:text-neutral-200">
              AI Request Quota (Daily Flash & Flash-Lite)
            </span>
          </div>
          <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
            {quota ? `${quota.daily_requests_used} / ${quota.daily_limit} requests used` : "Loading..."}
          </span>
        </div>
        <div className="w-full bg-neutral-100 dark:bg-neutral-800 rounded-full h-2.5 overflow-hidden">
          <div
            className={`h-2.5 rounded-full transition-all ${
              quotaPercent > 80 ? "bg-red-500" : quotaPercent > 50 ? "bg-amber-500" : "bg-neutral-900 dark:bg-white"
            }`}
            style={{ width: `${quotaPercent}%` }}
          />
        </div>
        <p className="text-xs text-neutral-400 mt-2">
          Screenshots are batched 4-6 per Gemini request to conserve quota. Resets at midnight Pacific Time.
        </p>
      </Card>

      {/* Upload Dropzone */}
      <Card className="p-8 border-dashed border-2 border-neutral-300 dark:border-neutral-700 text-center">
        <UploadCloud className="w-12 h-12 mx-auto text-neutral-400 mb-3" />
        <h3 className="text-base font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
          Drag and drop screenshots or spreadsheets
        </h3>
        <p className="text-xs text-neutral-500 mb-4">
          Accepts .png, .jpg, .webp mobile screenshots and .csv, .xlsx orders reports
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <label className="cursor-pointer">
            <input
              type="file"
              multiple
              accept="image/*,.csv,.xlsx,.xls"
              className="hidden"
              onChange={handleFileSelect}
            />
            <span className="px-4 py-2 border rounded-md text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800">
              Select Files ({selectedFiles.length} selected)
            </span>
          </label>
          <Button
            disabled={selectedFiles.length === 0 || uploading || processing}
            onClick={handleUploadAndProcess}
          >
            {uploading ? "Uploading..." : processing ? "Processing Batch..." : "Upload & Ingest"}
          </Button>
        </div>

        {selectedFiles.length > 0 && (
          <div className="mt-4 max-h-36 overflow-y-auto border-t border-neutral-200 dark:border-neutral-800 pt-3 text-left">
            <div className="text-xs font-semibold text-neutral-500 mb-1">Files in batch:</div>
            {selectedFiles.map((f, i) => (
              <div key={i} className="text-xs text-neutral-700 dark:text-neutral-300 py-0.5 flex items-center gap-2">
                {f.name.endsWith(".csv") || f.name.endsWith(".xlsx") ? (
                  <FileText className="w-3.5 h-3.5 text-blue-500" />
                ) : (
                  <ImageIcon className="w-3.5 h-3.5 text-emerald-500" />
                )}
                <span>{f.name}</span>
                <span className="text-neutral-400">({Math.round(f.size / 1024)} KB)</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {message && (
        <div className="p-4 rounded-md bg-neutral-100 dark:bg-neutral-800 text-sm border border-neutral-300 dark:border-neutral-700">
          {message}
        </div>
      )}

      {/* Upload History Table */}
      <Card className="p-5">
        <h3 className="text-base font-semibold text-neutral-800 dark:text-neutral-200 mb-4">
          Recent Upload History
        </h3>
        <Table>
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-800 text-left text-xs font-semibold text-neutral-500">
              <th className="py-2">File</th>
              <th className="py-2">Type</th>
              <th className="py-2">Status</th>
              <th className="py-2">Uploaded</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 text-xs">
            {uploads.map((u) => (
              <tr key={u.id}>
                <td className="py-2.5 font-medium">{u.filename}</td>
                <td className="py-2.5">
                  <Badge variant="outline">{u.file_type}</Badge>
                </td>
                <td className="py-2.5">
                  <Badge
                    variant={
                      u.status === "completed"
                        ? "default"
                        : u.status === "review_required"
                        ? "warning"
                        : u.status === "failed"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {u.status}
                  </Badge>
                </td>
                <td className="py-2.5 text-neutral-400">
                  {u.created_at ? new Date(u.created_at).toLocaleString() : "-"}
                </td>
              </tr>
            ))}
            {uploads.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-neutral-400">
                  No files uploaded yet.
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
};
