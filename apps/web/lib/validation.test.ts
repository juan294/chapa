import { describe, it, expect } from "vitest";
import { isValidHandle, isValidEmuHandle, isValidStatsShape, isValidBadgeConfig, isValidTelemetryPayload, stripRetiredBadgeConfigKeys } from "./validation";
import { DEFAULT_BADGE_CONFIG, BADGE_CONFIG_OPTIONS } from "@chapa/shared";

describe("isValidHandle", () => {
  describe("valid handles", () => {
    it.each([
      ["octocat"],
      ["juan294"],
      ["a"],
      ["a-b"],
      ["a-b-c-d-e"],
      ["A1"],
      ["z"],
      ["user123"],
      ["a".repeat(39)], // max length
    ])("accepts %s", (handle) => {
      expect(isValidHandle(handle)).toBe(true);
    });
  });

  describe("invalid handles", () => {
    it.each([
      ["", "empty string"],
      ["-start", "starts with hyphen"],
      ["end-", "ends with hyphen"],
      ["has spaces", "contains spaces"],
      ["<script>", "contains angle brackets"],
      ["a".repeat(40), "too long (40 chars)"],
      ["../etc", "path traversal"],
      ["has:colon", "contains colon"],
      ["-", "single hyphen"],
      ["a--b", "valid per GitHub but double hyphen is fine"], // GitHub allows this
    ])("rejects %s (%s)", (handle) => {
      // Note: "a--b" is actually valid on GitHub, so we only reject the rest
      if (handle === "a--b") return; // skip — this is actually valid
      expect(isValidHandle(handle)).toBe(false);
    });

    // Test the specific invalid ones individually for clarity
    it("rejects empty string", () => {
      expect(isValidHandle("")).toBe(false);
    });

    it("rejects handle starting with hyphen", () => {
      expect(isValidHandle("-start")).toBe(false);
    });

    it("rejects handle ending with hyphen", () => {
      expect(isValidHandle("end-")).toBe(false);
    });

    it("rejects handle with spaces", () => {
      expect(isValidHandle("has spaces")).toBe(false);
    });

    it("rejects XSS attempt", () => {
      expect(isValidHandle("<script>")).toBe(false);
    });

    it("rejects handle exceeding 39 chars", () => {
      expect(isValidHandle("a".repeat(40))).toBe(false);
    });

    it("rejects path traversal", () => {
      expect(isValidHandle("../etc")).toBe(false);
    });

    it("rejects handle with colon", () => {
      expect(isValidHandle("has:colon")).toBe(false);
    });
  });
});

describe("isValidEmuHandle", () => {
  describe("valid EMU handles", () => {
    it.each([
      ["Juan-GonzalezPonce_avoltagh"],
      ["user_corp"],
      ["a_b"],
      ["simple"],
      ["user-name_org"],
      ["A1_B2"],
    ])("accepts %s", (handle) => {
      expect(isValidEmuHandle(handle)).toBe(true);
    });
  });

  describe("invalid EMU handles", () => {
    it("rejects empty string", () => {
      expect(isValidEmuHandle("")).toBe(false);
    });

    it("rejects handle with spaces", () => {
      expect(isValidEmuHandle("has spaces")).toBe(false);
    });

    it("rejects XSS attempt", () => {
      expect(isValidEmuHandle("<script>")).toBe(false);
    });

    it("rejects handle exceeding 100 chars", () => {
      expect(isValidEmuHandle("a".repeat(101))).toBe(false);
    });

    it("rejects path traversal", () => {
      expect(isValidEmuHandle("../etc")).toBe(false);
    });
  });

  it("allows underscores (unlike regular handles)", () => {
    expect(isValidEmuHandle("user_corp")).toBe(true);
    expect(isValidHandle("user_corp")).toBe(false);
  });
});

