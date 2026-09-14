import { scoringInstant } from "@chapa/shared";
/** PostgreSQL emits up to six fractional digits. Normalize only trusted DB values;
 * public input continues to use the strict scoringInstant contract. */
export function databaseInstant(value: string): string {
  const normalized = value.replace(/(\.\d{3})\d{1,3}(?=Z|[+-]\d{2}:\d{2}$)/, "$1");
  return scoringInstant(normalized).toISOString();
}
