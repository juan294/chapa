// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ImpactBreakdown, DataSources, getArchetypeProfile } from "./ImpactBreakdown";
import type { ImpactV6Result, StatsData } from "@chapa/shared";
import { en } from "@/lib/i18n/dictionaries/en";
import { resolveTranslation } from "@/lib/i18n/resolve";

/** English translation function for tests */
function tEn(key: string): string | string[] | Record<string, unknown>[] {
  return resolveTranslation(key, en) as string | string[] | Record<string, unknown>[];
}

afterEach(cleanup);

const SAMPLE_IMPACT: ImpactV6Result = {
  handle: "testuser",
  profileType: "collaborative",
  dimensions: { delivery: 85, quality: 42, consistency: 70, breadth: 55 },
  archetype: "Builder",
  compositeScore: 72,
  confidence: 90,
  confidencePenalties: [],
  adjustedComposite: 78,
  tier: "High",
  computedAt: "2025-01-01T00:00:00Z",
};

const SAMPLE_STATS: StatsData = {
  handle: "testuser",
  displayName: "Test User",
  commitsTotal: 320,
  activeDays: 180,
  prsMergedCount: 65,
  prsMergedWeight: 72,
  reviewsSubmittedCount: 30,
  issuesClosedCount: 20,
  linesAdded: 40000,
  linesDeleted: 15000,
  reposContributed: 6,
  topRepoShare: 0.4,
  maxCommitsIn10Min: 2,
  totalStars: 500,
  totalForks: 120,
  totalWatchers: 45,
  heatmapData: [],
  fetchedAt: "2025-01-01T00:00:00Z",
};

describe("getArchetypeProfile", () => {
  it("returns profile with tip for Builder archetype", () => {
    const result = getArchetypeProfile(SAMPLE_IMPACT, tEn);
    expect(result).toContain("driven by output");
    // Builder's weakest is quality (42), so should include quality tip
    expect(result).toContain("Quality");
  });

  it("returns profile with tip for Quality Champion", () => {
    const impact: ImpactV6Result = {
      ...SAMPLE_IMPACT,
      archetype: "Quality Champion",
      dimensions: { delivery: 30, quality: 90, consistency: 50, breadth: 40 },
    };
    const result = getArchetypeProfile(impact, tEn);
    expect(result).toContain("shaped by quality");
    // Weakest is delivery (30)
    expect(result).toContain("Delivery");
  });

  it("returns profile with tip for Marathoner", () => {
    const impact: ImpactV6Result = {
      ...SAMPLE_IMPACT,
      archetype: "Marathoner",
      dimensions: { delivery: 40, quality: 20, consistency: 92, breadth: 35 },
    };
    const result = getArchetypeProfile(impact, tEn);
    expect(result).toContain("defined by consistency");
  });

  it("returns profile with tip for Polymath", () => {
    const impact: ImpactV6Result = {
      ...SAMPLE_IMPACT,
      archetype: "Polymath",
      dimensions: { delivery: 40, quality: 35, consistency: 45, breadth: 88 },
    };
    const result = getArchetypeProfile(impact, tEn);
    expect(result).toContain("marked by reach");
  });

  it("returns profile without tip for Balanced archetype", () => {
    const impact: ImpactV6Result = {
      ...SAMPLE_IMPACT,
      archetype: "Balanced",
      dimensions: { delivery: 70, quality: 68, consistency: 72, breadth: 66 },
    };
    const result = getArchetypeProfile(impact, tEn);
    expect(result).toContain("well-rounded");
    // Should NOT contain a dimension tip since Balanced skips tips
    expect(result).not.toContain("To strengthen");
  });

  it("returns profile without tip for Emerging archetype", () => {
    const impact: ImpactV6Result = {
      ...SAMPLE_IMPACT,
      archetype: "Emerging",
      dimensions: { delivery: 15, quality: 10, consistency: 12, breadth: 8 },
    };
    const result = getArchetypeProfile(impact, tEn);
    expect(result).toContain("still taking shape");
    expect(result).not.toContain("To strengthen");
  });
});

