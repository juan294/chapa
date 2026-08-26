"use client";

import {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import type { BadgeConfig, StatsData, ImpactV6Result } from "@chapa/shared";
import { DEFAULT_BADGE_CONFIG } from "@chapa/shared";
import { trackEvent } from "@/lib/analytics/posthog";
import { STUDIO_PRESETS } from "@/lib/effects/defaults";
import { useIsClient } from "@/hooks/useIsClient";
import { BadgePreviewCard } from "./BadgePreviewCard";
import type { PreviewVerification } from "./PreviewFooter";
import { QuickControls } from "./QuickControls";
import {
  useStudioCommands,
  type StudioCommandAction,
} from "./useStudioCommands";
import { TerminalOutput } from "@/components/terminal/TerminalOutput";
import { TerminalInput } from "@/components/terminal/TerminalInput";
import { AutocompleteDropdown } from "@/components/terminal/AutocompleteDropdown";
import {
  executeCommand,
  makeLine,
  type OutputLine,
} from "@/components/terminal/command-registry";
import { useKeyboardShortcutsContext } from "@/components/KeyboardShortcutsListener";
import { useTranslation, type LanguageContextValue } from "@/lib/i18n";
import { interpolate } from "@/lib/i18n/interpolate";
import {
  TERMINAL_COMMAND_INPUT_ID,
  TERMINAL_COMMAND_LISTBOX_ID,
} from "@/lib/keyboard/shortcuts";

export interface StudioClientProps {
  initialConfig: BadgeConfig;
  stats: StatsData;
  impact: ImpactV6Result;
  handle?: string;
  verification?: PreviewVerification | null;
}

type SaveState =
  | { status: "dirty" | "saving" | "saved" }
  | { status: "error"; message: string };

type Translate = LanguageContextValue["t"];

const TERMINAL_WELCOME_LINE_ID = "studio-terminal-welcome";
const TERMINAL_HINT_LINE_ID = "studio-terminal-hint";

function translation(t: Translate, key: string): string {
  return t(key) as string;
}

export function parseRetryAfterSeconds(
  value: string | null,
  now = Date.now(),
): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10);
  const retryAt = Date.parse(trimmed);
  if (Number.isNaN(retryAt)) return null;
  return Math.max(0, Math.ceil((retryAt - now) / 1000));
}

