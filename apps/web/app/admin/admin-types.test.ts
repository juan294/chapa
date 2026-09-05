import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  formatDate,
  tierBadgeClasses,
  TIER_ORDER,
  ARCHETYPE_COLOR,
  TIER_COLOR,
} from "./admin-types";
import type { AdminUser, PaginatedResponse } from "./admin-types";
import { compositeColor, contrastRatio, themedTokenValue } from "@/lib/test-helpers/css-tokens";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeUser(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    handle: "user",
    displayName: null,
    avatarUrl: null,
    registeredAt: "2025-06-01T00:00:00Z",
    lastSnapshotDate: null,
    fetchedAt: null,
    commitsTotal: null,
    prsMergedCount: null,
    reviewsSubmittedCount: null,
    activeDays: null,
    reposContributed: null,
    totalStars: null,
    archetype: null,
    tier: null,
    adjustedComposite: null,
    rawScore: null,
    confidence: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// AdminUser type shape
// ---------------------------------------------------------------------------

describe("AdminUser type shape", () => {
  it("has registeredAt field", () => {
    const user = makeUser({ registeredAt: "2025-01-01T00:00:00Z" });
    expect(user.registeredAt).toBe("2025-01-01T00:00:00Z");
  });

  it("has lastSnapshotDate field (nullable)", () => {
    const userWithSnapshot = makeUser({ lastSnapshotDate: "2025-06-01" });
    expect(userWithSnapshot.lastSnapshotDate).toBe("2025-06-01");

    const userWithoutSnapshot = makeUser({ lastSnapshotDate: null });
    expect(userWithoutSnapshot.lastSnapshotDate).toBeNull();
  });

  it("does NOT have statsExpired field", () => {
    const user = makeUser();
    expect(user).not.toHaveProperty("statsExpired");
  });
});

// ---------------------------------------------------------------------------
// PaginatedResponse type shape
// ---------------------------------------------------------------------------

describe("PaginatedResponse type shape", () => {
  it("has all required pagination fields", () => {
    const response: PaginatedResponse = {
      users: [makeUser()],
      total: 50,
      page: 1,
      limit: 25,
      totalPages: 2,
    };
    expect(response.total).toBe(50);
    expect(response.page).toBe(1);
    expect(response.limit).toBe(25);
    expect(response.totalPages).toBe(2);
    expect(response.users).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------

describe("formatDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns '< 1h ago' for dates less than 1 hour old", () => {
    const now = new Date("2026-02-21T12:00:00Z");
    vi.setSystemTime(now);
    const thirtyMinAgo = new Date("2026-02-21T11:35:00Z").toISOString();
    expect(formatDate(thirtyMinAgo)).toBe("< 1h ago");
  });

  it("returns hours ago for dates less than 24 hours old", () => {
    const now = new Date("2026-02-21T12:00:00Z");
    vi.setSystemTime(now);
    const fiveHoursAgo = new Date("2026-02-21T07:00:00Z").toISOString();
    expect(formatDate(fiveHoursAgo)).toBe("5h ago");
  });

  it("returns days ago for dates less than 7 days old", () => {
    const now = new Date("2026-02-21T12:00:00Z");
    vi.setSystemTime(now);
    const threeDaysAgo = new Date("2026-02-18T12:00:00Z").toISOString();
    expect(formatDate(threeDaysAgo)).toBe("3d ago");
  });

  it("returns formatted date for dates older than 7 days", () => {
    const now = new Date("2026-02-21T12:00:00Z");
    vi.setSystemTime(now);
    const twoWeeksAgo = new Date("2026-02-05T12:00:00Z").toISOString();
    expect(formatDate(twoWeeksAgo)).toMatch(/Feb\s+5/);
  });
});

// ---------------------------------------------------------------------------
// tierBadgeClasses
// ---------------------------------------------------------------------------

describe("tierBadgeClasses", () => {
  it("returns amber classes for Elite", () => {
    const result = tierBadgeClasses("Elite");
    expect(result).toContain("bg-amber/10");
    expect(result).toContain("text-amber");
  });

  it("returns terminal-green classes for High", () => {
    const result = tierBadgeClasses("High");
    expect(result).toContain("bg-terminal-green/10");
    expect(result).toContain("text-terminal-green");
  });

  it("returns text-primary classes for Solid", () => {
    const result = tierBadgeClasses("Solid");
    expect(result).toContain("bg-text-primary/10");
    expect(result).toContain("text-text-primary");
  });

  it("returns text-secondary classes for unknown tiers", () => {
    const result = tierBadgeClasses("Emerging");
    expect(result).toContain("bg-text-secondary/10");
    expect(result).toContain("text-text-secondary");
  });

  it("returns text-secondary classes for empty string", () => {
    const result = tierBadgeClasses("");
    expect(result).toContain("text-text-secondary");
  });

  it("always includes base styling classes", () => {
    const result = tierBadgeClasses("Elite");
    expect(result).toContain("inline-flex");
    expect(result).toContain("rounded-md");
    expect(result).toContain("font-heading");
  });
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("TIER_ORDER", () => {
  it("Elite has the highest rank", () => {
    expect(TIER_ORDER.Elite).toBe(4);
  });

  it("Emerging has the lowest rank", () => {
    expect(TIER_ORDER.Emerging).toBe(1);
  });

  it("has all 4 tiers", () => {
    expect(Object.keys(TIER_ORDER).sort()).toEqual(["Elite", "Emerging", "High", "Solid"]);
  });
});

describe("ARCHETYPE_COLOR", () => {
  it("maps all 7 archetypes to color classes", () => {
    expect(Object.keys(ARCHETYPE_COLOR).sort()).toEqual([
      "Artificer",
      "Balanced",
      "Builder",
      "Emerging",
      "Marathoner",
      "Polymath",
      "Quality Champion",
    ]);
  });

  it("each value is a text- class", () => {
    for (const color of Object.values(ARCHETYPE_COLOR)) {
      expect(color).toMatch(/^text-/);
    }
  });

  it("keeps every small archetype label readable on the actual table surface", () => {
    for (const color of Object.values(ARCHETYPE_COLOR)) {
      expect(color).toMatch(/^text-archetype-\w+-text$/);
      const token = themedTokenValue(`--color-${color.slice(5)}`);
      const card = themedTokenValue("--color-card");
      for (const theme of ["light", "dark"] as const) {
        expect(contrastRatio(token[theme], card[theme])).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

describe("TIER_COLOR", () => {
  it("maps all 4 tiers to color classes", () => {
    expect(Object.keys(TIER_COLOR).sort()).toEqual(["Elite", "Emerging", "High", "Solid"]);
  });

  it("uses text-safe Elite color on both plain and tinted table surfaces", () => {
    expect(TIER_COLOR.Elite).toBe("text-amber-text");
    expect(tierBadgeClasses("Elite").split(" ")).toContain("text-amber-text");
    const text = themedTokenValue("--color-amber-text");
    const amber = themedTokenValue("--color-amber");
    const card = themedTokenValue("--color-card");
    for (const theme of ["light", "dark"] as const) {
      expect(contrastRatio(text[theme], card[theme])).toBeGreaterThanOrEqual(4.5);
      const tinted = compositeColor(amber[theme], card[theme], 0.1);
      expect(contrastRatio(text[theme], tinted)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
