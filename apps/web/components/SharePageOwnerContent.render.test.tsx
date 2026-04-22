// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { SharePageOwnerContent } from "./SharePageOwnerContent";
import type { ImpactV6Result, StatsData } from "@chapa/shared";
import type { SessionUser } from "@/hooks/useSession";

interface UseSessionReturn { session: SessionUser | null; loading: boolean; invalidate: () => void }
const mockUseSession = vi.fn<() => UseSessionReturn>();

vi.mock("@/hooks/useSession", () => ({
  useSession: () => mockUseSession(),
}));

vi.mock("@/hooks/useOwnerCacheWarm", () => ({
  useOwnerCacheWarm: vi.fn(),
}));

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
} as unknown as ImpactV6Result;

beforeEach(() => {
  mockUseSession.mockReturnValue({ session: null, loading: false, invalidate: vi.fn() });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("SharePageOwnerContent — render", () => {
  it("shows nothing while loading session", () => {
    mockUseSession.mockReturnValue({ session: null, loading: true, invalidate: vi.fn() });

    const { container } = render(
      <SharePageOwnerContent
        handle="testuser"
        stats={MOCK_STATS}
        impact={MOCK_IMPACT}
      />,
    );

    expect(container.innerHTML).toBe("");
  });

  it("shows visitor CTA when user is not the profile owner", () => {
    mockUseSession.mockReturnValue({
      session: { login: "otheruser", name: null, avatar_url: "" },
      loading: false,
      invalidate: vi.fn(),
    });

    render(
      <SharePageOwnerContent
        handle="testuser"
        stats={MOCK_STATS}
        impact={MOCK_IMPACT}
      />,
    );

    expect(
      screen.getByText("Curious what your developer impact looks like?"),
    ).toBeTruthy();
    expect(screen.getByText("Discover your impact")).toBeTruthy();
  });

  it("shows visitor CTA when session fetch fails", () => {
    mockUseSession.mockReturnValue({ session: null, loading: false, invalidate: vi.fn() });

    render(
      <SharePageOwnerContent
        handle="testuser"
        stats={MOCK_STATS}
        impact={MOCK_IMPACT}
      />,
    );

    expect(
      screen.getByText("Curious what your developer impact looks like?"),
    ).toBeTruthy();
  });

  it("shows visitor CTA when user is null", () => {
    mockUseSession.mockReturnValue({ session: null, loading: false, invalidate: vi.fn() });

    render(
      <SharePageOwnerContent
        handle="testuser"
        stats={MOCK_STATS}
        impact={MOCK_IMPACT}
      />,
    );

    expect(screen.getByText("Discover your impact")).toBeTruthy();
  });

  it("shows owner content when user matches the handle", () => {
    mockUseSession.mockReturnValue({
      session: { login: "testuser", name: null, avatar_url: "" },
      loading: false,
      invalidate: vi.fn(),
    });

    render(
      <SharePageOwnerContent
        handle="testuser"
        stats={MOCK_STATS}
        impact={MOCK_IMPACT}
      />,
    );

    expect(screen.getByTestId("data-sources")).toBeTruthy();
    expect(screen.getByTestId("impact-dashboard")).toBeTruthy();
    expect(screen.getByText("Embed This Badge")).toBeTruthy();
    expect(screen.getByText("Impact Breakdown")).toBeTruthy();
  });

  it("renders embed snippets with correct handle", () => {
    mockUseSession.mockReturnValue({
      session: { login: "testuser", name: null, avatar_url: "" },
      loading: false,
      invalidate: vi.fn(),
    });

    render(
      <SharePageOwnerContent
        handle="testuser"
        stats={MOCK_STATS}
        impact={MOCK_IMPACT}
      />,
    );

    expect(screen.getByText("Embed This Badge")).toBeTruthy();

    const copyButtons = screen.getAllByTestId("copy-button");
    expect(copyButtons.length).toBe(2);
    expect(copyButtons[0]!.getAttribute("data-text")).toContain(
      "testuser/badge.svg",
    );
    expect(copyButtons[1]!.getAttribute("data-text")).toContain(
      "testuser/badge.svg",
    );
  });

  it("shows fallback message when impact data is missing", () => {
    mockUseSession.mockReturnValue({
      session: { login: "testuser", name: null, avatar_url: "" },
      loading: false,
      invalidate: vi.fn(),
    });

    render(
      <SharePageOwnerContent
        handle="testuser"
        stats={MOCK_STATS}
        impact={null}
      />,
    );

    expect(
      screen.getByText("Could not load impact data. Try again later."),
    ).toBeTruthy();
  });

  it("shows Regenerate button in empty state (#743)", () => {
    mockUseSession.mockReturnValue({
      session: { login: "testuser", name: null, avatar_url: "" },
      loading: false,
      invalidate: vi.fn(),
    });

    render(
      <SharePageOwnerContent
        handle="testuser"
        stats={MOCK_STATS}
        impact={null}
      />,
    );

    expect(screen.getByText("Regenerate")).toBeTruthy();
  });

  it("posts to refresh and shows success after a successful regenerate", async () => {
    mockUseSession.mockReturnValue({
      session: { login: "testuser", name: null, avatar_url: "" },
      loading: false,
      invalidate: vi.fn(),
    });
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    render(
      <SharePageOwnerContent
        handle="testuser"
        stats={MOCK_STATS}
        impact={null}
      />,
    );

    fireEvent.click(screen.getByText("Regenerate"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/refresh?handle=testuser", {
        method: "POST",
      });
    });

    expect(screen.getByText("Done!")).toBeTruthy();
  });

  it("shows support fallback when regenerate fails", async () => {
    mockUseSession.mockReturnValue({
      session: { login: "testuser", name: null, avatar_url: "" },
      loading: false,
      invalidate: vi.fn(),
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    render(
      <SharePageOwnerContent
        handle="testuser"
        stats={MOCK_STATS}
        impact={null}
      />,
    );

    fireEvent.click(screen.getByText("Regenerate"));

    expect(
      await screen.findByText("Regeneration failed.", { exact: false }),
    ).toBeTruthy();
    const supportLink = screen.getByText("Contact support");
    expect(supportLink.getAttribute("href")).toContain(
      "mailto:support@thecreativetoken.com",
    );
  });

  it("hides DataSources when stats is null", () => {
    mockUseSession.mockReturnValue({
      session: { login: "testuser", name: null, avatar_url: "" },
      loading: false,
      invalidate: vi.fn(),
    });

    render(
      <SharePageOwnerContent
        handle="testuser"
        stats={null}
        impact={MOCK_IMPACT}
      />,
    );

    expect(screen.getByText("Embed This Badge")).toBeTruthy();
    expect(screen.queryByTestId("data-sources")).toBeNull();
  });
});
