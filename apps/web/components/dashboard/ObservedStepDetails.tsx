"use client";
import type { ExplainedStep } from "@/lib/dashboard/receipt-explanation";

/** Formula operands and result come from the sealed trace; nothing is scored here. */
export function ObservedStepDetails({ step }: { step: ExplainedStep }) {
  if (step.clamped === undefined || step.multiplier === undefined) return null;
  return <span className="block break-words font-heading text-xs tabular-nums">
    {step.observed.lower} → {step.clamped}{" · "}ln(1 + {step.clamped}) / ln(1 + {step.cap}) × {step.multiplier} = {step.weighted.lower}
  </span>;
}
