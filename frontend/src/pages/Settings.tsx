import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Badge } from '../components/ui';
import { api } from '../api/client';
import { GoogleDriveCredentialModal } from '../components/credentials/GoogleDriveCredentialModal';
import {
  Key,
  Shield,
  Globe,
  Sliders,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Lock,
} from 'lucide-react';

interface SettingItem {
  key: string;
  value: string;
  is_secret: boolean;
  description?: string;
}

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'vault' | 'regional' | 'scoring' | 'rules' | 'security'>('vault');
  const [settings, setSettings] = useState<SettingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Test connection states
  const [testStatus, setTestStatus] = useState<Record<string, { loading: boolean; ok?: boolean; message?: string }>>({});

  // Secret edit modal
  const [editingSecret, setEditingSecret] = useState<string | null>(null);
  const [newSecretValue, setNewSecretValue] = useState('');
  const [gdriveModalOpen, setGdriveModalOpen] = useState(false);

  // Password change
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Form states for non-secret settings
  const [timezone, setTimezone] = useState('Asia/Manila');
  const [currency, setCurrency] = useState('PHP');
  const [scoringProfile, setScoringProfile] = useState('v2');
  const [dailyQuota, setDailyQuota] = useState('6');
  const [bannedClaims, setBannedClaims] = useState('cure, guaranteed, 100% legit, fda approved, approved ng dti');
  const [enableTikTokAudio, setEnableTikTokAudio] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const items = await api.get<SettingItem[]>('/api/settings');
      setSettings(items);

      // Hydrate forms
      const tz = items.find((i) => i.key === 'TIMEZONE');
      if (tz) setTimezone(tz.value);

      const curr = items.find((i) => i.key === 'CURRENCY');
      if (curr) setCurrency(curr.value);

      const sp = items.find((i) => i.key === 'SCORING_PROFILE');
      if (sp) setScoringProfile(sp.value);

      const dq = items.find((i) => i.key === 'DAILY_QUOTA');
      if (dq) setDailyQuota(dq.value);

      const bc = items.find((i) => i.key === 'BANNED_CLAIMS');
      if (bc) setBannedClaims(bc.value);

      const tta = items.find((i) => i.key === 'ENABLE_TIKTOK_AUDIO');
      if (tta) setEnableTikTokAudio(tta.value === 'true');
    } catch (e: any) {
      setErrorBanner('Failed to load settings: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSetting = async (key: string, value: string, isSecret = false) => {
    setErrorBanner(null);
    setSuccessBanner(null);
    try {
      await api.put(`/api/settings/${key}`, { value, is_secret: isSecret });
      setSuccessBanner(`Setting "${key}" saved successfully.`);
      await fetchSettings();
    } catch (e: any) {
      setErrorBanner(`Error updating ${key}: ` + e.message);
    }
  };

  const handleTestConnection = async (service: string) => {
    setTestStatus((prev) => ({ ...prev, [service]: { loading: true } }));
    try {
      const res = await api.post(`/api/settings/test/${service}`);
      setTestStatus((prev) => ({
        ...prev,
        [service]: { loading: false, ok: res.ok, message: res.message },
      }));
    } catch (e: any) {
      setTestStatus((prev) => ({
        ...prev,
        [service]: { loading: false, ok: false, message: e.message },
      }));
    }
  };

  const handleSaveSecret = async () => {
    if (!editingSecret || !newSecretValue.trim()) return;
    await handleSaveSetting(editingSecret, newSecretValue.trim(), true);
    setEditingSecret(null);
    setNewSecretValue('');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordLoading(true);
    setErrorBanner(null);
    setSuccessBanner(null);
    try {
      await api.post('/api/auth/change-password', {
        old_password: oldPassword,
        new_password: newPassword,
      });
      setSuccessBanner('Admin master password updated successfully.');
      setOldPassword('');
      setNewPassword('');
    } catch (e: any) {
      setErrorBanner('Failed to change password: ' + e.message);
    } finally {
      setPasswordLoading(false);
    }
  };

  const getSecretValue = (key: string) => {
    const s = settings.find((i) => i.key === key);
    return s?.value || '••••••••';
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings & Secrets Vault</h1>
        <p className="text-sm text-neutral-500">
          AES-256-GCM encrypted credentials, automated connection testing, and regional engine parameters.
        </p>
      </div>

      {/* Notifications */}
      {errorBanner && (
        <div className="rounded-card hairline-border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-600 dark:text-red-400 flex items-center justify-between">
          <span>{errorBanner}</span>
          <button onClick={() => setErrorBanner(null)} className="text-xs underline ml-2">Dismiss</button>
        </div>
      )}
      {successBanner && (
        <div className="rounded-card hairline-border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
          <span>{successBanner}</span>
          <button onClick={() => setSuccessBanner(null)} className="text-xs underline ml-2">Dismiss</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-800 gap-2">
        {[
          { id: 'vault', label: 'Secrets Vault & APIs', icon: Key },
          { id: 'regional', label: 'Regional & Localization', icon: Globe },
          { id: 'scoring', label: 'Scoring Profiles', icon: Sliders },
          { id: 'rules', label: 'Publishing & Audio Safety', icon: Shield },
          { id: 'security', label: 'Admin Security', icon: Lock },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-black dark:border-white text-black dark:text-white'
                  : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12 text-neutral-400 text-xs">
          <RefreshCw className="w-4 h-4 animate-spin mr-2" />
          Loading configuration...
        </div>
      ) : (
        <>
          {/* Tab: Secrets Vault */}
      {activeTab === 'vault' && (
        <div className="space-y-4">
          <p className="text-xs text-neutral-400">
            All credentials are encrypted at rest with hardware-backed AES-256-GCM. Raw plaintext keys are never returned by the API.
          </p>

          {[
            {
              id: 'BUFFER_ACCESS_TOKEN',
              label: 'Buffer Access Token',
              service: 'buffer',
              desc: 'GraphQL API token for scheduled TikTok post publishing.',
            },
            {
              id: 'GEMINI_API_KEY',
              label: 'Google Gemini API Key',
              service: 'gemini',
              desc: 'Gemini 2.5 Flash-Lite vision model for OCR, audio transcript analysis, and Taglish hook generation.',
            },
            {
              id: 'TELEGRAM_BOT_TOKEN',
              label: 'Telegram Bot Token',
              service: 'telegram',
              desc: 'Token from @BotFather powering creator notifications, interactive plan approvals, and media intake.',
            },
            {
              id: 'GOOGLE_DRIVE_SERVICE_ACCOUNT',
              label: 'Google Drive Service Account / OAuth',
              service: 'drive',
              desc: 'Google Drive JSON or path for 5-minute video and clip footage syncing.',
            },
            {
              id: 'CLOUDINARY_URL',
              label: 'Cloudinary / MediaHost Provider',
              service: 'cloudinary',
              desc: 'Public CDN media URL hosting rendered TikTok MP4 files for Buffer video intake.',
            },
          ].map((sec) => {
            const status = testStatus[sec.service];
            return (
              <Card key={sec.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-neutral-900 dark:text-white">{sec.label}</h3>
                    <p className="text-xs text-neutral-500">{sec.desc}</p>
                  </div>
                  <Badge variant="neutral">AES-256-GCM</Badge>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1 font-mono text-xs px-3 py-2 rounded-input bg-neutral-100 dark:bg-neutral-800 hairline-border select-none">
                    {getSecretValue(sec.id)}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      if (sec.id === 'GOOGLE_DRIVE_SERVICE_ACCOUNT') {
                        setGdriveModalOpen(true);
                      } else {
                        setEditingSecret(sec.id);
                        setNewSecretValue('');
                      }
                    }}
                  >
                    {sec.id === 'GOOGLE_DRIVE_SERVICE_ACCOUNT' ? 'Configure (n8n style)' : 'Replace Key'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={status?.loading}
                    onClick={() => handleTestConnection(sec.service)}
                    className="flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${status?.loading ? 'animate-spin' : ''}`} />
                    Test Connection
                  </Button>
                </div>

                {status && (
                  <div
                    className={`rounded-input p-2.5 text-xs flex items-center gap-2 ${
                      status.ok
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-red-500/10 text-red-600 dark:text-red-400'
                    }`}
                  >
                    {status.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
                    <span>{status.message}</span>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Tab: Regional */}
      {activeTab === 'regional' && (
        <Card className="p-6 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">Display Timezone</label>
              <p className="text-[11px] text-neutral-500 mb-1.5">
                Default timezone for scheduling daily content slots, reminders, and metrics aggregation.
              </p>
              <select
                value={timezone}
                onChange={(e) => {
                  setTimezone(e.target.value);
                  handleSaveSetting('TIMEZONE', e.target.value);
                }}
                className="w-full text-xs rounded-input hairline-border bg-white dark:bg-neutral-900 p-2.5 text-neutral-900 dark:text-white"
              >
                <option value="Asia/Manila">Asia/Manila (PST / UTC+8 - Philippines)</option>
                <option value="UTC">UTC (Coordinated Universal Time)</option>
                <option value="America/New_York">America/New_York (EST / UTC-5)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (PST / UTC-8)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">Creator Base Currency</label>
              <p className="text-[11px] text-neutral-500 mb-1.5">
                Currency used for GMV calculation, commission rates, and sales reporting.
              </p>
              <select
                value={currency}
                onChange={(e) => {
                  setCurrency(e.target.value);
                  handleSaveSetting('CURRENCY', e.target.value);
                }}
                className="w-full text-xs rounded-input hairline-border bg-white dark:bg-neutral-900 p-2.5 text-neutral-900 dark:text-white"
              >
                <option value="PHP">PHP (₱ - Philippine Peso)</option>
                <option value="USD">USD ($ - United States Dollar)</option>
                <option value="SGD">SGD (S$ - Singapore Dollar)</option>
                <option value="MYR">MYR (RM - Malaysian Ringgit)</option>
              </select>
            </div>
          </div>
        </Card>
      )}

      {/* Tab: Scoring Profiles */}
      {activeTab === 'scoring' && (
        <Card className="p-6 space-y-6">
          <div>
            <h3 className="text-sm font-semibold">Sunday Strategy Scoring Profile</h3>
            <p className="text-xs text-neutral-500">
              Control the mathematical scoring model used by the Sunday Strategy Engine to prioritize daily products.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              onClick={() => {
                setScoringProfile('v1');
                handleSaveSetting('SCORING_PROFILE', 'v1');
              }}
              className={`p-4 rounded-card hairline-border cursor-pointer transition-all ${
                scoringProfile === 'v1'
                  ? 'border-black dark:border-white bg-neutral-100 dark:bg-neutral-800'
                  : 'bg-white dark:bg-neutral-900 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-xs">Profile v1: Exact Legacy Math</span>
                {scoringProfile === 'v1' && <Badge variant="neutral">Active</Badge>}
              </div>
              <p className="text-xs text-neutral-500">
                100% mathematical parity with n8n Workflow 2 formulas. Strict 70/30 weighting on raw units sold and commission percentages.
              </p>
            </div>

            <div
              onClick={() => {
                setScoringProfile('v2');
                handleSaveSetting('SCORING_PROFILE', 'v2');
              }}
              className={`p-4 rounded-card hairline-border cursor-pointer transition-all ${
                scoringProfile === 'v2'
                  ? 'border-black dark:border-white bg-neutral-100 dark:bg-neutral-800'
                  : 'bg-white dark:bg-neutral-900 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-xs">Profile v2: Multi-Signal Recency Decay</span>
                {scoringProfile === 'v2' && <Badge variant="neutral">Active</Badge>}
              </div>
              <p className="text-xs text-neutral-500">
                Modern Bayesian smoothing, recency half-life weighting, and empirical Bayes shrinkage to prevent single-order flukes from dominating slots.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Tab: Publishing Rules */}
      {activeTab === 'rules' && (
        <Card className="p-6 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">Daily Target Posts Quota</label>
              <p className="text-[11px] text-neutral-500 mb-1.5">Maximum number of automated video posts per day.</p>
              <Input
                type="number"
                value={dailyQuota}
                onChange={(e) => setDailyQuota(e.target.value)}
                onBlur={() => handleSaveSetting('DAILY_QUOTA', dailyQuota)}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                Banned Claims & Prohibited Keywords Filter
              </label>
              <p className="text-[11px] text-neutral-500 mb-1.5">
                Comma-separated list of prohibited words. Videos containing these will be automatically flagged and rewritten.
              </p>
              <textarea
                rows={3}
                value={bannedClaims}
                onChange={(e) => setBannedClaims(e.target.value)}
                onBlur={() => handleSaveSetting('BANNED_CLAIMS', bannedClaims)}
                className="w-full text-xs font-mono rounded-input hairline-border bg-white dark:bg-neutral-900 p-2.5 text-neutral-900 dark:text-white"
              />
            </div>

            {/* TikTok Audio Warning */}
            <div className="rounded-card hairline-border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                    TikTok Sound Downloader Safety Warning
                  </h4>
                  <p className="text-xs text-neutral-600 dark:text-neutral-300">
                    Sounds downloaded from third-party TikTok videos are often copyrighted and can lead to videos being muted, disqualified from affiliate commissions, or flagged on commercial TikTok accounts.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="enable-tiktok-audio"
                  checked={enableTikTokAudio}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setEnableTikTokAudio(checked);
                    handleSaveSetting('ENABLE_TIKTOK_AUDIO', checked ? 'true' : 'false');
                  }}
                  className="rounded text-black focus:ring-0"
                />
                <label htmlFor="enable-tiktok-audio" className="text-xs font-medium cursor-pointer">
                  Enable experimental TikTok Audio Extraction (ENABLE_TIKTOK_AUDIO)
                </label>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Tab: Admin Security */}
      {activeTab === 'security' && (
        <Card className="p-6 space-y-6">
          <form onSubmit={handleChangePassword} className="max-w-md space-y-4">
            <h3 className="text-sm font-semibold">Change Creator Master Password</h3>
            <p className="text-xs text-neutral-500">
              Update the Argon2id-hashed master password for your creator admin account.
            </p>

            <div className="space-y-1">
              <label className="text-xs text-neutral-500">Current Password</label>
              <Input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-neutral-500">New Master Password</label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                required
              />
            </div>

            <Button type="submit" variant="primary" disabled={passwordLoading}>
              {passwordLoading ? 'Updating Password...' : 'Save New Password'}
            </Button>
          </form>
        </Card>
      )}
      </>
      )}

      {/* Modal: Replace Secret Key */}
      {editingSecret && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-card hairline-border bg-white dark:bg-[#121212] p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-semibold">Replace Secret: {editingSecret}</h3>
            <p className="text-xs text-neutral-400">
              Enter the new credential value. It will be immediately encrypted with AES-256-GCM.
            </p>

            <textarea
              rows={4}
              value={newSecretValue}
              onChange={(e) => setNewSecretValue(e.target.value)}
              placeholder="Paste raw token or JSON here..."
              className="w-full text-xs font-mono rounded-input hairline-border bg-neutral-50 dark:bg-neutral-900 p-3 text-neutral-900 dark:text-white"
            />

            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setEditingSecret(null);
                  setNewSecretValue('');
                }}
              >
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleSaveSecret}>
                Save Encrypted Secret
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Google Drive Credential Setup Modal (n8n style) */}
      <GoogleDriveCredentialModal
        isOpen={gdriveModalOpen}
        onClose={() => setGdriveModalOpen(false)}
        onSuccess={() => {
          fetchSettings();
          handleTestConnection('drive');
        }}
      />
    </div>
  );
};
