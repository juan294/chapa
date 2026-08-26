import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { isStudioEnabled } from "@/lib/feature-flags";
import { getOptionalServerSessionFromHeaders } from "@/lib/auth/session";
import { computeImpactV6 } from "@/lib/impact/v6";
import {
  getPublicProfileVerification,
  materializePublicProfile,
} from "@/lib/profile/public-profile";
import { loadStudioConfig } from "@/lib/db/studio";
import { Navbar } from "@/components/Navbar";
import { toDateString } from "@/lib/utils/date";
import { StudioClient } from "./StudioClient";
import type { BadgeConfig, StatsData } from "@chapa/shared";
import { DEFAULT_BADGE_CONFIG } from "@chapa/shared";
import { getSessionGitHubToken } from "@/lib/auth/github-session-token";
import { KeyboardShortcutsListener } from "@/components/KeyboardShortcutsListener";
import { getServerLocale, getServerT } from "@/lib/i18n/server";

function buildEmptyStats(session: {
  login: string;
  name: string | null;
  avatar_url: string;
}): StatsData {
  const now = Date.now();
  return {
    handle: session.login,
    displayName: session.name ?? undefined,
    avatarUrl: session.avatar_url,
    commitsTotal: 0,
    activeDays: 0,
    prsMergedCount: 0,
    prsMergedWeight: 0,
    reviewsSubmittedCount: 0,
    issuesClosedCount: 0,
    linesAdded: 0,
    linesDeleted: 0,
    reposContributed: 0,
    topRepoShare: 0,
    maxCommitsIn10Min: 0,
    totalStars: 0,
    totalForks: 0,
    totalWatchers: 0,
    heatmapData: Array.from({ length: 366 }, (_, i) => ({
      date: toDateString(new Date(now - (365 - i) * 86400000)),
      count: 0,
    })),
    fetchedAt: new Date(now).toISOString(),
  };
}

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const t = getServerT(locale);
  return {
    title: t('studio.metadataTitle') as string,
    description: t('studio.metadataDescription') as string,
    alternates: {
      canonical: "/studio",
    },
  };
}

export default async function StudioPage() {
  // Feature flag gate — redirect when studio is disabled
  if (!(await isStudioEnabled())) {
    redirect("/");
  }

  const session = getOptionalServerSessionFromHeaders(await headers());
  if (!session) {
    redirect("/api/auth/login");
  }

  const token = await getSessionGitHubToken(session);
  if (!token) {
    redirect("/api/auth/login");
  }

  // Fetch data in parallel: read-only public profile + saved config
  const [materialized, savedConfig] = await Promise.all([
    materializePublicProfile(session.login, { token, readOnly: true }),
    loadStudioConfig(session.login) as Promise<BadgeConfig | null>,
  ]);

  // Compute fallback impact only when profile materialization failed.
  const effectiveStats: StatsData = materialized?.stats ?? buildEmptyStats(session);

  const impact = materialized?.displayImpact ?? computeImpactV6(effectiveStats);
  const verification = materialized
    ? getPublicProfileVerification(materialized)
    : null;
  const initialConfig = savedConfig ?? DEFAULT_BADGE_CONFIG;

  const locale = await getServerLocale();
  const t = getServerT(locale);

  return (
    <main id="main-content" className="min-h-screen bg-bg">
      <Navbar
        navLinks={[
          { label: t('studio.navLinkStudio') as string, href: "/studio" },
          { label: t('studio.navLinkYourBadge') as string, href: `/u/${session.login}` },
        ]}
      />

      <div className="pt-[57px]">
        <KeyboardShortcutsListener />
        <StudioClient
          initialConfig={initialConfig}
          stats={effectiveStats}
          impact={impact}
          handle={session.login}
          verification={verification}
        />
      </div>
    </main>
  );
}