describe("isValidStatsShape", () => {
  const validStats = {
    handle: "test",
    commitsTotal: 10,
    activeDays: 5,
    prsMergedCount: 2,
    prsMergedWeight: 3,
    reviewsSubmittedCount: 1,
    issuesClosedCount: 0,
    linesAdded: 100,
    linesDeleted: 50,
    reposContributed: 2,
    topRepoShare: 0.5,
    maxCommitsIn10Min: 3,
    totalStars: 0,
    totalForks: 0,
    totalWatchers: 0,
    heatmapData: [{ date: "2025-01-01", count: 5 }],
    fetchedAt: new Date().toISOString(),
  };

  it("accepts a valid StatsData object", () => {
    expect(isValidStatsShape(validStats)).toBe(true);
  });

  it("rejects null", () => {
    expect(isValidStatsShape(null)).toBe(false);
  });

  it("rejects non-object", () => {
    expect(isValidStatsShape("string")).toBe(false);
    expect(isValidStatsShape(42)).toBe(false);
  });

  it("rejects missing required fields", () => {
    const missing = { ...validStats };
    delete (missing as Record<string, unknown>).commitsTotal;
    expect(isValidStatsShape(missing)).toBe(false);
  });

  it("rejects non-number for numeric fields", () => {
    expect(isValidStatsShape({ ...validStats, commitsTotal: "ten" })).toBe(false);
  });

  it("rejects negative numbers", () => {
    expect(isValidStatsShape({ ...validStats, commitsTotal: -1 })).toBe(false);
  });

  it("rejects non-finite numeric fields", () => {
    expect(isValidStatsShape({ ...validStats, commitsTotal: Infinity })).toBe(false);
    expect(isValidStatsShape({ ...validStats, commitsTotal: NaN })).toBe(false);
  });

  it("rejects ratio fields outside the 0..1 range", () => {
    expect(isValidStatsShape({ ...validStats, topRepoShare: 1.01 })).toBe(false);
    expect(isValidStatsShape({ ...validStats, microCommitRatio: -0.1 })).toBe(false);
    expect(isValidStatsShape({ ...validStats, docsOnlyPrRatio: 1.1 })).toBe(false);
  });

  it("rejects activity fields that exceed a one-year contribution window", () => {
    expect(isValidStatsShape({ ...validStats, activeDays: 366 })).toBe(false);
  });

  it("rejects stats missing totalStars", () => {
    const noStars = { ...validStats };
    delete (noStars as Record<string, unknown>).totalStars;
    expect(isValidStatsShape(noStars)).toBe(false);
  });

  it("rejects stats missing totalForks", () => {
    const noForks = { ...validStats };
    delete (noForks as Record<string, unknown>).totalForks;
    expect(isValidStatsShape(noForks)).toBe(false);
  });

  it("rejects stats missing totalWatchers", () => {
    const noWatchers = { ...validStats };
    delete (noWatchers as Record<string, unknown>).totalWatchers;
    expect(isValidStatsShape(noWatchers)).toBe(false);
  });

  it("accepts stats with valid totalStars, totalForks, totalWatchers", () => {
    expect(isValidStatsShape({ ...validStats, totalStars: 42, totalForks: 10, totalWatchers: 5 })).toBe(true);
  });

  it("rejects non-array heatmapData", () => {
    expect(isValidStatsShape({ ...validStats, heatmapData: "not-array" })).toBe(false);
  });

  it("rejects heatmapData with invalid entries", () => {
    expect(isValidStatsShape({ ...validStats, heatmapData: [{ wrong: true }] })).toBe(false);
  });

  it("rejects heatmap entries with invalid dates or counts", () => {
    expect(isValidStatsShape({ ...validStats, heatmapData: [{ date: "01/01/2025", count: 1 }] })).toBe(false);
    expect(isValidStatsShape({ ...validStats, heatmapData: [{ date: "2025-01-01", count: -1 }] })).toBe(false);
    expect(isValidStatsShape({ ...validStats, heatmapData: [{ date: "2025-01-01", count: Infinity }] })).toBe(false);
  });

  it("accepts empty heatmapData array", () => {
    expect(isValidStatsShape({ ...validStats, heatmapData: [] })).toBe(true);
  });

  it("accepts optional fields when present", () => {
    expect(isValidStatsShape({ ...validStats, microCommitRatio: 0.3, docsOnlyPrRatio: 0.1 })).toBe(true);
  });

  it("rejects heatmapData with more than 371 entries", () => {
    const bigHeatmap = Array.from({ length: 372 }, (_, i) => ({
      date: `2025-01-${String((i % 28) + 1).padStart(2, "0")}`,
      count: 1,
    }));
    expect(isValidStatsShape({ ...validStats, heatmapData: bigHeatmap })).toBe(false);
  });

  it("accepts heatmapData with exactly 371 entries", () => {
    const maxHeatmap = Array.from({ length: 371 }, (_, i) => ({
      date: `2025-01-${String((i % 28) + 1).padStart(2, "0")}`,
      count: 1,
    }));
    expect(isValidStatsShape({ ...validStats, heatmapData: maxHeatmap })).toBe(true);
  });

  it("accepts heatmapData with 91 entries (legacy 13-week data)", () => {
    const heatmap = Array.from({ length: 91 }, (_, i) => ({
      date: `2025-01-${String((i % 28) + 1).padStart(2, "0")}`,
      count: 1,
    }));
    expect(isValidStatsShape({ ...validStats, heatmapData: heatmap })).toBe(true);
  });

  // BE-M1 (#950): numeric range caps
  describe("numeric range caps (BE-M1 #950)", () => {
    it("rejects linesAdded exceeding 500_000", () => {
      expect(isValidStatsShape({ ...validStats, linesAdded: 999_999_999 })).toBe(false);
    });

    it("accepts linesAdded at the upper bound (500_000)", () => {
      expect(isValidStatsShape({ ...validStats, linesAdded: 500_000 })).toBe(true);
    });

    it("accepts linesAdded just below the upper bound (499_999)", () => {
      expect(isValidStatsShape({ ...validStats, linesAdded: 499_999 })).toBe(true);
    });

    it("rejects linesDeleted exceeding 500_000", () => {
      expect(isValidStatsShape({ ...validStats, linesDeleted: 500_001 })).toBe(false);
    });

    it("rejects prsMergedCount exceeding 10_000", () => {
      expect(isValidStatsShape({ ...validStats, prsMergedCount: 10_001 })).toBe(false);
    });

    it("accepts prsMergedCount at the upper bound (10_000)", () => {
      expect(isValidStatsShape({ ...validStats, prsMergedCount: 10_000 })).toBe(true);
    });

    it("rejects prsMergedWeight exceeding 10_000", () => {
      expect(isValidStatsShape({ ...validStats, prsMergedWeight: 10_001 })).toBe(false);
    });

    it("rejects commitsTotal exceeding 100_000", () => {
      expect(isValidStatsShape({ ...validStats, commitsTotal: 100_001 })).toBe(false);
    });

    it("accepts commitsTotal at the upper bound (100_000)", () => {
      expect(isValidStatsShape({ ...validStats, commitsTotal: 100_000 })).toBe(true);
    });

    it("rejects reviewsSubmittedCount exceeding 50_000", () => {
      expect(isValidStatsShape({ ...validStats, reviewsSubmittedCount: 50_001 })).toBe(false);
    });

    it("rejects issuesClosedCount exceeding 10_000", () => {
      expect(isValidStatsShape({ ...validStats, issuesClosedCount: 10_001 })).toBe(false);
    });

    it("rejects reposContributed exceeding 5_000", () => {
      expect(isValidStatsShape({ ...validStats, reposContributed: 5_001 })).toBe(false);
    });

    it("rejects maxCommitsIn10Min exceeding 1_000", () => {
      expect(isValidStatsShape({ ...validStats, maxCommitsIn10Min: 1_001 })).toBe(false);
    });

    it("rejects totalStars exceeding 10_000_000", () => {
      expect(isValidStatsShape({ ...validStats, totalStars: 10_000_001 })).toBe(false);
    });

    it("rejects totalForks exceeding 1_000_000", () => {
      expect(isValidStatsShape({ ...validStats, totalForks: 1_000_001 })).toBe(false);
    });

    it("rejects totalWatchers exceeding 1_000_000", () => {
      expect(isValidStatsShape({ ...validStats, totalWatchers: 1_000_001 })).toBe(false);
    });
  });

  // #984: optional numeric fields also flow into computeImpactV6 and persist
  // into snapshots/history, so they need the same non-negative + range guards.
  describe("optional numeric field caps (#984)", () => {
    it("accepts realistic medianPrLeadTimeHours", () => {
      expect(isValidStatsShape({ ...validStats, medianPrLeadTimeHours: 36 })).toBe(true);
    });

    it("accepts medianPrLeadTimeHours at the upper bound (100_000)", () => {
      expect(isValidStatsShape({ ...validStats, medianPrLeadTimeHours: 100_000 })).toBe(true);
    });

    it("rejects medianPrLeadTimeHours exceeding 100_000", () => {
      expect(isValidStatsShape({ ...validStats, medianPrLeadTimeHours: 100_001 })).toBe(false);
    });

    it("rejects negative medianPrLeadTimeHours", () => {
      expect(isValidStatsShape({ ...validStats, medianPrLeadTimeHours: -1 })).toBe(false);
    });

    it("rejects non-finite medianPrLeadTimeHours", () => {
      expect(isValidStatsShape({ ...validStats, medianPrLeadTimeHours: Infinity })).toBe(false);
    });

    it("accepts realistic primaryReviewsSubmittedCount", () => {
      expect(isValidStatsShape({ ...validStats, primaryReviewsSubmittedCount: 42 })).toBe(true);
    });

    it("accepts primaryReviewsSubmittedCount at the upper bound (50_000)", () => {
      expect(isValidStatsShape({ ...validStats, primaryReviewsSubmittedCount: 50_000 })).toBe(true);
    });

    it("rejects primaryReviewsSubmittedCount exceeding 50_000", () => {
      expect(isValidStatsShape({ ...validStats, primaryReviewsSubmittedCount: 50_001 })).toBe(false);
    });

    it("rejects negative primaryReviewsSubmittedCount", () => {
      expect(isValidStatsShape({ ...validStats, primaryReviewsSubmittedCount: -1 })).toBe(false);
    });

    for (const field of [
      "batchSizeScore",
      "prDescriptionRate",
      "featureBranchRate",
      "issueLinkageRate",
    ] as const) {
      it(`accepts ${field} within the 0..1 range`, () => {
        expect(isValidStatsShape({ ...validStats, [field]: 0.5 })).toBe(true);
      });

      it(`rejects ${field} above 1`, () => {
        expect(isValidStatsShape({ ...validStats, [field]: 1.01 })).toBe(false);
      });

      it(`rejects negative ${field}`, () => {
        expect(isValidStatsShape({ ...validStats, [field]: -0.1 })).toBe(false);
      });

      it(`rejects absurdly large ${field}`, () => {
        expect(isValidStatsShape({ ...validStats, [field]: 1e12 })).toBe(false);
      });
    }
  });
});

