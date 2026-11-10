import React, { useState, useEffect } from 'react';
import { Button, Card, Input, Badge } from '../components/ui';
import { Play, Copy, Sliders, Video } from 'lucide-react';
import { api } from '../api/client';

interface StyleSpecData {
  id: string;
  name: string;
  description: string;
  crop_mode: string;
  cut_mode: string;
  transitions_enabled: boolean;
  spec: any;
}

export const StyleStudioPage: React.FC = () => {
  const [styles, setStyles] = useState<StyleSpecData[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<StyleSpecData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [titleText, setTitleText] = useState('VIRAL WIRELESS MIC');
  const [subtitleText, setSubtitleText] = useState('NOISE CANCELLING DEAL');

  useEffect(() => {
    fetchStyles();
  }, []);

  const fetchStyles = async () => {
    try {
      const data = await api.get<StyleSpecData[]>('/api/styles');
      setStyles(data || []);
      if (data && data.length > 0 && !selectedStyle) {
        setSelectedStyle(data[0]);
      }
    } catch (err) {
      console.error('Failed to load styles', err);
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await api.post(`/api/styles/${id}/duplicate`);
      fetchStyles();
    } catch (err) {
      console.error(err);
    }
  };

  const handlePreviewRender = async () => {
    if (!selectedStyle) return;
    try {
      setPreviewLoading(true);
      const data = await api.post('/api/styles/preview', {
        style_id: selectedStyle.id,
        title: titleText,
        subtitle: subtitleText,
        sample_duration: 5.0,
      });
      if (data && data.preview_url) {
        setPreviewUrl(data.preview_url);
      }
    } catch (err) {
      console.error('Preview error', err);
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Sliders className="h-6 w-6" /> Style Studio
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Build, test, and preview TikTok video styles with real-time FFmpeg typography and transitions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => selectedStyle && handleDuplicate(selectedStyle.id)}>
            <Copy className="h-4 w-4 mr-1.5" /> Duplicate
          </Button>
          <Button variant="primary" size="sm" onClick={handlePreviewRender} disabled={previewLoading}>
            <Play className="h-4 w-4 mr-1.5" />
            {previewLoading ? 'Rendering 5s Preview...' : 'Preview Render'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Style Selector & Form Settings */}
        <div className="lg:col-span-7 space-y-6">
          {/* Style Selector Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {styles.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedStyle(s)}
                className={`p-3 text-left rounded-lg border transition-all ${
                  selectedStyle?.id === s.id
                    ? 'border-neutral-900 dark:border-white bg-neutral-100 dark:bg-neutral-800 font-medium shadow-sm'
                    : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900 text-neutral-500'
                }`}
              >
                <div className="text-xs uppercase tracking-wider text-neutral-400 mb-1">Style</div>
                <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">{s.name}</div>
                <div className="text-[11px] text-neutral-400 mt-1 flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px] px-1 py-0">{s.crop_mode}</Badge>
                  {s.transitions_enabled && <Badge variant="secondary" className="text-[10px] px-1 py-0">Transitions</Badge>}
                </div>
              </button>
            ))}
          </div>

          {/* Form Settings */}
          {selectedStyle && (
            <Card>
              <div className="border-b border-neutral-200 dark:border-neutral-800 pb-3 mb-4">
                <div className="text-base font-semibold flex items-center justify-between">
                  <span>{selectedStyle.name} Configuration</span>
                  <Badge variant="outline" className="font-mono text-xs">{selectedStyle.id}</Badge>
                </div>
                <div className="text-xs text-neutral-500 mt-1">{selectedStyle.description}</div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-500">Preview Title</label>
                    <Input
                      value={titleText}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitleText(e.target.value)}
                      placeholder="Line 1 Hook"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-500">Preview Subtitle</label>
                    <Input
                      value={subtitleText}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSubtitleText(e.target.value)}
                      placeholder="Line 2 Detail"
                    />
                  </div>
                </div>

                <div className="border-t border-neutral-200 dark:border-neutral-800 pt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-2.5 rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/30">
                    <div className="text-neutral-400 font-mono">CANVAS</div>
                    <div className="font-semibold mt-1">1080 x 1920 (30 fps)</div>
                  </div>
                  <div className="p-2.5 rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/30">
                    <div className="text-neutral-400 font-mono">CROP MODE</div>
                    <div className="font-semibold mt-1 capitalize">{selectedStyle.crop_mode.replace('_', ' ')}</div>
                  </div>
                  <div className="p-2.5 rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/30">
                    <div className="text-neutral-400 font-mono">CUT LOGIC</div>
                    <div className="font-semibold mt-1 capitalize">{selectedStyle.cut_mode.replace('_', ' ')}</div>
                  </div>
                </div>

                <div className="border-t border-neutral-200 dark:border-neutral-800 pt-3">
                  <div className="text-xs font-medium text-neutral-500 mb-2">Typography & Overlay Layers:</div>
                  <div className="space-y-2">
                    {selectedStyle.spec?.text_layers?.map((layer: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded border border-neutral-200 dark:border-neutral-800 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold uppercase tracking-wider">{layer.name}</span>
                          <span className="text-neutral-500">y={layer.position_y}px</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono" style={{ color: layer.color === '0xEFD34C' ? '#EFD34C' : 'inherit' }}>
                            {layer.color}
                          </span>
                          <Badge variant="outline" className="text-[10px]">max {layer.max_size}px</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Right: Phone-shaped 9:16 Preview Canvas */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="relative w-[280px] h-[498px] rounded-[36px] border-4 border-neutral-800 bg-black overflow-hidden shadow-2xl flex flex-col justify-between p-4 text-center select-none">
            {/* Phone notch */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-4 bg-neutral-800 rounded-full z-20"></div>

            {/* Video preview / Simulated canvas */}
            {previewUrl ? (
              <video
                src={previewUrl}
                autoPlay
                loop
                muted
                playsInline
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-b from-neutral-900 via-neutral-950 to-neutral-900 opacity-90 flex flex-col items-center justify-center">
                <Video className="h-10 w-10 text-neutral-600 mb-2" />
                <span className="text-[11px] text-neutral-500 font-mono">Live 9:16 Canvas</span>
              </div>
            )}

            {/* Visual Title / Subtitle Overlay Preview */}
            <div className="relative z-10 mt-14 space-y-1">
              <div
                className="font-bold tracking-tight text-center drop-shadow-md"
                style={{
                  fontFamily: 'Impact, Anton, sans-serif',
                  color: selectedStyle?.spec?.text_layers?.[0]?.color === '0xEFD34C' ? '#EFD34C' : '#FFFFFF',
                  fontSize: '22px',
                  lineHeight: '1.1',
                  WebkitTextStroke: '1px black',
                }}
              >
                {titleText}
              </div>
              <div
                className="font-bold tracking-tight text-center drop-shadow-md text-white"
                style={{
                  fontFamily: 'Impact, Anton, sans-serif',
                  fontSize: '20px',
                  lineHeight: '1.1',
                  WebkitTextStroke: '1px black',
                }}
              >
                {subtitleText}
              </div>
            </div>

            {/* Bottom Safe Area / CTA indicator */}
            <div className="relative z-10 mb-6 space-y-2">
              {selectedStyle?.spec?.text_layers?.some((l: any) => l.name === 'cta') && (
                <div className="inline-block px-3 py-1 bg-red-600 text-white font-bold text-[10px] rounded uppercase tracking-wider border border-yellow-400">
                  Tap Basket to Order
                </div>
              )}
              <div className="text-[9px] text-neutral-400 font-mono">
                Safe Area 1080x1920
              </div>
            </div>
          </div>
          <div className="text-xs text-neutral-500 mt-3 text-center">
            Click <strong>Preview Render</strong> to test 5-second dynamic cuts and transitions.
          </div>
        </div>
      </div>
    </div>
  );
};
