import type { PublicScoringReceipt, TrendAnchor, TrendObservation } from "@chapa/shared";

/** V7 trend is separate from the fresh headline. Caller supplies the latest strictly
 * earlier point anchor, including across gap dates; never today's mutable anchor. */
export function calculateTrendV7(
  receipt: Pick<PublicScoringReceipt, "policyVersion" | "revisionId" | "window" | "core" | "action">,
  previous: TrendAnchor | null,
): TrendObservation {
  const date = receipt.window.referenceDate;
  const midnight = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new RangeError("Invalid trend date");
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (!Number.isFinite(+parsed) || parsed.toISOString().slice(0, 10) !== value) throw new RangeError("Invalid trend date");
    return +parsed;
  };
  const currentDay = midnight(date);
  if (previous && previous.policyVersion !== receipt.policyVersion) previous = null;
  if (previous && (midnight(previous.referenceDate) >= currentDay || !Number.isFinite(previous.unroundedValue) || previous.unroundedValue < 0 || previous.unroundedValue > 100)) throw new RangeError("Invalid preceding trend anchor");
  if (receipt.action === "retract") return { status: "gap", referenceDate: date, reason: "missing" };
  if (receipt.core.composite.kind === "range") return { status: "gap", referenceDate: date, reason: "range" };
  const rawPoint = receipt.core.composite.value;
  if (!Number.isFinite(rawPoint) || rawPoint < 0 || rawPoint > 100) throw new RangeError("Invalid trend point");
  const retention = previous ? 0.85 ** ((currentDay - midnight(previous.referenceDate)) / 86_400_000) : 0;
  const unroundedValue = previous ? retention * previous.unroundedValue + (1 - retention) * rawPoint : rawPoint;
  return { status: "point", assumption: "new_value_backward_fill", anchor: { policyVersion: receipt.policyVersion, referenceDate: date,
    receiptRevisionId: receipt.revisionId, rawPoint, unroundedValue, previousAnchorRevisionId: previous?.receiptRevisionId ?? null } };
}
