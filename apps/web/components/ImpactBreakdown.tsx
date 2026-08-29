"use client";

import type {
  ClientImpactV6Result,
  ImpactV6Result,
  StatsData,
  Platform,
  DimensionScores,
} from "@chapa/shared";
import { formatCompact } from "@chapa/shared";
import { InfoTooltip } from "./InfoTooltip";
import { useClientFeatureFlags } from "./ClientFeatureFlagsProvider";
import { useTranslation } from "@/lib/i18n";
import { interpolate } from "@/lib/i18n/interpolate";

const DIMENSION_COLORS: Record<string, { from: string; to: string }> = {
  delivery: { from: "var(--color-dimension-delivery)", to: "var(--color-dimension-delivery-light)" },
  quality: { from: "var(--color-dimension-quality)", to: "var(--color-dimension-quality-light)" },
  consistency: { from: "var(--color-dimension-consistency)", to: "var(--color-dimension-consistency-light)" },
  breadth: { from: "var(--color-dimension-breadth)", to: "var(--color-dimension-breadth-light)" },
  craft: { from: "var(--color-dimension-craft)", to: "var(--color-dimension-craft-light)" },
};


const DIMENSION_TOOLTIP_IDS: Record<string, string> = {
  delivery: "dim-delivery",
  quality: "dim-quality",
  consistency: "dim-consistency",
  breadth: "dim-breadth",
  craft: "dim-craft",
};

const STAT_KEYS = [
  ["stars", "stat-stars"],
  ["forks", "stat-forks"],
  ["watchers", "stat-watchers"],
  ["activeDays", "stat-active-days"],
  ["commits", "stat-commits"],
  ["prsMerged", "stat-prs-merged"],
  ["reviews", "stat-reviews"],
  ["repos", "stat-repos"],
] as const;

const PLATFORM_DISPLAY: Record<Platform, { label: string; svgPath: string; viewBox: string }> = {
  github: {
    label: "GitHub",
    svgPath: "M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 01-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 010 8c0-4.42 3.58-8 8-8z",
    viewBox: "0 0 16 16",
  },
  bitbucket: {
    label: "Bitbucket",
    svgPath: "M.778 1.211a.768.768 0 00-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 00.77-.646l3.27-20.03a.768.768 0 00-.768-.891zM14.52 15.53H9.522L8.17 8.466h7.561z",
    viewBox: "0 0 24 24",
  },
  codeberg: {
    label: "Codeberg",
    svgPath: "M11.955.49A12 12 0 0 0 0 12.49a12 12 0 0 0 1.832 6.373L11.838 5.928a.187.187 0 0 1 .324 0l10.006 12.935A12 12 0 0 0 24 12.49a12 12 0 0 0-12-12 12 12 0 0 0-.045 0zm.375 6.467l4.416 5.774-4.416 3.252-4.416-3.252z",
    viewBox: "0 0 24 24",
  },
  gitlab: {
    label: "GitLab",
    svgPath: "m23.6004 9.5927-.0337-.0862L20.3.9814a.851.851 0 0 0-.3362-.405.8748.8748 0 0 0-.9997.0539.8748.8748 0 0 0-.29.4399l-2.2055 6.748H7.5375l-2.2057-6.748a.8573.8573 0 0 0-.29-.4412.8748.8748 0 0 0-.9997-.0539.8585.8585 0 0 0-.3362.405L.4332 9.5065l-.0325.0862a6.0657 6.0657 0 0 0 2.0119 7.0105l.0113.0087.0301.0213 4.976 3.7264 2.462 1.8633 1.4995 1.1321a1.0085 1.0085 0 0 0 1.2197 0l1.4995-1.1321 2.462-1.8633 5.006-3.7489.0125-.01a6.0682 6.0682 0 0 0 2.0094-7.003z",
    viewBox: "0 0 24 24",
  },
};

// URL builders per platform. GitHub uses the main handle; Bitbucket/Codeberg/GitLab
// use the platform-specific username from linkedPlatformLogins.
const PLATFORM_URLS: Partial<Record<Platform, (username: string) => string>> = {
  github: (username) => `https://github.com/${username}`,
  bitbucket: (username) => `https://bitbucket.org/${username}`,
  codeberg: (username) => `https://codeberg.org/${username}`,
  gitlab: (username) => `https://gitlab.com/${username}`,
};

/**
 * The canonical order the data-source row lists platforms in. Unlinked ones are
 * shown to the owner as a "connect" affordance, so the row reads as a status
 * list rather than a list of things that happen to be connected (#1217).
 */
const DATA_SOURCE_PLATFORMS: Platform[] = [
  "github",
  "gitlab",
  "bitbucket",
  "codeberg",
];

