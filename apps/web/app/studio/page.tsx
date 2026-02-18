import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { isStudioEnabled } from "@/lib/feature-flags";
import { readSessionCookie } from "@/lib/auth/github";
import { getStats } from "@/lib/github/client";
import { computeImpactV4 } from "@/lib/impact/v4";
import { cacheGet } from "@/lib/cache/redis";
import { Navbar } from "@/components/Navbar";
import { StudioClient } from "./StudioClient";
import type { BadgeConfig, StatsData } from "@chapa/shared";
import { DEFAULT_BADGE_CONFIG } from "@chapa/shared";

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
      date: new Date(now - (365 - i) * 86400000).toISOString().slice(0, 10),
      count: 0,
    })),
    fetchedAt: new Date(now).toISOString(),
  };
}

export const metadata: Metadata = {
  title: "Creator Studio — Chapa",
  description:
    "Customize your developer impact badge with visual effects, animations, and interactions.",
};

export default async function StudioPage() {
  // Feature flag gate — redirect when studio is disabled
  if (!(await isStudioEnabled())) {
    redirect("/");
  }

  // Auth gate — redirect unauthenticated users to login
  const sessionSecret = process.env.NEXTAUTH_SECRET?.trim();
  if (!sessionSecret) {
    redirect("/api/auth/login");
  }

  const headerStore = await headers();
  const session = readSessionCookie(
    headerStore.get("cookie"),
    sessionSecret,
  );

  if (!session) {
    redirect("/api/auth/login");
  }

  // Fetch data in parallel: stats + saved config
  const [stats, savedConfig] = await Promise.all([
    getStats(session.login, session.token),
    cacheGet<BadgeConfig>(`config:${session.login}`),
  ]);

  // Compute impact (fallback to empty stats if fetch failed)
  const effectiveStats: StatsData = stats ?? buildEmptyStats(session);

  const impact = computeImpactV4(effectiveStats);
  const initialConfig = savedConfig ?? DEFAULT_BADGE_CONFIG;

  return (
    <main id="main-content" className="min-h-screen bg-bg">
      <Navbar
        navLinks={[
          { label: "Studio", href: "/studio" },
          { label: "Your Badge", href: `/u/${session.login}` },
        ]}
      />

      <div className="pt-[57px]">
        <StudioClient
          initialConfig={initialConfig}
          stats={effectiveStats}
          impact={impact}
          handle={session.login}
        />
      </div>
    </main>
  );
}
