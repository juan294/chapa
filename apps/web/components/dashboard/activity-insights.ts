import type { HeatmapDay } from "@chapa/shared";

export interface ActivityInsights {
  currentStreak: number;
  longestStreak: number;
  busiestDay: string;
  avgPerActiveDay: number;
  peakDay: { date: string; count: number };
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function computeActivityInsights(data: HeatmapDay[]): ActivityInsights {
  if (data.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      busiestDay: "",
      avgPerActiveDay: 0,
      peakDay: { date: "", count: 0 },
    };
  }

  // Current streak: count from the end backwards while count > 0
  let currentStreak = 0;
  for (let i = data.length - 1; i >= 0; i--) {
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
  const busiestDay =
    maxDayTotal === 0 ? "" : (DAY_NAMES[dayTotals.indexOf(maxDayTotal)] ?? "");

  // Average contributions per active day
  const activeDays = data.filter((d) => d.count > 0);
  const totalContributions = activeDays.reduce((sum, d) => sum + d.count, 0);
  const avgPerActiveDay =
    activeDays.length > 0 ? totalContributions / activeDays.length : 0;

  // Peak day — data.length > 0 guaranteed by early return above
  let peakDay: HeatmapDay = data[0]!;
  for (const day of data) {
    if (day.count > peakDay.count) peakDay = day;
  }

  return {
    currentStreak,
    longestStreak,
    busiestDay,
    avgPerActiveDay,
    peakDay: { date: peakDay.date, count: peakDay.count },
  };
}
