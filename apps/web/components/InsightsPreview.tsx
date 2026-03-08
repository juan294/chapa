"use client";

import type { InsightsUpload } from "@chapa/shared";
import { formatShortDate } from "@/lib/utils/date";

interface InsightsPreviewProps {
  data: InsightsUpload;
}

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function InsightsPreview({ data }: InsightsPreviewProps) {
  const topTools = Object.entries(data.toolUsage)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);
  const maxToolCount = topTools[0]?.[1] ?? 1;

  const totalOutcomes =
    data.outcomes.fullyAchieved +
    data.outcomes.mostlyAchieved +
    data.outcomes.partiallyAchieved;
  const achievementPct =
    totalOutcomes > 0
      ? Math.round(
          ((data.outcomes.fullyAchieved + data.outcomes.mostlyAchieved * 0.7) /
            totalOutcomes) *
            100,
        )
      : 0;

  return (
    <div className="space-y-5">
      {/* Period */}
      <div className="flex items-center gap-2 text-xs text-text-secondary">
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span>
          {formatShortDate(data.reportPeriod.start)} –{" "}
          {formatShortDate(data.reportPeriod.end)}
        </span>
      </div>

      {/* Volume grid */}
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: "Messages", value: formatNumber(data.volume.messages) },
          {
            label: "Lines changed",
            value: `+${formatNumber(data.volume.linesAdded)} / -${formatNumber(data.volume.linesDeleted)}`,
          },
          { label: "Files touched", value: formatNumber(data.volume.files) },
          { label: "Days active", value: String(data.volume.days) },
          { label: "Sessions", value: String(data.totalSessions) },
          { label: "Msgs/day", value: String(Math.round(data.volume.msgsPerDay)) },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-stroke bg-bg px-3 py-2.5 text-center"
          >
            <dd className="font-heading text-lg font-bold text-text-primary leading-none">
              {stat.value}
            </dd>
            <dt className="text-[10px] text-text-secondary uppercase tracking-wider mt-1">
              {stat.label}
            </dt>
          </div>
        ))}
      </dl>

      {/* Top tools */}
      <div>
        <h4 className="text-xs text-text-secondary uppercase tracking-wider mb-2">
          Top Tools
        </h4>
        <div className="space-y-1.5">
          {topTools.map(([tool, count]) => (
            <div key={tool} className="flex items-center gap-2 text-sm">
              <span className="w-16 text-right font-heading text-text-primary text-xs">
                {tool}
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-track overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber"
                  style={{ width: `${(count / maxToolCount) * 100}%` }}
                />
              </div>
              <span className="w-10 text-right text-xs text-text-secondary font-heading">
                {formatNumber(count)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Outcomes + Multi-clauding row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-stroke bg-bg px-3 py-2.5">
          <div className="font-heading text-lg font-bold text-text-primary leading-none">
            {achievementPct}%
          </div>
          <div className="text-[10px] text-text-secondary uppercase tracking-wider mt-1">
            Achievement rate
          </div>
        </div>
        <div className="rounded-lg border border-stroke bg-bg px-3 py-2.5">
          <div className="font-heading text-lg font-bold text-text-primary leading-none">
            {data.multiClauding.overlapEvents}
          </div>
          <div className="text-[10px] text-text-secondary uppercase tracking-wider mt-1">
            Parallel sessions
          </div>
        </div>
      </div>
    </div>
  );
}
