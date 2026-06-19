// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { StatsData } from "@chapa/shared";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  redirect: vi.fn(),
  isStudioEnabled: vi.fn(),
  getOptionalServerSessionFromHeaders: vi.fn(),
  getSessionGitHubToken: vi.fn(),
  getStats: vi.fn(),
  cacheGet: vi.fn(),
  computeImpactV6: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: mocks.headers,
  cookies: vi.fn().mockReturnValue({ get: () => undefined }),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/lib/feature-flags", () => ({
  isStudioEnabled: mocks.isStudioEnabled,
}));

vi.mock("@/lib/auth/session", () => ({
  getOptionalServerSessionFromHeaders:
    mocks.getOptionalServerSessionFromHeaders,
}));

vi.mock("@/lib/auth/github-session-token", () => ({
  getSessionGitHubToken: mocks.getSessionGitHubToken,
}));

vi.mock("@/lib/github/client", () => ({
  getStats: mocks.getStats,
}));

vi.mock("@/lib/cache/redis", () => ({
  cacheGet: mocks.cacheGet,
}));

vi.mock("@/lib/impact/v6", () => ({
  computeImpactV6: mocks.computeImpactV6,
}));

vi.mock("@/components/Navbar", () => ({
  Navbar: ({ navLinks }: { navLinks: { label: string; href: string }[] }) => (
    <nav data-testid="navbar" data-links={navLinks.map((l) => l.href).join(",")} />
  ),
}));

vi.mock("@/components/KeyboardShortcutsListener", () => ({
  KeyboardShortcutsListener: () => <div data-testid="shortcuts" />,
}));

vi.mock("./StudioClient", () => ({
  StudioClient: ({
    handle,
    stats,
    initialConfig,
  }: {
    handle: string;
    stats: StatsData;
    initialConfig: { theme: string };
  }) => (
    <section
      data-testid="studio-client"
      data-handle={handle}
      data-commits={String(stats.commitsTotal)}
      data-config-theme={initialConfig.theme}
    />
  ),
}));

const session = {
  login: "octocat",
  name: "Octo Cat",
  avatar_url: "https://example.com/octo.png",
};

const stats = {
  handle: "octocat",
  displayName: "Octo Cat",
  avatarUrl: "https://example.com/octo.png",
  commitsTotal: 42,
  activeDays: 10,
  prsMergedCount: 5,
  prsMergedWeight: 5,
  reviewsSubmittedCount: 3,
  issuesClosedCount: 2,
  linesAdded: 100,
  linesDeleted: 20,
  reposContributed: 4,
  topRepoShare: 0.25,
  maxCommitsIn10Min: 1,
  totalStars: 7,
  totalForks: 2,
  totalWatchers: 1,
  heatmapData: [],
  fetchedAt: "2026-01-01T00:00:00.000Z",
} satisfies StatsData;

beforeEach(() => {
  cleanup();
  mocks.headers.mockResolvedValue(new Headers());
  mocks.redirect.mockImplementation((url: string) => {
    throw new Error(`redirect:${url}`);
  });
  mocks.isStudioEnabled.mockResolvedValue(true);
  mocks.getOptionalServerSessionFromHeaders.mockReturnValue(session);
  mocks.getSessionGitHubToken.mockResolvedValue("gho_token");
  mocks.getStats.mockResolvedValue(stats);
  mocks.cacheGet.mockResolvedValue({ theme: "saved-theme" });
  mocks.computeImpactV6.mockReturnValue({ compositeScore: 80 });
});

describe("StudioPage render", () => {
  it("redirects to home when Studio is disabled", async () => {
    mocks.isStudioEnabled.mockResolvedValue(false);
    const { default: StudioPage } = await import("./page");

    await expect(StudioPage()).rejects.toThrow("redirect:/");
  });

  it("redirects to login when no session exists", async () => {
    mocks.getOptionalServerSessionFromHeaders.mockReturnValue(null);
    const { default: StudioPage } = await import("./page");

    await expect(StudioPage()).rejects.toThrow("redirect:/api/auth/login");
  });

  it("redirects to login when the GitHub token is unavailable", async () => {
    mocks.getSessionGitHubToken.mockResolvedValue(null);
    const { default: StudioPage } = await import("./page");

    await expect(StudioPage()).rejects.toThrow("redirect:/api/auth/login");
  });

  it("renders the studio shell with fetched stats and saved config", async () => {
    const { default: StudioPage } = await import("./page");

    render(await StudioPage());

    expect(screen.getByTestId("navbar").getAttribute("data-links")).toContain(
      "/u/octocat",
    );
    expect(screen.getByTestId("shortcuts")).toBeTruthy();
    const client = screen.getByTestId("studio-client");
    expect(client.getAttribute("data-handle")).toBe("octocat");
    expect(client.getAttribute("data-commits")).toBe("42");
    expect(client.getAttribute("data-config-theme")).toBe("saved-theme");
    expect(mocks.computeImpactV6).toHaveBeenCalledWith(stats);
  });

  it("falls back to empty stats and the default config", async () => {
    mocks.getStats.mockResolvedValue(null);
    mocks.cacheGet.mockResolvedValue(null);
    const { default: StudioPage } = await import("./page");

    render(await StudioPage());

    const client = screen.getByTestId("studio-client");
    expect(client.getAttribute("data-commits")).toBe("0");
    expect(mocks.computeImpactV6).toHaveBeenCalledWith(
      expect.objectContaining({
        handle: "octocat",
        displayName: "Octo Cat",
        commitsTotal: 0,
        heatmapData: expect.arrayContaining([
          expect.objectContaining({ count: 0 }),
        ]),
      }),
    );
  });
});
