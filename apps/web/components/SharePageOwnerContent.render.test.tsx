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
    expect(screen.getByText("Incrustar esta insignia")).toBeTruthy();
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

    expect(
      screen.getByText("¿Quieres ver cómo se ve tu impacto como desarrollador?"),
    ).toBeTruthy();
    expect(screen.getByTestId("data-sources")).toBeTruthy();
    expect(screen.getByTestId("impact-dashboard")).toBeTruthy();
    expect(screen.getByText("Incrustar esta insignia")).toBeTruthy();
    expect(screen.getByText("Descubre tu impacto")).toBeTruthy();
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
      screen.getByText("¿Quieres ver cómo se ve tu impacto como desarrollador?"),
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

    expect(screen.getByText("Descubre tu impacto")).toBeTruthy();
    expect(screen.getByText("Incrustar esta insignia")).toBeTruthy();
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
    expect(screen.getByText("Incrustar esta insignia")).toBeTruthy();
    expect(screen.getByText("Desglose de impacto")).toBeTruthy();
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

    expect(screen.getByText("Incrustar esta insignia")).toBeTruthy();

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
      screen.getByText("No se pudieron cargar los datos de impacto. Intentalo de nuevo mas tarde."),
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

    expect(screen.getByText("Regenerar")).toBeTruthy();
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

    fireEvent.click(screen.getByText("Regenerar"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/refresh?handle=testuser", {
        method: "POST",
      });
    });

    expect(screen.getByText("Listo")).toBeTruthy();
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

    fireEvent.click(screen.getByText("Regenerar"));

    expect(
      await screen.findByText("La regeneracion fallo.", { exact: false }),
    ).toBeTruthy();
    const supportLink = screen.getByText("Contactar soporte");
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

    expect(screen.getByText("Incrustar esta insignia")).toBeTruthy();
    expect(screen.queryByTestId("data-sources")).toBeNull();
  });
});
