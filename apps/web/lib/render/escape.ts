/**
 * Escape XML entities in user-controlled strings before embedding in SVG/XML.
 *
 * NOTE: This is intentionally separate from `escapeHtml` in `lib/email/resend.ts`.
 * The two functions differ in single-quote escaping:
 *   - escapeXml uses `&apos;` — the correct named entity for XML/SVG contexts.
 *   - escapeHtml uses `&#39;`  — the numeric reference, which is universally safe in HTML.
 * `&apos;` is NOT defined in HTML4 and may cause rendering issues in older email
 * clients. Consolidating these would risk breaking email rendering or SVG validity.
 */
export function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/'/g, "&apos;")
    .replace(/"/g, "&quot;");
}
