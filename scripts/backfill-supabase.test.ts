import { describe, it, expect } from "vitest";
import {
  parseRedisSnapshot,
  parseRedisUser,
  parseRedisVerification,
  snapshotToRow,
  verificationToRow,
} from "./backfill-parsers";
import type { MetricsSnapshot } from "@chapa/shared";

// ---------------------------------------------------------------------------
// parseRedisSnapshot — converts JSON string from Redis sorted set member
// ---------------------------------------------------------------------------

describe("parseRedisSnapshot", () => {
  const validSnapshot: MetricsSnapshot = {
    date: "2025-06-15",
    capturedAt: "2025-06-15T12:00:00.000Z",
    commitsTotal: 200,
    prsMergedCount: 30,
    prsMergedWeight: 45.5,
    reviewsSubmittedCount: 50,
    issuesClosedCount: 10,
    reposContributed: 8,
    activeDays: 120,
    linesAdded: 5000,
    linesDeleted: 2000,
    totalStars: 100,
    totalForks: 20,
    totalWatchers: 15,
    topRepoShare: 0.4,
    maxCommitsIn10Min: 3,
    building: 70,
    guarding: 50,
    consistency: 60,
    breadth: 40,
    archetype: "Builder",
    profileType: "collaborative",
    compositeScore: 55,
    adjustedComposite: 52,
    confidence: 85,
    tier: "Solid",
  };

  it("parses a valid JSON snapshot string", () => {
    const result = parseRedisSnapshot(JSON.stringify(validSnapshot));
    expect(result).toEqual(validSnapshot);
  });

  it("returns null for invalid JSON", () => {
    expect(parseRedisSnapshot("not json")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseRedisSnapshot("")).toBeNull();
  });

  it("returns null when required field 'date' is missing", () => {
    const { date: _, ...noDate } = validSnapshot;
    expect(parseRedisSnapshot(JSON.stringify(noDate))).toBeNull();
  });

  it("returns null when required field 'commitsTotal' is missing", () => {
    const { commitsTotal: _, ...noCommits } = validSnapshot;
    expect(parseRedisSnapshot(JSON.stringify(noCommits))).toBeNull();
  });

  it("preserves optional fields when present", () => {
    const withOptional = {
      ...validSnapshot,
      microCommitRatio: 0.15,
      docsOnlyPrRatio: 0.05,
      confidencePenalties: [{ flag: "burst_activity", penalty: 5 }],
    };
    const result = parseRedisSnapshot(JSON.stringify(withOptional));
    expect(result).toEqual(withOptional);
  });
});

// ---------------------------------------------------------------------------
// parseRedisUser — converts Redis user:registered:<handle> value
// ---------------------------------------------------------------------------

