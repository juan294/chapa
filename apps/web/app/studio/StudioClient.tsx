"use client";

import { useState, useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import type { BadgeConfig, StatsData, ImpactV4Result } from "@chapa/shared";
import { DEFAULT_BADGE_CONFIG } from "@chapa/shared";
import { trackEvent } from "@/lib/analytics/posthog";
import { STUDIO_PRESETS } from "@/lib/effects/defaults";
import { BadgePreviewCard } from "./BadgePreviewCard";
import { QuickControls } from "./QuickControls";
import { useStudioCommands } from "./useStudioCommands";
import { TerminalOutput } from "@/components/terminal/TerminalOutput";
import { TerminalInput } from "@/components/terminal/TerminalInput";
import { AutocompleteDropdown } from "@/components/terminal/AutocompleteDropdown";
import {
  executeCommand,
  makeLine,
  type OutputLine,
  type CommandAction,
} from "@/components/terminal/command-registry";
import { useKeyboardShortcutsContext } from "@/components/KeyboardShortcutsProvider";

export interface StudioClientProps {
  initialConfig: BadgeConfig;
  stats: StatsData;
  impact: ImpactV4Result;
  handle?: string;
}

function subscribeReducedMotion(callback: () => void) {
  const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getReducedMotionSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getReducedMotionServerSnapshot() {
  return false;
}

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );
}

