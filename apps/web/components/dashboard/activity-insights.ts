import type { HeatmapDay } from "@chapa/shared";

export interface ActivityInsights {
  currentStreak: number;
  longestStreak: number;
  busiestDay: string;
  /** Index into DAY_NAMES (0=Sun, 1=Mon, ..., 6=Sat) for the busiest weekday */
  busiestDayIndex: number;
  peakDay: { date: string; count: number };
  /** Total contributions per weekday, indexed Sun=0 through Sat=6 */
  weekdayDistribution: number[];
  /** Mean weekly contribution total across all complete weeks */
  weeklyAverage: number;
  /** Total contributions in the most recent (possibly partial) week */
  thisWeekTotal: number;
  /** Last 7 data entries: true if count > 0 (oldest first) */
  last7DaysActive: boolean[];
  /** Natural-language summary sentence for the header */
  summary: string;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function computeActivityInsights(data: HeatmapDay[]): ActivityInsights {
  if (data.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      busiestDay: "",
      busiestDayIndex: -1,
      peakDay: { date: "", count: 0 },
      weekdayDistribution: [0, 0, 0, 0, 0, 0, 0],
      weeklyAverage: 0,
      thisWeekTotal: 0,
      last7DaysActive: [],
      summary: "No activity recorded yet",
    };
  }

  // Current streak: count from the end backwards while count > 0.
  // If the last entry is today with zero activity, skip it — the day isn't over yet.
  let startIdx = data.length - 1;
  const lastEntry = data[startIdx];
  if (lastEntry && lastEntry.count === 0) {
    // Use local calendar date (not UTC) to match GitHub's date format
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    if (lastEntry.date === today) {
      startIdx--;
    }
  }

  let currentStreak = 0;
  for (let i = startIdx; i >= 0; i--) {
    const entry = data[i];
    if (entry && entry.count > 0) currentStreak++;
    else break;
  }

  // Longest streak
  let longestStreak = 0;
  let streak = 0;
  for (const day of data) {
    if (day.count > 0) {
      streak++;
      if (streak > longestStreak) longestStreak = streak;
    } else {
      streak = 0;
    }
  }

  // Busiest day of the week: sum contributions by weekday
  const dayTotals: number[] = [0, 0, 0, 0, 0, 0, 0];
  for (const day of data) {
    const d = new Date(day.date + "T12:00:00");
    const dow = d.getDay();
    dayTotals[dow] = (dayTotals[dow] ?? 0) + day.count;
  }
  const maxDayTotal = Math.max(...dayTotals);
  const busiestDayIndex = maxDayTotal === 0 ? -1 : dayTotals.indexOf(maxDayTotal);
  const busiestDay =
    busiestDayIndex >= 0 ? (DAY_NAMES[busiestDayIndex] ?? "") : "";

  const activeDaysCount = data.filter((d) => d.count > 0).length;

  // Peak day — data.length > 0 guaranteed by early return above
  let peakDay: HeatmapDay = data[0]!;
  for (const day of data) {
    if (day.count > peakDay.count) peakDay = day;
  }

  // Weekly totals for average calculation
  const weeklyTotals: number[] = [];
  for (let i = 0; i < data.length; i += 7) {
    const chunk = data.slice(i, i + 7);
    weeklyTotals.push(chunk.reduce((s, d) => s + d.count, 0));
  }
  const thisWeekTotal = weeklyTotals[weeklyTotals.length - 1] ?? 0;
  // Average excludes the current (possibly partial) week if there are at least 2 weeks
  const avgWeeks = weeklyTotals.length > 1 ? weeklyTotals.slice(0, -1) : weeklyTotals;
  const weeklyAverage =
    avgWeeks.length > 0
      ? avgWeeks.reduce((s, v) => s + v, 0) / avgWeeks.length
      : 0;

  // Last 7 days activity indicators
  const last7 = data.slice(-7);
  const last7DaysActive = last7.map((d) => d.count > 0);

  // Summary sentence
  const summary = generateSummary(data, weeklyTotals, weeklyAverage, peakDay, activeDaysCount);

  return {
    currentStreak,
    longestStreak,
    busiestDay,
    busiestDayIndex,
    peakDay: { date: peakDay.date, count: peakDay.count },
    weekdayDistribution: dayTotals,
    weeklyAverage,
    thisWeekTotal,
    last7DaysActive,
    summary,
  };
}

// ── Summary generation ────────────────────────────────────────────────

function generateSummary(
  data: HeatmapDay[],
  weeklyTotals: number[],
  weeklyAverage: number,
  peakDay: HeatmapDay,
  activeDaysCount: number
): string {
  if (weeklyTotals.length === 0) return "No activity recorded yet";

  // Find the best week
  let bestWeekIdx = 0;
  let bestWeekTotal = 0;
  for (let i = 0; i < weeklyTotals.length; i++) {
    const t = weeklyTotals[i] ?? 0;
    if (t > bestWeekTotal) {
      bestWeekTotal = t;
      bestWeekIdx = i;
    }
  }

  if (bestWeekTotal === 0) return "No activity recorded yet";

  const ratio = weeklyAverage > 0 ? bestWeekTotal / weeklyAverage : 0;
  const startIdx = bestWeekIdx * 7;
  const startDay = data[startIdx];
  const endDay = data[Math.min(startIdx + 6, data.length - 1)];

  if (ratio > 1.2 && startDay && endDay) {
    const range = formatWeekRange(startDay.date, endDay.date);
    return `Most active week: ${range} — ${ratio.toFixed(1)}x your weekly average`;
  }

  if (peakDay.count > 0) {
    const d = new Date(peakDay.date + "T12:00:00");
    const label = d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    return `Peak day: ${label} with ${peakDay.count.toLocaleString()} contributions`;
  }

  return `${activeDaysCount} active days in the last ${Math.ceil(data.length / 7)} weeks`;
}

function formatWeekRange(startDate: string, endDate: string): string {
  const start = new Date(startDate + "T12:00:00");
  const end = new Date(endDate + "T12:00:00");
  const startLabel = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (start.getMonth() === end.getMonth()) {
    return `${startLabel}–${end.getDate()}`;
  }
  const endLabel = end.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${startLabel}–${endLabel}`;
}
