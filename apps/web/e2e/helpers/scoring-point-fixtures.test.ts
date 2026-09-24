import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createScoringWindow, verifyObservedScoreReceipt } from "@chapa/shared";
import { buildScoringPointSeeds, scoringReportHtml, assertScoringFixtureEnvironment, fixtureStatsBinding, fixtureStatsCacheEntry, githubZeroActivityResponses } from "./scoring-point-fixtures";
import { GITHUB_EVIDENCE_QUERIES } from "../../lib/github/evidence-queries";
import { withRateLimit } from "../../lib/github/evidence-rate-limit";
import { makeStats } from "../../lib/test-helpers/fixtures";
import { statsCacheBinding, readCachedStats } from "../../lib/cache/stats-cache";
import { createSourceContext } from "../../lib/platform/source-context";
import { cacheGet } from "../../lib/cache/redis";

vi.mock("../../lib/cache/redis", () => ({ cacheGet: vi.fn(), cacheSet: vi.fn() }));

describe("disposable scoring browser fixture", () => {
  it("seals current46, expired unlocked and boundary69.99 with independent expected scalars", async () => {
    const seeds = await buildScoringPointSeeds("2026-09-08T10:00:00.000Z");
    expect(seeds).toHaveLength(4);
    for (const seed of seeds) {
      const receipt = await verifyObservedScoreReceipt(seed.envelope);
      expect(receipt.window.referenceTime).toBe("2026-09-08T10:00:00.000Z");
      expect(receipt.core.composite.displayValue).toBe(seed.handle.endsWith("boundary") ? 69.99 : 46);
      if (!seed.handle.endsWith("boundary")) expect(receipt.core.composite.exact).toBeCloseTo(46.40250879691149, 12);
      if (seed.handle.endsWith("expired")) expect(receipt.craft).toMatchObject({ status: "expired", unlocked: true });
      else expect(receipt.craft.status).toBe("no_report");
    }
  });
  it("renders sanitized report files with complete labels and an eligible past period", () => {
    const html = scoringReportHtml(57, "2026-09-08T10:00:00.000Z");
    expect(html).toContain("2026-09-01 to 2026-09-07");
    expect(html).toContain("Fully Achieved"); expect(html).toContain("Failed");
    expect(scoringReportHtml(0, "2026-09-08T10:00:00.000Z")).toContain('class="bar-value">10');
    expect(html).not.toMatch(/private|email|prompt|token/i);
  });
  it("refuses non-loopback or unacknowledged seed environments before any writes", () => {
    expect(() => assertScoringFixtureEnvironment({ SUPABASE_URL: "https://production.example", REDESIGN_DISPOSABLE_PROJECT: "chapa-redesign" })).toThrow(/loopback/);
    expect(() => assertScoringFixtureEnvironment({ SUPABASE_URL: "http://127.0.0.1:55331" })).toThrow(/acknowledgment/);
    expect(() => assertScoringFixtureEnvironment({ SUPABASE_URL: "http://127.0.0.1:55331", REDESIGN_DISPOSABLE_PROJECT: "chapa-redesign" })).not.toThrow();
    expect(() => assertScoringFixtureEnvironment({ SUPABASE_URL: "http://127.0.0.1:54331", REDESIGN_DISPOSABLE_PROJECT: "chapa-redesign" })).toThrow(/55331|dedicated/);
  });

  // #1335 phase 4.8 — the E2E collection-queue fixture drives the REAL
  // GitHub collector (lib/github/evidence.ts) via a fetch-interception
  // fixture server, never real GitHub. It never queues files/reviews/
  // commits/issues/closures operations for an account with zero
  // repositories/PRs/reviews, so only these 5 canned responses are needed.
  // Keyed by `withRateLimit(query)` for each query text imported from
  // GITHUB_EVIDENCE_QUERIES (not duplicated here): the real collector
  // injects a `rateLimit { ... }` selection into every request before
  // sending it (see evidence.ts), so the raw query constant alone never
  // matches what actually crosses the wire. Sharing `withRateLimit` here
  // means a future change to either the query text or the injection
  // shape invalidates this fixture visibly (a query-text mismatch routes
  // to the interceptor's "Unexpected redesign upstream" error) instead of
  // silently drifting.
  describe("zero-activity GitHub collection responses", () => {
    it("keys a canned response for exactly the 5 operations a zero-activity account queues", () => {
      const responses = githubZeroActivityResponses();
      expect(Object.keys(responses).sort()).toEqual(
        [
          withRateLimit(GITHUB_EVIDENCE_QUERIES.profile),
          withRateLimit(GITHUB_EVIDENCE_QUERIES.repositories),
          withRateLimit(GITHUB_EVIDENCE_QUERIES.contributed),
          withRateLimit(GITHUB_EVIDENCE_QUERIES.merged),
          withRateLimit(GITHUB_EVIDENCE_QUERIES.reviewDiscovery),
        ].sort(),
      );
    });

    it("returns a non-empty profile identity and empty pages for every list", () => {
      const responses = githubZeroActivityResponses() as Record<string, { data: Record<string, unknown> }>;
      const profile = responses[withRateLimit(GITHUB_EVIDENCE_QUERIES.profile)]!.data as { user: { id: string; login: string } };
      expect(profile.user.id.length).toBeGreaterThan(0);
      expect(profile.user.login.length).toBeGreaterThan(0);

      const repositories = responses[withRateLimit(GITHUB_EVIDENCE_QUERIES.repositories)]!.data as { user: { repositories: { totalCount: number; nodes: unknown[]; pageInfo: { hasNextPage: boolean } } } };
      expect(repositories.user.repositories).toMatchObject({ totalCount: 0, nodes: [], pageInfo: { hasNextPage: false } });

      const contributed = responses[withRateLimit(GITHUB_EVIDENCE_QUERIES.contributed)]!.data as { user: { repositoriesContributedTo: { totalCount: number; nodes: unknown[] } } };
      expect(contributed.user.repositoriesContributedTo).toMatchObject({ totalCount: 0, nodes: [] });

      const merged = responses[withRateLimit(GITHUB_EVIDENCE_QUERIES.merged)]!.data as { search: { issueCount: number; nodes: unknown[] } };
      expect(merged.search).toMatchObject({ issueCount: 0, nodes: [] });

      const reviewDiscovery = responses[withRateLimit(GITHUB_EVIDENCE_QUERIES.reviewDiscovery)]!.data as { user: { contributionsCollection: { restrictedContributionsCount: number; pullRequestReviewContributions: { totalCount: number; nodes: unknown[] } } } };
      expect(reviewDiscovery.user.contributionsCollection).toMatchObject({ restrictedContributionsCount: 0, pullRequestReviewContributions: { totalCount: 0, nodes: [] } });
    });
  });
});

