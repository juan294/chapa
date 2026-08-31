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
/**
 * Whether the current config is exactly this preset (#1243). A preset sets
 * every category, so "applied" is an equality check, not a fuzzy match - the
 * marker has to go dark the moment the user changes any single option.
 */
function isPresetApplied(preset: BadgeConfig, config: BadgeConfig): boolean {
  return STUDIO_CATEGORIES.every(
    (category) => preset[category.key] === config[category.key],
  );
}

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
      {/* #1243 — presets are their own section above Quick Controls, not a
          strip buried under its label, and the applied one is marked. */}
      <div
        data-testid="qc-presets"
        className="border-b border-stroke px-4 py-3.5"
      >
        <div className="mb-2.5 font-heading text-[10.5px] tracking-[0.16em] text-terminal-dim">
          {t("studio.presetsHeading") as string}
        </div>
        <div className="flex flex-wrap gap-2">
          {STUDIO_PRESETS.map((preset) => {
            const applied = isPresetApplied(preset.config, config);
            return (
              <button
                key={preset.id}
                type="button"
                data-testid={`qc-preset-${preset.id}`}
                aria-pressed={applied}
                onClick={() => onCommand(`/preset ${preset.id}`)}
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-lg border px-3.5 font-heading text-[12.5px] transition-colors ${
                  applied
                    ? "border-amber bg-amber/10 font-bold text-text-primary"
                    : "border-stroke bg-bg text-text-secondary hover:border-amber/30 hover:text-text-primary"
                }`}
              >
                {applied && (
                  <span aria-hidden="true" className="text-amber-text">
                    &#9656;
                  </span>
                )}
                {getPresetLabel(preset.id, preset.label, t)}
              </button>
            );
          })}
        </div>
      </div>

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
        {/* Categories */}
        {/* #1243 — no height cap. The 256px window suited #1216's narrow
            sticky column beside a 50%-width preview; in the v3 tools column it
            was a small scroller above a large void. The list flows and the
            column scrolls with the page. */}
        <div data-testid="qc-categories">
          {STUDIO_CATEGORIES.map((category) => {
              const alias = CATEGORY_KEY_TO_ALIAS[category.key] ?? category.key;
              const isExpanded = expandedKey === category.key;
              const currentValue = config[category.key];
              const optionPanelId = `${controlsId}-${category.key}-options`;

              return (
                <div key={category.key} className="border-b border-stroke">
                  <button
                    type="button"
                    data-testid={`qc-category-${category.key}`}
                    aria-expanded={isExpanded}
                    aria-controls={optionPanelId}
                    onClick={() => setExpandedKey(isExpanded ? null : category.key)}
                    className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 text-left transition-colors hover:bg-amber/[0.03]"
                  >
                    <span className="flex min-w-0 items-center gap-2.5 font-heading text-[13px] text-text-primary">
                      <span
                        aria-hidden="true"
                        data-testid={`qc-chevron-${category.key}`}
                        className="text-[11px] text-terminal-dim"
                      >
                        {isExpanded ? "\u25be" : "\u25b8"}
                      </span>
                      {getCategoryLabel(category, t)}
                    </span>
                    {/* `text-amber` is a fill value at 2.75:1 on the light
                        ground; `text-amber-text` is its text-safe counterpart. */}
                    <span
                      data-testid={`qc-value-${category.key}`}
                      className="truncate font-heading text-xs text-amber-text"
                    >
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
                      <div
                        data-testid={`qc-options-${category.key}`}
                        className="flex flex-wrap gap-2 px-4 pb-4"
                      >
                        {category.options.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            // Selection is state, not part of the label: a "check"
                            // glyph inside the text would be read out as one.
                            aria-pressed={opt.value === currentValue}
                            onClick={() => onCommand(`/set ${alias} ${opt.value}`)}
                            className={`inline-flex min-h-[44px] flex-col items-start justify-center gap-0.5 rounded-[9px] border px-3 py-1.5 text-left transition-colors ${
                              opt.value === currentValue
                                ? "border-amber bg-amber/10"
                                : "border-stroke hover:border-amber/20"
                            }`}
                          >
                            {/* Selection is carried by the accent border and
                                tint. `text-amber` is a fill value at 2.75:1 on
                                the light ground, which no 11px label can afford
                                (#1241); `text-amber-text` (#1243) is the
                                text-safe accent, used for the row value where
                                the type is larger. */}
                            <span
                              className={`font-heading text-xs ${
                                opt.value === currentValue
                                  ? "font-bold text-amber-text"
                                  : "text-text-primary"
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
                            <span
                              className={`text-[11px] ${
                                opt.value === currentValue
                                  ? "text-text-secondary"
                                  : "text-terminal-dim"
                              }`}
                            >
                              {getOptionDescription(category.key, opt.value, t)}
                            </span>
                            {/* #1242/#1245 — a colour choice shows its colours,
                                to the handoff's pixel spec: three 14px rounded
                                squares (a circle reads as a radio input), in
                                primary -> secondary -> accent order, each with
                                the HEAVIER hairline — without it a dark primary
                                vanishes into a dark-theme chip. The dots are the
                                palette's own ground, card and accent, read from
                                the renderer, and they are literal hex: they must
                                not flip with the app theme. Decorative, so the
                                label and description carry the meaning. */}
                            {opt.swatches && (
                              <span
                                aria-hidden="true"
                                data-testid={`swatch-${category.key}-${opt.value}`}
                                className="mt-[3px] flex gap-1"
                              >
                                {opt.swatches.map((color) => (
                                  <span
                                    key={color}
                                    className="block size-3.5 rounded-[4px] border border-stroke-strong"
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
