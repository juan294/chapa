"use client";

import { useState, useEffect, useCallback, useMemo, useRef, useId } from "react";
import { getMatchingCommands } from "./command-registry";
import { useAnimatedUnmount } from "@/hooks/useAnimatedUnmount";
import type { CommandDef } from "./command-registry";
import { useInkTerminal } from "./TerminalPresentation";
import { useTranslation } from "@/lib/i18n";

interface AutocompleteDropdownProps {
  commands: CommandDef[];
  partial: string;
  onSelect: (command: string) => void;
  onFill?: (command: string) => void;
  onDismiss?: () => void;
  visible: boolean;
  listboxId?: string;
  onActiveDescendantChange?: (id: string | undefined) => void;
}

export function AutocompleteDropdown({
  commands,
  partial,
  onSelect,
  onFill,
  onDismiss,
  visible,
  listboxId,
  onActiveDescendantChange,
}: AutocompleteDropdownProps) {
  const { t } = useTranslation();
  const ink = useInkTerminal();
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const resolvedListboxId = listboxId ?? `${generatedId}-suggestions`;
  const { shouldRender, isAnimatingOut } = useAnimatedUnmount(visible, 150);

  const matching = useMemo(
    () => getMatchingCommands(partial, commands),
    [commands, partial],
  );

  // Reset active index when partial changes (adjust state during render — React docs pattern)
  const [prevPartial, setPrevPartial] = useState(partial);
  if (prevPartial !== partial) {
    setPrevPartial(partial);
    setActiveIndex(0);
  }

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!visible || matching.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setActiveIndex((i) => (i + 1) % matching.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setActiveIndex((i) => (i - 1 + matching.length) % matching.length);
      } else if (e.key === "Tab") {
        if (matching[activeIndex]) {
          e.preventDefault();
          e.stopPropagation();
          (onFill ?? onSelect)(matching[activeIndex].name);
        }
      } else if (e.key === "Enter") {
        if (matching[activeIndex]) {
          e.preventDefault();
          e.stopPropagation();
          onSelect(matching[activeIndex].name);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onDismiss?.();
      }
    },
    [visible, matching, activeIndex, onSelect, onFill, onDismiss],
  );

  useEffect(() => {
    if (visible && matching.length > 0) {
      document.addEventListener("keydown", handleKeyDown, true);
      return () => document.removeEventListener("keydown", handleKeyDown, true);
    }
  }, [visible, matching.length, handleKeyDown]);

  useEffect(() => {
    if (!visible || matching.length === 0) return;
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onDismiss?.();
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [visible, matching.length, onDismiss]);

  useEffect(() => {
    const activeId =
      visible && matching[activeIndex]
        ? `${resolvedListboxId}-option-${activeIndex}`
        : undefined;
    onActiveDescendantChange?.(activeId);
  }, [activeIndex, matching, onActiveDescendantChange, resolvedListboxId, visible]);

  if (!shouldRender || matching.length === 0) return null;

  return (
    <div
      ref={containerRef}
      id={resolvedListboxId}
      role="listbox"
      aria-label={t("aria.commandSuggestions") as string}
      className={`absolute bottom-full left-0 right-0 mb-1 max-h-48 sm:max-h-64 overflow-y-auto rounded-[3px] border font-terminal text-sm shadow-card ${ink ? "border-forest-line bg-forest-card" : "border-stroke-strong bg-card"} ${isAnimatingOut ? "animate-fade-out-up" : "animate-terminal-fade-in"}`}
    >
      {matching.map((cmd, i) => (
        <div
          key={cmd.name}
          id={`${resolvedListboxId}-option-${i}`}
          role="option"
          tabIndex={-1}
          aria-selected={i === activeIndex}
          onClick={() => onSelect(cmd.name)}
          onMouseEnter={() => setActiveIndex(i)}
          className={`flex w-full cursor-pointer items-center px-4 py-1.5 text-left transition-colors ${
            ink
              ? i === activeIndex
                ? "bg-forest-text/10 text-forest-text"
                : "text-forest-dim hover:bg-forest-text/5"
              : i === activeIndex
                ? "bg-amber/10 text-text-primary"
                : "text-text-secondary hover:bg-amber/5"
          }`}
        >
          <span className={`min-w-[10ch] shrink-0 ${ink ? "text-forest-text" : "text-amber-text"}`}>{cmd.name}</span>
          <span className={`truncate ${ink ? "text-forest-dim" : "text-text-secondary"}`}>
            {cmd.description}
          </span>
          {cmd.usage && (
            <span className={`ml-auto pl-3 shrink-0 hidden sm:inline ${ink ? "text-forest-dim" : "text-terminal-dim"}`}>
              {cmd.usage.replace(cmd.name + " ", "")}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
