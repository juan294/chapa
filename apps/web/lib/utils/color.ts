/**
 * Shared color conversion utilities.
 */

/** Apply alpha to a CSS variable color using color-mix(). */
export function cssVarAlpha(cssVar: string, alpha: number): string {
  const pct = Math.round(alpha * 100);
  return `color-mix(in srgb, ${cssVar} ${pct}%, transparent)`;
}
