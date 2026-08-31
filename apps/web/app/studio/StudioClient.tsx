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
import { BadgePreviewCard } from "./BadgePreviewCard";
import type { PreviewVerification } from "./BadgePreviewCard";
import { QuickControls } from "./QuickControls";
import {
  formatConfigCommands,
  formatConfigSummary,
} from "./studio-config-string";
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
  /**
   * Badge avatar, resolved server-side in `page.tsx` exactly as the badge
   * route resolves it (#1191 step 6). The preview renders the real badge SVG,
   * and that SVG draws the owner's avatar; without this it falls back to the
   * Chapa shield placeholder and stops matching the shipped badge.
   */
  avatarDataUri?: string;
  demo?: boolean;
}

type SaveState =
  | { status: "dirty" | "saving" | "saved" }
  | { status: "error"; message: string };

type Translate = LanguageContextValue["t"];

/**
 * Stage zoom (#1241). Presentation only — it never reaches the saved config.
 * The 50%/100% frames are flex children of a horizontally scrolling viewport,
 * so they need `shrink-0`: without it flexbox quietly shrinks them back to the
 * container width and the zoom appears to do nothing.
 */
const ZOOM_OPTIONS = [
  { id: "fit", labelKey: "studio.zoom.fit", frameClass: "w-[min(720px,100%)]" },
  {
    id: "half",
    labelKey: "studio.zoom.half",
    frameClass: "w-[600px] max-w-none shrink-0",
  },
  {
    id: "full",
    labelKey: "studio.zoom.full",
    frameClass: "w-[1200px] max-w-none shrink-0",
  },
] as const;

type StageZoom = (typeof ZOOM_OPTIONS)[number]["id"];

