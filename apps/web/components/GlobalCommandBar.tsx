"use client";

import { useCallback, useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AuthorTypewriter } from "@/components/AuthorTypewriter";
import { TerminalInput } from "@/components/terminal/TerminalInput";
import { TerminalOutput } from "@/components/terminal/TerminalOutput";
import { AutocompleteDropdown } from "@/components/terminal/AutocompleteDropdown";
import {
  executeCommand,
  createNavigationCommands,
} from "@/components/terminal/command-registry";
import type { OutputLine } from "@/components/terminal/command-registry";

const OUTPUT_TIMEOUT_MS = 5000;

/**
 * Fixed bottom command bar with navigation commands + AuthorTypewriter pill.
 * Use on any page that doesn't have its own terminal interface.
 */
export function GlobalCommandBar() {
  const router = useRouter();
  const [partial, setPartial] = useState("");
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [outputLines, setOutputLines] = useState<OutputLine[]>([]);
  const outputTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const commands = useMemo(() => createNavigationCommands(), []);

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

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-stroke bg-bg/90 backdrop-blur-xl">
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
        />
        <TerminalInput
          onSubmit={handleSubmit}
          onPartialChange={handlePartialChange}
          prompt="chapa"
        />
      </div>
    </div>
  );
}
