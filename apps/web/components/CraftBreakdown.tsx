"use client";

import type { CraftResult } from "@chapa/shared";
import { InfoTooltip } from "./InfoTooltip";
import { formatDateRange } from "@/lib/utils/date";

interface CraftBreakdownProps {
  craftResult: CraftResult;
}

const DIMENSIONS = [
  {
    key: "proficiency" as const,
    label: "Proficiency",
    tooltip: {
      id: "craft-proficiency",
      tip: "Measures tool mastery — diverse tool usage, agent orchestration, advanced features like parallel sessions, and consistent engagement depth.",
    },
  },
  {
    key: "effectiveness" as const,
    label: "Effectiveness",
    tooltip: {
      id: "craft-effectiveness",
      tip: "Measures outcome quality — how often sessions achieve their goals, satisfaction rates, and how well friction and errors are managed.",
    },
  },
  {
    key: "sophistication" as const,
    label: "Sophistication",
    tooltip: {
      id: "craft-sophistication",
      tip: "Measures workflow complexity — multi-task sessions, lines of code per session, parallel workflows, and breadth of file changes.",
    },
  },
];

export function CraftBreakdown({ craftResult }: CraftBreakdownProps) {
  return (
    <section className="animate-fade-in-up">
      {/* Terminal command header */}
      <div className="mb-3">
        <span className="text-terminal-dim font-heading text-sm">$ </span>
        <span className="text-text-secondary font-heading text-sm">
          craft --breakdown
        </span>
      </div>

      {/* Breakdown card */}
      <div className="rounded-xl border border-stroke bg-card p-5 sm:p-6 pl-4 border-l-2 border-l-stroke">
        {/* Score + tier */}
        <div className="flex items-baseline gap-3 mb-5">
          <span className="font-heading text-3xl sm:text-4xl font-extrabold text-text-primary">
            {craftResult.craftScore}
          </span>
          <div>
            <span className="text-sm font-medium text-amber">
              {craftResult.tier}
            </span>
            <span className="text-xs text-text-secondary ml-2">
              AI Craft Score
            </span>
          </div>
        </div>

        {/* Sub-dimension bars */}
        <div className="space-y-3 mb-5">
          {DIMENSIONS.map((dim) => {
            const value = craftResult.dimensions[dim.key];
            return (
              <div key={dim.key}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                      {dim.label}
                    </span>
                    <InfoTooltip id={dim.tooltip.id} content={dim.tooltip.tip} />
                  </div>
                  <span className="font-heading text-sm font-bold text-text-primary">
                    {value}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-track overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber animate-bar-fill"
                    role="progressbar"
                    aria-valuenow={value}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${dim.label} score`}
                    style={{ width: `${value}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Source + period */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
          <div className="flex items-center gap-1.5">
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
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            <span>Claude Code</span>
          </div>
          <div className="flex items-center gap-1.5">
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
              {formatDateRange(
                craftResult.reportPeriod.start,
                craftResult.reportPeriod.end,
              )}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
