import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Shell } from './components/layout/Shell';
import { DesignGallery } from './pages/DesignGallery';
import { StoragePage } from './pages/Storage';

const PlaceholderPage: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <div className="max-w-4xl mx-auto space-y-4">
    <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
    <p className="text-sm text-neutral-500">
      {subtitle || "Module initialized. Full controls and interactive data view ready."}
    </p>
    <div className="rounded-card hairline-border bg-neutral-50 dark:bg-neutral-900/30 p-8 text-center text-xs text-neutral-400">
      Ready for workflow execution. Navigate to <a href="/design" className="underline text-black dark:text-white font-medium">Design Gallery</a> to inspect core UI tokens and controls.
    </div>
  </div>
);

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Shell>
        <Routes>
          <Route path="/" element={<PlaceholderPage title="Creator Dashboard" subtitle="Real-time KPI overview, daily posting quota velocity, and system health." />} />
          <Route path="/design" element={<DesignGallery />} />
          <Route path="/planner" element={<PlaceholderPage title="Today's Plan" subtitle="7x6 Strategy Quota slot allocation, hook assignments, and approval status." />} />
          <Route path="/runs" element={<PlaceholderPage title="Pipeline & Runs" subtitle="Live background job executions, worker statuses, and SSE streaming logs." />} />
          <Route path="/videos" element={<PlaceholderPage title="Video Catalog" subtitle="Rendered assets, Buffer publication status, and clip provenance." />} />
          <Route path="/products" element={<PlaceholderPage title="Products Master" subtitle="Folder structure, TikTok aliases, clip inventory, and margins." />} />
          <Route path="/clips" element={<PlaceholderPage title="Clip Library" subtitle="Raw product footage, metadata tags, and storage sync status." />} />
          <Route path="/styles" element={<PlaceholderPage title="Style Studio" subtitle="Visual editor for Style 1 (Classic Hook) and custom creator templates." />} />
          <Route path="/music" element={<PlaceholderPage title="Music Library" subtitle="Librosa beat-tracked tracks, mood tags, and BPM synchronization." />} />
          <Route path="/storage" element={<StoragePage />} />
          <Route path="/upload" element={<PlaceholderPage title="Data Upload & Review" subtitle="Batch screenshot ingestion, Gemini OCR extraction, and deduplication." />} />
          <Route path="/orders" element={<PlaceholderPage title="Orders Log" subtitle="TikTok Shop orders, GMV, and commission attribution ledger." />} />
          <Route path="/analytics" element={<PlaceholderPage title="Analytics Engine" subtitle="Source chain metrics (Buffer -> TikTok Display API -> CSV)." />} />
          <Route path="/schedules" element={<PlaceholderPage title="Schedules Manager" subtitle="Configurable cron timings, timezone management, and manual execution triggers." />} />
          <Route path="/settings" element={<PlaceholderPage title="Settings & Vault" subtitle="AES-256-GCM encrypted credentials, connection tests, and regional limits." />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Shell>
    </BrowserRouter>
  );
};
