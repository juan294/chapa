"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface TerminalInputProps {
  onSubmit: (command: string) => void;
  onPartialChange?: (partial: string) => void;
  history?: string[];
  prompt?: string;
  autoFocus?: boolean;
}

export function TerminalInput({
  onSubmit,
  onPartialChange,
  history = [],
  prompt = "chapa",
  autoFocus = false,
}: TerminalInputProps) {
  const [value, setValue] = useState("");
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) {
      const timer = setTimeout(() => inputRef.current?.focus(), 300);
      return () => clearTimeout(timer);
    }
  }, [autoFocus]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && value.trim()) {
        onSubmit(value.trim());
        setValue("");
        setHistoryIndex(-1);
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (history.length === 0) return;
        const nextIndex =
          historyIndex < history.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(nextIndex);
        const historyValue = history[history.length - 1 - nextIndex];
        if (historyValue) {
          setValue(historyValue);
          onPartialChange?.(historyValue);
        }
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (historyIndex <= 0) {
          setHistoryIndex(-1);
          setValue("");
          onPartialChange?.("");
          return;
        }
        const nextIndex = historyIndex - 1;
        setHistoryIndex(nextIndex);
        const historyValue = history[history.length - 1 - nextIndex];
        if (historyValue) {
          setValue(historyValue);
          onPartialChange?.(historyValue);
        }
        return;
      }

      if (e.key === "Escape") {
        setValue("");
        setHistoryIndex(-1);
        onPartialChange?.("");
        return;
      }
    },
    [value, history, historyIndex, onSubmit, onPartialChange],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newVal = e.target.value;
      setValue(newVal);
      setHistoryIndex(-1);
      onPartialChange?.(newVal);
    },
    [onPartialChange],
  );

  return (
    <div
      className="flex items-center gap-2 border-t border-stroke bg-bg/80 backdrop-blur-sm px-4 py-3 font-terminal text-sm"
    >
      <span className="text-amber select-none shrink-0">
        {prompt} &gt;
      </span>
      <div className="relative flex-1">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className="terminal-input-bare w-full bg-transparent text-text-primary caret-amber placeholder:text-terminal-dim outline-none focus:ring-0 focus:outline-none border-none"
          style={{ outline: "none" }}
          placeholder="Type / for commands..."
          aria-label="Terminal command input"
          autoComplete="off"
          spellCheck={false}
        />
      </div>
    </div>
  );
}

