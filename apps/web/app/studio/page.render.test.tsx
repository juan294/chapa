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
  materializeDisplayProfile: vi.fn(),
  getPublicProfileVerification: vi.fn(),
  loadStudioConfig: vi.fn(),
  getServerLocale: vi.fn(),
  getServerT: vi.fn(),
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

vi.mock("@/lib/profile/materialize-profile", () => ({
  materializeDisplayProfile: mocks.materializeDisplayProfile,
}));

vi.mock("@/lib/profile/public-profile", () => ({
  getPublicProfileVerification: mocks.getPublicProfileVerification,
}));

vi.mock("@/lib/db/studio", () => ({
  loadStudioConfig: mocks.loadStudioConfig,
}));

vi.mock("@/lib/i18n/server", () => ({
  getServerLocale: mocks.getServerLocale,
  getServerT: mocks.getServerT,
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
    verification,
  }: {
    handle: string;
    stats: StatsData;
    initialConfig: { theme?: string; background?: string };
    verification: { hash: string; date: string } | null;
  }) => (
    <section
      data-testid="studio-client"
      data-handle={handle}
      data-commits={String(stats.commitsTotal)}
      data-config-theme={initialConfig.theme ?? "none"}
      data-config-background={initialConfig.background ?? "none"}
      data-verification={verification ? `${verification.hash}:${verification.date}` : "none"}
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
  vi.clearAllMocks();
  mocks.headers.mockResolvedValue(new Headers());
  mocks.redirect.mockImplementation((url: string) => {
    throw new Error(`redirect:${url}`);
  });
  mocks.isStudioEnabled.mockResolvedValue(true);
  mocks.getOptionalServerSessionFromHeaders.mockReturnValue(session);
  mocks.getSessionGitHubToken.mockResolvedValue("gho_token");
  mocks.materializeDisplayProfile.mockResolvedValue({
    stats,
    displayImpact: { compositeScore: 80 },
    statsComplete: true,
  });
  mocks.getPublicProfileVerification.mockReturnValue({
    hash: "abc123",
    date: "2026-08-26",
  });
  mocks.loadStudioConfig.mockResolvedValue({
    status: "found",
    config: { theme: "saved-theme" },
  });
  mocks.getServerLocale.mockResolvedValue("en");
  mocks.getServerT.mockReturnValue(
    (key: string) =>
      ({
        "studio.metadataTitle": "Creator Studio — Chapa",
        "studio.metadataDescription": "Customize your badge",
        "studio.navLinkStudio": "Studio",
        "studio.navLinkYourBadge": "Your Badge",
      })[key] ?? key,
  );
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
    expect(client.getAttribute("data-verification")).toBe(
      "abc123:2026-08-26",
    );
    expect(mocks.materializeDisplayProfile).toHaveBeenCalledWith("octocat", {
      token: "gho_token",
    });
    expect(mocks.getPublicProfileVerification).toHaveBeenCalledWith(
      expect.objectContaining({ stats }),
    );
    expect(mocks.loadStudioConfig).toHaveBeenCalledWith("octocat");
  });

  it("fails instead of rendering fabricated zero metrics when profile loading fails", async () => {
    mocks.materializeDisplayProfile.mockResolvedValue(null);
    mocks.loadStudioConfig.mockResolvedValue({ status: "not_found" });
    const { default: StudioPage } = await import("./page");

    await expect(StudioPage()).rejects.toThrow(
      "Unable to load Studio profile for octocat",
    );
    expect(mocks.getPublicProfileVerification).not.toHaveBeenCalled();
  });

  it("fails open to the default config when persisted storage is unavailable", async () => {
    mocks.loadStudioConfig.mockResolvedValue({ status: "unavailable" });
    const { default: StudioPage } = await import("./page");

    render(await StudioPage());

    expect(
      screen.getByTestId("studio-client").getAttribute("data-config-background"),
    ).toBe("solid");
  });

  it("is configured as a force-dynamic route", async () => {
    const mod = await import("./page");
    expect(mod.dynamic).toBe("force-dynamic");
  });

  it("generates localized metadata from i18n keys", async () => {
    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata();

    expect(metadata.title).toBe("Creator Studio — Chapa");
    expect(metadata.description).toBe("Customize your badge");
    expect(mocks.getServerT).toHaveBeenCalledWith("en");
  });

  it("declares its own canonical path instead of inheriting the bare origin (#1065 / FE-H1)", async () => {
    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata();

    expect(metadata.alternates).toEqual({ canonical: "/studio" });
  });
});
