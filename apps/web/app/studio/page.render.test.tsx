// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { useState } from "react";
import type { CraftResult, ImpactV6Result, StatsData } from "@chapa/shared";
import { DEMO_IMPACT, DEMO_STATS } from "@/lib/render/demoData";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  redirect: vi.fn(),
  isStudioEnabled: vi.fn(),
  isStudioDemoEnabled: vi.fn(),
  getOptionalServerSessionFromHeaders: vi.fn(),
  getSessionGitHubToken: vi.fn(),
  materializeDisplayProfile: vi.fn(),
  getPublicProfileVerification: vi.fn(),
  loadStudioConfig: vi.fn(),
  getServerLocale: vi.fn(),
  getServerT: vi.fn(),
  resolveBadgeAvatar: vi.fn(),
  getBadgeAvatarDataUri: vi.fn(),
}));

vi.mock("@/lib/render/avatar-outcome", () => ({
  resolveBadgeAvatar: mocks.resolveBadgeAvatar,
  getBadgeAvatarDataUri: mocks.getBadgeAvatarDataUri,
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
  isStudioDemoEnabled: mocks.isStudioDemoEnabled,
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
    impact,
    craftResult,
    initialConfig,
    verification,
    avatarDataUri,
    demo,
  }: {
    handle: string;
    stats: StatsData;
    impact: ImpactV6Result;
    craftResult: CraftResult | null;
    initialConfig: { theme?: string; background?: string };
    verification: { hash: string; date: string } | null;
    avatarDataUri?: string;
    demo?: boolean;
  }) => {
    const [mountedMode] = useState(demo ? "demo" : "live");
    return (
      <section
        data-testid="studio-client"
        data-handle={handle}
        data-commits={String(stats.commitsTotal)}
        data-impact-score={String(impact.adjustedComposite)}
        data-craft-score={String(craftResult?.craftScore ?? "none")}
        data-config-theme={initialConfig.theme ?? "none"}
        data-config-background={initialConfig.background ?? "none"}
        data-verification={verification ? `${verification.hash}:${verification.date}` : "none"}
        data-avatar={avatarDataUri ?? "none"}
        data-demo={String(demo ?? false)}
        data-mounted-mode={mountedMode}
      />
    );
  },
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

const craftResult = {
  tool: "claude-code",
  dimensions: { proficiency: 91, effectiveness: 72, sophistication: 83 },
  craftScore: 82,
  tier: "Expert",
  reportPeriod: { start: "2026-08-01", end: "2026-08-27" },
  computedAt: "2026-08-27T00:00:00.000Z",
} satisfies CraftResult;

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.headers.mockResolvedValue(new Headers());
  mocks.redirect.mockImplementation((url: string) => {
    throw new Error(`redirect:${url}`);
  });
  mocks.isStudioEnabled.mockResolvedValue(true);
  mocks.isStudioDemoEnabled.mockResolvedValue(false);
  mocks.getOptionalServerSessionFromHeaders.mockReturnValue(session);
  mocks.getSessionGitHubToken.mockResolvedValue("gho_token");
  mocks.materializeDisplayProfile.mockResolvedValue({
    stats,
    craftResult,
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
  mocks.resolveBadgeAvatar.mockResolvedValue({
    status: "resolved",
    dataUri: "data:image/png;base64,AVATAR",
  });
  mocks.getBadgeAvatarDataUri.mockReturnValue("data:image/png;base64,AVATAR");
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
  it("renders enabled demo fixtures without reading session or profile data", async () => {
    mocks.isStudioDemoEnabled.mockResolvedValue(true);
    const { default: StudioPage } = await import("./page");

    render(
      await StudioPage({
        searchParams: Promise.resolve({ demo: "1" }),
      }),
    );

    const client = screen.getByTestId("studio-client");
    expect(client.getAttribute("data-demo")).toBe("true");
    expect(client.getAttribute("data-handle")).toBe(DEMO_STATS.handle);
    expect(client.getAttribute("data-commits")).toBe(
      String(DEMO_STATS.commitsTotal),
    );
    expect(client.getAttribute("data-impact-score")).toBe(
      String(DEMO_IMPACT.adjustedComposite),
    );
    expect(client.getAttribute("data-craft-score")).toBe("none");
    expect(client.getAttribute("data-config-background")).toBe("solid");
    expect(client.getAttribute("data-verification")).toBe("none");
    expect(mocks.isStudioEnabled).toHaveBeenCalledOnce();
    expect(mocks.isStudioDemoEnabled).toHaveBeenCalledOnce();
    expect(mocks.headers).not.toHaveBeenCalled();
    expect(mocks.getOptionalServerSessionFromHeaders).not.toHaveBeenCalled();
    expect(mocks.getSessionGitHubToken).not.toHaveBeenCalled();
    expect(mocks.materializeDisplayProfile).not.toHaveBeenCalled();
    expect(mocks.loadStudioConfig).not.toHaveBeenCalled();
    expect(mocks.getPublicProfileVerification).not.toHaveBeenCalled();
  });

  it("remounts Studio state when navigation crosses the demo boundary", async () => {
    mocks.isStudioDemoEnabled.mockResolvedValue(true);
    const { default: StudioPage } = await import("./page");
    const view = render(
      await StudioPage({ searchParams: Promise.resolve({ demo: "1" }) }),
    );
    expect(
      screen.getByTestId("studio-client").getAttribute("data-mounted-mode"),
    ).toBe("demo");

    view.rerender(await StudioPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByTestId("studio-client").getAttribute("data-demo")).toBe(
      "false",
    );
    expect(
      screen.getByTestId("studio-client").getAttribute("data-mounted-mode"),
    ).toBe("live");
  });

  it("falls through to the login gate when demo mode is disabled", async () => {
    mocks.getOptionalServerSessionFromHeaders.mockReturnValue(null);
    const { default: StudioPage } = await import("./page");

    await expect(
      StudioPage({ searchParams: Promise.resolve({ demo: "1" }) }),
    ).rejects.toThrow("redirect:/api/auth/login");

    expect(mocks.isStudioDemoEnabled).toHaveBeenCalledOnce();
    expect(mocks.headers).toHaveBeenCalledOnce();
    expect(mocks.getOptionalServerSessionFromHeaders).toHaveBeenCalledOnce();
  });

  it("redirects to home when Studio is disabled", async () => {
    mocks.isStudioEnabled.mockResolvedValue(false);
    mocks.isStudioDemoEnabled.mockResolvedValue(true);
    const { default: StudioPage } = await import("./page");

    await expect(
      StudioPage({ searchParams: Promise.resolve({ demo: "1" }) }),
    ).rejects.toThrow("redirect:/");
    expect(mocks.isStudioDemoEnabled).not.toHaveBeenCalled();
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
    expect(client.getAttribute("data-craft-score")).toBe("82");
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

  // #1191 step 6 — Studio previews the real badge SVG, and the real badge
  // draws the owner's avatar. The page resolves it server-side exactly as the
  // badge route does; without it the preview shows the shield placeholder and
  // stops matching the artifact it claims to preview.
  it("resolves the badge avatar server-side and forwards it to the client", async () => {
    const { default: StudioPage } = await import("./page");

    render(await StudioPage());

    expect(mocks.resolveBadgeAvatar).toHaveBeenCalledWith(
      "octocat",
      stats.avatarUrl,
      expect.objectContaining({ deadlineMs: expect.any(Number) }),
    );
    expect(screen.getByTestId("studio-client").getAttribute("data-avatar")).toBe(
      "data:image/png;base64,AVATAR",
    );
  });

  it("still renders when the avatar cannot be resolved", async () => {
    mocks.getBadgeAvatarDataUri.mockReturnValue(undefined);

    const { default: StudioPage } = await import("./page");

    render(await StudioPage());

    expect(screen.getByTestId("studio-client").getAttribute("data-avatar")).toBe(
      "none",
    );
  });

  it("does not fetch an avatar for the anonymous demo", async () => {
    mocks.isStudioDemoEnabled.mockResolvedValue(true);

    const { default: StudioPage } = await import("./page");

    render(await StudioPage({ searchParams: Promise.resolve({ demo: "1" }) }));

    expect(mocks.resolveBadgeAvatar).not.toHaveBeenCalled();
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

  it("adds noindex metadata only for an enabled demo variant", async () => {
    mocks.isStudioDemoEnabled.mockResolvedValue(true);
    const { generateMetadata } = await import("./page");

    const metadata = await generateMetadata({
      searchParams: Promise.resolve({ demo: "1" }),
    });

    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.alternates).toEqual({ canonical: "/studio" });
  });

  it("keeps normal metadata when the demo flag is disabled", async () => {
    const { generateMetadata } = await import("./page");

    const metadata = await generateMetadata({
      searchParams: Promise.resolve({ demo: "1" }),
    });

    expect(metadata.robots).toBeUndefined();
    expect(metadata.alternates).toEqual({ canonical: "/studio" });
  });

  it("keeps normal metadata when Studio itself is disabled", async () => {
    mocks.isStudioEnabled.mockResolvedValue(false);
    mocks.isStudioDemoEnabled.mockResolvedValue(true);
    const { generateMetadata } = await import("./page");

    const metadata = await generateMetadata({
      searchParams: Promise.resolve({ demo: "1" }),
    });

    expect(metadata.robots).toBeUndefined();
    expect(metadata.alternates).toEqual({ canonical: "/studio" });
    expect(mocks.isStudioDemoEnabled).not.toHaveBeenCalled();
  });

  it("declares its own canonical path instead of inheriting the bare origin (#1065 / FE-H1)", async () => {
    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata();

    expect(metadata.alternates).toEqual({ canonical: "/studio" });
  });
});
