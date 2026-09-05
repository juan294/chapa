/** Every scoring consumer receives this context from one orchestration boundary. */
export interface ScoringWindow {
  readonly referenceTime: string;
  readonly referenceDate: string;
  readonly startInclusive: string;
  readonly endExclusive: string;
  readonly calendarDays: 365;
}

const UTC_DAY_MS = 86_400_000;

/** Require a real RFC3339 instant; never interpret a local date using host timezone. */
export function scoringInstant(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) throw new RangeError("Scoring time must be an explicit RFC3339 instant");
  const [, year, month, day, hour, minute, second, offset] = match;
  const calendar = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  const parsed = new Date(value);
  if (!offset || !Number.isFinite(parsed.getTime()) || !Number.isFinite(calendar.getTime()) ||
    calendar.toISOString().slice(0, 10) !== `${year}-${month}-${day}` ||
    Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59 ||
    (offset !== "Z" && (Number(offset.slice(1, 3)) > 23 || Number(offset.slice(4)) > 59))) {
    throw new RangeError("Invalid scoring instant");
  }
  return parsed;
}

export function createScoringWindow(referenceTime: string): ScoringWindow {
  const instant = scoringInstant(referenceTime);
  const referenceDate = instant.toISOString().slice(0, 10);
  const midnight = new Date(`${referenceDate}T00:00:00.000Z`).getTime();
  return Object.freeze({
    referenceTime: instant.toISOString(), referenceDate,
    startInclusive: new Date(midnight - 364 * UTC_DAY_MS).toISOString(),
    endExclusive: new Date(midnight + UTC_DAY_MS).toISOString(), calendarDays: 365,
  });
}

export function isWithinScoringWindow(occurredAt: string, window: ScoringWindow): boolean {
  const event = scoringInstant(occurredAt).getTime();
  return event >= scoringInstant(window.startInclusive).getTime() &&
    event <= scoringInstant(window.referenceTime).getTime() &&
    event < scoringInstant(window.endExclusive).getTime();
}

export function scoringDates(window: ScoringWindow): readonly string[] {
  const start = scoringInstant(window.startInclusive).getTime();
  return Array.from({ length: 365 }, (_, index) => new Date(start + index * UTC_DAY_MS).toISOString().slice(0, 10));
}

export function utcIsoWeek(instant: string): string {
  const date = scoringInstant(instant);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const year = date.getUTCFullYear();
  const yearStart = new Date(`${String(year).padStart(4, "0")}-01-01T00:00:00.000Z`);
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / UTC_DAY_MS + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}