describe("ImpactBreakdown", () => {
  it("renders all four dimension cards", () => {
    render(<ImpactBreakdown impact={SAMPLE_IMPACT} stats={SAMPLE_STATS} />);
    expect(screen.getByText("Delivery")).toBeDefined();
    expect(screen.getByText("Quality")).toBeDefined();
    expect(screen.getByText("Consistency")).toBeDefined();
    expect(screen.getByText("Breadth")).toBeDefined();
  });

  it("renders dimension scores", () => {
    render(<ImpactBreakdown impact={SAMPLE_IMPACT} stats={SAMPLE_STATS} />);
    expect(screen.getByText("85")).toBeDefined();
    expect(screen.getByText("42")).toBeDefined();
    expect(screen.getByText("70")).toBeDefined();
    expect(screen.getByText("55")).toBeDefined();
  });

  it("renders progress bars with correct aria-valuenow", () => {
    render(<ImpactBreakdown impact={SAMPLE_IMPACT} stats={SAMPLE_STATS} />);
    const bars = screen.getAllByRole("progressbar");
    expect(bars).toHaveLength(4);
    expect(bars[0]!.getAttribute("aria-valuenow")).toBe("85");
    expect(bars[1]!.getAttribute("aria-valuenow")).toBe("42");
  });

  it("renders key numbers section", () => {
    render(<ImpactBreakdown impact={SAMPLE_IMPACT} stats={SAMPLE_STATS} />);
    expect(screen.getByText("Key Numbers")).toBeDefined();
    expect(screen.getByText("Stars")).toBeDefined();
    expect(screen.getByText("Forks")).toBeDefined();
    expect(screen.getByText("Watchers")).toBeDefined();
  });
});

describe("ImpactBreakdown — null guard branch", () => {
  it("renders fallback message when impact is null", () => {
    // @ts-expect-error — testing runtime null guard
    render(<ImpactBreakdown impact={null} stats={SAMPLE_STATS} />);
    expect(screen.getByText("No impact data available")).toBeDefined();
  });

  it("renders fallback message when stats is null", () => {
    // @ts-expect-error — testing runtime null guard
    render(<ImpactBreakdown impact={SAMPLE_IMPACT} stats={null} />);
    expect(screen.getByText("No impact data available")).toBeDefined();
  });

  it("renders fallback message when both props are undefined", () => {
    // @ts-expect-error — testing runtime null guard
    render(<ImpactBreakdown impact={undefined} stats={undefined} />);
    expect(screen.getByText("No impact data available")).toBeDefined();
  });
});

describe("ImpactBreakdown — craft dimension visibility", () => {
  it("renders 5 dimension cards when craft is present", () => {
    const impactWithCraft: ImpactV6Result = {
      ...SAMPLE_IMPACT,
      dimensions: { delivery: 85, quality: 42, consistency: 70, breadth: 55, craft: 60 },
    };
    render(<ImpactBreakdown impact={impactWithCraft} stats={SAMPLE_STATS} />);
    expect(screen.getByText("Craft")).toBeDefined();
    const bars = screen.getAllByRole("progressbar");
    expect(bars).toHaveLength(5);
  });

  it("renders only 4 dimension cards when craft is absent", () => {
    render(<ImpactBreakdown impact={SAMPLE_IMPACT} stats={SAMPLE_STATS} />);
    expect(screen.queryByText("Craft")).toBeNull();
    const bars = screen.getAllByRole("progressbar");
    expect(bars).toHaveLength(4);
  });

  it("shows craft score value when craft is present", () => {
    const impactWithCraft: ImpactV6Result = {
      ...SAMPLE_IMPACT,
      dimensions: { delivery: 85, quality: 42, consistency: 70, breadth: 55, craft: 73 },
    };
    render(<ImpactBreakdown impact={impactWithCraft} stats={SAMPLE_STATS} />);
    expect(screen.getByText("73")).toBeDefined();
  });
});

describe("ImpactBreakdown — solo profile type", () => {
  const SOLO_IMPACT: ImpactV6Result = {
    ...SAMPLE_IMPACT,
    profileType: "solo",
  };

  it("shows solo-specific subtitle for quality dimension", () => {
    render(<ImpactBreakdown impact={SOLO_IMPACT} stats={SAMPLE_STATS} />);
    // Solo quality subtitle should be about PR descriptions, branch discipline, issue linkage
    expect(screen.getByText(/PR descriptions/)).toBeDefined();
  });

  it("still shows standard subtitles for non-overridden dimensions", () => {
    render(<ImpactBreakdown impact={SOLO_IMPACT} stats={SAMPLE_STATS} />);
    // Delivery subtitle is the same for solo and collaborative
    expect(screen.getByText(/PRs merged/)).toBeDefined();
  });
});

