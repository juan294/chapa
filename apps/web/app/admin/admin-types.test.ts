import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  sortUsers,
  formatDate,
  tierBadgeClasses,
  TIER_ORDER,
  ARCHETYPE_COLOR,
  TIER_COLOR,
} from "./admin-types";
import type { AdminUser } from "./admin-types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeUser(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    handle: "user",
    displayName: null,
    avatarUrl: null,
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
    confidence: null,
    statsExpired: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// sortUsers
// ---------------------------------------------------------------------------

describe("sortUsers", () => {
  describe("handle field (string sort)", () => {
    it("sorts alphabetically ascending", () => {
      const users = [
        makeUser({ handle: "charlie" }),
        makeUser({ handle: "alice" }),
        makeUser({ handle: "bob" }),
      ];
      const result = sortUsers(users, "handle", "asc");
      expect(result.map((u) => u.handle)).toEqual(["alice", "bob", "charlie"]);
    });

    it("sorts alphabetically descending", () => {
      const users = [
        makeUser({ handle: "alice" }),
        makeUser({ handle: "charlie" }),
        makeUser({ handle: "bob" }),
      ];
      const result = sortUsers(users, "handle", "desc");
      expect(result.map((u) => u.handle)).toEqual(["charlie", "bob", "alice"]);
    });
  });

  describe("tier field (ordinal sort)", () => {
    it("sorts by tier order ascending", () => {
      const users = [
        makeUser({ handle: "a", tier: "Elite" }),
        makeUser({ handle: "b", tier: "Emerging" }),
        makeUser({ handle: "c", tier: "High" }),
      ];
      const result = sortUsers(users, "tier", "asc");
      expect(result.map((u) => u.tier)).toEqual(["Emerging", "High", "Elite"]);
    });

    it("sorts by tier order descending", () => {
      const users = [
        makeUser({ handle: "a", tier: "Emerging" }),
        makeUser({ handle: "b", tier: "Elite" }),
        makeUser({ handle: "c", tier: "Solid" }),
      ];
      const result = sortUsers(users, "tier", "desc");
      expect(result.map((u) => u.tier)).toEqual(["Elite", "Solid", "Emerging"]);
    });

    it("treats null tier as lowest rank", () => {
      const users = [
        makeUser({ handle: "a", tier: "High" }),
        makeUser({ handle: "b", tier: null }),
      ];
      const result = sortUsers(users, "tier", "asc");
      expect(result.map((u) => u.tier)).toEqual([null, "High"]);
    });
  });

  describe("numeric fields", () => {
    it("sorts adjustedComposite ascending", () => {
      const users = [
        makeUser({ handle: "a", adjustedComposite: 80 }),
        makeUser({ handle: "b", adjustedComposite: 50 }),
        makeUser({ handle: "c", adjustedComposite: 95 }),
      ];
      const result = sortUsers(users, "adjustedComposite", "asc");
      expect(result.map((u) => u.adjustedComposite)).toEqual([50, 80, 95]);
    });

    it("sorts adjustedComposite descending", () => {
      const users = [
        makeUser({ handle: "a", adjustedComposite: 50 }),
        makeUser({ handle: "b", adjustedComposite: 95 }),
        makeUser({ handle: "c", adjustedComposite: 80 }),
      ];
      const result = sortUsers(users, "adjustedComposite", "desc");
      expect(result.map((u) => u.adjustedComposite)).toEqual([95, 80, 50]);
    });

    it("treats null numeric values as 0", () => {
      const users = [
        makeUser({ handle: "a", commitsTotal: 100 }),
        makeUser({ handle: "b", commitsTotal: null }),
      ];
      const result = sortUsers(users, "commitsTotal", "asc");
      expect(result.map((u) => u.commitsTotal)).toEqual([null, 100]);
    });
  });

  describe("archetype field (string sort)", () => {
    it("sorts alphabetically ascending", () => {
      const users = [
        makeUser({ handle: "a", archetype: "Polymath" }),
        makeUser({ handle: "b", archetype: "Builder" }),
        makeUser({ handle: "c", archetype: "Guardian" }),
      ];
      const result = sortUsers(users, "archetype", "asc");
      expect(result.map((u) => u.archetype)).toEqual(["Builder", "Guardian", "Polymath"]);
    });
  });

  describe("fetchedAt field (date sort)", () => {
    it("sorts by date ascending", () => {
      const users = [
        makeUser({ handle: "a", fetchedAt: "2026-02-20T12:00:00Z" }),
        makeUser({ handle: "b", fetchedAt: "2026-02-18T12:00:00Z" }),
        makeUser({ handle: "c", fetchedAt: "2026-02-19T12:00:00Z" }),
      ];
      const result = sortUsers(users, "fetchedAt", "asc");
      expect(result.map((u) => u.handle)).toEqual(["b", "c", "a"]);
    });
  });

  describe("expired users always sort to bottom", () => {
    it("puts expired users at the end regardless of sort direction", () => {
      const users = [
        makeUser({ handle: "expired", adjustedComposite: 99, statsExpired: true }),
        makeUser({ handle: "active", adjustedComposite: 10, statsExpired: false }),
      ];
      const resultAsc = sortUsers(users, "adjustedComposite", "asc");
      expect(resultAsc.map((u) => u.handle)).toEqual(["active", "expired"]);

      const resultDesc = sortUsers(users, "adjustedComposite", "desc");
      expect(resultDesc.map((u) => u.handle)).toEqual(["active", "expired"]);
    });

    it("sorts expired users among themselves", () => {
      const users = [
        makeUser({ handle: "exp-b", adjustedComposite: 50, statsExpired: true }),
        makeUser({ handle: "active", adjustedComposite: 10, statsExpired: false }),
        makeUser({ handle: "exp-a", adjustedComposite: 90, statsExpired: true }),
      ];
      const result = sortUsers(users, "adjustedComposite", "desc");
      expect(result.map((u) => u.handle)).toEqual(["active", "exp-a", "exp-b"]);
    });
  });

  describe("does not mutate the input array", () => {
    it("returns a new array", () => {
      const users = [makeUser({ handle: "a" }), makeUser({ handle: "b" })];
      const result = sortUsers(users, "handle", "asc");
      expect(result).not.toBe(users);
    });
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
  it("maps all 6 archetypes to color classes", () => {
    expect(Object.keys(ARCHETYPE_COLOR).sort()).toEqual([
      "Balanced",
      "Builder",
      "Emerging",
      "Guardian",
      "Marathoner",
      "Polymath",
    ]);
  });

  it("each value is a text- class", () => {
    for (const color of Object.values(ARCHETYPE_COLOR)) {
      expect(color).toMatch(/^text-/);
    }
  });
});

describe("TIER_COLOR", () => {
  it("maps all 4 tiers to color classes", () => {
    expect(Object.keys(TIER_COLOR).sort()).toEqual(["Elite", "Emerging", "High", "Solid"]);
  });
});