describe("isValidBadgeConfig", () => {
  it("accepts the default config", () => {
    expect(isValidBadgeConfig(DEFAULT_BADGE_CONFIG)).toBe(true);
  });

  it("accepts a fully customized valid config", () => {
    expect(
      isValidBadgeConfig({
        background: "aurora",
        cardStyle: "frost",
        border: "gradient-rotating",
        scoreEffect: "gold-shimmer",
        heatmapAnimation: "diagonal",
        tierTreatment: "enhanced",
      }),
    ).toBe(true);
  });

  // #1191 step 5 — the write path stays strict. A payload still carrying a
  // retired key is normalized by stripRetiredBadgeConfigKeys before it gets
  // here, so this guard never has to soften.
  it("rejects a config still carrying the retired preview-only keys", () => {
    expect(
      isValidBadgeConfig({
        ...DEFAULT_BADGE_CONFIG,
        interaction: "tilt-3d",
        statsDisplay: "animated-ease",
        celebration: "confetti",
      }),
    ).toBe(false);
  });

  it("rejects null", () => {
    expect(isValidBadgeConfig(null)).toBe(false);
  });

  it("rejects non-object", () => {
    expect(isValidBadgeConfig("string")).toBe(false);
    expect(isValidBadgeConfig(42)).toBe(false);
    expect(isValidBadgeConfig(undefined)).toBe(false);
  });

  it("rejects missing fields", () => {
    const partial = { background: "solid", cardStyle: "flat" };
    expect(isValidBadgeConfig(partial)).toBe(false);
  });

  it("rejects unknown values for a field", () => {
    expect(
      isValidBadgeConfig({ ...DEFAULT_BADGE_CONFIG, background: "neon" }),
    ).toBe(false);
  });

  it("rejects extra fields", () => {
    expect(
      isValidBadgeConfig({ ...DEFAULT_BADGE_CONFIG, unknownField: "evil" }),
    ).toBe(false);
  });

  it("rejects non-string field values", () => {
    expect(
      isValidBadgeConfig({ ...DEFAULT_BADGE_CONFIG, background: 42 }),
    ).toBe(false);
  });

  it("rejects each field with an invalid value", () => {
    const fields = [
      ["background", "neon"],
      ["cardStyle", "neon"],
      ["border", "neon"],
      ["scoreEffect", "neon"],
      ["heatmapAnimation", "neon"],
      ["tierTreatment", "neon"],
    ] as const;

    for (const [field, badValue] of fields) {
      expect(
        isValidBadgeConfig({ ...DEFAULT_BADGE_CONFIG, [field]: badValue }),
      ).toBe(false);
    }
  });

  it("accepts every valid option for each field", () => {
    for (const [field, options] of Object.entries(BADGE_CONFIG_OPTIONS)) {
      for (const option of options) {
        expect(
          isValidBadgeConfig({ ...DEFAULT_BADGE_CONFIG, [field]: option }),
        ).toBe(true);
      }
    }
  });
});

