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
  vi.clearAllTimers();
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("SharePageOwnerContent — render", () => {
  // useTranslation falls back to English without LanguageProvider in all these tests

  it("shows public content while loading session", () => {
    mockUseSession.mockReturnValue({ session: null, loading: true, invalidate: vi.fn() });

    const { container } = render(
      <SharePageOwnerContent
        handle="testuser"
        stats={MOCK_STATS}
        impact={MOCK_IMPACT}
      />,
    );

    expect(container.innerHTML).not.toBe("");
    expect(screen.getByTestId("data-sources")).toBeTruthy();
    expect(screen.getByTestId("impact-dashboard")).toBeTruthy();
    // English: shareOwner.embedBadge = 'Embed this badge'
    expect(screen.getByText("Embed this badge")).toBeTruthy();
  });

  it("shows public insight content and CTA when user is not the profile owner", () => {
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

    // English: shareVisitor.title = 'Want to see what your developer impact looks like?'
    expect(
      screen.getByText("Want to see what your developer impact looks like?"),
    ).toBeTruthy();
    expect(screen.getByTestId("data-sources")).toBeTruthy();
    expect(screen.getByTestId("impact-dashboard")).toBeTruthy();
    // English: shareOwner.embedBadge = 'Embed this badge'
    expect(screen.getByText("Embed this badge")).toBeTruthy();
    // English: shareVisitor.cta = 'Discover your impact'
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

    // English: shareVisitor.title
    expect(
      screen.getByText("Want to see what your developer impact looks like?"),
    ).toBeTruthy();
    expect(screen.getByTestId("data-sources")).toBeTruthy();
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

    // English: shareVisitor.cta = 'Discover your impact'
    expect(screen.getByText("Discover your impact")).toBeTruthy();
    // English: shareOwner.embedBadge = 'Embed this badge'
    expect(screen.getByText("Embed this badge")).toBeTruthy();
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
    // English: shareOwner.embedBadge = 'Embed this badge'
    expect(screen.getByText("Embed this badge")).toBeTruthy();
    // English: shareOwner.impactBreakdown = 'Impact breakdown'
    expect(screen.getByText("Impact breakdown")).toBeTruthy();
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

    // English: shareOwner.embedBadge = 'Embed this badge'
    expect(screen.getByText("Embed this badge")).toBeTruthy();

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

    // English: shareOwner.emptyState = 'Impact data could not be loaded. Try again later.'
    expect(
      screen.getByText("Impact data could not be loaded. Try again later."),
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

    // English: shareOwner.regenerate = 'Regenerate'
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

    // English: shareOwner.regenerate = 'Regenerate'
    fireEvent.click(screen.getByText("Regenerate"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/refresh?handle=testuser", {
        method: "POST",
      });
    });

    // English: shareOwner.ready = 'Ready'. Wait for the resolved fetch to
    // drive the component's state update; under a busy full-suite worker the
    // fetch assertion above can win the race against React's render.
    await waitFor(() => {
      expect(screen.getByText("Ready")).toBeTruthy();
    });
  });

  it("reloads the page 800ms after a successful regenerate", async () => {
    mockUseSession.mockReturnValue({
      session: { login: "testuser", name: null, avatar_url: "" },
      loading: false,
      invalidate: vi.fn(),
    });
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload },
    });

    render(
      <SharePageOwnerContent
        handle="testuser"
        stats={MOCK_STATS}
        impact={null}
      />,
    );

    // English: shareOwner.regenerate = 'Regenerate'
    fireEvent.click(screen.getByText("Regenerate"));
    await vi.advanceTimersByTimeAsync(0); // resolve fetch microtask
    await vi.advanceTimersByTimeAsync(800);

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("falls back to error state when fetch itself rejects (network error)", async () => {
    mockUseSession.mockReturnValue({
      session: { login: "testuser", name: null, avatar_url: "" },
      loading: false,
      invalidate: vi.fn(),
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    render(
      <SharePageOwnerContent
        handle="testuser"
        stats={MOCK_STATS}
        impact={null}
      />,
    );

    // English: shareOwner.regenerate = 'Regenerate'
    fireEvent.click(screen.getByText("Regenerate"));

    expect(
      // English: shareOwner.regenerateError = 'Regeneration failed.'
      await screen.findByText("Regeneration failed.", { exact: false }),
    ).toBeTruthy();
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

    // English: shareOwner.regenerate = 'Regenerate'
    fireEvent.click(screen.getByText("Regenerate"));

    expect(
      // English: shareOwner.regenerateError = 'Regeneration failed.'
      await screen.findByText("Regeneration failed.", { exact: false }),
    ).toBeTruthy();
    // English: shareOwner.contactSupport = 'Contact support'
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

    // English: shareOwner.embedBadge = 'Embed this badge'
    expect(screen.getByText("Embed this badge")).toBeTruthy();
    expect(screen.queryByTestId("data-sources")).toBeNull();
  });
});
