import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getStats, _resetInflight } from "./client";
import { materializeProfile } from "@/lib/profile/materialize-profile";
import { persistProfileSnapshot, getPublicProfileVerification } from "@/lib/profile/public-profile";
import { dbGetLatestSnapshot } from "@/lib/db/snapshots";
import { redisFake } from "@/test/contract/redis-fake";
import { makeFullStats } from "@/lib/test-helpers/fixtures";
import type { StatsData } from "@chapa/shared";

// ---------------------------------------------------------------------------
// Real-pipeline regression contract (2026-07-07 scoring-integrity-contract,
// Phase 5b). Only the network edge (global fetch, for the GitHub GraphQL
// POST) is mocked — getStats/_fetchAndCache (client.ts), fetchStats
// (stats.ts), fetchContributionData (queries.ts), materializeProfile, and
// persistProfileSnapshot/getPublicProfileVerification all run for real
// against the redisFake cache (globally mocked by vitest.contract-setup.ts)
// and the real local Supabase instance.
// ---------------------------------------------------------------------------

/** The juan294 corruption signature: search sees merged PRs, sample is empty. */
function degradedGraphqlResponse() {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        data: {
          user: {
            login: "contract-degraded-user",
            name: "Contract Degraded User",
            avatarUrl: "https://avatars.githubusercontent.com/u/1",
            contributionsCollection: {
              contributionCalendar: { totalContributions: 15533, weeks: [] },
              pullRequestContributions: { totalCount: 143, nodes: [] },
              pullRequestReviewContributions: { totalCount: 16 },
              issueContributions: { totalCount: 5096 },
            },
            repositories: { totalCount: 0, nodes: [] },
          },
          search: { issueCount: 904 },
        },
      }),
  };
}

function healthyStaleStats(handle: string): StatsData {
  return makeFullStats({
    handle,
    prsMergedCount: 904,
    prsMergedWeight: 120,
    commitsTotal: 15533,
    reviewsSubmittedCount: 16,
    issuesClosedCount: 5096,
    fetchScope: "authenticated",
  });
}

describe("scoring-integrity real-pipeline contract", () => {
  beforeEach(() => {
    redisFake.__reset();
    _resetInflight();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("degraded fetch with no stale baseline: getStats returns null, writes nothing to merged/stale", async () => {
    const handle = "contract-degraded-cold";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(degradedGraphqlResponse()));

    const result = await getStats(handle);

    expect(result).toBeNull();
    expect(await redisFake.cacheGet(`stats:v2:merged:${handle}`)).toBeNull();
    expect(await redisFake.cacheGet(`stats:stale:${handle}`)).toBeNull();
  });

  it("degraded fetch with a healthy stale baseline: getStats serves the stale value and does not downgrade it", async () => {
    const handle = "contract-degraded-warm";
    const healthy = healthyStaleStats(handle);
    await redisFake.cacheSet(`stats:stale:${handle}`, healthy, 604800);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(degradedGraphqlResponse()));

    const result = await getStats(handle);

    expect(result).not.toBeNull();
    expect(result!.prsMergedCount).toBe(904);

    const staleAfter = await redisFake.cacheGet<StatsData>(`stats:stale:${handle}`);
    expect(staleAfter).not.toBeNull();
    expect(staleAfter!.prsMergedCount).toBe(904);
  });

  it("persist boundary: a poisoned hot-cache entry never becomes a snapshot row or a verification record", async () => {
    const handle = "contract-poisoned-hot";
    const poisoned = makeFullStats({
      handle,
      prsMergedCount: 0,
      prsMergedWeight: 0,
      commitsTotal: 15585,
      fetchScope: "authenticated",
    });
    // Seed the hot key directly — getStats hits it and returns immediately,
    // never calling _fetchAndCache (no network mock needed for this case).
    await redisFake.cacheSet(`stats:v2:merged:${handle}`, poisoned, 21600);

    const materialized = await materializeProfile(handle);
    expect(materialized).not.toBeNull();
    expect(materialized!.statsComplete).toBe(false);

    const persisted = await persistProfileSnapshot(handle, materialized!);
    expect(persisted).toBe(false);

    const snapshotRow = await dbGetLatestSnapshot(handle);
    expect(snapshotRow).toBeNull();

    expect(getPublicProfileVerification(materialized!)).toBeNull();
  });
});