const COPY_CONFIRMATION_MS = 1_600;

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
  avatarDataUri,
  demo = false,
}: StudioClientProps) {
  const { t } = useTranslation();
  const { webmcpEnabled } = useClientFeatureFlags();
  const [config, setConfig] = useState<BadgeConfig>(initialConfig);
  const configRef = useRef(config);
  const [saveState, setSaveState] = useState<SaveState>({ status: "saved" });
  const [pendingAgentSave, setPendingAgentSave] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [zoom, setZoom] = useState<StageZoom>("fit");
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  /**
   * #1241 — copies the configuration as replayable `/set` lines. A rejected or
   * missing clipboard has to say so in the log: a copy control that silently
   * does nothing is worse than no copy control.
   */
  const handleCopyConfig = useCallback(async () => {
    const commands = formatConfigCommands(configRef.current);
    try {
      await navigator.clipboard.writeText(commands);
    } catch {
      setLines((prev) => [
        ...prev,
        makeLine("error", translation(t, "studio.copyConfig.errorLine")),
      ]);
      return;
    }
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(
      () => setCopied(false),
      COPY_CONFIRMATION_MS,
    );
    setLines((prev) => [
      ...prev,
      makeLine("success", translation(t, "studio.copyConfig.logLine")),
    ]);
  }, [t]);

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
    setLines((prev) => [
      ...prev,
      makeLine("system", translation(t, "studio.agentSave.proposed")),
    ]);
  }, [t]);

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

  const configSummary = useMemo(() => formatConfigSummary(config), [config]);
  const zoomFrameClass =
    ZOOM_OPTIONS.find((option) => option.id === zoom)?.frameClass ??
    ZOOM_OPTIONS[0]!.frameClass;

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col">
      <h1 className="sr-only">{t("studio.title") as string}</h1>

      {/* #1241 — the stage owns the full width. The badge is a fixed 1200x630
          artifact, so a 50% column could never let it grow; it only left the
          preview floating in an empty canvas with the controls squeezed
          beside it. */}
      <section
        data-testid="studio-stage"
        aria-busy={saving}
        className="@container border-b border-stroke px-3 py-4 sm:px-6 sm:py-6"
      >
        <h2 className="sr-only">{t("studio.stage.title") as string}</h2>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-heading text-sm whitespace-nowrap text-text-primary">
              <span className="select-none text-amber">%</span>{" "}
              {t("studio.stage.command") as string}
            </span>
            {/* The section-header rule keeps meta on one line, but this meta
                is longer than a 390px viewport in Spanish and pushed the whole
                page into horizontal scroll. It stays unbroken once the stage
                has room for it. */}
            <span className="font-heading text-xs text-terminal-dim @md:whitespace-nowrap">
              {t("studio.stage.meta") as string}
            </span>
            {demo && (
              <span
                className="font-heading text-xs font-bold tracking-[0.2em] text-amber"
                data-testid="studio-demo-marker"
              >
                {t("studio.demoMarker") as string}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Presentation only — zoom never reaches the saved config. */}
            <div
              role="group"
              aria-label={t("studio.zoom.groupLabel") as string}
              className="inline-flex gap-0.5 rounded-lg border border-stroke-strong bg-bg p-0.5"
            >
              {ZOOM_OPTIONS.map((option) => {
                const selected = option.id === zoom;
                return (
                  <button
                    key={option.id}
                    type="button"
                    data-testid={`studio-zoom-${option.id}`}
                    aria-pressed={selected}
                    onClick={() => setZoom(option.id)}
                    className={`min-h-[36px] rounded-md px-3 font-heading text-[11.5px] transition-colors ${
                      selected
                        ? "bg-amber/10 font-bold text-text-primary"
                        : "text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    {t(option.labelKey) as string}
                  </button>
                );
              })}
            </div>

            <span
              className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 font-heading text-xs ${
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
        </div>

        {/* The badge is server-rendered and always dark, so its stage is one of
            the fixed-ground surfaces: forest tokens, not theme-aware ones. */}
        <div className="bg-grid-forest flex flex-col items-center gap-4 rounded-2xl border border-forest-line bg-forest p-4 sm:p-6">
          <div
            data-testid="studio-stage-viewport"
            className="flex max-w-full overflow-x-auto [justify-content:safe_center]"
          >
            <div
              data-testid="studio-badge-frame"
              className={zoomFrameClass}
            >
              <BadgePreviewCard
                key={previewKey}
                config={config}
                stats={stats}
                impact={impact}
                verification={verification}
                avatarDataUri={avatarDataUri}
                demoMode={demo}
              />
            </div>
          </div>

          {/* #1241 — one line replaces the ACTIVE CONFIG table, which repeated
              what Quick Controls already shows. `/copy config` turns it into
              input: one `/set` per category, replayable at the prompt. */}
          <div className="flex max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-2">
            <span className="sr-only">
              {t("studio.copyConfig.summaryLabel") as string}
            </span>
            <span
              data-testid="studio-config-summary"
              className="text-center font-heading text-[11px] leading-relaxed text-forest-dim [overflow-wrap:anywhere]"
            >
              {configSummary}
            </span>
            <button
              type="button"
              data-testid="studio-copy-config"
              onClick={() => void handleCopyConfig()}
              className="min-h-[36px] rounded-lg border border-forest-line px-3 font-heading text-[11px] whitespace-nowrap text-forest-dim transition-colors hover:border-forest-text/40 hover:text-forest-text"
            >
              {copied
                ? `✓ ${t("studio.copyConfig.copied") as string}`
                : (t("studio.copyConfig.label") as string)}
            </button>
          </div>
        </div>

        {reducedMotion && (
          <p className="mt-3 text-center text-xs text-text-secondary">
            {t("studio.reducedMotion") as string}
          </p>
        )}
      </section>

      {/* #1241 — the tools band splits on its own width, not a viewport
          breakpoint, so the terminal sits beside the controls it acts on
          instead of being stranded at the bottom of the page. */}
      <div
        data-testid="studio-tools"
        className="grid flex-1 grid-cols-[repeat(auto-fit,minmax(min(100%,460px),1fr))] items-stretch"
      >
        <div className="@container flex min-w-0 flex-col border-r border-b border-stroke">
          {/* The page's only accessible name is the sr-only <h1> above; this
              repeats it visually and is hidden from assistive tech to avoid a
              double announcement. The subhead is new descriptive copy. */}
          <div className="flex flex-col gap-1 border-b border-stroke px-4 py-3">
            <span
              aria-hidden="true"
              data-testid="studio-visible-title"
              className="font-heading text-base font-bold tracking-tight text-text-primary"
            >
              {t("studio.title") as string}
            </span>
            <p
              data-testid="studio-visible-subtitle"
              className="text-sm leading-relaxed text-pretty text-text-secondary"
            >
              {t("studio.subtitle") as string}
            </p>
          </div>

          <QuickControls
            config={config}
            onCommand={handleQuickCommand}
            visible={showQuickControls}
            onToggle={() => setShowQuickControls((v) => !v)}
          />
        </div>

        <div
          data-testid="studio-session"
          className="@container flex min-w-0 flex-col border-b border-stroke bg-card"
        >
          <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-1">
            <span className="font-heading text-[10px] tracking-[0.14em] text-terminal-dim">
              {t("studio.session") as string}
            </span>
            <button
              type="button"
              data-testid="studio-clear-session"
              onClick={() => handleQuickCommand("/clear")}
              className="min-h-[36px] rounded-lg border border-stroke px-2.5 font-heading text-[11px] text-text-secondary transition-colors hover:border-amber/30 hover:text-text-primary"
            >
              {t("studio.clearSession") as string}
            </button>
          </div>

          <div className="min-h-36 flex-1 overflow-y-auto">
            <TerminalOutput lines={localizedLines} />
          </div>

          <div
            data-testid="studio-prompt-row"
            className="relative mt-auto border-t border-stroke p-2"
          >
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

          {/* #1241 — the save actions moved out of the collapsible Quick
              Controls panel: collapsing the controls used to take /save with
              it. They belong beside the prompt that runs the same commands. */}
          <div className="flex gap-2 px-2 pb-2">
            <button
              type="button"
              data-testid="studio-save"
              onClick={() => handleQuickCommand("/save")}
              disabled={saving}
              className="min-h-[46px] flex-1 rounded-lg bg-amber-dark font-heading text-sm font-bold text-white transition-colors hover:bg-amber disabled:cursor-not-allowed disabled:opacity-50"
            >
              /save
            </button>
            <button
              type="button"
              data-testid="studio-reset"
              onClick={() => handleQuickCommand("/reset")}
              className="min-h-[46px] rounded-lg border border-stroke px-4 font-heading text-sm text-text-secondary transition-colors hover:border-amber/30 hover:text-text-primary"
            >
              /reset
            </button>
          </div>

          {pendingAgentSave && (
            <div
              className="border-t border-amber/20 bg-amber/[0.04] px-4 py-3"
              role="group"
              aria-label={t("studio.agentSave.prompt") as string}
            >
              <p className="mb-2 text-xs text-text-secondary">
                {t("studio.agentSave.prompt") as string}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  data-testid="agent-save-confirm"
                  onClick={handleAgentSaveConfirm}
                  disabled={saving}
                  className="min-h-[44px] flex-1 rounded-lg bg-amber-dark px-3 font-heading text-xs font-bold text-white transition-colors hover:bg-amber disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t("studio.agentSave.confirm") as string}
                </button>
                <button
                  type="button"
                  data-testid="agent-save-dismiss"
                  onClick={handleAgentSaveDismiss}
                  className="min-h-[44px] rounded-lg border border-stroke px-3 font-heading text-xs text-text-secondary transition-colors hover:border-amber/30 hover:text-text-primary"
                >
                  {t("studio.agentSave.dismiss") as string}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
