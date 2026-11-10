import React, { useState, useEffect } from 'react';
import { Button, Card, Input, Badge } from '../components/ui';
import { Music, Download, Play, Pause, AlertTriangle, ShieldCheck } from 'lucide-react';

interface TrackItem {
  id: number;
  title: string;
  filename: string;
  duration: number;
  bpm: number;
  beats_count: number;
  tags: string;
  safe_to_use: boolean;
  source_url?: string;
  license_note?: string;
  created_at: string;
}

export const MusicLibraryPage: React.FC = () => {
  const [tracks, setTracks] = useState<TrackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  // Download modal state
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [downloadTitle, setDownloadTitle] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    fetchTracks();
    return () => {
      if (audioElement) {
        audioElement.pause();
      }
    };
  }, []);

  const fetchTracks = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/music');
      const data = await res.json();
      setTracks(data);
    } catch (err) {
      console.error('Failed to load music tracks', err);
    } finally {
      setLoading(false);
    }
  };

  const getCsrfToken = () => {
    const match = document.cookie.match(/csrf_token=([^;]+)/);
    return match ? match[1] : '';
  };

  const handlePlayToggle = (track: TrackItem) => {
    if (playingId === track.id) {
      if (audioElement) {
        audioElement.pause();
      }
      setPlayingId(null);
    } else {
      if (audioElement) {
        audioElement.pause();
      }
      const audio = new Audio(`/api/music/${track.id}/audio`);
      audio.onended = () => setPlayingId(null);
      audio.play();
      setAudioElement(audio);
      setPlayingId(track.id);
    }
  };

  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!downloadUrl) return;
    try {
      setDownloading(true);
      setDownloadError(null);
      const csrf = getCsrfToken();
      const res = await fetch('/api/music/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrf,
        },
        body: JSON.stringify({
          url: downloadUrl,
          title: downloadTitle || undefined,
          safe_to_use: false, // Downloaded audio defaults to caution flag
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Download failed');
      }

      setShowDownloadModal(false);
      setDownloadUrl('');
      setDownloadTitle('');
      fetchTracks();
    } catch (err: any) {
      setDownloadError(err.message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Music className="h-6 w-6" /> Music Library
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Beat-detected background audio tracks for rhythmic video cutting and loudness-normalized audio.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowDownloadModal(true)}>
            <Download className="h-4 w-4 mr-1.5" /> Download Track
          </Button>
        </div>
      </div>

      {/* Commercial Safety Warning Banner */}
      <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/5 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-xs text-foreground/80 space-y-1">
          <div className="font-semibold text-foreground">Commercial Copyright Safety Notice</div>
          <div>
            TikTok sounds downloaded from other creator videos often carry commercial restrictions and may be muted or flagged on affiliate accounts.
            The Daily Planner automatically prefers tracks marked as <strong className="text-emerald-500">Safe for Commercial Use</strong>.
          </div>
        </div>
      </div>

      {/* Tracks Table */}
      <Card>
        <div className="border-b border-neutral-200 dark:border-neutral-800 pb-3 mb-4">
          <div className="text-base font-semibold flex items-center justify-between">
            <span>Audio Tracks ({tracks.length})</span>
          </div>
          <div className="text-xs text-neutral-500 mt-1">
            All tracks are normalized to -14 LUFS with leading silence removed and tempo normalized between 85-170 BPM.
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-neutral-500">Loading music library...</div>
        ) : tracks.length === 0 ? (
          <div className="py-12 text-center text-sm text-neutral-500 space-y-3">
            <Music className="h-8 w-8 mx-auto text-neutral-400" />
            <div>No music tracks currently registered in the library.</div>
            <Button variant="secondary" size="sm" onClick={() => setShowDownloadModal(true)}>
              Add First Track
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-400 font-mono">
                <tr>
                  <th className="py-2.5 px-3">TRACK</th>
                  <th className="py-2.5 px-3">BPM</th>
                  <th className="py-2.5 px-3">DURATION</th>
                  <th className="py-2.5 px-3">BEATS</th>
                  <th className="py-2.5 px-3">SAFETY</th>
                  <th className="py-2.5 px-3 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800/60">
                {tracks.map((t) => (
                  <tr key={t.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/30 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-semibold text-neutral-900 dark:text-neutral-100">{t.title}</div>
                      <div className="text-[11px] text-neutral-400 font-mono truncate max-w-[240px]">
                        {t.filename}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <Badge variant="outline" className="font-mono text-[11px] px-1.5 py-0.5">
                        {t.bpm} BPM
                      </Badge>
                    </td>
                    <td className="py-3 px-3 font-mono text-neutral-400">{t.duration}s</td>
                    <td className="py-3 px-3 font-mono text-neutral-400">{t.beats_count} cuts</td>
                    <td className="py-3 px-3">
                      {t.safe_to_use ? (
                        <span className="inline-flex items-center gap-1 text-emerald-500 font-medium">
                          <ShieldCheck className="h-3.5 w-3.5" /> Safe
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-500 font-medium">
                          <AlertTriangle className="h-3.5 w-3.5" /> Caution
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Button
                        variant={playingId === t.id ? 'primary' : 'secondary'}
                        size="sm"
                        className="h-7 w-7 p-0 rounded-full"
                        onClick={() => handlePlayToggle(t)}
                      >
                        {playingId === t.id ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Download Track Modal */}
      {showDownloadModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Download className="h-5 w-5" /> Download TikTok / Social Audio
            </h2>
            <p className="text-xs text-neutral-500">
              Paste a video URL to extract the audio, normalize volume, and compute beat synchronization markers.
            </p>

            {downloadError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs">
                {downloadError}
              </div>
            )}

            <form onSubmit={handleDownload} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-medium text-neutral-700 dark:text-neutral-300">Video Link (TikTok, YouTube Shorts)</label>
                <Input
                  value={downloadUrl}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDownloadUrl(e.target.value)}
                  placeholder="https://www.tiktok.com/@creator/video/..."
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-medium text-neutral-700 dark:text-neutral-300">Custom Track Title (Optional)</label>
                <Input
                  value={downloadTitle}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDownloadTitle(e.target.value)}
                  placeholder="e.g. Upbeat Viral Bass"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" type="button" onClick={() => setShowDownloadModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={downloading}>
                  {downloading ? 'Downloading...' : 'Extract & Analyze Audio'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
