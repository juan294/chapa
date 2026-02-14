"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { getMatchingCommands } from "./command-registry";
import type { CommandDef } from "./command-registry";

interface AutocompleteDropdownProps {
  commands: CommandDef[];
  partial: string;
  onSelect: (command: string) => void;
  onFill?: (command: string) => void;
  onDismiss?: () => void;
  visible: boolean;
}

export function AutocompleteDropdown({
  commands,
  partial,
  onSelect,
  onFill,
  onDismiss,
  visible,
}: AutocompleteDropdownProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

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

  if (!visible || matching.length === 0) return null;

  return (
    <div
      ref={containerRef}
      role="listbox"
      aria-label="Command suggestions"
      className="absolute bottom-full left-0 right-0 mb-1 max-h-48 sm:max-h-64 overflow-y-auto rounded-lg border border-stroke bg-card font-terminal text-sm shadow-xl"
    >
      {matching.map((cmd, i) => (
        <button
          key={cmd.name}
          type="button"
          role="option"
          aria-selected={i === activeIndex}
          onClick={() => onSelect(cmd.name)}
          onMouseEnter={() => setActiveIndex(i)}
          className={`flex w-full items-center px-4 py-1.5 text-left transition-colors ${
            i === activeIndex
              ? "bg-amber/10 text-text-primary"
              : "text-text-secondary hover:bg-amber/5"
          }`}
        >
          <span className="min-w-[10ch] text-amber shrink-0">{cmd.name}</span>
          <span className="text-text-secondary truncate">
            {cmd.description}
          </span>
          {cmd.usage && (
            <span className="ml-auto pl-3 text-terminal-dim shrink-0 hidden sm:inline">
              {cmd.usage.replace(cmd.name + " ", "")}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
