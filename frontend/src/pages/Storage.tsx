import React, { useState, useEffect } from 'react';
import { Card, Button, Badge } from '../components/ui';
import { HardDrive, Cloud, RefreshCw, Folder, FileVideo, Eye, X } from 'lucide-react';

interface StorageMeters {
  local_total_bytes: number;
  local_free_bytes: number;
  local_used_bytes: number;
  cache_used_bytes: number;
  cache_max_bytes: number;
  drive_quota_bytes?: number;
  drive_used_bytes?: number;
  last_sync?: string;
}

interface StorageFile {
  path: string;
  name: string;
  size_bytes: number;
  modified_at: string;
  is_dir: boolean;
  remote_id?: string;
}

export const StoragePage: React.FC = () => {
  const [meters, setMeters] = useState<StorageMeters | null>(null);
  const [currentPath, setCurrentPath] = useState('clips');
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    fetchMeters();
    fetchFiles(currentPath);
  }, [currentPath]);

  const fetchMeters = async () => {
    try {
      const res = await fetch('/api/storage/meters');
      if (res.ok) {
        setMeters(await res.json());
      }
    } catch (e) {
      console.error('Failed to load meters', e);
    }
  };

  const fetchFiles = async (path: string) => {
    try {
      const res = await fetch(`/api/storage/files?path=${encodeURIComponent(path)}`);
      if (res.ok) {
        setFiles(await res.json());
      }
    } catch (e) {
      console.error('Failed to load files', e);
    }
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      const csrf = document.cookie
        .split('; ')
        .find((row) => row.startsWith('csrf_token='))
        ?.split('=')[1] || '';

      const res = await fetch('/api/storage/sync', {
        method: 'POST',
        headers: { 'X-CSRF-Token': csrf },
      });
      if (res.ok) {
        await fetchMeters();
        await fetchFiles(currentPath);
      }
    } catch (e) {
      console.error('Sync failed', e);
    } finally {
      setIsSyncing(false);
    }
  };

  const formatGb = (bytes?: number) => {
    if (!bytes) return '0.0 GB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Storage & Sync Manager</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Local NVMe fast storage, size-capped LRU asset cache, and Google Drive cloud mirror.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSyncNow}
            disabled={isSyncing}
          >
            <RefreshCw size={14} className={isSyncing ? 'animate-spin mr-1.5' : 'mr-1.5'} />
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </Button>
        </div>
      </div>

      {/* Storage Meters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Local NVMe Meter */}
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Local NVMe Disk</span>
            <HardDrive size={16} className="text-neutral-400" />
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-semibold">{formatGb(meters?.local_used_bytes)}</span>
              <span className="text-neutral-500 text-xs">of {formatGb(meters?.local_total_bytes)}</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
              <div
                className="h-full bg-black dark:bg-white"
                style={{
                  width: `${meters ? (meters.local_used_bytes / meters.local_total_bytes) * 100 : 0}%`,
                }}
              />
            </div>
            <p className="text-[11px] text-neutral-400">
              {formatGb(meters?.local_free_bytes)} free for clip processing
            </p>
          </div>
        </Card>

        {/* LRU Cache Meter */}
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Size-Capped LRU Cache</span>
            <Badge>Job Locked</Badge>
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-semibold">{formatGb(meters?.cache_used_bytes)}</span>
              <span className="text-neutral-500 text-xs">cap {formatGb(meters?.cache_max_bytes)}</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
              <div
                className="h-full bg-black dark:bg-white"
                style={{
                  width: `${meters && meters.cache_max_bytes ? (meters.cache_used_bytes / meters.cache_max_bytes) * 100 : 0}%`,
                }}
              />
            </div>
            <p className="text-[11px] text-neutral-400">
              Old unlocked assets evicted automatically
            </p>
          </div>
        </Card>

        {/* Google Drive Meter */}
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Google Drive Cloud</span>
            <Cloud size={16} className="text-neutral-400" />
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-semibold">{formatGb(meters?.drive_used_bytes)}</span>
              <span className="text-neutral-500 text-xs">of {formatGb(meters?.drive_quota_bytes)}</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
              <div
                className="h-full bg-black dark:bg-white"
                style={{
                  width: `${meters && meters.drive_quota_bytes ? ((meters.drive_used_bytes || 0) / meters.drive_quota_bytes) * 100 : 0}%`,
                }}
              />
            </div>
            <p className="text-[11px] text-neutral-400">
              Last synced: {meters?.last_sync ? new Date(meters.last_sync).toLocaleTimeString() : 'Never'}
            </p>
          </div>
        </Card>
      </div>

      {/* Directory Browser Navigation Tabs */}
      <div className="flex items-center gap-2 hairline-b pb-2">
        {['clips', 'renders', 'archive', 'trash'].map((tab) => (
          <button
            key={tab}
            onClick={() => setCurrentPath(tab)}
            className={`px-3 py-1.5 text-xs font-medium rounded-control transition-standard capitalize ${
              currentPath.startsWith(tab)
                ? 'bg-black text-white dark:bg-white dark:text-black font-semibold'
                : 'text-neutral-500 hover:text-black dark:hover:text-white'
            }`}
          >
            /{tab}
          </button>
        ))}
      </div>

      {/* File Browser Table */}
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-left table-dense border-collapse">
          <thead>
            <tr className="hairline-b bg-neutral-50 dark:bg-neutral-900/40 text-neutral-500 font-medium">
              <th>Name</th>
              <th>Path</th>
              <th>Size</th>
              <th>Modified</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200/50 dark:divide-neutral-800/50 text-xs font-mono">
            {files.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-neutral-400 font-sans">
                  No files or directories present in /{currentPath}
                </td>
              </tr>
            ) : (
              files.map((file) => (
                <tr key={file.path} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/20">
                  <td className="font-sans font-medium flex items-center gap-2">
                    {file.is_dir ? (
                      <Folder size={14} className="text-neutral-400" />
                    ) : (
                      <FileVideo size={14} className="text-neutral-400" />
                    )}
                    <span
                      className={file.is_dir ? 'cursor-pointer hover:underline' : ''}
                      onClick={() => file.is_dir && setCurrentPath(file.path)}
                    >
                      {file.name}
                    </span>
                  </td>
                  <td className="text-neutral-400 text-[11px]">{file.path}</td>
                  <td>{file.is_dir ? '-' : (file.size_bytes / (1024 * 1024)).toFixed(2) + ' MB'}</td>
                  <td className="text-neutral-400 text-[11px]">
                    {new Date(file.modified_at).toLocaleDateString()}
                  </td>
                  <td>
                    {!file.is_dir && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-[11px]"
                        onClick={() => setPreviewFile(file.path)}
                      >
                        <Eye size={12} className="mr-1" />
                        Preview
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      {/* Video Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-card hairline-border bg-white dark:bg-[#141414] shadow-2xl p-4 space-y-3">
            <div className="flex items-center justify-between hairline-b pb-2">
              <span className="text-xs font-mono font-medium truncate max-w-sm">{previewFile}</span>
              <button onClick={() => setPreviewFile(null)} className="p-1 rounded-control hover:bg-black/5 dark:hover:bg-white/5">
                <X size={16} />
              </button>
            </div>
            <div className="aspect-[9/16] max-h-[65vh] mx-auto bg-black rounded-lg overflow-hidden flex items-center justify-center">
              <video
                src={`/api/storage/preview/${encodeURIComponent(previewFile)}`}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
