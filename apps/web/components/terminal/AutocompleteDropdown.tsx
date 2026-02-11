"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { CommandDef } from "./command-registry";

interface AutocompleteDropdownProps {
  commands: CommandDef[];
  partial: string;
  onSelect: (command: string) => void;
  visible: boolean;
}

export function AutocompleteDropdown({
  commands,
  partial,
  onSelect,
  visible,
}: AutocompleteDropdownProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const matching = useMemo(
    () =>
      partial.startsWith("/")
        ? commands.filter((c) => c.name.startsWith(partial.toLowerCase()))
        : [],
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
      } else if (e.key === "Tab" || e.key === "Enter") {
        if (matching[activeIndex]) {
          e.preventDefault();
          e.stopPropagation();
          onSelect(matching[activeIndex].name);
        }
      }
    },
    [visible, matching, activeIndex, onSelect],
  );

  useEffect(() => {
    if (visible && matching.length > 0) {
      document.addEventListener("keydown", handleKeyDown, true);
      return () => document.removeEventListener("keydown", handleKeyDown, true);
    }
  }, [visible, matching.length, handleKeyDown]);

  if (!visible || matching.length === 0) return null;

  return (
    <div
      role="listbox"
      aria-label="Command suggestions"
      className="absolute bottom-full left-0 right-0 mb-1 max-h-64 overflow-y-auto rounded-lg border border-stroke bg-card shadow-xl"
    >
      {matching.map((cmd, i) => (
        <button
          key={cmd.name}
          type="button"
          role="option"
          aria-selected={i === activeIndex}
          onClick={() => onSelect(cmd.name)}
          onMouseEnter={() => setActiveIndex(i)}
          className={`flex w-full items-center gap-3 px-4 py-1.5 text-left text-sm transition-colors ${
            i === activeIndex
              ? "bg-amber/10 text-text-primary"
              : "text-text-secondary hover:bg-amber/5"
          }`}
        >
          <span className="font-heading text-amber shrink-0">{cmd.name}</span>
          <span className="text-text-secondary truncate text-xs">
            {cmd.description}
          </span>
        </button>
      ))}
    </div>
  );
}