const PLATFORM_CONNECT_PATHS: Partial<Record<Platform, string>> = {
  bitbucket: "/api/auth/bitbucket/connect",
  codeberg: "/api/auth/codeberg/connect",
  gitlab: "/api/auth/gitlab/connect",
};

interface DataSourcesProps {
  stats: StatsData;
  handle: string;
  /**
   * Only the owner can act on an unconnected platform, so only the owner sees
   * the "connect" entries. A visitor sees the linked sources alone.
   */
  isOwner?: boolean;
}

export function DataSources({ stats, handle, isOwner = false }: DataSourcesProps) {
  const { t } = useTranslation();
  const flags = useClientFeatureFlags();
  const linked = new Set<Platform>([
    "github",
    ...(stats.linkedPlatforms?.filter((p): p is Platform => p !== "github") ?? []),
  ]);
  const connectable: Partial<Record<Platform, boolean>> = {
    bitbucket: flags.bitbucketEnabled,
    codeberg: flags.codebergEnabled,
    gitlab: flags.gitlabEnabled,
  };
  const platforms = DATA_SOURCE_PLATFORMS.filter(
    (platform) =>
      linked.has(platform) ||
      (isOwner && connectable[platform] === true && PLATFORM_CONNECT_PATHS[platform]),
  );

  return (
    <div>
      <h3 className="font-heading text-xs tracking-[0.2em] uppercase text-text-secondary mb-4 animate-fade-in-up [animation-delay:260ms]">
        {t('dashboard.dataSources') as string}
      </h3>
      <div className="flex flex-wrap gap-3">
        {platforms.map((platform, i) => {
          const display = PLATFORM_DISPLAY[platform];
          if (!display) return null;
          const isLinked = linked.has(platform);
          const urlBuilder = PLATFORM_URLS[platform];
          // GitHub uses the main handle; linked platforms use their own username
          const username = platform === "github"
            ? handle
            : stats.linkedPlatformLogins?.[platform];
          const href = isLinked
            ? (urlBuilder && username ? urlBuilder(username) : null)
            : (PLATFORM_CONNECT_PATHS[platform] ?? null);
          const sharedClass = "inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-stroke bg-card px-3 animate-fade-in-up transition-colors";
          const inner = (
            <>
              <svg
                width="16"
                height="16"
                viewBox={display.viewBox}
                fill="currentColor"
                className="text-text-secondary"
                aria-hidden="true"
              >
                <path d={display.svgPath} />
              </svg>
              <span className="text-sm text-text-primary font-medium">
                {display.label}
              </span>
              {/* The status word is what turns this from a list of logos into a
                  row that says where the numbers came from (#1217). */}
              <span
                data-testid={`data-source-status-${platform}`}
                className={`font-heading text-xs ${
                  isLinked ? "text-terminal-green" : "text-terminal-dim"
                }`}
              >
                {t(
                  isLinked
                    ? "dashboard.dataSourceLinked"
                    : "dashboard.dataSourceConnect",
                ) as string}
              </span>
            </>
          );
          return href ? (
            <a
              key={platform}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={`${sharedClass} hover:border-amber/30 hover:text-amber`}
              style={{ animationDelay: `${280 + i * 80}ms` }}
            >
              {inner}
            </a>
          ) : (
            <span
              key={platform}
              className={sharedClass}
              style={{ animationDelay: `${280 + i * 80}ms` }}
            >
              {inner}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function toArchetypeKey(archetype: string): string {
  const map: Record<string, string> = {
    'Builder': 'builder',
    'Quality Champion': 'qualityChampion',
    'Marathoner': 'marathoner',
    'Polymath': 'polymath',
    'Balanced': 'balanced',
    'Emerging': 'emerging',
    'Artificer': 'artificer',
  };
  return map[archetype] ?? archetype.toLowerCase();
}

/**
 * Generate a rich profile description with archetype context and an
 * actionable tip for the developer's weakest dimension.
 */
export function getArchetypeProfile(
  // #1067 — may be a redacted PublicImpactV6Result for a non-owner
  // share-page visitor; this function never reads confidence.
  impact: ClientImpactV6Result,
  t: (key: string) => string | string[] | Record<string, unknown>[],
): string {
  const profile = t(`archetypeProfiles.${toArchetypeKey(impact.archetype)}`) as string;
  const dims = impact.dimensions;

  // Find the weakest dimension (skip for Balanced/Emerging -- tips don't apply the same way)
  if (impact.archetype === "Balanced" || impact.archetype === "Emerging") {
    return profile;
  }

  const entries = Object.entries(dims) as [string, number][];
  const weakest = entries.reduce((min, curr) => (curr[1] < min[1] ? curr : min));
  const isSolo = impact.profileType === "solo";
  const finalTip = (isSolo && weakest[0] === 'quality')
    ? t('dimensionTips.qualitySolo') as string
    : t(`dimensionTips.${weakest[0]}`) as string;

  return `${profile} ${finalTip}`;
}

interface ImpactBreakdownProps {
  impact: ImpactV6Result;
  stats: StatsData;
}

export function ImpactBreakdown({ impact, stats }: ImpactBreakdownProps) {
  const { t } = useTranslation();

  if (!impact || !stats) {
    return (
      <div className="rounded-xl border border-stroke bg-card p-8 text-center">
        <p className="text-sm text-text-secondary">
          {t('dashboard.noImpactData') as string}
        </p>
      </div>
    );
  }

  const dims = impact.dimensions;
  const isSolo = impact.profileType === "solo";
  const hasCraft = dims.craft != null;
  const activeDimensions: (keyof DimensionScores)[] = hasCraft
    ? ["delivery", "quality", "consistency", "breadth", "craft"]
    : ["delivery", "quality", "consistency", "breadth"];
  const statValues = {
    stars: stats.totalStars ?? 0,
    forks: stats.totalForks ?? 0,
    watchers: stats.totalWatchers ?? 0,
    activeDays: stats.activeDays ?? 0,
    commits: stats.commitsTotal ?? 0,
    prsMerged: stats.prsMergedCount ?? 0,
    reviews: stats.reviewsSubmittedCount ?? 0,
    repos: stats.reposContributed ?? 0,
  };

  return (
    <div className="space-y-10">
      {/* ── Dimension Cards ────────────────────────────────── */}
      <div>
        <h3 className="font-heading text-xs tracking-[0.2em] uppercase text-text-secondary mb-4 text-balance">
          {t('dashboard.performanceDimensions') as string}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {activeDimensions.map(
            (key, i) => (
              <div
                key={key}
                className="rounded-xl bg-card shadow-card p-4 animate-fade-in-up relative hover:z-10 focus-within:z-10 transition-shadow hover:shadow-card-hover"
                style={{ animationDelay: `${400 + i * 100}ms` }}
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="text-xs text-text-secondary uppercase tracking-wider flex items-center gap-1">
                    {t(`dimensions.${key}.label`) as string}
                    <InfoTooltip
                      id={DIMENSION_TOOLTIP_IDS[key]!}
                      content={t(
                        isSolo && key === 'quality'
                          ? 'dimensions.quality.soloTip'
                          : `dimensions.${key}.tip`,
                      ) as string}
                    />
                  </span>
                  <span className="font-heading text-3xl font-extrabold text-text-primary leading-none tabular-nums">
                    {dims[key]}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-valuenow={dims[key]}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={interpolate(t('aria.impactScore') as string, { label: t(`dimensions.${key}.label`) as string })}
                  className="h-1.5 rounded-full bg-track overflow-hidden"
                >
                  <div
                    className="h-full rounded-full animate-bar-fill"
                    style={{
                      width: `${dims[key]}%`,
                      background: `linear-gradient(to right, ${DIMENSION_COLORS[key]!.from}, ${DIMENSION_COLORS[key]!.to})`,
                      animationDelay: `${600 + i * 100}ms`,
                    }}
                  />
                </div>
                <p className="text-xs text-text-secondary/50 mt-2.5 leading-relaxed">
                  {t(
                    isSolo && key === 'quality'
                      ? 'dimensions.quality.soloSubtitle'
                      : `dimensions.${key}.subtitle`,
                  ) as string}
                </p>
              </div>
            ),
          )}
        </div>
      </div>

      {/* ── Stats Grid ─────────────────────────────────────── */}
      <div>
        <h3 className="font-heading text-xs tracking-[0.2em] uppercase text-text-secondary mb-4">
          {t('dashboard.keyNumbers') as string}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {STAT_KEYS.map(([key, tooltipId], i) => {
            const label = t(`dashboard.stats.${key}.label`) as string;

            return (
              <div
                key={key}
                className="rounded-xl bg-card shadow-card px-3 py-4 text-center animate-fade-in-up relative hover:z-10 focus-within:z-10 transition-shadow hover:shadow-card-hover"
                style={{ animationDelay: `${700 + i * 60}ms` }}
              >
                <div className="font-heading text-2xl font-extrabold text-text-primary leading-none tabular-nums">
                  {formatCompact(statValues[key])}
                </div>
                <div className="text-xs text-text-secondary uppercase tracking-wider mt-1.5 flex items-center justify-center gap-1">
                  {label}
                  <InfoTooltip
                    id={tooltipId}
                    content={t(`dashboard.stats.${key}.tip`) as string}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
