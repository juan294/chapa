"use client";

import { useTranslation } from "@/lib/i18n";
import type { ReceiptExplanation } from "@/lib/dashboard/receipt-explanation";
import type { ExactNumericBounds } from "@chapa/shared";

/**
 * The owner's view of a v7 receipt's own arithmetic (#1311).
 *
 * It renders the receipt's numbers rather than recomputing them: every value
 * here comes from `explainReceipt`, whose steps are the trace the receipt was
 * sealed with. That is the point — an explanation that derives its own figures
 * is a second answer, and the one thing a reader checks an explanation for is
 * whether it adds up to the headline.
 *
 * A bound pair that differs is shown as an interval throughout, never averaged
 * into a midpoint. Where evidence is incomplete the honest display is "between
 * these two", and inventing the middle would be exactly the false precision
 * the range policy exists to avoid.
 */
function Bounds({ value }: { value: ExactNumericBounds }) {
  const lower = Math.round(value.lower * 10) / 10;
  const upper = Math.round(value.upper * 10) / 10;
  return <span className="tabular-nums">{lower === upper ? lower : `${lower}–${upper}`}</span>;
}

export function ReceiptExplanationPanel({ explanation }: { explanation: ReceiptExplanation }) {
  const { t } = useTranslation();
  const dimensionLabel = (key: string) => t(`dimensions.${key}.label`) as string;

  return (
    <section
      aria-labelledby="receipt-explanation"
      className="rounded-[3px] border border-stroke bg-card p-6 sm:p-8"
    >
      <h3
        id="receipt-explanation"
        className="font-heading text-lg font-semibold tracking-tight text-text-primary"
      >
        {t("receiptExplanation.title") as string}
      </h3>
      <p className="mt-2 max-w-2xl text-pretty text-sm leading-relaxed text-text-secondary">
        {t("receiptExplanation.intro") as string}
      </p>

      <dl className="mt-6 grid gap-3 @sm:grid-cols-2">
        <div>
          <dt className="font-heading text-xs uppercase tracking-wider text-terminal-dim">
            {t("receiptExplanation.core") as string}
          </dt>
          <dd className="font-heading text-2xl text-text-primary">
            <Bounds value={explanation.composite} />
          </dd>
        </div>
        <div>
          <dt className="font-heading text-xs uppercase tracking-wider text-terminal-dim">
            {t("receiptExplanation.tier") as string}
          </dt>
          <dd className="text-sm text-text-primary">
            {explanation.tier ?? (t("receiptExplanation.tierNone") as string)}
          </dd>
        </div>
        <div>
          <dt className="font-heading text-xs uppercase tracking-wider text-terminal-dim">
            {t("receiptExplanation.archetype") as string}
          </dt>
          <dd className="text-sm text-text-primary">
            {explanation.archetype ?? (t("receiptExplanation.archetypeNone") as string)}
          </dd>
        </div>
        <div>
          <dt className="font-heading text-xs uppercase tracking-wider text-terminal-dim">
            {t("receiptExplanation.window") as string}
          </dt>
          <dd className="text-sm text-text-secondary tabular-nums">
            {explanation.window.startInclusive.slice(0, 10)} —{" "}
            {explanation.window.referenceDate}
          </dd>
        </div>
      </dl>

      <div className="mt-8 space-y-6">
        {explanation.dimensions.map((dimension) => (
          <div key={dimension.key}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="font-heading text-sm font-medium text-text-primary">
                {dimensionLabel(dimension.key)}
              </h4>
              <p className="font-heading text-xs text-text-secondary">
                <Bounds value={dimension.dimension} />
                {" · "}
                {t("receiptExplanation.contributes") as string}{" "}
                <Bounds value={dimension.contribution} />
              </p>
            </div>
            <ul className="mt-2 space-y-1">
              {dimension.steps.map((entry) => (
                <li
                  key={entry.label}
                  className="flex flex-wrap items-baseline justify-between gap-2 border-b border-stroke/50 pb-1 text-sm"
                >
                  <span className="text-text-secondary">{entry.label}</span>
                  <span className="font-heading text-xs text-text-secondary">
                    <Bounds value={entry.step.observed} />
                    {" / "}
                    {entry.step.cap}
                    {" → "}
                    <Bounds value={entry.step.weighted} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Craft is reported beside the core, never inside it. An absent
          portfolio reads as not observed rather than as a zero. */}
      <div className="mt-8 border-t border-stroke pt-6">
        <h4 className="font-heading text-sm font-medium text-text-primary">
          {t("receiptExplanation.craft") as string}
        </h4>
        <p className="mt-1 text-sm text-text-secondary">
          {explanation.craft && explanation.craft.status === "observed" && explanation.craft.composite ? (
            <>
              <Bounds value={explanation.craft.composite} />
              {explanation.craft.descriptor ? ` · ${explanation.craft.descriptor}` : ""}
            </>
          ) : (
            (t("receiptExplanation.craftNotObserved") as string)
          )}
        </p>
      </div>

      {explanation.coverage.some((row) => row.status !== "complete") ? (
        <p className="mt-6 text-sm text-text-secondary">
          {t("receiptExplanation.coverageIncomplete") as string}
        </p>
      ) : null}
    </section>
  );
}