describe("isValidTelemetryPayload", () => {
  const validPayload = {
    operationId: "550e8400-e29b-41d4-a716-446655440000",
    targetHandle: "juan294",
    sourceHandle: "juan_corp",
    success: true,
    stats: {
      commitsTotal: 30,
      reposContributed: 3,
      prsMergedCount: 5,
      activeDays: 20,
      reviewsSubmittedCount: 10,
    },
    timing: {
      fetchMs: 1200,
      uploadMs: 300,
      totalMs: 1500,
    },
    cliVersion: "0.3.1",
  };

  it("accepts a valid telemetry payload", () => {
    expect(isValidTelemetryPayload(validPayload)).toBe(true);
  });

  it("accepts a failed operation with errorCategory", () => {
    expect(isValidTelemetryPayload({
      ...validPayload,
      success: false,
      errorCategory: "network",
    })).toBe(true);
  });

  it("accepts all valid errorCategory values", () => {
    for (const cat of ["auth", "network", "graphql", "server", "unknown"]) {
      expect(isValidTelemetryPayload({
        ...validPayload,
        success: false,
        errorCategory: cat,
      })).toBe(true);
    }
  });

  // --- Helpers ---

  /** Create payload with specific keys removed */
  function without<K extends string>(obj: Record<string, unknown>, ...keys: K[]) {
    const copy = { ...obj };
    for (const k of keys) delete copy[k];
    return copy;
  }

  // --- Rejection tests ---

  it("rejects null", () => {
    expect(isValidTelemetryPayload(null)).toBe(false);
  });

  it("rejects non-object", () => {
    expect(isValidTelemetryPayload("string")).toBe(false);
    expect(isValidTelemetryPayload(42)).toBe(false);
  });

  it("rejects missing operationId", () => {
    expect(isValidTelemetryPayload(without(validPayload, "operationId"))).toBe(false);
  });

  it("rejects invalid UUID format for operationId", () => {
    expect(isValidTelemetryPayload({ ...validPayload, operationId: "not-a-uuid" })).toBe(false);
    expect(isValidTelemetryPayload({ ...validPayload, operationId: "550e8400e29b41d4a716446655440000" })).toBe(false);
  });

  it("rejects invalid targetHandle", () => {
    expect(isValidTelemetryPayload({ ...validPayload, targetHandle: "<script>" })).toBe(false);
    expect(isValidTelemetryPayload({ ...validPayload, targetHandle: "" })).toBe(false);
  });

  it("rejects invalid sourceHandle", () => {
    expect(isValidTelemetryPayload({ ...validPayload, sourceHandle: "<script>" })).toBe(false);
    expect(isValidTelemetryPayload({ ...validPayload, sourceHandle: "" })).toBe(false);
  });

  it("rejects non-boolean success", () => {
    expect(isValidTelemetryPayload({ ...validPayload, success: "true" })).toBe(false);
    expect(isValidTelemetryPayload({ ...validPayload, success: 1 })).toBe(false);
  });

  it("rejects invalid errorCategory", () => {
    expect(isValidTelemetryPayload({ ...validPayload, errorCategory: "invalid" })).toBe(false);
  });

  it("rejects missing stats", () => {
    expect(isValidTelemetryPayload(without(validPayload, "stats"))).toBe(false);
  });

  it("rejects stats with missing fields", () => {
    expect(isValidTelemetryPayload({
      ...validPayload,
      stats: { commitsTotal: 10 },
    })).toBe(false);
  });

  it("rejects stats with negative numbers", () => {
    expect(isValidTelemetryPayload({
      ...validPayload,
      stats: { ...validPayload.stats, commitsTotal: -1 },
    })).toBe(false);
  });

  it("rejects stats with non-integer numbers", () => {
    expect(isValidTelemetryPayload({
      ...validPayload,
      stats: { ...validPayload.stats, commitsTotal: 1.5 },
    })).toBe(false);
  });

  it("rejects missing timing", () => {
    expect(isValidTelemetryPayload(without(validPayload, "timing"))).toBe(false);
  });

  it("rejects timing with missing fields", () => {
    expect(isValidTelemetryPayload({
      ...validPayload,
      timing: { fetchMs: 100 },
    })).toBe(false);
  });

  it("rejects timing with negative numbers", () => {
    expect(isValidTelemetryPayload({
      ...validPayload,
      timing: { ...validPayload.timing, fetchMs: -1 },
    })).toBe(false);
  });

  it("rejects missing cliVersion", () => {
    expect(isValidTelemetryPayload(without(validPayload, "cliVersion"))).toBe(false);
  });

  it("rejects empty cliVersion", () => {
    expect(isValidTelemetryPayload({ ...validPayload, cliVersion: "" })).toBe(false);
  });

  it("rejects cliVersion exceeding 20 chars", () => {
    expect(isValidTelemetryPayload({ ...validPayload, cliVersion: "a".repeat(21) })).toBe(false);
  });

  it("accepts payload without errorCategory when success is true", () => {
    expect(isValidTelemetryPayload(without(validPayload, "errorCategory"))).toBe(true);
  });
});

