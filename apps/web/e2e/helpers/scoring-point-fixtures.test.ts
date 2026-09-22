import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createScoringWindow, verifyObservedScoreReceipt } from "@chapa/shared";
import { buildScoringPointSeeds, scoringReportHtml, assertScoringFixtureEnvironment, fixtureStatsBinding, fixtureStatsCacheEntry } from "./scoring-point-fixtures";
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
      expect(seed.legacyImpact.adjustedComposite).toBe(80);
      expect(seed.legacyImpact.archetype).toBe("Builder");
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
