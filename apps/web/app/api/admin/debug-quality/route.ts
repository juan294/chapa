import { type NextRequest, NextResponse } from "next/server";
import { fetchContributionData } from "@/lib/github/queries";
import { buildStatsFromRaw } from "@chapa/shared";
import { computeImpactV4 } from "@/lib/impact/v4";
import { cacheDel, cacheSet } from "@/lib/cache/redis";
import { invalidateSnapshotCache } from "@/lib/cache/snapshot-cache";
import { dbReplaceSnapshot } from "@/lib/db/snapshots";
import { buildSnapshot } from "@/lib/history/snapshot";
import { readSessionCookie } from "@/lib/auth/github";

/**
 * GET /api/admin/debug-quality?handle=juan294
 * Temporary debug endpoint — remove after verification.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const url = new URL(request.url);
  const handle = url.searchParams.get("handle") ?? "juan294";
  const lowerHandle = handle.toLowerCase();

  // Use session token (from browser cookie) or fall back to GITHUB_TOKEN
  const sessionSecret = process.env.NEXTAUTH_SECRET?.trim();
  let token = process.env.GITHUB_TOKEN?.trim();
  if (sessionSecret) {
    const session = readSessionCookie(request.headers.get("cookie"), sessionSecret);
    if (session?.token) token = session.token;
  }

  // Clear both primary and stale cache so badge route picks up fresh data
  await cacheDel(`stats:v2:merged:${lowerHandle}`);
  await cacheDel(`stats:stale:${lowerHandle}`);

  const raw = await fetchContributionData(handle, token);
  if (!raw) {
    return NextResponse.json({ error: "Failed to fetch GitHub data" }, { status: 502 });
  }

  const DEFAULT = new Set(["main", "master", "develop", "development", "dev", "developer", "trunk"]);
  const mergedPRs = raw.pullRequests.nodes.filter((pr) => pr.merged);
  const hasBaseRefName = mergedPRs.some((pr) => pr.baseRefName != null);
  const crossDefault = mergedPRs.filter(
    (pr) => DEFAULT.has(pr.headRefName) && DEFAULT.has(pr.baseRefName!),
  );
  const devPRs = mergedPRs.filter(
    (pr) => !(DEFAULT.has(pr.headRefName) && DEFAULT.has(pr.baseRefName!)),
  );

  const stats = buildStatsFromRaw(raw);
  const impact = computeImpactV4(stats);

  // Cache fresh stats so badge route uses them
  await cacheSet(`stats:v2:merged:${lowerHandle}`, stats, 21600);
  await cacheSet(`stats:stale:${lowerHandle}`, stats, 604800);

  // Replace today's snapshot so EMA smoothing uses the corrected score
  const snapshot = buildSnapshot(stats, impact);
  await dbReplaceSnapshot(handle, snapshot);
  await invalidateSnapshotCache(handle);

  return NextResponse.json({
    handle,
    hasBaseRefName,
    totalMerged: mergedPRs.length,
    crossDefaultCount: crossDefault.length,
    devPRCount: devPRs.length,
    crossDefaultSample: crossDefault.slice(0, 5).map((pr) => ({
      head: pr.headRefName,
      base: pr.baseRefName,
      lines: pr.additions + pr.deletions,
    })),
    devPRSample: devPRs.slice(0, 5).map((pr) => ({
      head: pr.headRefName,
      base: pr.baseRefName,
      lines: pr.additions + pr.deletions,
      body: (pr.body ?? "").substring(0, 40),
      issues: pr.closingIssuesCount,
    })),
    statsRates: {
      prDescriptionRate: stats.prDescriptionRate,
      featureBranchRate: stats.featureBranchRate,
      issueLinkageRate: stats.issueLinkageRate,
      batchSizeScore: stats.batchSizeScore,
      reviewsSubmittedCount: stats.reviewsSubmittedCount,
      prsMergedCount: stats.prsMergedCount,
    },
    impact: {
      profileType: impact.profileType,
      dimensions: impact.dimensions,
      compositeScore: impact.compositeScore,
      adjustedComposite: impact.adjustedComposite,
      confidence: impact.confidence,
      confidencePenalties: impact.confidencePenalties,
    },
  });
}
