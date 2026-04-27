import { readFileSync } from "node:fs";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildPayload, computeHash, generateVerificationCode } from "./hmac";
import type { StatsData, ImpactV6Result } from "@chapa/shared";

const HMAC_V2_FIXTURE = JSON.parse(
  readFileSync(new URL("./__fixtures__/hmac-v2.json", import.meta.url), "utf8"),
) as {
  date: string;
  payload: string;
  secret: string;
  hash: string;
};

const HMAC_V2_GOLDEN_VECTORS = JSON.parse(
  readFileSync(
    new URL("./__fixtures__/hmac-v2-golden-vectors.json", import.meta.url),
    "utf8",
  ),
) as Array<{
  label: string;
  stats: Pick<
    StatsData,
    | "handle"
    | "commitsTotal"
    | "prsMergedCount"
    | "reviewsSubmittedCount"
    | "activeDays"
    | "reposContributed"
  >;
  impact: Pick<
    ImpactV6Result,
    "adjustedComposite" | "confidence" | "tier" | "archetype"
  > & {
    dimensions: Pick<
      ImpactV6Result["dimensions"],
      "delivery" | "quality" | "consistency" | "breadth" | "craft"
    >;
  };
  date: string;
  secret: string;
  expectedPayload: string;
  expectedHash: string;
}>;

const baseStats: StatsData = {
  handle: "TestUser",
  displayName: "Test User",
  commitsTotal: 200,
  activeDays: 120,
  prsMergedCount: 30,
  prsMergedWeight: 60,
  reviewsSubmittedCount: 50,
  issuesClosedCount: 10,
  linesAdded: 5000,
  linesDeleted: 2000,
  reposContributed: 5,
  topRepoShare: 0.4,
  maxCommitsIn10Min: 3,
  totalStars: 100,
  totalForks: 20,
  totalWatchers: 15,
  heatmapData: [],
  fetchedAt: "2025-01-15T00:00:00Z",
};

const baseImpact: ImpactV6Result = {
  handle: "TestUser",
  profileType: "collaborative",
  dimensions: { delivery: 70, quality: 50, consistency: 60, breadth: 40 },
  archetype: "Builder",
  compositeScore: 55,
  confidence: 85,
  confidencePenalties: [],
  adjustedComposite: 52,
  tier: "Solid",
  computedAt: "2025-01-15T00:00:00Z",
};

function makeGoldenStats(
  overrides: Partial<StatsData>,
): StatsData {
  return {
    ...baseStats,
    ...overrides,
  };
}

function makeGoldenImpact(
  overrides: Partial<ImpactV6Result>,
): ImpactV6Result {
  return {
    ...baseImpact,
    ...overrides,
    dimensions: {
      ...baseImpact.dimensions,
      ...(overrides.dimensions ?? {}),
    },
  };
}

describe("buildPayload", () => {
  it("produces a deterministic v2 pipe-delimited string", () => {
    const result = buildPayload(baseStats, baseImpact, "2025-06-15");
    expect(result).toBe(
      "v2|testuser|52|85|Solid|Builder|70|50|60|40|0|200|30|50|120|5|2025-06-15",
    );
  });

  it("includes the v2 version byte at the start", () => {
    const result = buildPayload(baseStats, baseImpact, "2025-06-15");
    expect(result.startsWith("v2|")).toBe(true);
  });

  it("lowercases the handle", () => {
    const result = buildPayload(baseStats, baseImpact, "2025-06-15");
    expect(result.startsWith("v2|testuser|")).toBe(true);
  });

  it("uses the adjustedComposite (not compositeScore)", () => {
    const result = buildPayload(baseStats, baseImpact, "2025-06-15");
    const parts = result.split("|");
    expect(parts[2]).toBe("52"); // adjustedComposite, not 55
  });

  it("rounds dimension scores to integers", () => {
    const impact = {
      ...baseImpact,
      dimensions: { delivery: 70.6, quality: 50.3, consistency: 60.9, breadth: 40.1 },
    };
    const result = buildPayload(baseStats, impact, "2025-06-15");
    const parts = result.split("|");
    expect(parts[6]).toBe("71"); // delivery rounded
    expect(parts[7]).toBe("50"); // quality rounded
    expect(parts[8]).toBe("61"); // consistency rounded
    expect(parts[9]).toBe("40"); // breadth rounded
  });

  it("includes activeDays, reposContributed, and craft", () => {
    const impact = {
      ...baseImpact,
      dimensions: {
        ...baseImpact.dimensions,
        craft: 12.6,
      },
    };
    const result = buildPayload(baseStats, impact, "2025-06-15");
    expect(result).toContain("|120|");
    expect(result).toContain("|5|2025-06-15");
    expect(result.split("|")[9]).toBe("40");
    expect(result.split("|")[10]).toBe("13");
  });

  it("produces different hashes when reposContributed differs", () => {
    const a = buildPayload(baseStats, baseImpact, "2025-06-15");
    const b = buildPayload(
      { ...baseStats, reposContributed: 12 },
      baseImpact,
      "2025-06-15",
    );

    expect(computeHash(a, "test-secret")).not.toBe(computeHash(b, "test-secret"));
  });

  it("matches the committed hmac-v2 golden vector", () => {
    expect(buildPayload(baseStats, baseImpact, HMAC_V2_FIXTURE.date)).toBe(
      HMAC_V2_FIXTURE.payload,
    );
    expect(computeHash(HMAC_V2_FIXTURE.payload, HMAC_V2_FIXTURE.secret)).toBe(
      HMAC_V2_FIXTURE.hash,
    );
  });
});

