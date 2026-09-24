"use client";

import type { StatsData, Platform } from "@chapa/shared";
import { useClientFeatureFlags } from "./ClientFeatureFlagsProvider";
import { useTranslation } from "@/lib/i18n";

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
      {/* An h2: on /u/:handle this is the first heading after the page h1
          and a peer of the "Impact breakdown" / "Embed badge" h2s (LE-8-3). */}
      <h2 className="font-heading text-xs tracking-[0.2em] uppercase text-text-secondary mb-4 animate-fade-in-up [animation-delay:260ms]">
        {t('dashboard.dataSources') as string}
      </h2>
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
          const sharedClass = "inline-flex min-h-[44px] items-center gap-2 rounded-[3px] border border-stroke bg-card px-3 animate-fade-in-up transition-colors";
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
              className={`${sharedClass} hover:border-amber/30 hover:text-amber-text`}
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

        {/* #1220 — EMU/supplemental stats are a real source of the numbers on
            this page, and StatsData says so via hasSupplementalData (set by
            the EMU merge path). It is deliberately labelled "supplemental",
            not "merged": "merged" asserts a verified merge operation that this
            flag does not carry. Shown to visitors too, because it explains
            where the numbers came from. */}
        {stats.hasSupplementalData && (
          <span className="inline-flex min-h-[44px] items-center gap-2 rounded-[3px] border border-stroke bg-card px-3 animate-fade-in-up">
            <svg
              width="16"
              height="16"
              viewBox={PLATFORM_DISPLAY.github.viewBox}
              fill="currentColor"
              className="text-text-secondary"
              aria-hidden="true"
            >
              <path d={PLATFORM_DISPLAY.github.svgPath} />
            </svg>
            <span className="text-sm font-medium text-text-primary">
              {t('dashboard.dataSourceSupplementalLabel') as string}
            </span>
            <span
              data-testid="data-source-status-supplemental"
              className="font-heading text-xs text-terminal-green"
            >
              {t('dashboard.dataSourceSupplemental') as string}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
