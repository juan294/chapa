"use client";

import {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import type {
  BadgeConfig,
  CraftResult,
  StatsData,
  ImpactV6Result,
} from "@chapa/shared";
import { trackEvent } from "@/lib/analytics/posthog";
import { STUDIO_PRESETS } from "@/lib/effects/defaults";
import { useIsClient } from "@/hooks/useIsClient";
import { BadgePreviewCard } from "./BadgePreviewCard";
import type { PreviewVerification } from "./PreviewFooter";
import { QuickControls } from "./QuickControls";
import { STUDIO_CATEGORIES } from "./studio-options";
import {
  useStudioCommands,
  type StudioCommandAction,
} from "./useStudioCommands";
import { TerminalOutput } from "@/components/terminal/TerminalOutput";
import { TerminalInput } from "@/components/terminal/TerminalInput";
import { AutocompleteDropdown } from "@/components/terminal/AutocompleteDropdown";
import {
  CATEGORY_KEY_TO_ALIAS,
  executeCommand,
  makeLine,
  type CommandResult,
  type OutputLine,
} from "@/components/terminal/command-registry";
import { useClientFeatureFlags } from "@/components/ClientFeatureFlagsProvider";
import { useKeyboardShortcutsContext } from "@/components/KeyboardShortcutsListener";
import { useTranslation, type LanguageContextValue } from "@/lib/i18n";
import { interpolate } from "@/lib/i18n/interpolate";
import {
  TERMINAL_COMMAND_INPUT_ID,
  TERMINAL_COMMAND_LISTBOX_ID,
} from "@/lib/keyboard/shortcuts";
import { useModelContextTools } from "@/lib/webmcp/use-model-context-tools";
import { useStudioWebMcpTools } from "./useStudioWebMcpTools";
import { getStudioCommandConfig } from "./studio-command-config";

export interface StudioClientProps {
  initialConfig: BadgeConfig;
  stats: StatsData;
  impact: ImpactV6Result;
  craftResult?: CraftResult | null;
  handle?: string;
  verification?: PreviewVerification | null;
  demo?: boolean;
}

type SaveState =
  | { status: "dirty" | "saving" | "saved" }
  | { status: "error"; message: string };

type Translate = LanguageContextValue["t"];

const TERMINAL_WELCOME_LINE_ID = "studio-terminal-welcome";
const TERMINAL_HINT_LINE_ID = "studio-terminal-hint";

// UX-M1 (#1173): Quick Controls now defaults to expanded (see showQuickControls
// below) but a user's explicit collapse choice is still respected across visits.
const QUICK_CONTROLS_STORAGE_KEY = "chapa:studio:quickControlsVisible";

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
  craftResult = null,
  handle = "",
  verification = null,
  demo = false,
}: StudioClientProps) {
  const { t } = useTranslation();
  const { webmcpEnabled } = useClientFeatureFlags();
  const [config, setConfig] = useState<BadgeConfig>(initialConfig);
  const configRef = useRef(config);
  const [saveState, setSaveState] = useState<SaveState>({ status: "saved" });
  const [pendingAgentSave, setPendingAgentSave] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  // UX-M1 (#1173): defaults to expanded — Quick Controls was the only
  // pointer affordance for the 9 customization categories, and starting
  // collapsed behind a low-contrast toggle meant it was easy to miss
  // entirely. Starting `true` here matches the server-rendered value too
  // (no localStorage on the server), so there's no hydration mismatch; the
  // effect below only ever narrows it to a previously-chosen `false`.
  const [showQuickControls, setShowQuickControlsState] = useState(true);
  const setShowQuickControls = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      setShowQuickControlsState((prev) => {
        const value = typeof next === "function" ? next(prev) : next;
        try {
          window.localStorage.setItem(QUICK_CONTROLS_STORAGE_KEY, String(value));
        } catch {
          // localStorage unavailable (private browsing, etc.) — visibility
          // still works for this session, it just won't persist.
        }
        return value;
      });
    },
    [],
  );
  // Hydrate a previously-chosen collapse state after mount only — reading
  // localStorage during the initial render would disagree with the
  // server-rendered `true` default and trigger a hydration mismatch. This is
  // the intended client-only hydration of a browser-derived value (same
  // pattern as UserMenu.tsx's insights-cooldown read, #892); the lint rule
  // below is a false positive for that case.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(QUICK_CONTROLS_STORAGE_KEY);
      if (stored === "true" || stored === "false") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setShowQuickControlsState(stored === "true");
      }
    } catch {
      // localStorage unavailable — keep the default.
    }
  }, []);
  const isClient = useIsClient();
  const reducedMotion = useReducedMotion();
  const hasTrackedOpen = useRef(false);
  const configRevisionRef = useRef(0);
  const saveInFlightRef = useRef(false);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

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
  const trackStudioEvent = useCallback(
    (event: string, properties?: Record<string, unknown>) => {
      if (demo) {
        trackEvent(event, { ...properties, demo: true });
      } else if (properties) {
        trackEvent(event, properties);
      } else {
        trackEvent(event);
      }
    },
    [demo],
  );

  // Track studio_opened on mount (once)
  useEffect(() => {
    if (!hasTrackedOpen.current) {
      trackStudioEvent("studio_opened");
      hasTrackedOpen.current = true;
    }
  }, [trackStudioEvent]);

  // FE-M3 (#1173): warn before an unsaved-changes loss. Registered/removed on
  // the saveState.status transition (not just on mount) so the listener only
  // exists while there's actually something to lose. Demo mode never
  // persists by design (see handleSave above) — the guard must not fire
  // there, or the judge-demo flow gets a spurious "leave site?" prompt on
  // every exit even though there was never anything to save.
  useEffect(() => {
    if (demo || saveState.status !== "dirty") return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [demo, saveState.status]);

  const handleConfigChange = useCallback(
    (newConfig: BadgeConfig) => {
      const currentConfig = configRef.current;
      let changed = false;
      for (const key of Object.keys(newConfig) as (keyof BadgeConfig)[]) {
        if (newConfig[key] !== currentConfig[key]) {
          changed = true;
          trackStudioEvent("effect_changed", {
            category: key,
            from: currentConfig[key],
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
      configRef.current = newConfig;
      setConfig(newConfig);
    },
    [trackStudioEvent],
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
    const configToSave = configRef.current;
    setSaveState({ status: "saving" });
    try {
      if (demo) {
        trackStudioEvent("config_saved", { config: configToSave });
        setSaveState({ status: "saved" });
        setLines((prev) => [
          ...prev,
          makeLine(
            "success",
            translation(t, "studio.save.demoNotPersisted"),
          ),
        ]);
        return;
      }

      const res = await fetch("/api/studio/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(configToSave),
      });
      if (res.ok) {
        trackStudioEvent("config_saved", { config: configToSave });
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
  }, [demo, t, trackStudioEvent]);

  const handleReset = useCallback(() => {
    const currentConfig = configRef.current;
    const resetConfig = getStudioCommandConfig(currentConfig, { type: "reset" });
    if (!resetConfig) return;
    const changed = Object.keys(resetConfig).some((key) => {
      const configKey = key as keyof BadgeConfig;
      return currentConfig[configKey] !== resetConfig[configKey];
    });
    configRef.current = resetConfig;
    setConfig(resetConfig);
    if (changed) {
      configRevisionRef.current += 1;
      if (!saveInFlightRef.current) {
        setSaveState({ status: "dirty" });
      }
    }
    trackStudioEvent("effect_changed", {
      category: "reset",
      to: "default",
    });
  }, [trackStudioEvent]);

  const handleAction = useCallback(
    (action: StudioCommandAction) => {
      switch (action.type) {
        case "set": {
          const nextConfig = getStudioCommandConfig(configRef.current, action);
          if (nextConfig) handleConfigChange(nextConfig);
          break;
        }
        case "preset": {
          const nextConfig = getStudioCommandConfig(configRef.current, action);
          if (nextConfig) {
            trackStudioEvent("preset_selected", { preset: action.name });
            handleConfigChange(nextConfig);
          }
          break;
        }
        case "save":
          setPendingAgentSave(false);
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
    [handleConfigChange, handleSave, handleReset, trackStudioEvent],
  );

  const handleSubmit = useCallback(
    (input: string): CommandResult<StudioCommandAction> => {
      const inputLine = makeLine("input", input);
      setHistory((h) => [...h, input]);
      setShowAutocomplete(false);
      setPartial("");

      const result = executeCommand(input, studioCommands);

      if (result.action?.type === "clear") {
        setLines([]);
        return result;
      }

      setLines((prev) => [...prev, inputLine, ...result.lines]);

      if (result.action) {
        handleAction(result.action);
      }
      return result;
    },
    [studioCommands, handleAction],
  );

  const handleAgentSaveProposal = useCallback(() => {
    setPendingAgentSave(true);
    setShowQuickControls(true);
    setLines((prev) => [
      ...prev,
      makeLine("system", translation(t, "studio.agentSave.proposed")),
    ]);
  }, [t, setShowQuickControls]);

  const handleAgentSaveConfirm = useCallback(() => {
    setPendingAgentSave(false);
    void handleSave();
  }, [handleSave]);

  const handleAgentSaveDismiss = useCallback(() => {
    setPendingAgentSave(false);
    setLines((prev) => [
      ...prev,
      makeLine("info", translation(t, "studio.agentSave.dismissed")),
    ]);
  }, [t]);

  const studioWebMcpTools = useStudioWebMcpTools({
    config,
    enabled: webmcpEnabled,
    stats,
    impact,
    craftResult,
    handle,
    saveStatus: saveState.status,
    runCommand: handleSubmit,
    proposeSave: handleAgentSaveProposal,
    getCurrentConfig: () => configRef.current,
  });
  useModelContextTools(studioWebMcpTools, webmcpEnabled);

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
          trackStudioEvent("preset_selected", { preset: preset.id });
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
  }, [
    registerPageShortcuts,
    config.background,
    handleConfigChange,
    trackStudioEvent,
    setShowQuickControls,
  ]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 min-h-[calc(100vh-3.5rem)]">
      <h1 className="sr-only">{t("studio.title") as string}</h1>
      {/* Preview pane (left, sticky) */}
      <div className="flex items-start justify-center lg:items-center px-3 sm:px-4 py-4 sm:py-6 lg:px-8 lg:py-0 border-b lg:border-b-0 lg:border-r border-stroke" aria-busy={saving}>
        <div className="w-full max-w-xl sticky top-20">
          {demo && (
            <div
              className="mb-3 text-center font-heading text-xs font-bold tracking-[0.2em] text-amber"
              data-testid="studio-demo-marker"
            >
              {t("studio.demoMarker") as string}
            </div>
          )}
          <BadgePreviewCard
            key={previewKey}
            config={config}
            stats={stats}
            impact={impact}
            interactive={isClient && !reducedMotion}
            verification={verification}
          />

          {/* #1216 — a status pill, not a centered line of text. The state is
              a property of the preview, so it reads as a label on it rather
              than as a sentence floating underneath. */}
          <div className="mt-4 flex justify-center">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-heading text-xs ${
                saveState.status === "error"
                  ? "border-terminal-red/40 bg-terminal-red/10 text-terminal-red"
                  : saveState.status === "saving"
                    ? "animate-terminal-fade-in border-amber/40 bg-amber/10 text-amber"
                    : saveState.status === "dirty"
                      ? "border-terminal-yellow/40 bg-terminal-yellow/10 text-terminal-yellow"
                      : "border-terminal-green/40 bg-terminal-green/10 text-terminal-green"
              }`}
              role={saveState.status === "error" ? "alert" : "status"}
              data-save-state={saveState.status}
            >
              {saveState.status === "error"
                ? saveState.message
                : (t(`studio.save.${saveState.status}`) as string)}
            </span>
          </div>

          {/* #1216 — the whole configuration in one line, so the effect of a
              /set or /preset is visible without opening nine categories. */}
          <div className="mt-4 rounded-lg border border-stroke bg-card px-3 py-2">
            <div className="font-heading text-[10px] tracking-wider text-terminal-dim">
              {t("studio.activeConfig") as string}
            </div>
            <dl
              data-testid="studio-active-config"
              className="mt-1.5 grid grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-x-4 gap-y-1"
            >
              {STUDIO_CATEGORIES.map((category) => (
                <div
                  key={category.key}
                  className="flex items-baseline justify-between gap-2 font-heading text-[11px]"
                >
                  <dt className="text-terminal-dim">
                    {CATEGORY_KEY_TO_ALIAS[category.key] ?? category.key}
                  </dt>
                  <dd className="truncate text-text-secondary">
                    {config[category.key]}
                  </dd>
                </div>
              ))}
            </dl>
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
        {/* Visible title + subhead (UX-M1, #1173) — the page's only prior
            accessible name was the sr-only <h1> above, so nothing on screen
            named the tool. The title text duplicates that h1 and is hidden
            from assistive tech to avoid a double announcement; the subhead
            is new descriptive copy and stays in the normal a11y tree. */}
        <div className="flex flex-col gap-0.5 border-b border-stroke px-3 py-2.5">
          <span
            aria-hidden="true"
            data-testid="studio-visible-title"
            className="font-heading text-sm font-semibold tracking-tight text-text-primary"
          >
            {t("studio.title") as string}
          </span>
          <span
            data-testid="studio-visible-subtitle"
            className="text-xs text-text-secondary"
          >
            {t("studio.subtitle") as string}
          </span>
        </div>

        {/* Quick Controls toggle */}
        <QuickControls
          config={config}
          onCommand={handleQuickCommand}
          visible={showQuickControls}
          onToggle={() => setShowQuickControls((v) => !v)}
          saveDisabled={saving}
          agentSaveProposal={
            pendingAgentSave
              ? {
                  onConfirm: handleAgentSaveConfirm,
                  onDismiss: handleAgentSaveDismiss,
                }
              : undefined
          }
        />

        {/* #1216 — the log is a bounded strip and the whole cluster sticks to
            the bottom of the column, so the primary input is never scrolled
            off-screen by a long session. */}
        <div className="sticky bottom-0 mt-auto border-t border-stroke bg-bg/95 backdrop-blur-sm">
        <div className="max-h-40 overflow-y-auto">
          <TerminalOutput lines={localizedLines} />
        </div>

        {/* Terminal input + autocomplete */}
        <div className="relative p-2">
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
    </div>
  );
}
