import React, { useState } from 'react';
import { Button, Input } from '../ui';
import { api } from '../../api/client';
import {
  Cloud,
  X,
  Play,
  CheckCircle2,
  AlertTriangle,
  Upload,
  KeyRound,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

interface GoogleDriveCredentialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const GoogleDriveCredentialModal: React.FC<GoogleDriveCredentialModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [authType, setAuthType] = useState<'service_account' | 'oauth2'>('service_account');

  // Service Account Fields (inserted one by one like n8n)
  const [clientEmail, setClientEmail] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [projectId, setProjectId] = useState('');

  // OAuth2 Fields (inserted one by one like n8n)
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [refreshToken, setRefreshToken] = useState('');

  // In-modal Testing & Saving state
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  // Build the credential payload based on chosen auth method
  const getCredentialPayload = () => {
    if (authType === 'service_account') {
      let formattedKey = privateKey.trim();
      // Auto-clean escaped newlines
      formattedKey = formattedKey.replace(/\\n/g, '\n');
      if (!formattedKey.includes('-----BEGIN PRIVATE KEY-----')) {
        formattedKey = `-----BEGIN PRIVATE KEY-----\n${formattedKey}\n-----END PRIVATE KEY-----`;
      }
      return {
        type: 'service_account',
        client_email: clientEmail.trim(),
        private_key: formattedKey,
        project_id: projectId.trim() || undefined,
      };
    } else {
      return {
        type: 'oauth2',
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
        refresh_token: refreshToken.trim(),
      };
    }
  };

  // Test connection directly in modal (like n8n "Test Connection")
  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const payload = getCredentialPayload();
      const res = await api.post('/api/settings/test/google_drive', {
        credential: payload,
      });
      setTestResult({
        ok: res.ok,
        message: res.message || (res.ok ? 'Connection verified!' : 'Connection failed'),
      });
    } catch (e: any) {
      setTestResult({
        ok: false,
        message: e.message || 'Error communicating with server',
      });
    } finally {
      setTesting(false);
    }
  };

  // Save credential to vault
  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = getCredentialPayload();
      await api.put('/api/settings/GOOGLE_DRIVE_SERVICE_ACCOUNT', {
        value: JSON.stringify(payload),
        is_secret: true,
        description: `Google Drive Credential (${authType === 'service_account' ? clientEmail : clientId})`,
      });
      onSuccess();
      onClose();
    } catch (e: any) {
      setTestResult({
        ok: false,
        message: `Failed to save credential: ${e.message}`,
      });
    } finally {
      setSaving(false);
    }
  };

  // Helper: auto-fill fields if user uploads a JSON key file
  const handleJsonFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        if (parsed.type === 'service_account' || parsed.client_email) {
          setAuthType('service_account');
          if (parsed.client_email) setClientEmail(parsed.client_email);
          if (parsed.private_key) setPrivateKey(parsed.private_key);
          if (parsed.project_id) setProjectId(parsed.project_id);
          setTestResult({
            ok: true,
            message: 'Auto-populated Service Account fields from JSON key file!',
          });
        } else if (parsed.installed || parsed.web) {
          const clientData = parsed.installed || parsed.web;
          setAuthType('oauth2');
          if (clientData.client_id) setClientId(clientData.client_id);
          if (clientData.client_secret) setClientSecret(clientData.client_secret);
          setTestResult({
            ok: true,
            message: 'Auto-populated OAuth2 Client ID & Secret from file! Enter your Refresh Token.',
          });
        } else {
          setTestResult({
            ok: false,
            message: 'JSON file did not match Service Account or OAuth client format.',
          });
        }
      } catch (err: any) {
        setTestResult({
          ok: false,
          message: `Could not parse JSON file: ${err.message}`,
        });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-card hairline-border bg-white dark:bg-[#121212] shadow-2xl p-6 space-y-5">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#ea4335]/10 text-[#ea4335] flex items-center justify-center border border-[#ea4335]/20">
              <Cloud className="w-4 h-4 text-[#ea4335]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                  Google Drive Credential Setup
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                  n8n style
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Enter your connection parameters one-by-one. No JSON formatting required.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-control hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Auth Type Tabs */}
        <div className="flex border-b border-neutral-200 dark:border-neutral-800 gap-2">
          <button
            type="button"
            onClick={() => {
              setAuthType('service_account');
              setTestResult(null);
            }}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium border-b-2 transition-colors ${
              authType === 'service_account'
                ? 'border-black dark:border-white text-black dark:text-white font-semibold'
                : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-300'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            Service Account (Recommended)
          </button>

          <button
            type="button"
            onClick={() => {
              setAuthType('oauth2');
              setTestResult(null);
            }}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium border-b-2 transition-colors ${
              authType === 'oauth2'
                ? 'border-black dark:border-white text-black dark:text-white font-semibold'
                : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-300'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            OAuth2 (Client ID & Secret)
          </button>
        </div>

        {/* Optional JSON file autofill helper */}
        <div className="flex items-center justify-between p-2.5 rounded-input hairline-border bg-neutral-50 dark:bg-neutral-900/50 text-xs">
          <span className="text-[11px] text-neutral-500 flex items-center gap-1.5">
            <Upload className="w-3.5 h-3.5 text-neutral-400" />
            Have a Google credentials .json file? Drop it here to auto-fill:
          </span>
          <label className="cursor-pointer text-[11px] font-medium text-black dark:text-white underline hover:opacity-80">
            Browse JSON File
            <input
              type="file"
              accept=".json"
              onChange={handleJsonFileUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* Form Fields: Service Account */}
        {authType === 'service_account' && (
          <div className="space-y-3.5">
            <div className="space-y-1">
              <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                Service Account Email
              </label>
              <Input
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="e.g. tiktok-sync@your-project.iam.gserviceaccount.com"
                className="text-xs font-mono"
              />
              <span className="text-[10px] text-neutral-400">
                Remember to share your Google Drive clips folder with this email as Viewer or Editor.
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Private Key (RSA)
                </label>
                <span className="text-[10px] text-neutral-400">
                  Paste raw PEM key or text
                </span>
              </div>
              <textarea
                rows={5}
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                placeholder={`-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----`}
                className="w-full text-xs font-mono rounded-input hairline-border bg-neutral-50 dark:bg-neutral-900 p-3 text-neutral-900 dark:text-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                Project ID (Optional)
              </label>
              <Input
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                placeholder="e.g. my-creator-autopilot"
                className="text-xs font-mono"
              />
            </div>
          </div>
        )}

        {/* Form Fields: OAuth2 */}
        {authType === 'oauth2' && (
          <div className="space-y-3.5">
            <div className="space-y-1">
              <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                Client ID
              </label>
              <Input
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="e.g. 1234567890-abcdef.apps.googleusercontent.com"
                className="text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                Client Secret
              </label>
              <Input
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="e.g. GOCSPX-xxxxxxxxxxxxxxxx"
                className="text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                Refresh Token
              </label>
              <Input
                type="password"
                value={refreshToken}
                onChange={(e) => setRefreshToken(e.target.value)}
                placeholder="e.g. 1//04xxxxxxxxxxxxxxxx"
                className="text-xs font-mono"
              />
              <span className="text-[10px] text-neutral-400">
                OAuth2 offline refresh token for autonomous background sync.
              </span>
            </div>
          </div>
        )}

        {/* Test Result Banner */}
        {testResult && (
          <div
            className={`p-3 rounded-input text-xs space-y-1 font-mono ${
              testResult.ok
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}
          >
            <div className="flex items-center gap-1.5 font-sans font-semibold">
              {testResult.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-400" />
              )}
              {testResult.ok ? 'Connection Verified Successfully' : 'Connection Failed'}
            </div>
            <p className="text-[11px] leading-relaxed break-words">{testResult.message}</p>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-neutral-100 dark:border-neutral-800">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleTest}
            disabled={
              testing ||
              (authType === 'service_account' ? !clientEmail || !privateKey : !clientId || !refreshToken)
            }
          >
            {testing ? (
              <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
            )}
            {testing ? 'Testing...' : 'Test Connection'}
          </Button>

          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={
                saving ||
                (authType === 'service_account' ? !clientEmail || !privateKey : !clientId || !refreshToken)
              }
            >
              {saving ? 'Saving...' : 'Save & Encrypt'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
