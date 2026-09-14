import "server-only";
import { scoringInstant } from "@chapa/shared";
/** Preserve Postgres microseconds for optimistic-concurrency comparisons. */
export function databaseInstantMicros(value: string): bigint {
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) throw new RangeError("Invalid database instant");
  const fraction = (match[2] ?? "").padEnd(6, "0");
  const milliseconds = scoringInstant(`${match[1]}.${fraction.slice(0, 3)}${match[3]}`).getTime();
  return BigInt(milliseconds) * 1000n + BigInt(fraction.slice(3));
}
export function validDatabaseInstant(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try { databaseInstantMicros(value); return true; } catch { return false; }
}
