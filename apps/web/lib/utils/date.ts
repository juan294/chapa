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
