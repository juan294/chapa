"use client";

import { useCallback, useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AuthorTypewriter } from "@/components/AuthorTypewriter";
import { KeyboardShortcutsListener } from "@/components/KeyboardShortcutsListener";
import { TerminalInput } from "@/components/terminal/TerminalInput";
import type { TerminalInputHandle } from "@/components/terminal/TerminalInput";
import { TerminalOutput } from "@/components/terminal/TerminalOutput";
import { AutocompleteDropdown } from "@/components/terminal/AutocompleteDropdown";
import {
  executeCommand,
  createNavigationCommands,
} from "@/components/terminal/command-registry";
import type { OutputLine } from "@/components/terminal/command-registry";
import { useClientFeatureFlags } from "@/components/ClientFeatureFlagsProvider";
import { useTranslation } from "@/lib/i18n";
import { tObject } from "@/lib/i18n/typed-accessors";
import {
  TERMINAL_COMMAND_INPUT_ID,
  TERMINAL_COMMAND_LISTBOX_ID,
} from "@/lib/keyboard/shortcuts";

const OUTPUT_TIMEOUT_MS = 5000;
const CHIP_COUNT = 6;

/**
 * Fixed bottom command bar with navigation commands + AuthorTypewriter pill.
 * Use on any page that doesn't have its own terminal interface.
 */
export function GlobalCommandBar({
  isAdmin,
  skipShortcutsListener,
}: {
  isAdmin?: boolean;
  /**
   * Skip mounting an internal `KeyboardShortcutsListener` — set this when
   * the caller has already mounted one as a sibling (e.g. `CommandBarHint`,
   * #1068). Mounting it twice would publish the module store twice, and the
   * second instance's cleanup on unmount would kill the survivor's
   * registrations.
   */
  skipShortcutsListener?: boolean;
} = {}) {
  const router = useRouter();
  const { studioEnabled } = useClientFeatureFlags();
  const { t } = useTranslation();
  const terminalRef = useRef<TerminalInputHandle>(null);
  const [partial, setPartial] = useState("");
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [activeSuggestionId, setActiveSuggestionId] = useState<string>();
  const [outputLines, setOutputLines] = useState<OutputLine[]>([]);
  const outputTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autocompleteExpanded = showAutocomplete && !!activeSuggestionId;

  const descriptions = useMemo(() => {
    const d = tObject<Record<string, string>>(t, "commands.descriptions");
    return typeof d === "object" && d !== null && !Array.isArray(d) ? d : {};
  }, [t]);

  const commands = useMemo(
    () => createNavigationCommands({ isAdmin, studioEnabled, descriptions }),
    [isAdmin, studioEnabled, descriptions],
  );

  // The chips are a scrolling shortcut row, not the full registry — enough to
  // show what the bar can do without turning it into a menu.
  const chipCommands = useMemo(() => commands.slice(0, CHIP_COUNT), [commands]);

  // Auto-clear output after timeout
  useEffect(() => {
    if (outputLines.length === 0) return;
    outputTimerRef.current = setTimeout(() => {
      setOutputLines([]);
    }, OUTPUT_TIMEOUT_MS);
    return () => {
      if (outputTimerRef.current) clearTimeout(outputTimerRef.current);
    };
  }, [outputLines]);

  const handleSubmit = useCallback(
    (input: string) => {
      setShowAutocomplete(false);
      setPartial("");

      const result = executeCommand(input, commands);
      const action = result.action;

      // Show output lines for any command that produces them
      if (result.lines.length > 0) {
        setOutputLines(result.lines);
      }

      if (action?.type === "navigate") {
        if (action.path === "/api/auth/login") {
          window.location.href = action.path;
        } else {
          router.push(action.path);
        }
      } else if (action?.type === "custom") {
        window.dispatchEvent(
          new CustomEvent(action.event, action.detail ? { detail: action.detail } : undefined),
        );
        // Custom actions provide their own visual feedback (e.g., spinning
        // refresh icon, sorted table column). Clear output immediately so
        // the command message doesn't linger in the command bar. (#283)
        setOutputLines([]);
      }
    },
    [commands, router],
  );

  const handlePartialChange = useCallback((val: string) => {
    setPartial(val);
    setShowAutocomplete(val.startsWith("/") && val.length > 0);
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

  return (
    <>
      {!skipShortcutsListener && <KeyboardShortcutsListener />}
      {/* #1214 — the bar stays inline at the bottom of the viewport rather
          than opening as a full-screen palette. The chips make the commands
          discoverable without typing `/` first, which is what the palette
          overlay was there to do. */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-stroke bg-bg/90 px-4 py-2.5 backdrop-blur-xl">
        <div className="hidden md:block absolute right-4 top-1/2 -translate-y-1/2 z-50">
          <AuthorTypewriter />
        </div>
        <div className="relative mx-auto max-w-4xl">
          {outputLines.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-1 max-h-48 sm:max-h-64 overflow-y-auto rounded-lg border border-stroke bg-card shadow-xl">
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
            prompt="chapa"
            autoFocus={!!isAdmin}
            suggestionsVisible={autocompleteExpanded}
            suggestionsListboxId={TERMINAL_COMMAND_LISTBOX_ID}
            activeSuggestionId={activeSuggestionId}
            trailing={
              <kbd
                aria-hidden="true"
                className="hidden shrink-0 rounded border border-stroke-strong px-1.5 py-0.5 font-heading text-[11px] text-terminal-dim sm:block"
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
                  onClick={() => handleAutocompleteFill(`/${command.name}`)}
                  title={command.description}
                  className="shrink-0 rounded-full border border-stroke px-3 py-1.5 font-heading text-xs whitespace-nowrap text-text-secondary transition-colors hover:border-amber/40 hover:text-text-primary"
                >
                  /{command.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
