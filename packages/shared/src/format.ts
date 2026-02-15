/**
 * Format a number in compact notation: 0, 999, 1.2k, 15.7k, 1.5M
 */
export function formatCompact(n: number): string {
  if (n < 0) return "0";
  if (n < 1000) return String(Math.round(n));
  if (n < 1_000_000) {
    const k = n / 1000;
    const rounded = Math.round(k * 10) / 10;
    return rounded % 1 === 0 ? `${Math.round(rounded)}k` : `${rounded}k`;
  }
  const m = n / 1_000_000;
  const rounded = Math.round(m * 10) / 10;
  return rounded % 1 === 0 ? `${Math.round(rounded)}M` : `${rounded}M`;
}
