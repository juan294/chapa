import type { MetricsSnapshot } from "@chapa/shared";

export type PublicMetricsSnapshot = Omit<
  MetricsSnapshot,
  "confidence" | "confidencePenalties"
>;

export function redactSnapshotForVisitor(
  snapshot: MetricsSnapshot,
): PublicMetricsSnapshot {
  const publicSnapshot = { ...snapshot };
  Reflect.deleteProperty(publicSnapshot, "confidence");
  Reflect.deleteProperty(publicSnapshot, "confidencePenalties");
  return publicSnapshot;
}
