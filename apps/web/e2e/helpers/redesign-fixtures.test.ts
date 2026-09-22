import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildDerivedVerificationRow } from "./redesign-fixtures";
import { makeFullStats } from "../../lib/test-helpers/fixtures";
import { DEMO_STATS } from "../../lib/render/demoData";
import { computeImpactV6 } from "../../lib/impact/v6";
import { generateVerificationCode } from "../../lib/verification/hmac";

// Regression: `assertShareVerification` (deployment-probes.ts) reads
// octocat's share page as a read-only smoke probe, extracts the
// `/verify/{hash}` link the live render produced, then looks that exact
// hash up via `/api/verify/{hash}`. The live render computes that hash with
// `getPublicProfileVerification` -> `generateVerificationCode`, but never
// persists it under `readOnly: true` — so on a genuinely cold seed (no
// earlier non-read-only render of /u/octocat), the lookup 404s regardless
// of the stats-cache envelope fix. `buildDerivedVerificationRow` must
// produce a row whose hash is byte-identical to what the live production
// path independently derives for the same stats, so a cold seed can
// pre-populate it.
describe("buildDerivedVerificationRow — must match the real production hash", () => {
  const secret = "redesign-fixture-verification-regression-secret-0123456789abcdef";

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-22T12:00:00.000Z"));
    vi.stubEnv("CHAPA_VERIFICATION_SECRET", secret);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("derives the exact same hash and scores generateVerificationCode would mint for a live render", () => {
    const stats = makeFullStats({ ...DEMO_STATS, handle: "octocat", displayName: "octocat", avatarUrl: "", linkedPlatforms: [], linkedPlatformLogins: {}, fetchedAt: new Date().toISOString() });

    const row = buildDerivedVerificationRow(stats, secret, new Date());

    // What a live, non-read-only render would independently compute and
    // persist for the identical stats.
    const impact = computeImpactV6(stats);
    const liveVerification = generateVerificationCode(stats, impact);
    expect(liveVerification).not.toBeNull();

    expect(row.hash).toBe(liveVerification!.hash);
    expect(row.generated_at).toBe(liveVerification!.date);
    expect(row).toMatchObject({
      handle: "octocat",
      adjusted_composite: impact.adjustedComposite,
      confidence: impact.confidence,
      tier: impact.tier,
      archetype: impact.archetype,
      profile_type: impact.profileType,
      building: impact.dimensions.delivery,
      guarding: impact.dimensions.quality,
      consistency: impact.dimensions.consistency,
      breadth: impact.dimensions.breadth,
      commits_total: stats.commitsTotal,
      prs_merged_count: stats.prsMergedCount,
      reviews_submitted: stats.reviewsSubmittedCount,
    });
  });

  it("changes hash when the underlying stats change", () => {
    const stats = makeFullStats({ ...DEMO_STATS, handle: "octocat", displayName: "octocat", avatarUrl: "", linkedPlatforms: [], linkedPlatformLogins: {}, fetchedAt: new Date().toISOString() });
    const other = makeFullStats({ ...DEMO_STATS, handle: "octocat", displayName: "octocat", avatarUrl: "", linkedPlatforms: [], linkedPlatformLogins: {}, fetchedAt: new Date().toISOString(), commitsTotal: stats.commitsTotal + 500 });

    expect(buildDerivedVerificationRow(stats, secret).hash).not.toBe(buildDerivedVerificationRow(other, secret).hash);
  });
});
