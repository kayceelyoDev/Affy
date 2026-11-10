import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Shell } from './components/layout/Shell';
import { DesignGallery } from './pages/DesignGallery';
import { StoragePage } from './pages/Storage';
import { ProductsPage } from './pages/Products';
import { UploadPage } from './pages/Upload';
import { ReviewQueuePage } from './pages/ReviewQueue';
import { OrdersPage } from './pages/Orders';
import { AnalyticsPage } from './pages/Analytics';
import { PlannerPage } from './pages/Planner';
import { StyleStudioPage } from './pages/StyleStudio';
import { MusicLibraryPage } from './pages/MusicLibrary';
import { VideosPage } from './pages/Videos';
import { RunsPage } from './pages/Runs';
import { SchedulesPage } from './pages/Schedules';

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
          <Route path="/planner" element={<PlannerPage />} />
          <Route path="/runs" element={<RunsPage />} />
          <Route path="/videos" element={<VideosPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/clips" element={<PlaceholderPage title="Clip Library" subtitle="Raw product footage, metadata tags, and storage sync status." />} />
          <Route path="/styles" element={<StyleStudioPage />} />
          <Route path="/music" element={<MusicLibraryPage />} />
          <Route path="/storage" element={<StoragePage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/review" element={<ReviewQueuePage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/schedules" element={<SchedulesPage />} />
          <Route path="/settings" element={<PlaceholderPage title="Settings & Vault" subtitle="AES-256-GCM encrypted credentials, connection tests, and regional limits." />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Shell>
    </BrowserRouter>
  );
};
