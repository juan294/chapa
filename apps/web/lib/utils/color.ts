/**
 * Shared color conversion utilities.
 */

/** Convert a hex color string to rgba. */
export function hexToRgba(hex: string, alpha: number): string {
  return `rgba(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}, ${alpha})`;
}