function getSaveErrorMessage(response: Response, t: Translate): string {
  let key: string;
  switch (response.status) {
    case 400:
      key = "studio.save.invalidError";
      break;
    case 401:
    case 403:
      key = "studio.save.authError";
      break;
    case 404:
      key = "studio.save.notFoundError";
      break;
    case 429:
      key = "studio.save.rateLimitError";
      break;
    case 503:
      key = "studio.save.unavailableError";
      break;
    default:
      return interpolate(translation(t, "studio.save.statusError"), {
        status: String(response.status),
      });
  }

  const base = translation(t, key);
  const retryAfter = parseRetryAfterSeconds(response.headers.get("Retry-After"));
  if (retryAfter === null) return base;
  return `${base} ${interpolate(translation(t, "studio.save.retryAfter"), {
    seconds: String(retryAfter),
  })}`;
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
  verification = null,
}: StudioClientProps) {
  const { t } = useTranslation();
  const [config, setConfig] = useState<BadgeConfig>(initialConfig);
  const [saveState, setSaveState] = useState<SaveState>({ status: "saved" });
  const [previewKey, setPreviewKey] = useState(0);
  const [showQuickControls, setShowQuickControls] = useState(false);
  const isClient = useIsClient();
  const reducedMotion = useReducedMotion();
  const hasTrackedOpen = useRef(false);
  const configRevisionRef = useRef(0);
  const saveInFlightRef = useRef(false);

  // Terminal state — identify seed lines so their rendered text can follow a
  // live locale change without replacing command history or re-adding cleared
  // output.
  const [lines, setLines] = useState<OutputLine[]>(() => [
    {
      id: TERMINAL_WELCOME_LINE_ID,
      type: "system",
      text: translation(t, "studio.terminalWelcome"),
    },
    {
      id: TERMINAL_HINT_LINE_ID,
      type: "dim",
      text: translation(t, "studio.terminalHint"),
    },
  ]);
  const localizedLines = useMemo(() => {
    return lines.map((line) => {
      if (line.id === TERMINAL_WELCOME_LINE_ID) {
        return {
          ...line,
          text: translation(t, "studio.terminalWelcome"),
        };
      }
      if (line.id === TERMINAL_HINT_LINE_ID) {
        return { ...line, text: translation(t, "studio.terminalHint") };
      }
      return line;
    });
  }, [lines, t]);
  const [history, setHistory] = useState<string[]>([]);
  const [partial, setPartial] = useState("");
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [activeSuggestionId, setActiveSuggestionId] = useState<string>();

  const saving = saveState.status === "saving";
  const autocompleteExpanded = showAutocomplete && !!activeSuggestionId;
  const studioCommands = useStudioCommands({ config, handle, saving });

  // Track studio_opened on mount (once)
  useEffect(() => {
    if (!hasTrackedOpen.current) {
      trackEvent("studio_opened");
      hasTrackedOpen.current = true;
    }
  }, []);

  const handleConfigChange = useCallback(
    (newConfig: BadgeConfig) => {
      let changed = false;
      for (const key of Object.keys(newConfig) as (keyof BadgeConfig)[]) {
        if (newConfig[key] !== config[key]) {
          changed = true;
          trackEvent("effect_changed", {
            category: key,
            from: config[key],
            to: newConfig[key],
          });
        }
      }
      if (changed) {
        configRevisionRef.current += 1;
        if (!saveInFlightRef.current) {
          setSaveState({ status: "dirty" });
        }
      }
      setConfig(newConfig);
    },
    [config],
  );

  const handleSave = useCallback(async () => {
    if (saveInFlightRef.current) {
      setLines((prev) => [
        ...prev,
        makeLine("warning", translation(t, "studio.save.alreadySaving")),
      ]);
      return;
    }

    saveInFlightRef.current = true;
    const revision = configRevisionRef.current;
    const configToSave = config;
    setSaveState({ status: "saving" });
    try {
      const res = await fetch("/api/studio/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(configToSave),
      });
      if (res.ok) {
        trackEvent("config_saved", { config: configToSave });
        const hasNewerChanges = configRevisionRef.current !== revision;
        setSaveState({ status: hasNewerChanges ? "dirty" : "saved" });
        setLines((prev) => [
          ...prev,
          makeLine(
            hasNewerChanges ? "warning" : "success",
            translation(
              t,
              hasNewerChanges
                ? "studio.save.changedDuringSave"
                : "studio.save.success",
            ),
          ),
        ]);
      } else {
        const message = getSaveErrorMessage(res, t);
        setSaveState({ status: "error", message });
        setLines((prev) => [...prev, makeLine("error", message)]);
      }
    } catch {
      const message = translation(t, "studio.save.transportError");
      setSaveState({ status: "error", message });
      setLines((prev) => [...prev, makeLine("error", message)]);
    } finally {
      saveInFlightRef.current = false;
    }
  }, [config, t]);

  const handleReset = useCallback(() => {
    const changed = Object.keys(DEFAULT_BADGE_CONFIG).some((key) => {
      const configKey = key as keyof BadgeConfig;
      return config[configKey] !== DEFAULT_BADGE_CONFIG[configKey];
    });
    setConfig({ ...DEFAULT_BADGE_CONFIG });
    if (changed) {
      configRevisionRef.current += 1;
      if (!saveInFlightRef.current) {
        setSaveState({ status: "dirty" });
      }
    }
    trackEvent("effect_changed", { category: "reset", to: "default" });
  }, [config]);

  const handleAction = useCallback(
    (action: StudioCommandAction) => {
      switch (action.type) {
        case "set": {
          handleConfigChange({ ...config, [action.category]: action.value });
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
          void handleSave();
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
    setActiveSuggestionId(undefined);
  }, []);

  const handleAutocompleteSelect = useCallback(
    (command: string) => {
      setShowAutocomplete(false);
      setActiveSuggestionId(undefined);
      setPartial("");
      handleSubmit(command);
    },
    [handleSubmit],
  );

  const handleAutocompleteFill = useCallback((command: string) => {
    setShowAutocomplete(false);
    setActiveSuggestionId(undefined);
    const input = document.querySelector<HTMLInputElement>(
      `#${TERMINAL_COMMAND_INPUT_ID}`,
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
            `#${TERMINAL_COMMAND_INPUT_ID}`,
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
      <h1 className="sr-only">{t("studio.title") as string}</h1>
      {/* Preview pane (left, sticky) */}
      <div className="flex items-start justify-center lg:items-center px-3 sm:px-4 py-4 sm:py-6 lg:px-8 lg:py-0 border-b lg:border-b-0 lg:border-r border-stroke" aria-busy={saving}>
        <div className="w-full max-w-xl sticky top-20">
          <BadgePreviewCard
            key={previewKey}
            config={config}
            stats={stats}
            impact={impact}
            interactive={isClient && !reducedMotion}
            verification={verification}
          />

          <div
            className={`mt-4 text-center text-sm font-heading ${
              saveState.status === "error"
                ? "text-terminal-red"
                : saveState.status === "saving"
                  ? "text-amber animate-terminal-fade-in"
                  : "text-text-secondary"
            }`}
            role={saveState.status === "error" ? "alert" : "status"}
            data-save-state={saveState.status}
          >
            {saveState.status === "error"
              ? saveState.message
              : (t(`studio.save.${saveState.status}`) as string)}
          </div>

          {reducedMotion && (
            <div className="mt-4 text-center text-xs text-text-secondary">
              {t("studio.reducedMotion") as string}
            </div>
          )}
        </div>
      </div>

      {/* Terminal pane (right) */}
      <div className="flex flex-col min-h-[50vh] lg:h-[calc(100vh-3.5rem)] bg-bg">
        {/* Quick Controls toggle */}
        <QuickControls
          config={config}
          onCommand={handleQuickCommand}
          visible={showQuickControls}
          onToggle={() => setShowQuickControls((v) => !v)}
          saveDisabled={saving}
        />

        {/* Terminal output */}
        <TerminalOutput lines={localizedLines} />

        {/* Terminal input + autocomplete */}
        <div className="relative mt-auto">
          <AutocompleteDropdown
            commands={studioCommands}
            partial={partial}
            onSelect={handleAutocompleteSelect}
            onFill={handleAutocompleteFill}
            onDismiss={handleAutocompleteDismiss}
            visible={showAutocomplete}
            listboxId={TERMINAL_COMMAND_LISTBOX_ID}
            onActiveDescendantChange={setActiveSuggestionId}
          />
          <TerminalInput
            onSubmit={handleSubmit}
            onPartialChange={handlePartialChange}
            history={history}
            prompt="studio"
            suggestionsVisible={autocompleteExpanded}
            suggestionsListboxId={TERMINAL_COMMAND_LISTBOX_ID}
            activeSuggestionId={activeSuggestionId}
          />
        </div>
      </div>
    </div>
  );
}