// Regression: the fixture writer previously seeded the old `{ binding,
// referenceDate, stats }` shape under the `stats-cache-binding-v1` HMAC
// domain, after `stats-cache.ts` moved to a versioned `schemaVersion: 2`
// envelope and the `-v2` domain (badge-source-outage-resilience,
// 2026-09-22). A cold qualification seed then read as an unconditional
// `readCachedStats` miss for every fixture handle, which cascaded into the
// share-page/badge/verify failures the qualification run observed. These
// tests prove the fixture writer's output is exactly what `readCachedStats`
// accepts as `fresh`, and that its binding is byte-for-byte what production
// derives for the same access context.
describe("fixtureStatsBinding / fixtureStatsCacheEntry — must match the real stats cache", () => {
  const handle = "chapa-score-chromium";
  const referenceTime = "2026-09-08T10:00:00.000Z";
  const secret = "fixture-envelope-regression-secret-0123456789abcdef";
  const token = "redesign-local-fixture";

  beforeEach(() => {
    vi.resetAllMocks();
    process.env.NEXTAUTH_SECRET = secret;
    process.env.GITHUB_TOKEN = token;
  });
  afterEach(() => {
    delete process.env.NEXTAUTH_SECRET;
    delete process.env.GITHUB_TOKEN;
  });

  it("derives the exact same binding as production for the same access context and links", async () => {
    const window = createScoringWindow(referenceTime);
    const context = createSourceContext(
      {
        owner: handle,
        requestedSource: { provider: "github", host: "github.com", login: handle },
        window,
        scope: { discovery: "legacy_upload", repositoryIds: [], eventKinds: [] },
      },
      { kind: "github", token },
    );
    const productionBinding = statsCacheBinding({ accessContextId: context.accessContextId, links: "unlinked|unlinked|unlinked" });

    expect(fixtureStatsBinding(handle, secret, token)).toBe(productionBinding);
  });

  it("seeds an envelope readCachedStats accepts as fresh, bound under the exact production binding", async () => {
    const window = createScoringWindow(referenceTime);
    const context = createSourceContext(
      {
        owner: handle,
        requestedSource: { provider: "github", host: "github.com", login: handle },
        window,
        scope: { discovery: "legacy_upload", repositoryIds: [], eventKinds: [] },
      },
      { kind: "github", token },
    );
    const productionBinding = statsCacheBinding({ accessContextId: context.accessContextId, links: "unlinked|unlinked|unlinked" });
    expect(productionBinding).not.toBeNull();

    const stats = makeStats({ handle, prsMergedCount: 11 });
    const now = new Date(referenceTime);
    const raw = fixtureStatsCacheEntry(handle, window.referenceDate, secret, token, stats, now);
    const entry = JSON.parse(raw) as Record<string, unknown>;

    // The regression shape: `{ binding, referenceDate, stats }` under the
    // now-retired v1 domain. Fails loudly if the writer ever reverts to it.
    expect(entry).not.toHaveProperty("binding");
    expect(entry).toMatchObject({ schemaVersion: 2, authorizationBinding: productionBinding, referenceDate: window.referenceDate });
    expect(typeof entry.capturedAt).toBe("string");
    expect(typeof entry.freshUntil).toBe("string");

    vi.mocked(cacheGet).mockResolvedValue(entry);
    const result = await readCachedStats(handle, productionBinding!, window.referenceDate, now);

    expect(result).toEqual({ status: "fresh", stats, capturedAt: entry.capturedAt });
  });
});
