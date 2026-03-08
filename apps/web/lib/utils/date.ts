/**
 * Shared date formatting utilities.
 */

/** Format an ISO date string (YYYY-MM-DD) into a human-readable short date. */
export function formatIsoDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Convert a Date object to an ISO date string (YYYY-MM-DD). */
export function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Format an ISO date (YYYY-MM-DD) as "Mar 7, 2026". */
export function formatShortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Format a date range as "Mar 7, 2026 – Mar 14, 2026". */
export function formatDateRange(start: string, end: string): string {
  return `${formatShortDate(start)} – ${formatShortDate(end)}`;
}
