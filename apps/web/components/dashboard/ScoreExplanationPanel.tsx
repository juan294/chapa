"use client";

import { useCallback, useId, useMemo, useState } from "react";
import type {
  ClientImpactV6Result,
  CraftResult,
  DimensionScores,
  Platform,
  StatsData,
} from "@chapa/shared";
import {
  buildScoreExplanation,
  type DimensionExplanation,
  type SignalKey,
} from "@/lib/dashboard/score-explanation";
import { useTranslation } from "@/lib/i18n";
import { interpolate } from "@/lib/i18n/interpolate";
import { ChallengeForm } from "./ChallengeForm";

type TranslateFn = (key: string) => string | string[] | Record<string, unknown>[];

interface ScoreExplanationPanelProps {
  // #1067 — the share page passes a structurally-redacted
  // PublicImpactV6Result (confidence/confidencePenalties keys entirely
  // absent) for non-owner visitors, and the full ImpactV6Result only for
  // the owner. buildScoreExplanation() below narrows on field presence.
  impact: ClientImpactV6Result;
  stats: StatsData;
  craftResult?: CraftResult | null;
  isOwner: boolean;
}

const DIMENSION_COLORS: Record<keyof DimensionScores, string> = {
  delivery: "var(--color-dimension-delivery)",
  quality: "var(--color-dimension-quality)",
  consistency: "var(--color-dimension-consistency)",
  breadth: "var(--color-dimension-breadth)",
  craft: "var(--color-dimension-craft)",
};

const PLATFORM_LABELS: Record<Platform, string> = {
  github: "GitHub",
  gitlab: "GitLab",
  bitbucket: "Bitbucket",
  codeberg: "Codeberg",
};

function formatPenalty(penalty: number): string {
  if (penalty > 0) return `-${penalty}`;
  if (penalty < 0) return `+${Math.abs(penalty)}`;
  return "0";
}

function formatPercent(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 100);
}

function formulaKeyForDimension(dimension: DimensionExplanation): string {
  if (dimension.key === "quality") {
    return dimension.countsTowardComposite
      ? "scoreExplanation.dimensions.qualityCollaborativeFormula"
      : "scoreExplanation.dimensions.qualitySoloFormula";
  }

  return `scoreExplanation.dimensions.${dimension.key}Formula`;
}

