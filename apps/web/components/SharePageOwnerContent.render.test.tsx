// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { SharePageOwnerContent } from "./SharePageOwnerContent";
import type { ImpactV4Result, StatsData } from "@chapa/shared";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/ImpactBreakdown", () => ({
  DataSources: ({ handle }: { handle: string }) => (
    <div data-testid="data-sources">{handle}</div>
  ),
}));

vi.mock("@/components/dashboard/ImpactDashboard", () => ({
  ImpactDashboard: () => <div data-testid="impact-dashboard" />,
}));

vi.mock("@/components/CopyButton", () => ({
  CopyButton: ({ text }: { text: string }) => (
    <button data-testid="copy-button" data-text={text}>
      Copy
    </button>
  ),
}));

const MOCK_STATS = {
  handle: "testuser",
  fetchedAt: "2026-01-01T00:00:00Z",
  commitsTotal: 100,
  activeDays: 50,
  prsMergedCount: 20,
  prsMergedWeight: 30,
  reviewsSubmittedCount: 15,
  issuesClosedCount: 5,
  linesAdded: 1000,
  linesDeleted: 500,
  reposContributed: 8,
  topRepoShare: 0.4,
  maxCommitsIn10Min: 3,
  totalStars: 50,
  totalForks: 10,
  totalWatchers: 5,
  heatmapData: [],
} as unknown as StatsData;

const MOCK_IMPACT = {
  handle: "testuser",
  delivery: 75,
  quality: 80,
  consistency: 70,
  breadth: 65,
  archetype: "builder",
  compositeScore: 72,
  adjustedComposite: 70,
  confidence: 85,
  confidenceReasons: [],
  tier: "Solid",
  dimensions: [],
} as unknown as ImpactV4Result;

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockReset();
});

afterEach(cleanup);

describe("SharePageOwnerContent — render", () => {
  it("shows nothing while loading session", () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () => new Promise(() => {}),
    );

    const { container } = render(
      <SharePageOwnerContent
        handle="testuser"
        stats={MOCK_STATS}
        impact={MOCK_IMPACT}
      />,
    );

    expect(container.innerHTML).toBe("");
  });

  it("shows visitor CTA when user is not the profile owner", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ user: { login: "otheruser" } })),
    );

    render(
      <SharePageOwnerContent
        handle="testuser"
        stats={MOCK_STATS}
        impact={MOCK_IMPACT}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Curious what your developer impact looks like?"),
      ).toBeTruthy();
    });

    expect(screen.getByText("Discover your impact")).toBeTruthy();
  });

  it("shows visitor CTA when session fetch fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("Network error"),
    );

    render(
      <SharePageOwnerContent
        handle="testuser"
        stats={MOCK_STATS}
        impact={MOCK_IMPACT}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Curious what your developer impact looks like?"),
      ).toBeTruthy();
    });
  });

  it("shows visitor CTA when user is null", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ user: null })),
    );

    render(
      <SharePageOwnerContent
        handle="testuser"
        stats={MOCK_STATS}
        impact={MOCK_IMPACT}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Discover your impact")).toBeTruthy();
    });
  });

  it("shows owner content when user matches the handle", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ user: { login: "testuser" } })),
    );

    render(
      <SharePageOwnerContent
        handle="testuser"
        stats={MOCK_STATS}
        impact={MOCK_IMPACT}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("data-sources")).toBeTruthy();
    });

    expect(screen.getByTestId("impact-dashboard")).toBeTruthy();
    expect(screen.getByText("Embed This Badge")).toBeTruthy();
    expect(screen.getByText("Impact Breakdown")).toBeTruthy();
  });

  it("renders embed snippets with correct handle", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ user: { login: "testuser" } })),
    );

    render(
      <SharePageOwnerContent
        handle="testuser"
        stats={MOCK_STATS}
        impact={MOCK_IMPACT}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Embed This Badge")).toBeTruthy();
    });

    const copyButtons = screen.getAllByTestId("copy-button");
    expect(copyButtons.length).toBe(2);
    expect(copyButtons[0]!.getAttribute("data-text")).toContain(
      "testuser/badge.svg",
    );
    expect(copyButtons[1]!.getAttribute("data-text")).toContain(
      "testuser/badge.svg",
    );
  });

  it("shows fallback message when impact data is missing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ user: { login: "testuser" } })),
    );

    render(
      <SharePageOwnerContent
        handle="testuser"
        stats={MOCK_STATS}
        impact={null}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          "Could not load impact data for this user. Try again later.",
        ),
      ).toBeTruthy();
    });
  });

  it("hides DataSources when stats is null", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ user: { login: "testuser" } })),
    );

    render(
      <SharePageOwnerContent
        handle="testuser"
        stats={null}
        impact={MOCK_IMPACT}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Embed This Badge")).toBeTruthy();
    });

    expect(screen.queryByTestId("data-sources")).toBeNull();
  });
});
