"use client";

import type { Insight } from "@/lib/dashboard/generate-insights";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface InsightCardProps {
  insight: Insight;
  animationDelay?: number;
}

// ---------------------------------------------------------------------------
// Helpers — border color & icon color resolution
// ---------------------------------------------------------------------------

type ColorResult =
  | { mode: "class"; className: string }
  | { mode: "style"; style: string };

function resolveColor(insight: Insight): ColorResult {
  switch (insight.type) {
    case "trend":
      return insight.icon === "trending-up"
        ? { mode: "class", className: "border-l-terminal-green" }
        : { mode: "class", className: "border-l-terminal-yellow" };
    case "tip":
      if (insight.dimension) {
        return {
          mode: "style",
          style: `var(--color-dimension-${insight.dimension})`,
        };
      }
      return { mode: "class", className: "border-l-amber" };
    case "achievement":
      return { mode: "class", className: "border-l-terminal-green" };
    case "next-tier":
      return { mode: "class", className: "border-l-amber" };
  }
}

// ---------------------------------------------------------------------------
// Icons (inline SVG, 20x20, stroke style)
// ---------------------------------------------------------------------------

interface IconProps {
  color: ColorResult;
}

function TrendingUpIcon({ color }: IconProps) {
  const svgProps = iconSvgProps(color);
  return (
    <svg {...svgProps}>
      <path
        d="M2 17L8 11L12 15L18 3"
        stroke={svgProps.stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <polyline
        points="18 3 18 9"
        stroke={svgProps.stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <polyline
        points="18 3 12 3"
        stroke={svgProps.stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function TrendingDownIcon({ color }: IconProps) {
  const svgProps = iconSvgProps(color);
  return (
    <svg {...svgProps}>
      <path
        d="M2 3L8 9L12 5L18 17"
        stroke={svgProps.stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <polyline
        points="18 17 18 11"
        stroke={svgProps.stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <polyline
        points="18 17 12 17"
        stroke={svgProps.stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function TargetIcon({ color }: IconProps) {
  const svgProps = iconSvgProps(color);
  return (
    <svg {...svgProps}>
      <circle
        cx="10"
        cy="10"
        r="8"
        stroke={svgProps.stroke}
        strokeWidth="1.5"
        fill="none"
      />
      <circle
        cx="10"
        cy="10"
        r="3"
        stroke={svgProps.stroke}
        strokeWidth="1.5"
        fill="none"
      />
      <circle cx="10" cy="10" r="1" fill={svgProps.stroke} />
    </svg>
  );
}

function TrophyIcon({ color }: IconProps) {
  const svgProps = iconSvgProps(color);
  const s = svgProps.stroke;
  return (
    <svg {...svgProps}>
      <path
        d="M6 2H14V8C14 11.3 12.2 13 10 13C7.8 13 6 11.3 6 8V2Z"
        stroke={s}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M4 2H6" stroke={s} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14 2H16" stroke={s} strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M4 2C4 4 5 5 6 5"
        stroke={s}
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M16 2C16 4 15 5 14 5"
        stroke={s}
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M8 13V15" stroke={s} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 13V15" stroke={s} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M6 15H14" stroke={s} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function LightbulbIcon({ color }: IconProps) {
  const svgProps = iconSvgProps(color);
  const s = svgProps.stroke;
  return (
    <svg {...svgProps}>
      <path d="M9 18H11" stroke={s} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10 2V3" stroke={s} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M3 10H4" stroke={s} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M16 10H17" stroke={s} strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M5.6 5.6L6.3 6.3"
        stroke={s}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M14.4 5.6L13.7 6.3"
        stroke={s}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M8 14C6.3 13 5 11.2 5 9A5 5 0 1110 4A5 5 0 0115 9C15 11.2 13.7 13 12 14V15H8V14Z"
        stroke={s}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function ArrowUpIcon({ color }: IconProps) {
  const svgProps = iconSvgProps(color);
  return (
    <svg {...svgProps}>
      <path
        d="M10 18V2"
        stroke={svgProps.stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M3 9L10 2L17 9"
        stroke={svgProps.stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function iconSvgProps(color: ColorResult) {
  const base = {
    width: 20,
    height: 20,
    viewBox: "0 0 20 20",
    "aria-hidden": "true" as const,
    fill: "none",
  };

  if (color.mode === "style") {
    return {
      ...base,
      stroke: color.style,
      style: { stroke: color.style },
    };
  }
  // Map Tailwind border-l class to a text-* class for currentColor
  const textClass = color.className
    .replace("border-l-", "text-");
  return {
    ...base,
    stroke: "currentColor",
    className: textClass,
  };
}

const ICON_MAP: Record<
  Insight["icon"],
  React.ComponentType<IconProps>
> = {
  "trending-up": TrendingUpIcon,
  "trending-down": TrendingDownIcon,
  target: TargetIcon,
  trophy: TrophyIcon,
  lightbulb: LightbulbIcon,
  "arrow-up": ArrowUpIcon,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InsightCard({
  insight,
  animationDelay = 0,
}: InsightCardProps) {
  const color = resolveColor(insight);
  const IconComponent = ICON_MAP[insight.icon];

  // Build container classes
  const baseClasses =
    "rounded-xl border border-stroke bg-card p-4 border-l-4 animate-fade-in-up";

  const achievementBg =
    insight.type === "achievement" ? " bg-terminal-green/5" : "";

  // Border-left class (only used when color.mode === "class")
  const borderClass = color.mode === "class" ? ` ${color.className}` : "";

  const containerClassName = `${baseClasses}${achievementBg}${borderClass}`;

  // Inline styles for animation delay + dimension border color
  const containerStyle: React.CSSProperties = {
    animationDelay: `${animationDelay}ms`,
    ...(color.mode === "style" ? { borderLeftColor: color.style } : {}),
  };

  return (
    <div
      role="article"
      aria-label={`${insight.headline} ${insight.body}`}
      className={containerClassName}
      style={containerStyle}
    >
      {/* Header row: icon + headline */}
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex-shrink-0">
          <IconComponent color={color} />
        </div>
        <div className="min-w-0">
          <p className="font-heading text-sm font-semibold text-text-primary">
            {insight.headline}
          </p>
          <p className="mt-1 text-sm text-text-secondary leading-relaxed">
            {insight.body}
          </p>
        </div>
      </div>
    </div>
  );
}
