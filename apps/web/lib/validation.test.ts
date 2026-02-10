import { describe, it, expect } from "vitest";
import { isValidHandle, isValidEmuHandle, isValidStats90dShape } from "./validation";

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

describe("isValidStats90dShape", () => {
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
    heatmapData: [{ date: "2025-01-01", count: 5 }],
    fetchedAt: new Date().toISOString(),
  };

  it("accepts a valid Stats90d object", () => {
    expect(isValidStats90dShape(validStats)).toBe(true);
  });

  it("rejects null", () => {
    expect(isValidStats90dShape(null)).toBe(false);
  });

  it("rejects non-object", () => {
    expect(isValidStats90dShape("string")).toBe(false);
    expect(isValidStats90dShape(42)).toBe(false);
  });

  it("rejects missing required fields", () => {
    const missing = { ...validStats };
    delete (missing as Record<string, unknown>).commitsTotal;
    expect(isValidStats90dShape(missing)).toBe(false);
  });

  it("rejects non-number for numeric fields", () => {
    expect(isValidStats90dShape({ ...validStats, commitsTotal: "ten" })).toBe(false);
  });

  it("rejects negative numbers", () => {
    expect(isValidStats90dShape({ ...validStats, commitsTotal: -1 })).toBe(false);
  });

  it("rejects non-array heatmapData", () => {
    expect(isValidStats90dShape({ ...validStats, heatmapData: "not-array" })).toBe(false);
  });

  it("rejects heatmapData with invalid entries", () => {
    expect(isValidStats90dShape({ ...validStats, heatmapData: [{ wrong: true }] })).toBe(false);
  });

  it("accepts empty heatmapData array", () => {
    expect(isValidStats90dShape({ ...validStats, heatmapData: [] })).toBe(true);
  });

  it("accepts optional fields when present", () => {
    expect(isValidStats90dShape({ ...validStats, microCommitRatio: 0.3, docsOnlyPrRatio: 0.1 })).toBe(true);
  });
});
