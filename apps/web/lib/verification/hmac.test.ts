import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildPayload, computeHash, generateVerificationCode } from "./hmac";
import type { StatsData, ImpactV4Result } from "@chapa/shared";

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

const baseImpact: ImpactV4Result = {
  handle: "TestUser",
  profileType: "collaborative",
  dimensions: { building: 70, guarding: 50, consistency: 60, breadth: 40 },
  archetype: "Builder",
  compositeScore: 55,
  confidence: 85,
  confidencePenalties: [],
  adjustedComposite: 52,
  tier: "Solid",
  computedAt: "2025-01-15T00:00:00Z",
};

describe("buildPayload", () => {
  it("produces a deterministic pipe-delimited string", () => {
    const result = buildPayload(baseStats, baseImpact, "2025-06-15");
    expect(result).toBe(
      "testuser|52|85|Solid|Builder|70|50|60|40|200|30|50|2025-06-15",
    );
  });

  it("lowercases the handle", () => {
    const result = buildPayload(baseStats, baseImpact, "2025-06-15");
    expect(result.startsWith("testuser|")).toBe(true);
  });

  it("uses the adjustedComposite (not compositeScore)", () => {
    const result = buildPayload(baseStats, baseImpact, "2025-06-15");
    const parts = result.split("|");
    expect(parts[1]).toBe("52"); // adjustedComposite, not 55
  });

  it("rounds dimension scores to integers", () => {
    const impact = {
      ...baseImpact,
      dimensions: { building: 70.6, guarding: 50.3, consistency: 60.9, breadth: 40.1 },
    };
    const result = buildPayload(baseStats, impact, "2025-06-15");
    const parts = result.split("|");
    expect(parts[5]).toBe("71"); // building rounded
    expect(parts[6]).toBe("50"); // guarding rounded
    expect(parts[7]).toBe("61"); // consistency rounded
    expect(parts[8]).toBe("40"); // breadth rounded
  });
});

describe("computeHash", () => {
  it("returns an 8-character hex string", () => {
    const hash = computeHash("some-payload", "secret");
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
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

  it("returns null when CHAPA_VERIFICATION_SECRET is unset", () => {
    delete process.env.CHAPA_VERIFICATION_SECRET;
    const result = generateVerificationCode(baseStats, baseImpact);
    expect(result).toBeNull();
  });

  it("returns null when CHAPA_VERIFICATION_SECRET is empty", () => {
    process.env.CHAPA_VERIFICATION_SECRET = "";
    const result = generateVerificationCode(baseStats, baseImpact);
    expect(result).toBeNull();
  });

  it("returns hash and date when secret is set", () => {
    process.env.CHAPA_VERIFICATION_SECRET = "test-secret-with-enough-length-32chars!";
    const result = generateVerificationCode(baseStats, baseImpact);
    expect(result).not.toBeNull();
    expect(result!.hash).toMatch(/^[0-9a-f]{8}$/);
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
    expect(result!.hash).toMatch(/^[0-9a-f]{8}$/);
  });
});