export function ScoreExplanationPanel({
  impact,
  stats,
  craftResult = null,
  isOwner,
}: ScoreExplanationPanelProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const panelId = useId();

  const explanation = useMemo(
    () => buildScoreExplanation(impact, stats, craftResult),
    [impact, stats, craftResult],
  );

  const toggle = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const activeDimensionLabels = explanation.composite.activeDimensionKeys
    .map((key) => t(`dimensions.${key}.label`) as string)
    .join(", ");
  // Lead with the SAME number shown on the badge (adjustedComposite). The raw
  // dimension average (compositeScore) is shown underneath as the breakdown, so
  // visitors never see a headline number that contradicts the badge.
  const scoreLine = interpolate(t("scoreExplanation.composite.scoreLine") as string, {
    score: String(explanation.composite.adjusted),
    tier: explanation.composite.tier,
  });
  const compositeBreakdown = interpolate(t("scoreExplanation.composite.breakdown") as string, {
    dims: activeDimensionLabels,
    composite: String(explanation.composite.score),
  });
  const adjustmentNote = interpolate(t("scoreExplanation.composite.adjustmentNote") as string, {
    composite: String(explanation.composite.score),
  });

  return (
    <div className="rounded-xl bg-card shadow-card">
      <button
        type="button"
        aria-expanded={isExpanded}
        aria-controls={panelId}
        aria-label={t("aria.toggleScoreExplanation") as string}
        onClick={toggle}
        className="flex w-full cursor-pointer items-center justify-between gap-4 p-4 text-left sm:p-5"
      >
        <div>
          <h3 className="font-heading text-xs uppercase tracking-[0.2em] text-text-secondary">
            {t("scoreExplanation.toggle") as string}
          </h3>
          <p className="mt-1 text-sm text-text-secondary">
            {t("scoreExplanation.intro") as string}
          </p>
        </div>
        <svg
          className={`h-5 w-5 shrink-0 text-text-secondary transition-transform duration-200 ${
            isExpanded ? "rotate-180" : ""
          }`}
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M5 7.5L10 12.5L15 7.5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <div
        id={panelId}
        className="collapse-grid"
        data-expanded={isExpanded ? "true" : "false"}
      >
        <div className="overflow-hidden">
          <div className="space-y-6 border-t border-stroke px-4 py-5 sm:px-5">
            <section>
              <h4 className="font-heading text-sm font-bold text-text-primary">
                {t("scoreExplanation.composite.heading") as string}
              </h4>
              <p className="mt-2 rounded-lg border border-stroke bg-track/40 p-3 font-heading text-xl font-bold text-text-primary tabular-nums">
                {scoreLine}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                {compositeBreakdown}
              </p>
              {explanation.composite.soloQualityExcluded && (
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                  {t("scoreExplanation.composite.soloNote") as string}
                </p>
              )}
              {explanation.composite.adjusted !== explanation.composite.score && (
                <p className="mt-2 text-xs leading-relaxed text-text-secondary">
                  {adjustmentNote}
                </p>
              )}
            </section>

            <section className="space-y-3">
              {explanation.dimensions.map((dimension) => (
                <DimensionFormula
                  key={dimension.key}
                  dimension={dimension}
                  label={t(`dimensions.${dimension.key}.label`) as string}
                  formula={t(formulaKeyForDimension(dimension)) as string}
                  notCountedLabel={t("scoreExplanation.dimensions.notCounted") as string}
                  t={t}
                />
              ))}
              <p className="text-xs leading-relaxed text-text-secondary">
                {t("scoreExplanation.dimensions.normalizationNote") as string}
              </p>
            </section>

            <section>
              <h4 className="font-heading text-sm font-bold text-text-primary">
                {t("scoreExplanation.dataSources.heading") as string}
              </h4>
              <div className="mt-3 space-y-3">
                {explanation.dataSources.map((source) => {
                  const platform = PLATFORM_LABELS[source.platform];
                  const login = source.login ?? stats.handle;
                  return (
                    <div
                      key={source.platform}
                      className="rounded-lg border border-stroke bg-track/30 p-3"
                    >
                      <p className="text-sm font-semibold text-text-primary">
                        {interpolate(t("scoreExplanation.dataSources.platformLine") as string, {
                          platform,
                          login,
                        })}
                      </p>
                      <SignalList
                        label={t("scoreExplanation.dataSources.provides") as string}
                        signals={source.providedSignalKeys}
                        t={t}
                      />
                      <SignalList
                        label={t("scoreExplanation.dataSources.missing") as string}
                        signals={source.missingSignalKeys}
                        t={t}
                      />
                      {!source.providesQualitySignals && (
                        <p className="mt-2 text-xs leading-relaxed text-text-secondary">
                          {interpolate(t("scoreExplanation.dataSources.qualityCaveat") as string, {
                            platform,
                          })}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {isOwner && (
              <section>
                <h4 className="font-heading text-sm font-bold text-text-primary">
                  {t("scoreExplanation.confidence.heading") as string}
                </h4>
                <p className="mt-2 text-sm font-medium text-text-primary">
                  {interpolate(t("scoreExplanation.confidence.valueLine") as string, {
                    value: String(explanation.confidence.value),
                  })}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-text-secondary">
                  {t("scoreExplanation.confidence.explainer") as string}
                </p>
                <p className="mt-1 text-xs text-text-secondary">
                  {t("scoreExplanation.confidence.ownerOnlyNote") as string}
                </p>
                {explanation.confidence.penalties.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {explanation.confidence.penalties.map((penalty) => (
                      <li
                        key={penalty.flag}
                        className="flex items-start justify-between gap-3 rounded-lg border border-stroke bg-track/30 p-3"
                      >
                        <span className="text-sm leading-relaxed text-text-secondary">
                          {t(`scoreExplanation.confidence.reasons.${penalty.flag}`) as string}
                        </span>
                        <span className="font-heading text-sm font-bold text-text-primary tabular-nums">
                          {formatPenalty(penalty.penalty)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-text-secondary">
                    {t("scoreExplanation.confidence.noPenalties") as string}
                  </p>
                )}
              </section>
            )}

            {isOwner && isExpanded && (
              <section className="border-t border-stroke pt-4">
                <ChallengeForm handle={stats.handle} />
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface DimensionFormulaProps {
  dimension: DimensionExplanation;
  label: string;
  formula: string;
  notCountedLabel: string;
  t: TranslateFn;
}

function DimensionFormula({
  dimension,
  label,
  formula,
  notCountedLabel,
  t,
}: DimensionFormulaProps) {
  const color = DIMENSION_COLORS[dimension.key];

  return (
    <article className="rounded-lg border border-stroke bg-track/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: color }}
            aria-hidden="true"
          />
          <h4 className="font-heading text-sm font-bold text-text-primary">
            {label}
          </h4>
        </div>
        <div className="flex items-center gap-2">
          {!dimension.countsTowardComposite && (
            <span className="rounded-full border border-stroke px-2 py-0.5 text-[11px] font-medium text-text-secondary">
              {notCountedLabel}
            </span>
          )}
          <span className="font-heading text-sm font-bold text-text-primary tabular-nums">
            {dimension.score}
          </span>
        </div>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">
        {formula}
      </p>
      {dimension.subMetrics.length > 0 && (
        <div className="mt-3 space-y-3">
          {dimension.subMetrics.map((metric) => {
            const percent = formatPercent(metric.normalizedValue);
            const metricLabel = t(`scoreExplanation.subMetrics.${metric.key}`) as string;
            return (
              <div key={metric.key}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-text-primary">
                    {metricLabel}
                  </span>
                  <span className="text-xs text-text-secondary">
                    {metric.weight}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-valuenow={percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={metricLabel}
                  className="h-1.5 overflow-hidden rounded-full bg-stroke/40"
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${percent}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
                <p className="mt-1 text-xs text-text-secondary">
                  {interpolate(
                    t(`scoreExplanation.rawLabels.${metric.rawLabelKey}`) as string,
                    metric.rawLabelParams,
                  )}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

interface SignalListProps {
  label: string;
  signals: SignalKey[];
  t: TranslateFn;
}

function SignalList({ label, signals, t }: SignalListProps) {
  if (signals.length === 0) return null;

  return (
    <p className="mt-2 text-xs leading-relaxed text-text-secondary">
      <span className="font-medium text-text-primary">{label}: </span>
      {signals
        .map((signal) => t(`scoreExplanation.dataSources.signalLabels.${signal}`) as string)
        .join(", ")}
    </p>
  );
}
