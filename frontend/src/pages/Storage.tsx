import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, Input } from '../components/ui';
import { api } from '../api/client';
import { GoogleDriveCredentialModal } from '../components/credentials/GoogleDriveCredentialModal';
import {
  HardDrive,
  Cloud,
  RefreshCw,
  Folder,
  FileVideo,
  Eye,
  X,
  Play,
  CheckCircle2,
  AlertTriangle,
  Key,
  FolderCheck,
  HelpCircle,
} from 'lucide-react';

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

  // n8n Style Google Drive Connection State
  const [folderId, setFolderId] = useState('');
  const [savingFolderId, setSavingFolderId] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [hasCredential, setHasCredential] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    fetchMeters();
    fetchFiles(currentPath);
    loadDriveSettings();
  }, [currentPath]);

  const fetchMeters = async () => {
    try {
      const data = await api.get<StorageMeters>('/api/storage/meters');
      setMeters(data);
    } catch (e) {
      console.error('Failed to load meters', e);
    }
  };

  const fetchFiles = async (path: string) => {
    try {
      const data = await api.get<StorageFile[]>(`/api/storage/files?path=${encodeURIComponent(path)}`);
      setFiles(data);
    } catch (e) {
      console.error('Failed to load files', e);
    }
  };

  const loadDriveSettings = async () => {
    try {
      const settings = await api.get<any[]>('/api/settings');
      const folderSetting = settings.find((s) => s.key === 'GOOGLE_DRIVE_FOLDER_ID');
      if (folderSetting) {
        setFolderId(folderSetting.value);
      }
      const saSetting = settings.find((s) => s.key === 'GOOGLE_DRIVE_SERVICE_ACCOUNT');
      if (saSetting && saSetting.value && !saSetting.value.includes('NOT_SET')) {
        setHasCredential(true);
      }
    } catch (e) {
      console.error('Failed to load settings', e);
    }
  };

  const handleSaveFolderId = async () => {
    setSavingFolderId(true);
    try {
      await api.put('/api/settings/GOOGLE_DRIVE_FOLDER_ID', {
        value: folderId.trim(),
        is_secret: false,
        description: 'Google Drive clips root folder ID',
      });
      alert('Root Folder ID saved successfully!');
    } catch (e: any) {
      alert(`Failed to save Folder ID: ${e.message}`);
    } finally {
      setSavingFolderId(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await api.post('/api/settings/test/google_drive');
      setTestResult(res);
    } catch (e: any) {
      setTestResult({ ok: false, message: e.message });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      const res = await api.post('/api/storage/sync');
      await fetchMeters();
      await fetchFiles(currentPath);
      if (res.ok === false || res.status === 'drive_error') {
        alert(`Sync Notice: ${res.message || 'Error communicating with Google Drive.'}`);
      } else {
        alert(`Sync completed! Status: ${res.status}, new clips synced: ${res.synced ?? 0}`);
      }
    } catch (e: any) {
      alert(`Sync failed: ${e.message}`);
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
          <Button variant="secondary" size="sm" onClick={handleSyncNow} disabled={isSyncing}>
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

      {/* n8n-STYLE GOOGLE DRIVE CONNECTION NODE */}
      <div className="rounded-card hairline-border bg-white dark:bg-[#121212] overflow-hidden shadow-sm">
        {/* Node Titlebar */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-neutral-50 dark:bg-[#181818] border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#ea4335]/10 text-[#ea4335] flex items-center justify-center font-bold text-xs border border-[#ea4335]/20">
              <Cloud className="w-4 h-4 text-[#ea4335]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold tracking-wide uppercase text-neutral-800 dark:text-neutral-200">
                  Google Drive Trigger & Sync
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                  n8n-nodes-base.googleDrive
                </span>
              </div>
              <p className="text-[11px] text-neutral-500">
                Polls product folders, mirrors vertical video clips, and registers new assets automatically.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${
                hasCredential
                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${hasCredential ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {hasCredential ? 'Credential Connected' : 'Requires Service Account'}
            </span>
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-1"
              title="How to configure"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Step-by-step Setup Helper */}
        {showHelp && (
          <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 border-b border-blue-100 dark:border-blue-900/40 text-xs text-neutral-600 dark:text-neutral-400 space-y-2">
            <h4 className="font-semibold text-neutral-900 dark:text-white flex items-center gap-1.5">
              <FolderCheck className="w-4 h-4 text-blue-500" />
              Quick 3-Step Google Drive Connection Guide (n8n Style)
            </h4>
            <ol className="list-decimal list-inside space-y-1 leading-relaxed pl-1">
              <li>
                In Google Cloud Console, create a <strong>Service Account</strong> and generate a <strong>JSON Key</strong>.
              </li>
              <li>
                Click <strong>"Configure Service Account"</strong> below and paste the raw JSON key into the vault.
              </li>
              <li>
                In Google Drive, open your clips folder, click <strong>Share</strong>, and add the Service Account's email address as <strong>Editor</strong> or <strong>Viewer</strong>.
              </li>
              <li>
                Copy the Folder ID from the URL (the string after <code>/folders/</code>) and paste it into <strong>Root Folder ID</strong>.
              </li>
            </ol>
          </div>
        )}

        {/* Node Parameters Panel */}
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Credential Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Credential to Connect
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center justify-between p-2.5 rounded-input hairline-border bg-neutral-50 dark:bg-neutral-900 text-xs">
                  <div className="flex items-center gap-2">
                    <Key className="w-3.5 h-3.5 text-neutral-400" />
                    <span className="font-medium">
                      {hasCredential ? 'Google Service Account (Encrypted in Vault)' : 'No Credential Set'}
                    </span>
                  </div>
                  <Badge variant={hasCredential ? 'default' : 'neutral'}>
                    {hasCredential ? 'SAVED' : 'MISSING'}
                  </Badge>
                </div>
                <Button size="sm" variant="secondary" onClick={() => setShowJsonModal(true)}>
                  {hasCredential ? 'Edit Credential' : 'Set Up Credential'}
                </Button>
              </div>
            </div>

            {/* Resource & Operation */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Resource</label>
                <div className="p-2.5 rounded-input hairline-border bg-neutral-50 dark:bg-neutral-900 text-xs font-mono text-neutral-500">
                  Folder & File
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Operation</label>
                <div className="p-2.5 rounded-input hairline-border bg-neutral-50 dark:bg-neutral-900 text-xs font-mono text-neutral-500">
                  Sync Clips (5m)
                </div>
              </div>
            </div>
          </div>

          {/* Root Folder ID Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Clips Root Folder ID (or Drive Folder Link)
              </label>
              <span className="text-[11px] text-neutral-400">
                Example: <code>1E8RKxQ_j99CCMchUxYoO2ioSDcFL9U85</code>
              </span>
            </div>
            <div className="flex gap-2">
              <Input
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                placeholder="Paste Google Drive folder ID or URL..."
                className="text-xs font-mono"
              />
              <Button size="sm" variant="primary" onClick={handleSaveFolderId} disabled={savingFolderId}>
                {savingFolderId ? 'Saving...' : 'Save Folder ID'}
              </Button>
            </div>
          </div>

          {/* Test & Execution Action Buttons */}
          <div className="flex flex-wrap items-center justify-between pt-2 border-t border-neutral-100 dark:border-neutral-800 gap-2">
            <div className="flex items-center gap-2">
              {/* Test Step Button */}
              <Button
                size="sm"
                variant="secondary"
                onClick={handleTestConnection}
                disabled={isTesting || !hasCredential}
              >
                <Play className={`w-3.5 h-3.5 mr-1.5 ${isTesting ? 'animate-spin' : 'text-amber-500'}`} />
                {isTesting ? 'Testing Step...' : 'Test Connection Step'}
              </Button>

              {/* Execute / Sync Now Button */}
              <Button size="sm" variant="primary" onClick={handleSyncNow} disabled={isSyncing}>
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Executing Sync...' : 'Execute Node (Sync Now)'}
              </Button>
            </div>

            <span className="text-[11px] text-neutral-400">
              Worker schedule: <code>*/5 * * * *</code> (every 5 mins)
            </span>
          </div>

          {/* n8n Style Live Output Inspector */}
          {testResult && (
            <div className="rounded-card p-3 bg-neutral-900 text-neutral-100 font-mono text-xs space-y-2 border border-neutral-800">
              <div className="flex items-center justify-between text-[11px] text-neutral-400 border-b border-neutral-800 pb-1.5">
                <span className="flex items-center gap-1.5">
                  {testResult.ok ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                  )}
                  [Node Output: {testResult.ok ? '200 SUCCESS' : 'EXECUTION FAILED'}]
                </span>
                <span>Response Time: ~420ms</span>
              </div>
              <pre className="text-[11px] overflow-x-auto text-emerald-400">
                {JSON.stringify(testResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
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
              <button
                onClick={() => setPreviewFile(null)}
                className="p-1 rounded-control hover:bg-black/5 dark:hover:bg-white/5"
              >
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

      {/* Google Drive Credential Setup Modal (n8n style) */}
      <GoogleDriveCredentialModal
        isOpen={showJsonModal}
        onClose={() => setShowJsonModal(false)}
        onSuccess={() => {
          loadDriveSettings();
          handleTestConnection();
        }}
      />
    </div>
  );
};
