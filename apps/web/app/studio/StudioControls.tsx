"use client";

import { useState, useCallback, useRef } from "react";
import type { BadgeConfig } from "@chapa/shared";
import { STUDIO_CATEGORIES } from "./studio-options";
import { EffectSection } from "./EffectSection";
import { PresetBar } from "./PresetBar";

export interface StudioControlsProps {
  config: BadgeConfig;
  onChange: (config: BadgeConfig) => void;
  onPresetSelect: (config: BadgeConfig) => void;
  onSave: () => void;
  onReset: () => void;
  saving: boolean;
  saved: boolean;
}

export function StudioControls({
  config,
  onChange,
  onPresetSelect,
  onSave,
  onReset,
  saving,
  saved,
}: StudioControlsProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);
  const [confirmReset, setConfirmReset] = useState(false);
  const accordionRef = useRef<HTMLDivElement>(null);

  function handleFieldChange(key: keyof BadgeConfig, value: string) {
    onChange({ ...config, [key]: value });
  }

  function handleReset() {
    if (!confirmReset) {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 3000);
      return;
    }
    onReset();
    setConfirmReset(false);
  }

  const handleAccordionKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (!target.hasAttribute("data-accordion-trigger")) return;

      const triggers =
        accordionRef.current?.querySelectorAll<HTMLButtonElement>(
          "[data-accordion-trigger]",
        );
      if (!triggers || triggers.length === 0) return;

      const currentIdx = Array.from(triggers).indexOf(
        target as HTMLButtonElement,
      );
      let nextIdx = -1;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        nextIdx = (currentIdx + 1) % triggers.length;
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        nextIdx = (currentIdx - 1 + triggers.length) % triggers.length;
      } else if (e.key === "Home") {
        e.preventDefault();
        nextIdx = 0;
      } else if (e.key === "End") {
        e.preventDefault();
        nextIdx = triggers.length - 1;
      }

      if (nextIdx >= 0) {
        triggers[nextIdx].focus();
      }
    },
    [],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Presets */}
      <div className="px-4 pt-4 pb-3">
        <div className="text-xs text-text-secondary uppercase tracking-wider mb-2">
          Presets
        </div>
        <PresetBar config={config} onSelect={onPresetSelect} />
      </div>

      <div className="mx-4 border-t border-stroke" />

      {/* Effect sections */}
      <div
        ref={accordionRef}
        className="flex-1 overflow-y-auto"
        onKeyDown={handleAccordionKeyDown}
      >
        {STUDIO_CATEGORIES.map((category, index) => (
          <EffectSection
            key={category.key}
            category={category}
            config={config}
            onChange={handleFieldChange}
            isExpanded={expandedIndex === index}
            onToggle={() =>
              setExpandedIndex(expandedIndex === index ? null : index)
            }
            triggerId={`studio-trigger-${category.key}`}
            panelId={`studio-panel-${category.key}`}
          />
        ))}
      </div>

      {/* Save / Reset */}
      <div className="border-t border-stroke px-4 py-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="flex-1 rounded-full bg-amber px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-amber-light hover:shadow-lg hover:shadow-amber/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving..." : saved ? "Saved!" : "Save & Apply"}
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="rounded-full border border-stroke px-5 py-3 text-sm font-medium text-text-secondary transition-colors hover:border-amber/20 hover:text-text-primary hover:bg-amber/[0.04]"
        >
          {confirmReset ? "Confirm?" : "Reset"}
        </button>
      </div>
    </div>
  );
}