describe("getArchetypeProfile — Artificer archetype", () => {
  it("returns profile with craft description for Artificer", () => {
    const impact: ImpactV6Result = {
      ...SAMPLE_IMPACT,
      archetype: "Artificer",
      dimensions: { delivery: 40, quality: 35, consistency: 45, breadth: 30, craft: 92 },
    };
    const result = getArchetypeProfile(impact, tEn);
    expect(result).toContain("defined by craft");
    // Weakest is breadth (30)
    expect(result).toContain("Breadth");
  });
});

describe("getArchetypeProfile — solo profile tips", () => {
  it("uses solo quality tip when profileType is solo and quality is weakest", () => {
    const impact: ImpactV6Result = {
      ...SAMPLE_IMPACT,
      profileType: "solo",
      archetype: "Builder",
      dimensions: { delivery: 90, quality: 10, consistency: 70, breadth: 55 },
    };
    const result = getArchetypeProfile(impact, tEn);
    // Solo quality tip mentions PR descriptions and feature branches
    expect(result).toContain("PR descriptions");
    expect(result).toContain("feature branches");
  });

  it("falls back to standard tip for non-quality dimensions even in solo mode", () => {
    const impact: ImpactV6Result = {
      ...SAMPLE_IMPACT,
      profileType: "solo",
      archetype: "Marathoner",
      dimensions: { delivery: 10, quality: 40, consistency: 90, breadth: 55 },
    };
    const result = getArchetypeProfile(impact, tEn);
    // Weakest is delivery (10), and there's no solo override for delivery
    expect(result).toContain("opening and merging more pull requests");
  });
});

describe("DataSources", () => {
  it("renders GitHub as default data source", () => {
    render(<DataSources stats={SAMPLE_STATS} handle="testuser" />);
    expect(screen.getByText("GitHub")).toBeDefined();
  });

  it("renders linked platforms when present", () => {
    const stats: StatsData = {
      ...SAMPLE_STATS,
      linkedPlatforms: ["github", "bitbucket"],
      linkedPlatformLogins: { bitbucket: "bbuser" },
    };
    render(<DataSources stats={stats} handle="testuser" />);
    expect(screen.getByText("GitHub")).toBeDefined();
    expect(screen.getByText("Bitbucket")).toBeDefined();
  });

  it("renders GitHub link with handle", () => {
    render(<DataSources stats={SAMPLE_STATS} handle="testuser" />);
    const link = screen.getByText("GitHub").closest("a");
    expect(link?.getAttribute("href")).toBe("https://github.com/testuser");
  });

  it("renders Codeberg platform when linked", () => {
    const stats: StatsData = {
      ...SAMPLE_STATS,
      linkedPlatforms: ["github", "codeberg"],
      linkedPlatformLogins: { codeberg: "cbuser" },
    };
    render(<DataSources stats={stats} handle="testuser" />);
    expect(screen.getByText("Codeberg")).toBeDefined();
    const link = screen.getByText("Codeberg").closest("a");
    expect(link?.getAttribute("href")).toBe("https://codeberg.org/cbuser");
  });

  it("renders platform as span (not link) when no username is available", () => {
    const stats: StatsData = {
      ...SAMPLE_STATS,
      linkedPlatforms: ["github", "bitbucket"],
      // No linkedPlatformLogins for bitbucket — so no URL can be built
    };
    render(<DataSources stats={stats} handle="testuser" />);
    const bitbucketLabel = screen.getByText("Bitbucket");
    // Should be inside a span, not an anchor
    expect(bitbucketLabel.closest("a")).toBeNull();
    expect(bitbucketLabel.closest("span")).not.toBeNull();
  });

  it("renders only GitHub when linkedPlatforms is undefined", () => {
    const stats: StatsData = {
      ...SAMPLE_STATS,
      linkedPlatforms: undefined,
    };
    render(<DataSources stats={stats} handle="testuser" />);
    expect(screen.getByText("GitHub")).toBeDefined();
    expect(screen.queryByText("Bitbucket")).toBeNull();
    expect(screen.queryByText("Codeberg")).toBeNull();
  });

  it("renders Bitbucket link with correct URL from linkedPlatformLogins", () => {
    const stats: StatsData = {
      ...SAMPLE_STATS,
      linkedPlatforms: ["github", "bitbucket"],
      linkedPlatformLogins: { bitbucket: "mybbuser" },
    };
    render(<DataSources stats={stats} handle="testuser" />);
    const link = screen.getByText("Bitbucket").closest("a");
    expect(link?.getAttribute("href")).toBe("https://bitbucket.org/mybbuser");
  });
});
