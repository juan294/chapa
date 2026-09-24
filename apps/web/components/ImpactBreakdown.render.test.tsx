// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { DataSources } from "./ImpactBreakdown";
import type { StatsData } from "@chapa/shared";

afterEach(cleanup);

// #1335 — the ImpactBreakdown component and getArchetypeProfile it used to
// export are gone (dead code once the v6 dashboard/ScoreBoldNumber paths
// that were their only callers were removed). DataSources is the one export
// this file still tests; it's used unconditionally by SharePageOwnerContent.

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

// #1217 — the data sources become a status row: each source says whether it is
// linked, and the owner sees the platforms they could still connect.
describe("DataSources — status row (#1217)", () => {
  it("marks a connected platform as linked", () => {
    render(<DataSources stats={SAMPLE_STATS} handle="testuser" />);
    expect(
      screen.getByTestId("data-source-status-github").textContent,
    ).toBe("linked");
  });

  it("does not offer connect entries to a visitor", () => {
    render(<DataSources stats={SAMPLE_STATS} handle="testuser" />);
    expect(screen.queryByTestId("data-source-status-gitlab")).toBeNull();
    expect(screen.queryByTestId("data-source-status-bitbucket")).toBeNull();
  });

  it("keeps a linked platform's status even when the viewer is the owner", () => {
    render(
      <DataSources
        stats={{ ...SAMPLE_STATS, linkedPlatforms: ["github", "gitlab"] }}
        handle="testuser"
        isOwner
      />,
    );
    expect(
      screen.getByTestId("data-source-status-gitlab").textContent,
    ).toBe("linked");
  });
});

// #1220 — the v2 status row shipped without a supplemental entry on the stated
// grounds that StatsData carried no EMU signal. It does: hasSupplementalData
// is OR-accumulated by the EMU merge path.
describe("DataSources — supplemental source (#1220)", () => {
  it("shows a supplemental row when EMU stats were merged in", () => {
    render(
      <DataSources
        stats={{ ...SAMPLE_STATS, hasSupplementalData: true }}
        handle="testuser"
      />,
    );
    expect(
      screen.getByTestId("data-source-status-supplemental").textContent,
    ).toBe("supplemental");
  });

  it("says 'supplemental', never 'merged'", () => {
    // "Merged" asserts more than the flag carries — it would need
    // merge_operations.verified behind it.
    const { container } = render(
      <DataSources
        stats={{ ...SAMPLE_STATS, hasSupplementalData: true }}
        handle="testuser"
      />,
    );
    expect(container.textContent).not.toContain("merged");
  });

  it("omits the row when no supplemental stats were merged", () => {
    render(<DataSources stats={SAMPLE_STATS} handle="testuser" />);
    expect(screen.queryByTestId("data-source-status-supplemental")).toBeNull();
  });

  it("shows it to a visitor too, since it is a real source of the numbers", () => {
    render(
      <DataSources
        stats={{ ...SAMPLE_STATS, hasSupplementalData: true }}
        handle="testuser"
        isOwner={false}
      />,
    );
    expect(screen.getByTestId("data-source-status-supplemental")).toBeDefined();
  });
});


/**
 * On /u/:handle the data-sources block is the first heading after the page
 * h1, and it is a peer of the "Impact breakdown" and "Embed badge" h2s that
 * follow it, styled identically. An h3 there skipped a level, which
 * Lighthouse's heading-order audit flagged (LE-8-3).
 */
describe("DataSources — heading level (LE-8-3)", () => {
  it("titles the block with an h2, the same level as its sibling share-page sections", () => {
    render(<DataSources stats={SAMPLE_STATS} handle="testuser" />);
    const heading = screen.getByRole("heading", { name: /data sources/i });
    expect(heading.tagName).toBe("H2");
  });
});
