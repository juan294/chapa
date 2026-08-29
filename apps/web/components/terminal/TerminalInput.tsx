"use client";

import { useState, useRef, useCallback, useEffect, useMemo, forwardRef, useImperativeHandle } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "@/lib/i18n";
import { TERMINAL_COMMAND_INPUT_ID } from "@/lib/keyboard/shortcuts";

export interface TerminalInputHandle {
  clear: () => void;
  focus: () => void;
}

interface TerminalInputProps {
  onSubmit: (command: string) => void;
  onPartialChange?: (partial: string) => void;
  history?: string[];
  prompt?: string;
  autoFocus?: boolean;
  suggestionsVisible?: boolean;
  suggestionsListboxId?: string;
  activeSuggestionId?: string;
  /**
   * Rendered at the trailing edge of the field, inside the border. The v2
   * command bar puts the `/` keycap here (#1214).
   */
  trailing?: ReactNode;
}

export const TerminalInput = forwardRef<TerminalInputHandle, TerminalInputProps>(function TerminalInput({
  onSubmit,
  onPartialChange,
  history = [],
  prompt = "chapa",
  autoFocus = false,
  suggestionsVisible = false,
  suggestionsListboxId,
  activeSuggestionId,
  trailing,
}, ref) {
  const { t } = useTranslation();
  // `t` is a stable reference per locale (memoized in LanguageProvider), but
  // `value`/`historyIndex` state changes on every keystroke re-render this
  // component — memoize so the dictionary lookup only reruns on locale
  // change, not on every keystroke.
  const placeholder = useMemo(() => t("terminalInput.placeholder") as string, [t]);
  const ariaLabel = useMemo(() => t("aria.terminalCommandInput") as string, [t]);
  const [value, setValue] = useState("");
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    clear() {
      setValue("");
      setHistoryIndex(-1);
    },
    focus() {
      inputRef.current?.focus();
    },
  }));

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
    // #1214 — the field is a bordered 46px control, not a bare line on a
    // divider. The bar chrome around it (sticky positioning, backdrop,
    // suggestion chips) belongs to the caller, so Studio and the global
    // command bar can frame the same field differently.
    <div className="flex min-h-[46px] items-center gap-2 rounded-lg border border-stroke bg-card px-3 font-terminal text-base leading-6 transition-colors focus-within:border-amber sm:text-sm">
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
          id={TERMINAL_COMMAND_INPUT_ID}
          className="terminal-input-bare w-full bg-transparent text-text-primary caret-amber placeholder:text-terminal-dim outline-none focus:ring-0 focus:outline-none border-none"
          style={{ outline: "none" }}
          placeholder={placeholder}
          aria-label={ariaLabel}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={suggestionsVisible}
          aria-controls={suggestionsVisible ? suggestionsListboxId : undefined}
          aria-activedescendant={
            suggestionsVisible ? activeSuggestionId : undefined
          }
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>
      {trailing}
    </div>
  );
});
