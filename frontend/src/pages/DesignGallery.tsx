import React, { useState } from 'react';
import { Button, Card, Input, StatusDot, Badge } from '../components/ui';
import { Sliders } from 'lucide-react';

export const DesignGallery: React.FC = () => {
  const [grayscale, setGrayscale] = useState(false);
  const [inputValue, setInputValue] = useState('');

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-16">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Design System & Component Gallery</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Strict Apple clarity, Notion calm, monochromatic black & white palette with semantic accents.
        </p>
      </div>

      {/* Color Tokens Matrix */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">Theme Tokens</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="space-y-2">
            <div className="h-10 rounded-control bg-white hairline-border flex items-center justify-center text-xs font-mono text-black">
              #FFFFFF
            </div>
            <p className="text-xs font-medium">Background Light</p>
          </Card>
          <Card className="space-y-2">
            <div className="h-10 rounded-control bg-[#FAFAFA] hairline-border flex items-center justify-center text-xs font-mono text-black">
              #FAFAFA
            </div>
            <p className="text-xs font-medium">Surface Light</p>
          </Card>
          <Card className="space-y-2">
            <div className="h-10 rounded-control bg-[#000000] hairline-border flex items-center justify-center text-xs font-mono text-white">
              #000000
            </div>
            <p className="text-xs font-medium">Background Dark</p>
          </Card>
          <Card className="space-y-2">
            <div className="h-10 rounded-control bg-[#0A0A0A] hairline-border flex items-center justify-center text-xs font-mono text-white">
              #0A0A0A
            </div>
            <p className="text-xs font-medium">Surface Dark</p>
          </Card>
        </div>
      </section>

      {/* Buttons */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">Button Variants & Sizes</h2>
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary">Primary Action</Button>
            <Button variant="secondary">Secondary Action</Button>
            <Button variant="ghost">Ghost Button</Button>
            <Button variant="destructive">Destructive</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-2 hairline-t">
            <Button size="sm" variant="primary">Small Button</Button>
            <Button size="md" variant="primary">Medium Button</Button>
            <Button size="lg" variant="primary">Large Button</Button>
            <Button size="md" variant="secondary" disabled>Disabled State</Button>
          </div>
        </Card>
      </section>

      {/* Form Controls */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">Inputs & Controls</h2>
        <Card className="space-y-4 max-w-md">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-neutral-500">API Endpoint / Setting</label>
            <Input
              placeholder="e.g. https://api.buffer.com"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-neutral-500">Encrypted Token (Masked Input)</label>
            <Input
              type="password"
              defaultValue="sk-1234567890abcdef"
              disabled
            />
          </div>
        </Card>
      </section>

      {/* Status Dots & Badges */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">Status Indicators</h2>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setGrayscale(!grayscale)}
          >
            <Sliders size={13} className="mr-1.5" />
            Toggle Grayscale: {grayscale ? 'ON' : 'OFF'}
          </Button>
        </div>
        <Card className="flex flex-wrap items-center gap-6">
          <StatusDot status="active" grayscale={grayscale} label="Running" />
          <StatusDot status="warning" grayscale={grayscale} label="Sync Pending" />
          <StatusDot status="error" grayscale={grayscale} label="Post Failed" />
          <StatusDot status="idle" grayscale={grayscale} label="Idle" />
          <Badge>Default Tag</Badge>
          <Badge className="bg-emerald-500/10 text-emerald-500">Success</Badge>
          <Badge className="bg-amber-500/10 text-amber-500">Degraded</Badge>
        </Card>
      </section>

      {/* Dense Table Layout */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">Dense Table Component (13px)</h2>
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-left table-dense border-collapse">
            <thead>
              <tr className="hairline-b bg-neutral-50 dark:bg-neutral-900/40 text-neutral-500 font-medium">
                <th>Schedule ID</th>
                <th>Target Process</th>
                <th>Cron Expression</th>
                <th>Timezone</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200/50 dark:divide-neutral-800/50 font-mono text-xs">
              <tr className="hover:bg-neutral-50 dark:hover:bg-neutral-900/20">
                <td>nightly_orders_sync</td>
                <td className="font-sans">Nightly Orders & Multi-File Sync</td>
                <td>0 23 * * *</td>
                <td>Asia/Manila</td>
                <td><StatusDot status="active" grayscale={grayscale} label="Healthy" /></td>
              </tr>
              <tr className="hover:bg-neutral-50 dark:hover:bg-neutral-900/20">
                <td>sunday_strategy_engine</td>
                <td className="font-sans">Sunday Strategy Engine & Scorecard</td>
                <td>0 8 * * 0</td>
                <td>Asia/Manila</td>
                <td><StatusDot status="active" grayscale={grayscale} label="Scheduled" /></td>
              </tr>
              <tr className="hover:bg-neutral-50 dark:hover:bg-neutral-900/20">
                <td>buffer_poster_sync</td>
                <td className="font-sans">Buffer TikTok 6-Daily Poster</td>
                <td>0 9,11,14,16,19,21 * * *</td>
                <td>Asia/Manila</td>
                <td><StatusDot status="active" grayscale={grayscale} label="Ready" /></td>
              </tr>
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  );
};