describe("computeHash", () => {
  it("returns a 32-character hex string (128 bits)", () => {
    const hash = computeHash("some-payload", "secret");
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
  });

  it("is deterministic for same input", () => {
    const a = computeHash("payload", "secret");
    const b = computeHash("payload", "secret");
    expect(a).toBe(b);
  });

  it("changes when payload changes", () => {
    const a = computeHash("payload-a", "secret");
    const b = computeHash("payload-b", "secret");
    expect(a).not.toBe(b);
  });

  it("changes when secret changes", () => {
    const a = computeHash("payload", "secret-a");
    const b = computeHash("payload", "secret-b");
    expect(a).not.toBe(b);
  });

  it.each(HMAC_V2_GOLDEN_VECTORS)(
    "matches golden vector $label",
    ({ stats, impact, date, secret, expectedPayload, expectedHash }) => {
      const payload = buildPayload(
        makeGoldenStats(stats),
        makeGoldenImpact(impact),
        date,
      );

      expect(payload).toBe(expectedPayload);
      expect(computeHash(payload, secret)).toBe(expectedHash);
    },
  );
});

describe("generateVerificationCode", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-15T12:00:00Z"));
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env = originalEnv;
  });

  it("throws when the secret is unset in production", () => {
    delete process.env.CHAPA_VERIFICATION_SECRET;
    process.env.VERCEL_ENV = "production";
    expect(() => generateVerificationCode(baseStats, baseImpact)).toThrow(
      /CHAPA_VERIFICATION_SECRET/,
    );
  });

  it("returns null when CHAPA_VERIFICATION_SECRET is empty outside production", () => {
    process.env.CHAPA_VERIFICATION_SECRET = "";
    process.env.VERCEL_ENV = "preview";
    const result = generateVerificationCode(baseStats, baseImpact);
    expect(result).toBeNull();
  });

  it("returns null when CHAPA_VERIFICATION_SECRET is unset outside production", () => {
    delete process.env.CHAPA_VERIFICATION_SECRET;
    process.env.VERCEL_ENV = "preview";
    const result = generateVerificationCode(baseStats, baseImpact);
    expect(result).toBeNull();
  });

  it("returns hash and date when secret is set", () => {
    process.env.CHAPA_VERIFICATION_SECRET = "test-secret-with-enough-length-32chars!";
    const result = generateVerificationCode(baseStats, baseImpact);
    expect(result).not.toBeNull();
    expect(result!.hash).toMatch(/^[0-9a-f]{32}$/);
    expect(result!.date).toBe("2025-06-15");
  });

  it("is deterministic for same data on same day", () => {
    process.env.CHAPA_VERIFICATION_SECRET = "test-secret-with-enough-length-32chars!";
    const a = generateVerificationCode(baseStats, baseImpact);
    const b = generateVerificationCode(baseStats, baseImpact);
    expect(a!.hash).toBe(b!.hash);
  });

  it("changes on different days", () => {
    process.env.CHAPA_VERIFICATION_SECRET = "test-secret-with-enough-length-32chars!";
    const a = generateVerificationCode(baseStats, baseImpact);

    vi.setSystemTime(new Date("2025-06-16T12:00:00Z"));
    const b = generateVerificationCode(baseStats, baseImpact);

    expect(a!.hash).not.toBe(b!.hash);
  });

  it("trims whitespace from secret env var", () => {
    process.env.CHAPA_VERIFICATION_SECRET = "  test-secret-with-enough-length-32chars!  \n";
    const result = generateVerificationCode(baseStats, baseImpact);
    expect(result).not.toBeNull();
    expect(result!.hash).toMatch(/^[0-9a-f]{32}$/);
  });
});
