"use client";

import { useCallback, useState, useMemo, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { navigateInApp } from "@/lib/navigation";
import { AuthorTypewriter } from "@/components/AuthorTypewriter";
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
const EMPTY_COMMANDS: CommandDef[] = [];

export interface GlobalCommandBarProps {
  isAdmin?: boolean;
  skipShortcutsListener?: boolean;
  scopedCommands?: CommandDef[];
  onCustomAction?: (action: Extract<CommandAction, {type: "custom"}>) => Promise<OutputLine[] | undefined>;
}
const CHIP_COUNT = 6;

/**
 * Fixed bottom command bar with navigation commands + AuthorTypewriter pill.
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
  const terminalRef = useRef<TerminalInputHandle>(null);
  const [partial, setPartial] = useState("");
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [activeSuggestionId, setActiveSuggestionId] = useState<string>();
  const [outputLines, setOutputLines] = useState<OutputLine[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const outputRevision = useRef(0);
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
  const chipCommands = useMemo(() => commands.slice(0, CHIP_COUNT), [commands]);

  useEffect(() => {
    const fill = (event: Event) => {
      const value = (event as CustomEvent<{value?: unknown}>).detail?.value;
      if (typeof value === "string") terminalRef.current?.fill(value);
    };
    window.addEventListener("chapa:terminal-fill", fill);
    return () => window.removeEventListener("chapa:terminal-fill", fill);
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
          than opening as a full-screen palette. The chips make the commands
          discoverable without typing `/` first, which is what the palette
          overlay was there to do. */}
      {/* Reserve document space for the two-row dock, including on short pages. */}
      <div aria-hidden="true" className="h-32 shrink-0" />
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-forest-line bg-forest px-4 py-2.5 text-forest-text md:pr-64">
        <div className="hidden md:block absolute right-4 top-1/2 -translate-y-1/2 z-50">
          <AuthorTypewriter />
        </div>
        <div className="relative mx-auto max-w-4xl">
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
              <kbd
                aria-hidden="true"
                className="hidden shrink-0 rounded border border-forest-line px-1.5 py-0.5 font-heading text-[11px] text-forest-dim sm:block"
              >
                /
              </kbd>
            }
          />
          {chipCommands.length > 0 && (
            <div
              className="mt-2 flex gap-2 overflow-x-auto pb-0.5"
              aria-label={t("aria.commandSuggestions") as string}
            >
              {chipCommands.map((command) => (
                <button
                  key={command.name}
                  type="button"
                  onClick={() => handleAutocompleteFill(command.name)}
                  title={command.description}
                  className="min-h-11 shrink-0 rounded-[3px] border border-forest-line px-3 py-1.5 font-heading text-xs whitespace-nowrap text-forest-dim transition-colors hover:border-forest-text hover:text-forest-text focus-visible:outline-forest-text!"
                >
                  {command.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </TerminalPresentation>
  );
}
