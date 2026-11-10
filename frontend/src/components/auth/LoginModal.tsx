import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button, Input } from '../ui';
import { ShieldCheck, KeyRound } from 'lucide-react';

export const LoginModal: React.FC = () => {
  const { user, loginModalOpen, login } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!loginModalOpen || user?.authenticated) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username.trim(), password);
      window.location.reload(); // Refresh data with active session
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-card hairline-border bg-white dark:bg-[#121212] p-6 shadow-2xl space-y-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-black dark:text-white">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-white">
            Creator Authentication
          </h2>
          <p className="text-xs text-neutral-500">
            Sign in to manage TikTok affiliate pipelines, rendering queues, and encrypted credentials.
          </p>
        </div>

        {error && (
          <div className="rounded-input hairline-border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Username
            </label>
            <Input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Master Password
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
            <p className="text-[11px] text-neutral-400 pt-1">
              Default first-run password: <code className="bg-neutral-100 dark:bg-neutral-800 px-1 py-0.5 rounded">admin123</code> (customizable in Settings).
            </p>
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full py-2.5 flex items-center justify-center gap-2"
            disabled={loading}
          >
            <KeyRound className="w-4 h-4" />
            {loading ? 'Authenticating...' : 'Sign in to Autopilot'}
          </Button>
        </form>
      </div>
    </div>
  );
};
