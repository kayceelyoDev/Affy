import React, { useState, useEffect } from 'react';
import {
  Clock,
  Play,
  Save,
  Check,
  RefreshCw,
  Layers,
} from 'lucide-react';
import { Button, Card, Input, Badge, Table } from '../components/ui';
import { api } from '../api/client';

interface ScheduleItem {
  id: string;
  name: string;
  cron_expression: string;
  enabled: boolean;
  timezone: string;
  next_run_at?: string;
  last_run_at?: string;
  last_status?: string;
}

export const SchedulesPage: React.FC = () => {
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [cronDrafts, setCronDrafts] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [runningJobId, setRunningJobId] = useState<string | null>(null);
  const [savedJobId, setSavedJobId] = useState<string | null>(null);
  const [isChainRunning, setIsChainRunning] = useState(false);

  const fetchSchedules = async () => {
    setIsLoading(true);
    try {
      const data = await api.get<ScheduleItem[]>('/api/schedules');
      setSchedules(data || []);
      const drafts: Record<string, string> = {};
      (data || []).forEach((s) => {
        drafts[s.id] = s.cron_expression;
      });
      setCronDrafts(drafts);
    } catch (e) {
      console.error('Failed to load schedules:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  const handleCronChange = (id: string, val: string) => {
    setCronDrafts((prev) => ({ ...prev, [id]: val }));
  };

  const handleToggle = async (item: ScheduleItem) => {
    const newEnabled = !item.enabled;
    try {
      await api.put(`/api/schedules/${item.id}`, { enabled: newEnabled });
      await fetchSchedules();
    } catch (e) {
      console.error('Failed to toggle schedule:', e);
    }
  };

  const handleSaveCron = async (id: string) => {
    const cron = cronDrafts[id];
    try {
      await api.put(`/api/schedules/${id}`, { cron_expression: cron });
      setSavedJobId(id);
      setTimeout(() => setSavedJobId(null), 2000);
      await fetchSchedules();
    } catch (e) {
      console.error('Failed to save cron:', e);
    }
  };

  const handleRunNow = async (id: string) => {
    setRunningJobId(id);
    try {
      await api.post(`/api/schedules/${id}/run`);
      await fetchSchedules();
    } catch (e) {
      console.error('Failed to run schedule now:', e);
    } finally {
      setRunningJobId(null);
    }
  };

  const handleRunChain = async () => {
    setIsChainRunning(true);
    try {
      await api.post('/api/schedules/chain');
      await fetchSchedules();
    } catch (e) {
      console.error('Failed to run chain:', e);
    } finally {
      setIsChainRunning(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
            <Clock className="w-6 h-6" />
            Schedules & Automation
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Configurable cron expressions, timezone synchronization (Asia/Manila), and instant manual triggers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleRunChain}
            disabled={isChainRunning}
            className="gap-2 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
          >
            <Layers className="w-4 h-4" />
            Run Full Chain
          </Button>
          <Button onClick={fetchSchedules} variant="secondary" className="gap-2">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Schedules Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b hairline-border bg-neutral-50/50 dark:bg-neutral-900/50 text-neutral-500 font-medium">
                <th className="p-3 w-16">Active</th>
                <th className="p-3">Job Name</th>
                <th className="p-3 w-48">Cron Expression</th>
                <th className="p-3">Timezone</th>
                <th className="p-3">Last Execution</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y hairline-border">
              {schedules.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-neutral-400">
                    No registered schedules found.
                  </td>
                </tr>
              ) : (
                schedules.map((s) => (
                  <tr key={s.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30 transition-colors">
                    <td className="p-3">
                      <button
                        onClick={() => handleToggle(s)}
                        className={`w-8 h-4 rounded-full transition-colors relative ${
                          s.enabled ? 'bg-neutral-900 dark:bg-white' : 'bg-neutral-200 dark:bg-neutral-800'
                        }`}
                        title={s.enabled ? 'Enabled (click to disable)' : 'Disabled (click to enable)'}
                      >
                        <span
                          className={`absolute top-0.5 w-3 h-3 rounded-full transition-transform ${
                            s.enabled
                              ? 'bg-white dark:bg-black translate-x-4'
                              : 'bg-neutral-400 dark:bg-neutral-500 translate-x-0.5'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="p-3 space-y-0.5">
                      <div className="font-semibold text-neutral-900 dark:text-neutral-100">{s.name}</div>
                      <div className="font-mono text-[10px] text-neutral-400">{s.id}</div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <Input
                          value={cronDrafts[s.id] ?? s.cron_expression}
                          onChange={(e) => handleCronChange(s.id, e.target.value)}
                          className="font-mono text-xs h-7 py-0 px-2 w-32"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSaveCron(s.id)}
                          className="h-7 px-2"
                          title="Save Cron"
                        >
                          {savedJobId === s.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Save className="w-3.5 h-3.5 text-neutral-500" />
                          )}
                        </Button>
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-[10px]">
                        {s.timezone}
                      </Badge>
                    </td>
                    <td className="p-3 space-y-0.5">
                      <div className="text-neutral-600 dark:text-neutral-400 text-[11px]">
                        {s.last_run_at ? new Date(s.last_run_at).toLocaleString() : 'Never run'}
                      </div>
                      {s.last_status && (
                        <Badge
                          variant={s.last_status === 'completed' ? 'default' : 'destructive'}
                          className="text-[9px] uppercase"
                        >
                          {s.last_status}
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleRunNow(s.id)}
                        disabled={runningJobId === s.id}
                        className="h-7 px-2.5 text-xs gap-1"
                      >
                        <Play className={`w-3 h-3 fill-current ${runningJobId === s.id ? 'animate-spin' : ''}`} />
                        Run Now
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      </Card>
    </div>
  );
};
