"use client";

import { useCallback, useState, useMemo, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { usePathname, useRouter } from "next/navigation";
import { navigateInApp } from "@/lib/navigation";
import { KeyboardShortcutsListener } from "@/components/KeyboardShortcutsListener";
import { TerminalInput } from "@/components/terminal/TerminalInput";
import type { TerminalInputHandle } from "@/components/terminal/TerminalInput";
import { TerminalPresentation } from "@/components/terminal/TerminalPresentation";
import { TerminalOutput } from "@/components/terminal/TerminalOutput";
import { AutocompleteDropdown } from "@/components/terminal/AutocompleteDropdown";
import {
  executeCommand,
  createNavigationCommands,
  makeLine,
} from "@/components/terminal/command-registry";
import type { CommandDef, CommandAction, OutputLine } from "@/components/terminal/command-registry";
import { useClientFeatureFlags } from "@/components/ClientFeatureFlagsProvider";
import { useTranslation } from "@/lib/i18n";
import { tObject } from "@/lib/i18n/typed-accessors";
import {
  TERMINAL_COMMAND_LISTBOX_ID,
} from "@/lib/keyboard/shortcuts";

const HISTORY_LIMIT = 50;
const SCROLL_HEIGHT_ROUNDING_PX = 1;
const HINT_COUNT = 5;
const EMPTY_COMMANDS: CommandDef[] = [];

export interface GlobalCommandBarProps {
  isAdmin?: boolean;
  skipShortcutsListener?: boolean;
  scopedCommands?: CommandDef[];
  onCustomAction?: (action: Extract<CommandAction, {type: "custom"}>) => Promise<OutputLine[] | undefined>;
}

/**
 * Fixed bottom command bar with navigation commands.
 * Use on any page that doesn't have its own terminal interface.
 */
export function GlobalCommandBar({
  isAdmin,
  skipShortcutsListener,
  scopedCommands = EMPTY_COMMANDS,
  onCustomAction,
}: GlobalCommandBarProps = {}) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { studioEnabled } = useClientFeatureFlags();
  const { t } = useTranslation();
  const pathname = usePathname();
  const terminalRef = useRef<TerminalInputHandle>(null);
  const [partial, setPartial] = useState("");
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [activeSuggestionId, setActiveSuggestionId] = useState<string>();
  const [outputLines, setOutputLines] = useState<OutputLine[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const outputRevision = useRef(0);
  const dockRef = useRef<HTMLDivElement>(null);
  const [dockHeight, setDockHeight] = useState<number>();
  const autocompleteExpanded = showAutocomplete && !!activeSuggestionId;

  const descriptions = useMemo(() => tObject<Record<string, string>>(t, "commands.descriptions"), [t]);

  const messages = useMemo(() => tObject<Record<string, string>>(t, "commands.messages"), [t]);
  const commands = useMemo(() => {
    const themeCommand: CommandDef = {
      name: "/theme", description: descriptions.theme ?? "Read or change theme", usage: "/theme [light|dark|system]",
      execute: args => {
        const choice = args[0];
        if (args.length > 1 || (choice && !["light", "dark", "system"].includes(choice))) return {lines: [makeLine("error", `${messages.usage} /theme [light|dark|system]`)]};
        if (choice) setTheme(choice);
        return {lines: [makeLine("info", (messages.themeChoice ?? "Theme: {theme}").replace("{theme}", choice ?? theme ?? "system"))]};
      },
    };
    return createNavigationCommands({isAdmin, studioEnabled, descriptions, messages, additionalCommands: [themeCommand, ...scopedCommands]});
  }, [isAdmin, studioEnabled, descriptions, messages, scopedCommands, theme, setTheme]);

  const hints = useMemo(
    () => commands.slice(0, HINT_COUNT).map(command => command.usage ?? command.name),
    [commands],
  );
  // Literal fallbacks match the command registry's own `d.x ?? "..."` style:
  // a dock label is chrome, and an empty one reads as a rendering bug.
  const dock = useMemo(() => {
    const strings = tObject<Record<string, string>>(t, "terminalInput.dock");
    return {
      navigate: strings.navigate ?? "navigate",
      complete: strings.complete ?? "tab complete",
      dismiss: strings.dismiss ?? "esc dismiss",
      enter: strings.enter ?? "enter",
      anywhere: strings.anywhere ?? "press / anywhere",
    };
  }, [t]);
  const cwd = pathname === "/" ? "~/home" : `~${pathname}`;

  useEffect(() => {
    const fill = (event: Event) => {
      const value = (event as CustomEvent<{value?: unknown}>).detail?.value;
      if (typeof value === "string") terminalRef.current?.fill(value);
    };
    window.addEventListener("chapa:terminal-fill", fill);
    return () => window.removeEventListener("chapa:terminal-fill", fill);
  }, []);

  // LE-4-3 — the spacer must reserve what the dock actually covers. Two
  // things a fixed `h-28` cannot know: the dock's border box follows font
  // metrics plus its 1px top border, and the document's height is rounded to
  // an integer scroll height, so up to one sub-pixel of the page's bottom
  // edge is unreachable by scrolling. That pixel is taken from the spacer,
  // the last element in flow, and the footer above it ends under the dock
  // (0.375px on a Pixel 5). Measure the dock, round up, and reserve one more
  // pixel for the rounding; `h-28` stays as the floor until measured.
  useEffect(() => {
    const dock = dockRef.current;
    if (!dock || typeof ResizeObserver === "undefined") return;
    const measure = () => setDockHeight(Math.ceil(dock.getBoundingClientRect().height) + SCROLL_HEIGHT_ROUNDING_PX);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(dock);
    return () => observer.disconnect();
  }, []);

  const handleSubmit = useCallback(
    (input: string) => {
      setShowAutocomplete(false);
      setPartial("");

      const revision = ++outputRevision.current;
      setHistory(previous => [...previous, input].slice(-HISTORY_LIMIT));
      const result = executeCommand(input, commands, messages);
      const action = result.action;

      // Show output lines for any command that produces them
      setOutputLines(result.lines);

      if (action?.type === "navigate") {
        if (action.path === "/api/auth/login") {
          window.location.href = action.path;
        } else {
          navigateInApp(action.path, (href) => router.push(href));
        }
      } else if (action?.type === "clear") {
        terminalRef.current?.clear();
        setOutputLines([]);
      } else if (action?.type === "custom") {
        if (onCustomAction && action.event.startsWith("chapa:landing-")) {
          void onCustomAction(action).then(lines => {
            if (lines && outputRevision.current === revision) setOutputLines(lines);
          });
        } else {
          window.dispatchEvent(new CustomEvent(action.event, action.detail ? {detail: action.detail} : undefined));
          setOutputLines([]);
        }
      }
    },
    [commands, router, messages, onCustomAction],
  );

  const handlePartialChange = useCallback((val: string, suggest = true) => {
    outputRevision.current++;
    setPartial(val);
    setShowAutocomplete(suggest && val.startsWith("/") && val.length > 0);
    // Clear transient output on next keystroke
    setOutputLines([]);
  }, []);

  const handleAutocompleteDismiss = useCallback(() => {
    setShowAutocomplete(false);
  }, []);

  const handleAutocompleteSelect = useCallback(
    (command: string) => {
      setShowAutocomplete(false);
      setPartial("");
      handleSubmit(command);
      // Autocomplete's capture-phase keydown calls stopPropagation on Enter,
      // so TerminalInput's own handler never fires and setValue("") never runs.
      // Clear the input imperatively via ref. (#283)
      terminalRef.current?.clear();
    },
    [handleSubmit],
  );

  const handleAutocompleteFill = useCallback((command: string) => {
    setShowAutocomplete(false);
    terminalRef.current?.fill(command + " ");
  }, []);

  return (
    <TerminalPresentation value="ink">
      {!skipShortcutsListener && <KeyboardShortcutsListener />}
      {/* #1214 — the bar stays inline at the bottom of the viewport rather
          than opening as a full-screen palette. Typing `/` opens the
          autocomplete, which is how commands are discovered here. */}
      {/* Reserve document space for the three-row dock, including on short pages. */}
      <div aria-hidden="true" className="h-28 shrink-0" style={dockHeight ? {height: `${dockHeight}px`} : undefined} />
      <div ref={dockRef} className="fixed bottom-0 left-0 right-0 z-40 border-t border-forest-line bg-forest px-4 py-2.5 text-forest-text">
        <div className="relative mx-auto max-w-4xl">
          {/* Terminal chrome: where you are on the left, the keys that work on
              the right. Both are labels, not controls. */}
          <div aria-hidden="true" className="mb-1.5 flex items-center justify-between gap-4 font-heading text-[11px] text-forest-dim">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-1.5 w-1.5 shrink-0 bg-forest-accent" />
              chapa
              <span className="ml-2 truncate text-forest-text">{cwd}</span>
            </span>
            <span className="hidden shrink-0 gap-5 sm:flex">
              <span>↑↓ {dock.navigate}</span>
              <span>{dock.complete}</span>
              <span>{dock.dismiss}</span>
            </span>
          </div>
          {outputLines.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-1 max-h-48 sm:max-h-64 overflow-y-auto rounded-[3px] border border-forest-line bg-forest-card shadow-card">
              <TerminalOutput lines={outputLines} />
            </div>
          )}
          <AutocompleteDropdown
            commands={commands}
            partial={partial}
            onSelect={handleAutocompleteSelect}
            onFill={handleAutocompleteFill}
            onDismiss={handleAutocompleteDismiss}
            visible={showAutocomplete}
            listboxId={TERMINAL_COMMAND_LISTBOX_ID}
            onActiveDescendantChange={setActiveSuggestionId}
          />
          <TerminalInput
            ref={terminalRef}
            onSubmit={handleSubmit}
            onPartialChange={handlePartialChange}
              onHistoryChange={value => handlePartialChange(value, false)}
            prompt="chapa"
            history={history}
            autoFocus={!!isAdmin}
            suggestionsVisible={autocompleteExpanded}
            suggestionsListboxId={TERMINAL_COMMAND_LISTBOX_ID}
            activeSuggestionId={activeSuggestionId}
            trailing={
              <span
                aria-hidden="true"
                className="hidden shrink-0 items-center gap-2.5 self-stretch border-l border-forest-line pl-3 font-heading text-[11px] text-forest-dim sm:flex"
              >
                <span>{dock.enter} ↵</span>
                <kbd className="rounded border border-forest-line px-1.5 py-0.5">/</kbd>
              </span>
            }
          />
          {/* Command hints, not buttons: the dock is for typing. */}
          <div aria-hidden="true" className="mt-1.5 flex items-center justify-between gap-4 font-heading text-[11px] text-forest-dim">
            <span className="flex min-w-0 gap-5 overflow-x-auto whitespace-nowrap">
              {hints.map(hint => <span key={hint}>{hint}</span>)}
            </span>
            <span className="hidden shrink-0 sm:inline">{dock.anywhere}</span>
          </div>
        </div>
      </div>
    </TerminalPresentation>
  );
}