describe("parseRedisUser", () => {
  it("parses a valid user object with handle and registeredAt", () => {
    const value = { handle: "testuser", registeredAt: "2025-06-15T12:00:00.000Z" };
    const result = parseRedisUser(value);
    expect(result).toEqual({ handle: "testuser", registeredAt: "2025-06-15T12:00:00.000Z" });
  });

  it("returns null for null input", () => {
    expect(parseRedisUser(null)).toBeNull();
  });

  it("returns null when handle is missing", () => {
    expect(parseRedisUser({ registeredAt: "2025-06-15T12:00:00.000Z" })).toBeNull();
  });

  it("normalizes handle to lowercase", () => {
    const result = parseRedisUser({ handle: "TestUser", registeredAt: "2025-06-15T12:00:00.000Z" });
    expect(result?.handle).toBe("testuser");
  });

  it("defaults registeredAt to current ISO string when missing", () => {
    const result = parseRedisUser({ handle: "testuser" });
    expect(result).not.toBeNull();
    expect(result!.handle).toBe("testuser");
    // registeredAt should be a valid ISO string
    expect(() => new Date(result!.registeredAt)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// parseRedisVerification — converts Redis verify:<hash> value
// ---------------------------------------------------------------------------

describe("parseRedisVerification", () => {
  const validRecord = {
    handle: "testuser",
    displayName: "Test User",
    adjustedComposite: 52,
    confidence: 85,
    tier: "Solid",
    archetype: "Builder",
    profileType: "collaborative",
    dimensions: { building: 70, guarding: 50, consistency: 60, breadth: 40 },
    commitsTotal: 200,
    prsMergedCount: 30,
    reviewsSubmittedCount: 50,
    generatedAt: "2025-06-15",
  };

  it("parses a valid verification record", () => {
    const result = parseRedisVerification(validRecord);
    expect(result).toEqual(validRecord);
  });

  it("returns null for null input", () => {
    expect(parseRedisVerification(null)).toBeNull();
  });

  it("returns null when handle is missing", () => {
    const { handle: _, ...noHandle } = validRecord;
    expect(parseRedisVerification(noHandle)).toBeNull();
  });

  it("returns null when dimensions is missing", () => {
    const { dimensions: _, ...noDimensions } = validRecord;
    expect(parseRedisVerification(noDimensions)).toBeNull();
  });

  it("handles missing displayName gracefully", () => {
    const { displayName: _, ...noDisplayName } = validRecord;
    const result = parseRedisVerification(noDisplayName);
    expect(result).not.toBeNull();
    expect(result!.displayName).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// snapshotToRow — converts MetricsSnapshot to Supabase row
// ---------------------------------------------------------------------------

describe("snapshotToRow", () => {
  const snapshot: MetricsSnapshot = {
    date: "2025-06-15",
    capturedAt: "2025-06-15T12:00:00.000Z",
    commitsTotal: 200,
    prsMergedCount: 30,
    prsMergedWeight: 45.5,
    reviewsSubmittedCount: 50,
    issuesClosedCount: 10,
    reposContributed: 8,
    activeDays: 120,
    linesAdded: 5000,
    linesDeleted: 2000,
    totalStars: 100,
    totalForks: 20,
    totalWatchers: 15,
    topRepoShare: 0.4,
    maxCommitsIn10Min: 3,
    building: 70,
    guarding: 50,
    consistency: 60,
    breadth: 40,
    archetype: "Builder",
    profileType: "collaborative",
    compositeScore: 55,
    adjustedComposite: 52,
    confidence: 85,
    tier: "Solid",
  };

  it("maps camelCase fields to snake_case columns", () => {
    const row = snapshotToRow("TestUser", snapshot);
    expect(row.handle).toBe("testuser");
    expect(row.commits_total).toBe(200);
    expect(row.prs_merged_count).toBe(30);
    expect(row.adjusted_composite).toBe(52);
    expect(row.profile_type).toBe("collaborative");
  });

  it("normalizes handle to lowercase", () => {
    const row = snapshotToRow("TestUser", snapshot);
    expect(row.handle).toBe("testuser");
  });

  it("sets optional fields to null when missing", () => {
    const row = snapshotToRow("user", snapshot);
    expect(row.micro_commit_ratio).toBeNull();
    expect(row.docs_only_pr_ratio).toBeNull();
    expect(row.confidence_penalties).toBeNull();
  });

  it("preserves optional fields when present", () => {
    const withOptional: MetricsSnapshot = {
      ...snapshot,
      microCommitRatio: 0.15,
      confidencePenalties: [{ flag: "burst_activity", penalty: 5 }],
    };
    const row = snapshotToRow("user", withOptional);
    expect(row.micro_commit_ratio).toBe(0.15);
    expect(row.confidence_penalties).toEqual([{ flag: "burst_activity", penalty: 5 }]);
  });
});

// ---------------------------------------------------------------------------
// verificationToRow — converts VerificationRecord to Supabase row
// ---------------------------------------------------------------------------

describe("verificationToRow", () => {
  const record = {
    handle: "TestUser",
    displayName: "Test User",
    adjustedComposite: 52,
    confidence: 85,
    tier: "Solid",
    archetype: "Builder",
    profileType: "collaborative",
    dimensions: { building: 70, guarding: 50, consistency: 60, breadth: 40 },
    commitsTotal: 200,
    prsMergedCount: 30,
    reviewsSubmittedCount: 50,
    generatedAt: "2025-06-15",
  };

  it("maps fields to snake_case and flattens dimensions", () => {
    const row = verificationToRow("abc123", record);
    expect(row.hash).toBe("abc123");
    expect(row.handle).toBe("testuser");
    expect(row.display_name).toBe("Test User");
    expect(row.building).toBe(70);
    expect(row.guarding).toBe(50);
    expect(row.consistency).toBe(60);
    expect(row.breadth).toBe(40);
    expect(row.generated_at).toBe("2025-06-15");
  });

  it("sets display_name to null when missing", () => {
    const { displayName: _, ...noDisplayName } = record;
    const row = verificationToRow("abc123", noDisplayName as typeof record);
    expect(row.display_name).toBeNull();
  });
});
