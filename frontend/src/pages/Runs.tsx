import React, { useState, useEffect, useRef } from 'react';
import {
  PlayCircle,
  RefreshCw,
  Terminal,
  ArrowRight,
  Layers,
  X,
  Play,
} from 'lucide-react';
import { Button, Card, Badge, Table } from '../components/ui';
import { api } from '../api/client';

interface LogItem {
  id?: number;
  timestamp: string;
  level: string;
  message: string;
}

interface RunItem {
  id: string;
  job_name: string;
  trigger_type: string;
  status: string;
  started_at: string;
  completed_at?: string;
  error_message?: string;
  logs?: LogItem[];
}

export const RunsPage: React.FC = () => {
  const [runs, setRuns] = useState<RunItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isChainRunning, setIsChainRunning] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [liveLogs, setLiveLogs] = useState<LogItem[]>([]);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchRuns = async () => {
    setIsLoading(true);
    try {
      const data = await api.get<RunItem[]>('/api/runs?limit=50');
      setRuns(data || []);
    } catch (e) {
      console.error('Failed to load runs:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
    const interval = setInterval(fetchRuns, 10000);
    return () => clearInterval(interval);
  }, []);

  const runChain = async () => {
    setIsChainRunning(true);
    try {
      const data = await api.post('/api/schedules/chain');
      if (data && data.run_id) {
        openLogs(data.run_id);
      }
      await fetchRuns();
    } catch (e) {
      console.error('Failed to trigger chain:', e);
    } finally {
      setIsChainRunning(false);
    }
  };

  const openLogs = (runId: string) => {
    setActiveRunId(runId);
    setLiveLogs([]);

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(`/api/runs/${runId}/logs/stream`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data._type === 'DONE') {
          fetchRuns();
          es.close();
        } else if (data.message) {
          setLiveLogs((prev) => [...prev, data]);
        }
      } catch (err) {
        // Heartbeat or raw string
      }
    };

    es.onerror = () => {
      es.close();
    };
  };

  const closeLogs = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    setActiveRunId(null);
  };

  useEffect(() => {
    if (activeRunId) {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [liveLogs, activeRunId]);

  const formatJobName = (name: string) => {
    return name
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
            <PlayCircle className="w-6 h-6" />
            Pipeline & Runs
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Real-time background execution queue, worker telemetry, and live SSE streaming logs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={runChain}
            disabled={isChainRunning}
            className="gap-2 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
          >
            <Play className={`w-4 h-4 fill-current ${isChainRunning ? 'animate-spin' : ''}`} />
            Run as Chain
          </Button>
          <Button onClick={fetchRuns} variant="secondary" className="gap-2">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Chain Info Banner */}
      <Card className="p-4 bg-gradient-to-r from-neutral-50 to-neutral-100 dark:from-neutral-950 dark:to-neutral-900 border hairline-border">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs uppercase tracking-wider text-neutral-500 font-semibold flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" /> Autonomous Chain Pipeline
            </span>
            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              One-click autonomous flow: Storage Sync <ArrowRight className="inline w-3 h-3" /> Daily Brain Planner <ArrowRight className="inline w-3 h-3" /> Auto-Edit Render <ArrowRight className="inline w-3 h-3" /> Buffer Schedule.
            </p>
          </div>
          <Badge variant="outline" className="font-mono text-[11px] bg-white dark:bg-neutral-900">
            6 Slots Daily Quota
          </Badge>
        </div>
      </Card>

      {/* Runs Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b hairline-border bg-neutral-50/50 dark:bg-neutral-900/50 text-neutral-500 font-medium">
                <th className="p-3">Run ID</th>
                <th className="p-3">Job Name</th>
                <th className="p-3">Trigger</th>
                <th className="p-3">Status</th>
                <th className="p-3">Started At</th>
                <th className="p-3">Completed At</th>
                <th className="p-3 text-right">Live Logs</th>
              </tr>
            </thead>
            <tbody className="divide-y hairline-border">
              {runs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-neutral-400">
                    No pipeline runs recorded.
                  </td>
                </tr>
              ) : (
                runs.map((r) => (
                  <tr key={r.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30 transition-colors">
                    <td className="p-3 font-mono text-[11px] text-neutral-500">
                      {r.id.slice(0, 8)}...
                    </td>
                    <td className="p-3 font-medium text-neutral-900 dark:text-neutral-100">
                      {formatJobName(r.job_name)}
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {r.trigger_type}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Badge
                        variant={
                          r.status === 'completed'
                            ? 'default'
                            : r.status === 'running' || r.status === 'pending'
                            ? 'outline'
                            : 'destructive'
                        }
                        className="capitalize text-[10px]"
                      >
                        {r.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-neutral-500 text-[11px]">
                      {new Date(r.started_at).toLocaleTimeString()}
                    </td>
                    <td className="p-3 text-neutral-500 text-[11px]">
                      {r.completed_at ? new Date(r.completed_at).toLocaleTimeString() : 'In Progress'}
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openLogs(r.id)}
                        className="text-xs h-7 px-2.5 gap-1.5"
                      >
                        <Terminal className="w-3.5 h-3.5" />
                        Inspect
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      </Card>

      {/* Live SSE Streaming Terminal Drawer */}
      {activeRunId && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <Card className="w-full max-w-3xl bg-neutral-950 border-neutral-800 text-neutral-100 p-0 overflow-hidden flex flex-col h-[520px] shadow-2xl">
            {/* Terminal Top Bar */}
            <div className="p-3 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span className="font-mono text-xs text-neutral-300">
                  Live Log Stream: {activeRunId.slice(0, 8)}
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <button
                onClick={closeLogs}
                className="w-7 h-7 rounded-full bg-neutral-800 flex items-center justify-center hover:bg-neutral-700 transition"
              >
                <X className="w-4 h-4 text-neutral-400" />
              </button>
            </div>

            {/* Terminal Body */}
            <div className="flex-1 p-4 font-mono text-xs overflow-y-auto space-y-2 bg-neutral-950 text-neutral-300">
              {liveLogs.length === 0 ? (
                <div className="text-neutral-500 italic">Streaming live telemetry output...</div>
              ) : (
                liveLogs.map((log, idx) => (
                  <div key={idx} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-neutral-500 select-none text-[10px]">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span
                      className={`text-[10px] px-1 rounded select-none ${
                        log.level === 'ERROR'
                          ? 'bg-red-950 text-red-400'
                          : log.level === 'WARNING'
                          ? 'bg-amber-950 text-amber-400'
                          : 'bg-neutral-800 text-neutral-400'
                      }`}
                    >
                      {log.level}
                    </span>
                    <span className="flex-1 break-all text-neutral-200">{log.message}</span>
                  </div>
                ))
              )}
              <div ref={terminalEndRef} />
            </div>

            {/* Terminal Footer */}
            <div className="p-2.5 bg-neutral-900/80 border-t border-neutral-800 flex items-center justify-between text-[11px] text-neutral-400">
              <span>SSE Connection Active (Server-Sent Events)</span>
              <Button size="sm" variant="ghost" onClick={() => setLiveLogs([])} className="h-6 text-[10px] text-neutral-400">
                Clear View
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
