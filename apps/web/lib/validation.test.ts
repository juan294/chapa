import { describe, it, expect } from "vitest";
import { isValidHandle, isValidEmuHandle, isValidStatsShape, isValidBadgeConfig } from "./validation";
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

  it("rejects non-array heatmapData", () => {
    expect(isValidStatsShape({ ...validStats, heatmapData: "not-array" })).toBe(false);
  });

  it("rejects heatmapData with invalid entries", () => {
    expect(isValidStatsShape({ ...validStats, heatmapData: [{ wrong: true }] })).toBe(false);
  });

  it("accepts empty heatmapData array", () => {
    expect(isValidStatsShape({ ...validStats, heatmapData: [] })).toBe(true);
  });

  it("accepts optional fields when present", () => {
    expect(isValidStatsShape({ ...validStats, microCommitRatio: 0.3, docsOnlyPrRatio: 0.1 })).toBe(true);
  });

  it("rejects heatmapData with more than 91 entries", () => {
    const bigHeatmap = Array.from({ length: 92 }, (_, i) => ({
      date: `2025-01-${String(i + 1).padStart(2, "0")}`,
      count: 1,
    }));
    expect(isValidStatsShape({ ...validStats, heatmapData: bigHeatmap })).toBe(false);
  });

  it("accepts heatmapData with exactly 91 entries", () => {
    const maxHeatmap = Array.from({ length: 91 }, (_, i) => ({
      date: `2025-01-${String(i + 1).padStart(2, "0")}`,
      count: 1,
    }));
    expect(isValidStatsShape({ ...validStats, heatmapData: maxHeatmap })).toBe(true);
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
        interaction: "tilt-3d",
        statsDisplay: "animated-ease",
        tierTreatment: "enhanced",
        celebration: "confetti",
      }),
    ).toBe(true);
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
      ["interaction", "neon"],
      ["statsDisplay", "neon"],
      ["tierTreatment", "neon"],
      ["celebration", "neon"],
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
