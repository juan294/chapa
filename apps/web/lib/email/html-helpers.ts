/**
 * Shared HTML helpers for email templates.
 *
 * Used by both announcement and score-bump templates to keep
 * feature-row rendering consistent across all Chapa emails.
 */

/** Render a single arrow-prefixed feature row for email HTML. */
export function featureRow(
  text: string,
  paddingBottom: number = 12,
): string {
  return `
          <tr><td style="padding-bottom:${paddingBottom}px;padding-left:8px;">
            <span style="font-family:'JetBrains Mono',monospace;font-size:13px;color:#8B5CF6;">&rarr;</span>
            <span style="font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:#E2E4E9;padding-left:8px;">
              ${text}
            </span>
          </td></tr>`;
}
