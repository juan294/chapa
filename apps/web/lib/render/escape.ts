/**
 * Escape XML entities in user-controlled strings before embedding in SVG/XML.
 *
 * Replaces the five XML special characters (`&`, `<`, `>`, `'`, `"`) with
 * their corresponding named entities. This prevents XSS when user-controlled
 * text (handles, display names) is interpolated into SVG badge markup.
 *
 * NOTE: This is intentionally separate from `escapeHtml` in `lib/email/resend.ts`.
 * The two functions differ in single-quote escaping:
 *   - `escapeXml` uses `&apos;` — the correct named entity for XML/SVG contexts.
 *   - `escapeHtml` uses `&#39;`  — the numeric reference, which is universally safe in HTML.
 * `&apos;` is NOT defined in HTML4 and may cause rendering issues in older email
 * clients. Consolidating these would risk breaking email rendering or SVG validity.
 *
 * @param str - The raw user-controlled string to escape
 * @returns The string with XML special characters replaced by named entities
 */
export function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/'/g, "&apos;")
    .replace(/"/g, "&quot;");
}
