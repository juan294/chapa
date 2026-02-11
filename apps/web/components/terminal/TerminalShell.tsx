"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { TerminalOutput } from "./TerminalOutput";
import { TerminalInput } from "./TerminalInput";
import { AutocompleteDropdown } from "./AutocompleteDropdown";
import {
  executeCommand,
  makeLine,
  createCoreCommands,
  type CommandDef,
  type OutputLine,
  type CommandAction,
} from "./command-registry";

interface TerminalShellProps {
  /** Extra commands merged with core commands */
  extraCommands?: CommandDef[];
  /** Called when a command produces an action */
  onAction?: (action: CommandAction) => void;
  /** Initial welcome lines */
  welcomeLines?: OutputLine[];
  /** Prompt text */
  prompt?: string;
  /** Additional CSS classes for the container */
  className?: string;
}

export function TerminalShell({
  extraCommands = [],
  onAction,
  welcomeLines = [],
  prompt = "chapa",
  className = "",
}: TerminalShellProps) {
  const router = useRouter();
  const allCommands = useMemo(
    () => [...createCoreCommands(), ...extraCommands],
    [extraCommands],
  );
  const [lines, setLines] = useState<OutputLine[]>(welcomeLines);
  const [history, setHistory] = useState<string[]>([]);
  const [partial, setPartial] = useState("");
  const [showAutocomplete, setShowAutocomplete] = useState(false);

  const handleSubmit = useCallback(
    (input: string) => {
      // Add user input line
      const inputLine = makeLine("input", input);
      setHistory((h) => [...h, input]);
      setShowAutocomplete(false);
      setPartial("");

      const result = executeCommand(input, allCommands);

      if (result.action?.type === "clear") {
        setLines([]);
        return;
      }

      setLines((prev) => [...prev, inputLine, ...result.lines]);

      if (result.action) {
        if (result.action.type === "navigate") {
          router.push(result.action.path);
        }
        onAction?.(result.action);
      }
    },
    [router, onAction, allCommands],
  );

  const handlePartialChange = useCallback((val: string) => {
    setPartial(val);
    setShowAutocomplete(val.startsWith("/") && val.length > 0);
  }, []);

  const handleAutocompleteSelect = useCallback(
    (command: string) => {
      setShowAutocomplete(false);
      setPartial("");
      // Auto-execute if the command needs no args
      const needsArgs = ["/set", "/preset", "/badge", "/b"];
      if (needsArgs.includes(command)) {
        setPartial(command + " ");
        setShowAutocomplete(false);
        // Focus input and set value via DOM
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
      } else {
        handleSubmit(command);
      }
    },
    [handleSubmit],
  );

  return (
    <div
      className={`flex flex-col bg-bg border border-stroke rounded-xl overflow-hidden ${className}`}
    >
      <TerminalOutput lines={lines} />
      <div className="relative">
        <AutocompleteDropdown
          commands={allCommands}
          partial={partial}
          onSelect={handleAutocompleteSelect}
          visible={showAutocomplete}
        />
        <TerminalInput
          onSubmit={handleSubmit}
          onPartialChange={handlePartialChange}
          history={history}
          prompt={prompt}
        />
      </div>
    </div>
  );
}
