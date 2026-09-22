/**
 * Pure helpers for deployed HTML probes (#1279).
 *
 * Two defects hid inside `profile.share-verification` for weeks, both about
 * reading HTML as a string:
 *
 * 1. A label can appear as a text node the visitor sees, or inside the
 *    serialized translation dictionary the page ships for hydration.
 *    `toContain("Not found")` cannot tell them apart, so the probe failed on
 *    every verified page. `hasRenderedText` matches only a text node: the
 *    label alone between a `>` and a `<`, whitespace allowed.
 * 2. `/verify\/([0-9a-f]{8}|[0-9a-f]{16}|[0-9a-f]{32})/` tries the shortest
 *    alternative first, so a 32-character hash was captured as its first 8
 *    characters and the probe then verified a hash that does not exist.
 *    `verifyHashFromHtml` tries the longest form first and refuses a match
 *    followed by more hex.
 */
export function renderedTextPattern(label: string): RegExp {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`>\\s*${escaped}\\s*<`);
}

export function hasRenderedText(html: string, label: string): boolean {
  return renderedTextPattern(label).test(html);
}

const VERIFY_HASH_PATTERN = /\/verify\/([0-9a-f]{32}|[0-9a-f]{16}|[0-9a-f]{8})(?![0-9a-f])/;

/** The full verification hash of the first `/verify/{hash}` link, or null. */
export function verifyHashFromHtml(html: string): string | null {
  return VERIFY_HASH_PATTERN.exec(html)?.[1] ?? null;
}
