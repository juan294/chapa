"use client";

import { useId, useState } from "react";
import type { BadgeConfig } from "@chapa/shared";
import { DEFAULT_BADGE_CONFIG } from "@chapa/shared";
import {
  getCategoryLabel,
  getOptionDescription,
  getOptionLabel,
  getPresetLabel,
  STUDIO_CATEGORIES,
} from "./studio-options";
import { interpolate } from "@/lib/i18n/interpolate";
import { STUDIO_PRESETS } from "@/lib/effects/defaults";
import { CATEGORY_KEY_TO_ALIAS } from "@/components/terminal/command-registry";
import { useTranslation } from "@/lib/i18n";

interface QuickControlsProps {
  config: BadgeConfig;
  onCommand: (command: string) => void;
  visible: boolean;
  onToggle: () => void;
}

/**
 * The pointer affordance for the six badge categories: presets, then one
 * accordion row per category.
 *
 * `/save` and `/reset` used to live at the bottom of this panel. They moved to
 * the session column in #1241, because collapsing Quick Controls took the only
 * pointer route to saving with it, and because the actions belong beside the
 * prompt that runs the same two commands.
 */
export function QuickControls({
  config,
  onCommand,
  visible,
  onToggle,
}: QuickControlsProps) {
  const { t } = useTranslation();
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const changedCount = STUDIO_CATEGORIES.filter(
    (category) => config[category.key] !== DEFAULT_BADGE_CONFIG[category.key],
  ).length;
  const controlsId = useId();
  const panelId = `${controlsId}-panel`;

  return (
    <div className="border-b border-stroke">
      <div className="flex items-center gap-2 pr-3">
      {/* Toggle button — icon cross-fades between + and ↑ */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={visible}
        aria-controls={panelId}
        className="flex items-center justify-between gap-2 px-3 py-2 text-xs font-heading text-text-secondary transition-colors hover:text-text-primary w-full"
      >
        <span>{t("studio.quickControls") as string}</span>
        <span className="relative w-3.5 h-3.5">
          {/* Plus icon — shown when collapsed */}
          <svg
            className={`absolute inset-0 w-3.5 h-3.5 transition-all duration-150 ${
              visible ? "opacity-0 scale-75" : "opacity-100 scale-100"
            }`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          {/* Chevron up icon — shown when expanded */}
          <svg
            className={`absolute inset-0 w-3.5 h-3.5 transition-all duration-150 ${
              visible ? "opacity-100 scale-100" : "opacity-0 scale-75"
            }`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 15l-6-6-6 6" />
          </svg>
        </span>
      </button>
      {/* #1216 — how far the preview has drifted from the default, at a
          glance. Without it the only way to tell was opening all nine
          categories one by one. Kept OUTSIDE the toggle so it does not end up
          in that button's accessible name. */}
      <span
        data-testid="studio-changed-count"
        className="shrink-0 rounded-full border border-stroke px-2 py-0.5 font-heading text-[11px] whitespace-nowrap text-terminal-dim"
      >
        {changedCount === 0
          ? (t("studio.defaultConfig") as string)
          : interpolate(t("studio.changedCount") as string, {
              count: String(changedCount),
              total: String(STUDIO_CATEGORIES.length),
            })}
      </span>
      </div>

      <div id={panelId} hidden={!visible}>
        {/* Presets */}
        <div className="px-3 pb-2">
          <div className="text-[10px] text-terminal-dim uppercase tracking-wider mb-1.5">
            {t("studio.presetsHeading") as string}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {STUDIO_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onCommand(`/preset ${preset.id}`)}
                className="rounded-md border border-stroke px-2.5 py-1 text-xs text-text-secondary transition-colors hover:border-amber/30 hover:text-amber font-heading"
              >
                {getPresetLabel(preset.id, preset.label, t)}
              </button>
            ))}
          </div>
        </div>

        {/* Categories */}
        {/* #1216 — the category list owns the column instead of being a
            48-64px accordion window. 256px is the cap the source already had. */}
        <div className="max-h-64 overflow-y-auto">
          {STUDIO_CATEGORIES.map((category) => {
              const alias = CATEGORY_KEY_TO_ALIAS[category.key] ?? category.key;
              const isExpanded = expandedKey === category.key;
              const currentValue = config[category.key];
              const optionPanelId = `${controlsId}-${category.key}-options`;

              return (
                <div key={category.key} className="border-t border-stroke/50">
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    aria-controls={optionPanelId}
                    onClick={() => setExpandedKey(isExpanded ? null : category.key)}
                    className="flex w-full items-center justify-between px-3 py-2 text-xs transition-colors hover:bg-amber/[0.03]"
                  >
                    <span className="flex items-center gap-2 font-heading text-text-secondary">
                      {getCategoryLabel(category, t)}
                    </span>
                    <span className="text-terminal-dim font-heading text-xs">
                      {currentValue}
                    </span>
                  </button>

                  <div
                    id={optionPanelId}
                    className="collapse-grid"
                    data-expanded={isExpanded}
                    aria-hidden={!isExpanded}
                    inert={!isExpanded ? true : undefined}
                  >
                    <div>
                      <div className="flex flex-col gap-1 px-3 pb-2">
                        {category.options.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            // Selection is state, not part of the label: a "check"
                            // glyph inside the text would be read out as one.
                            aria-pressed={opt.value === currentValue}
                            onClick={() => onCommand(`/set ${alias} ${opt.value}`)}
                            className={`flex min-h-[44px] flex-col items-start justify-center rounded-md border px-2.5 py-1.5 text-left transition-colors ${
                              opt.value === currentValue
                                ? "border-amber bg-amber/10"
                                : "border-stroke hover:border-amber/20"
                            }`}
                          >
                            {/* Selection is carried by the accent border and
                                tint, not by accent-coloured text: `text-amber`
                                measures ~2.8:1 on the light ground, which no
                                11px label can afford (#1241). */}
                            <span
                              className={`font-heading text-[11px] text-text-primary ${
                                opt.value === currentValue ? "font-bold" : ""
                              }`}
                            >
                              {opt.value === currentValue && (
                                <span aria-hidden="true">&#10003; </span>
                              )}
                              {getOptionLabel(category.key, opt.value, t)}
                            </span>
                            {/* The description was already in STUDIO_CATEGORIES
                                but nothing rendered it, so picking an effect
                                meant guessing from its name (#1216). */}
                            <span className="text-[11px] text-text-secondary">
                              {getOptionDescription(category.key, opt.value, t)}
                            </span>
                            {/* #1242 — a colour choice shows its colours. The
                                dots are the palette's own ground, card and
                                accent; decorative, so the label and the
                                description carry the meaning. */}
                            {opt.swatches && (
                              <span
                                aria-hidden="true"
                                data-testid={`swatch-${category.key}-${opt.value}`}
                                className="mt-1 flex gap-1"
                              >
                                {opt.swatches.map((color) => (
                                  <span
                                    key={color}
                                    className="block size-3 rounded-[3px] border border-stroke"
                                    style={{ backgroundColor: color }}
                                  />
                                ))}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
          })}
        </div>

      </div>
    </div>
  );
}