/**
 * #1191 step 5 — dropping three categories from the schema would otherwise
 * orphan every Studio config already saved with nine keys: `isValidBadgeConfig`
 * rejects extra fields, so `dbGetStudioConfig` would report `invalid` and
 * silently hand the owner back the default. Stripping the retired keys on read
 * turns a legacy row into a valid six-key config instead of discarding a
 * durable write.
 */
describe("stripRetiredBadgeConfigKeys", () => {
  const LEGACY_CONFIG = {
    background: "aurora",
    cardStyle: "frost",
    border: "gradient-rotating",
    scoreEffect: "gold-shimmer",
    heatmapAnimation: "diagonal",
    interaction: "tilt-3d",
    statsDisplay: "animated-ease",
    tierTreatment: "enhanced",
    celebration: "confetti",
  };

  it("turns a legacy nine-key config into a valid six-key one", () => {
    const stripped = stripRetiredBadgeConfigKeys(LEGACY_CONFIG);
    expect(isValidBadgeConfig(stripped)).toBe(true);
  });

  it("preserves every surviving choice", () => {
    expect(stripRetiredBadgeConfigKeys(LEGACY_CONFIG)).toEqual({
      background: "aurora",
      cardStyle: "frost",
      border: "gradient-rotating",
      scoreEffect: "gold-shimmer",
      heatmapAnimation: "diagonal",
      tierTreatment: "enhanced",
    });
  });

  it("leaves an already-current config untouched", () => {
    expect(stripRetiredBadgeConfigKeys(DEFAULT_BADGE_CONFIG)).toEqual(
      DEFAULT_BADGE_CONFIG,
    );
  });

  it("does not mutate its input", () => {
    const input = { ...LEGACY_CONFIG };
    stripRetiredBadgeConfigKeys(input);
    expect(input).toEqual(LEGACY_CONFIG);
  });

  it("keeps unknown fields so the validator still rejects them", () => {
    const stripped = stripRetiredBadgeConfigKeys({
      ...DEFAULT_BADGE_CONFIG,
      unknownField: "evil",
    });
    expect(stripped).toHaveProperty("unknownField");
    expect(isValidBadgeConfig(stripped)).toBe(false);
  });

  it("passes non-objects through for the validator to reject", () => {
    expect(stripRetiredBadgeConfigKeys(null)).toBe(null);
    expect(stripRetiredBadgeConfigKeys("string")).toBe("string");
    expect(isValidBadgeConfig(stripRetiredBadgeConfigKeys(null))).toBe(false);
  });

  it("does not rescue a legacy config whose surviving values are invalid", () => {
    const stripped = stripRetiredBadgeConfigKeys({
      ...LEGACY_CONFIG,
      background: "not-a-background",
    });
    expect(isValidBadgeConfig(stripped)).toBe(false);
  });
});