export function StudioClient({
  initialConfig,
  stats,
  impact,
  handle = "",
}: StudioClientProps) {
  const [config, setConfig] = useState<BadgeConfig>(initialConfig);
  const [saving, setSaving] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [showQuickControls, setShowQuickControls] = useState(false);
  const reducedMotion = useReducedMotion();
  const hasTrackedOpen = useRef(false);

  // Terminal state
  const [lines, setLines] = useState<OutputLine[]>([
    makeLine("system", "Creator Studio — customize your badge"),
    makeLine("dim", "Type /help for commands or use Quick Controls."),
  ]);
  const [history, setHistory] = useState<string[]>([]);
  const [partial, setPartial] = useState("");
  const [showAutocomplete, setShowAutocomplete] = useState(false);

  const studioCommands = useStudioCommands({ config, handle });

  // Track studio_opened on mount (once)
  useEffect(() => {
    if (!hasTrackedOpen.current) {
      trackEvent("studio_opened");
      hasTrackedOpen.current = true;
    }
  }, []);

  const handleConfigChange = useCallback(
    (newConfig: BadgeConfig) => {
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
      setPreviewKey((k) => k + 1);
    },
    [config],
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/studio/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        trackEvent("config_saved", { config });
        setLines((prev) => [...prev, makeLine("success", "Configuration saved!")]);
      } else {
        setLines((prev) => [...prev, makeLine("error", "Failed to save. Try again.")]);
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

  const handleAction = useCallback(
    (action: CommandAction) => {
      switch (action.type) {
        case "set": {
          const key = action.category as keyof BadgeConfig;
          handleConfigChange({ ...config, [key]: action.value });
          break;
        }
        case "preset": {
          const preset = STUDIO_PRESETS.find((p) => p.id === action.name);
          if (preset) {
            trackEvent("preset_selected", { preset: preset.id });
            handleConfigChange(preset.config);
          }
          break;
        }
        case "save":
          handleSave();
          break;
        case "reset":
          handleReset();
          break;
        case "clear":
          setLines([]);
          break;
        default:
          break;
      }
    },
    [config, handleConfigChange, handleSave, handleReset],
  );

  const handleSubmit = useCallback(
    (input: string) => {
      const inputLine = makeLine("input", input);
      setHistory((h) => [...h, input]);
      setShowAutocomplete(false);
      setPartial("");

      const result = executeCommand(input, studioCommands);

      if (result.action?.type === "clear") {
        setLines([]);
        return;
      }

      setLines((prev) => [...prev, inputLine, ...result.lines]);

      if (result.action) {
        handleAction(result.action);
      }
    },
    [studioCommands, handleAction],
  );

  const handleQuickCommand = useCallback(
    (cmd: string) => {
      handleSubmit(cmd);
    },
    [handleSubmit],
  );

  const handlePartialChange = useCallback((val: string) => {
    setPartial(val);
    setShowAutocomplete(val.startsWith("/") && val.length > 0);
  }, []);

  const handleAutocompleteDismiss = useCallback(() => {
    setShowAutocomplete(false);
  }, []);

  const handleAutocompleteSelect = useCallback(
    (command: string) => {
      setShowAutocomplete(false);
      setPartial("");
      handleSubmit(command);
    },
    [handleSubmit],
  );

  const handleAutocompleteFill = useCallback((command: string) => {
    setShowAutocomplete(false);
    const input = document.querySelector<HTMLInputElement>(
      'input[aria-label="Terminal command input"]',
    );
    if (input) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )?.set;
      nativeInputValueSetter?.call(input, command + " ");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
    }
  }, []);

  // Register studio keyboard shortcuts via global provider
  const { registerPageShortcuts } = useKeyboardShortcutsContext();
  useEffect(() => {
    return registerPageShortcuts("studio", (id: string) => {
      switch (id) {
        case "focus-terminal": {
          const input = document.querySelector<HTMLInputElement>(
            'input[aria-label="Terminal command input"]',
          );
          input?.focus();
          break;
        }
        case "cycle-preset": {
          const currentIdx = STUDIO_PRESETS.findIndex(
            (p) => p.config.background === config.background,
          );
          const nextIdx = (currentIdx + 1) % STUDIO_PRESETS.length;
          const preset = STUDIO_PRESETS[nextIdx]!;
          trackEvent("preset_selected", { preset: preset.id });
          handleConfigChange(preset.config);
          break;
        }
        case "toggle-quick-controls":
          setShowQuickControls((v) => !v);
          break;
        case "refresh-preview":
          setPreviewKey((k) => k + 1);
          break;
      }
    });
  }, [registerPageShortcuts, config.background, handleConfigChange]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 min-h-[calc(100vh-3.5rem)]">
      <h1 className="sr-only">Creator Studio</h1>
      {/* Preview pane (left, sticky) */}
      <div className="flex items-start justify-center lg:items-center px-4 py-6 lg:px-8 lg:py-0 border-b lg:border-b-0 lg:border-r border-stroke" aria-busy={saving}>
        <div className="w-full max-w-xl sticky top-20">
          <BadgePreviewCard
            key={previewKey}
            config={config}
            stats={stats}
            impact={impact}
            interactive={!reducedMotion}
          />

          {saving && (
            <div className="mt-4 text-center text-sm text-amber animate-terminal-fade-in font-heading">
              Saving...
            </div>
          )}

          {reducedMotion && (
            <div className="mt-4 text-center text-xs text-text-secondary">
              Reduced motion detected — animations are disabled
            </div>
          )}
        </div>
      </div>

      {/* Terminal pane (right) */}
      <div className="flex flex-col lg:h-[calc(100vh-3.5rem)] bg-bg">
        {/* Quick Controls toggle */}
        <QuickControls
          config={config}
          onCommand={handleQuickCommand}
          visible={showQuickControls}
          onToggle={() => setShowQuickControls((v) => !v)}
        />

        {/* Terminal output */}
        <TerminalOutput lines={lines} />

        {/* Terminal input + autocomplete */}
        <div className="relative mt-auto">
          <AutocompleteDropdown
            commands={studioCommands}
            partial={partial}
            onSelect={handleAutocompleteSelect}
            onFill={handleAutocompleteFill}
            onDismiss={handleAutocompleteDismiss}
            visible={showAutocomplete}
          />
          <TerminalInput
            onSubmit={handleSubmit}
            onPartialChange={handlePartialChange}
            history={history}
            prompt="studio"
          />
        </div>
      </div>
    </div>
  );
}
