"use client";

import { useState, useCallback } from "react";
import type { BadgeConfig, Stats90d, ImpactV3Result } from "@chapa/shared";
import { DEFAULT_BADGE_CONFIG } from "@chapa/shared";
import { BadgePreviewCard } from "./BadgePreviewCard";
import { StudioControls } from "./StudioControls";

export interface StudioClientProps {
  initialConfig: BadgeConfig;
  stats: Stats90d;
  impact: ImpactV3Result;
}

export function StudioClient({
  initialConfig,
  stats,
  impact,
}: StudioClientProps) {
  const [config, setConfig] = useState<BadgeConfig>(initialConfig);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/studio/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }, [config]);

  const handleReset = useCallback(() => {
    setConfig({ ...DEFAULT_BADGE_CONFIG });
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 lg:gap-0 min-h-[calc(100vh-5rem)]">
      {/* Preview pane */}
      <div className="flex items-start justify-center lg:items-center px-4 py-6 lg:px-8 lg:py-0">
        <div className="w-full max-w-xl sticky top-24">
          <BadgePreviewCard
            config={config}
            stats={stats}
            impact={impact}
            interactive
          />

          {/* Saved toast */}
          {saved && (
            <div className="mt-4 text-center text-sm text-amber animate-fade-in-up">
              Configuration saved!
            </div>
          )}
        </div>
      </div>

      {/* Controls pane */}
      <div className="border-t lg:border-t-0 lg:border-l border-warm-stroke bg-warm-card/30 lg:h-[calc(100vh-5rem)] lg:overflow-y-auto">
        <StudioControls
          config={config}
          onChange={setConfig}
          onSave={handleSave}
          onReset={handleReset}
          saving={saving}
          saved={saved}
        />
      </div>
    </div>
  );
}
