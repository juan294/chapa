"use client";

import { useId, useState } from "react";
import type { BadgeConfig } from "@chapa/shared";
import {
  getCategoryLabel,
  getOptionLabel,
  getPresetLabel,
  STUDIO_CATEGORIES,
} from "./studio-options";
import { STUDIO_PRESETS } from "@/lib/effects/defaults";
import { CATEGORY_KEY_TO_ALIAS } from "@/components/terminal/command-registry";
import { useTranslation } from "@/lib/i18n";

interface QuickControlsProps {
  config: BadgeConfig;
  onCommand: (command: string) => void;
  visible: boolean;
  onToggle: () => void;
  saveDisabled?: boolean;
  agentSaveProposal?: {
    onConfirm: () => void;
    onDismiss: () => void;
  };
}

export function QuickControls({
  config,
  onCommand,
  visible,
  onToggle,
  saveDisabled = false,
  agentSaveProposal,
}: QuickControlsProps) {
  const { t } = useTranslation();
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const controlsId = useId();
  const panelId = `${controlsId}-panel`;

  return (
    <div className="border-b border-stroke">
      {/* Toggle button — icon cross-fades between + and ↑ */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={visible}
        aria-controls={panelId}
        className="flex items-center justify-between gap-2 px-3 py-2 text-xs font-heading text-terminal-dim transition-colors hover:text-text-secondary w-full"
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
        <div className="max-h-48 sm:max-h-64 overflow-y-auto">
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
                    <span className="text-text-secondary font-heading">
                      {getCategoryLabel(category, t)}
                    </span>
                    <span className="text-terminal-dim font-heading text-[10px]">
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
                      <div className="px-3 pb-2 flex gap-1.5 flex-wrap">
                        {category.options.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => onCommand(`/set ${alias} ${opt.value}`)}
                            className={`rounded-md border px-2 py-1 text-[11px] font-heading transition-colors ${
                              opt.value === currentValue
                                ? "border-amber bg-amber/10 text-amber"
                                : "border-stroke text-text-secondary hover:border-amber/20 hover:text-text-primary"
                            }`}
                          >
                            {getOptionLabel(category.key, opt.value, t)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
          })}
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-3 py-2 border-t border-stroke">
            <button
              type="button"
              onClick={() => onCommand("/save")}
              disabled={saveDisabled}
              className="flex-1 rounded-md bg-amber px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-amber-light disabled:cursor-not-allowed disabled:opacity-50"
            >
              /save
            </button>
            <button
              type="button"
              onClick={() => onCommand("/reset")}
              className="rounded-md border border-stroke px-3 py-1.5 text-xs text-text-secondary transition-colors hover:border-amber/20 hover:text-text-primary"
            >
              /reset
            </button>
        </div>
        {agentSaveProposal && (
          <div
            className="border-t border-amber/20 bg-amber/[0.04] px-3 py-2"
            role="group"
            aria-label={t("studio.agentSave.prompt") as string}
          >
            <p className="mb-2 text-xs text-text-secondary">
              {t("studio.agentSave.prompt") as string}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={agentSaveProposal.onConfirm}
                disabled={saveDisabled}
                className="flex-1 rounded-md bg-amber px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-amber-light disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("studio.agentSave.confirm") as string}
              </button>
              <button
                type="button"
                onClick={agentSaveProposal.onDismiss}
                className="rounded-md border border-stroke px-3 py-1.5 text-xs text-text-secondary transition-colors hover:border-amber/20 hover:text-text-primary"
              >
                {t("studio.agentSave.dismiss") as string}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
