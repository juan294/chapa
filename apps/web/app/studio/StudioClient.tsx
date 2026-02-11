"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { BadgeConfig, Stats90d, ImpactV3Result } from "@chapa/shared";
import { DEFAULT_BADGE_CONFIG } from "@chapa/shared";
import { trackEvent } from "@/lib/analytics/posthog";
import { BadgePreviewCard } from "./BadgePreviewCard";
import { StudioControls } from "./StudioControls";

export interface StudioClientProps {
  initialConfig: BadgeConfig;
  stats: Stats90d;
  impact: ImpactV3Result;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return reduced;
}

export function StudioClient({
  initialConfig,
  stats,
  impact,
}: StudioClientProps) {
  const [config, setConfig] = useState<BadgeConfig>(initialConfig);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const reducedMotion = useReducedMotion();
  const hasTrackedOpen = useRef(false);

  // Track studio_opened on mount (once)
  useEffect(() => {
    if (!hasTrackedOpen.current) {
      trackEvent("studio_opened");
      hasTrackedOpen.current = true;
    }
  }, []);

  const handleConfigChange = useCallback(
    (newConfig: BadgeConfig) => {
      // Track which field changed
      for (const key of Object.keys(newConfig) as (keyof BadgeConfig)[]) {
        if (newConfig[key] !== config[key]) {
          trackEvent("effect_changed", {
            category: key,
            from: config[key],
            to: newConfig[key],
          });
        }
      }
      setConfig(newConfig);
      // Reset preview key to replay heatmap animation
      setPreviewKey((k) => k + 1);
    },
    [config],
  );

  const handlePresetSelect = useCallback(
    (presetConfig: BadgeConfig) => {
      trackEvent("preset_selected", { preset: presetConfig });
      handleConfigChange(presetConfig);
    },
    [handleConfigChange],
  );

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
        trackEvent("config_saved", { config });
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }, [config]);

  const handleReset = useCallback(() => {
    setConfig({ ...DEFAULT_BADGE_CONFIG });
    setPreviewKey((k) => k + 1);
    trackEvent("effect_changed", { category: "reset", to: "default" });
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 lg:gap-0 min-h-[calc(100vh-5rem)]">
      {/* Preview pane */}
      <div className="flex items-start justify-center lg:items-center px-4 py-6 lg:px-8 lg:py-0">
        <div className="w-full max-w-xl sticky top-24">
          <BadgePreviewCard
            key={previewKey}
            config={config}
            stats={stats}
            impact={impact}
            interactive={!reducedMotion}
          />

          {/* Saved toast */}
          {saved && (
            <div className="mt-4 text-center text-sm text-amber animate-fade-in-up">
              Configuration saved!
            </div>
          )}

          {/* Reduced motion notice */}
          {reducedMotion && (
            <div className="mt-4 text-center text-xs text-text-secondary">
              Reduced motion detected — animations are disabled
            </div>
          )}
        </div>
      </div>

      {/* Controls pane */}
      <div className="border-t lg:border-t-0 lg:border-l border-warm-stroke bg-warm-card/30 lg:h-[calc(100vh-5rem)] lg:overflow-y-auto">
        <StudioControls
          config={config}
          onChange={handleConfigChange}
          onPresetSelect={handlePresetSelect}
          onSave={handleSave}
          onReset={handleReset}
          saving={saving}
          saved={saved}
        />
      </div>
    </div>
  );
}
