// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  redirect: vi.fn(),
  getOptionalServerSessionFromHeaders: vi.fn(),
  getServerLocale: vi.fn(),
  getServerT: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth/session", () => ({
  getOptionalServerSessionFromHeaders: mocks.getOptionalServerSessionFromHeaders,
}));
vi.mock("@/lib/i18n/server", () => ({
  getServerLocale: mocks.getServerLocale,
  getServerT: mocks.getServerT,
}));
vi.mock("@/components/Navbar", () => ({
  Navbar: ({ navLinks }: { navLinks: { href: string }[] }) => (
    <div data-testid="navbar" data-links={navLinks.map((l) => l.href).join(",")} />
  ),
}));
vi.mock("./SettingsClient", () => ({
  SettingsClient: ({
    login,
    name,
    avatarUrl,
  }: {
    login: string;
    name: string | null;
    avatarUrl: string | null;
  }) => (
    <div
      data-testid="settings-client"
      data-login={login}
      data-name={name ?? "none"}
      data-avatar={avatarUrl ?? "none"}
    />
  ),
}));

const session = {
  login: "octocat",
  name: "The Octocat",
  avatar_url: "https://example.com/octo.png",
};

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.headers.mockResolvedValue(new Headers());
  mocks.redirect.mockImplementation((url: string) => {
    throw new Error(`redirect:${url}`);
  });
  mocks.getOptionalServerSessionFromHeaders.mockReturnValue(session);
  mocks.getServerLocale.mockResolvedValue("en");
  mocks.getServerT.mockReturnValue((key: string) => key);
});

/**
 * #1223 — account and connection management gets a real page. It is
 * session-gated like /studio, not a public content page: it reads the session
 * from request headers, so it can never be statically rendered.
 */
describe("SettingsPage", () => {
  it("renders the shell for a signed-in user", async () => {
    const { default: SettingsPage } = await import("./page");
    render(await SettingsPage());

    const client = screen.getByTestId("settings-client");
    expect(client.getAttribute("data-login")).toBe("octocat");
    expect(client.getAttribute("data-name")).toBe("The Octocat");
    expect(client.getAttribute("data-avatar")).toBe(
      "https://example.com/octo.png",
    );
  });

  it("links back to the owner's badge", async () => {
    const { default: SettingsPage } = await import("./page");
    render(await SettingsPage());
    expect(screen.getByTestId("navbar").getAttribute("data-links")).toContain(
      "/u/octocat",
    );
  });

  it("redirects to login when there is no session", async () => {
    mocks.getOptionalServerSessionFromHeaders.mockReturnValue(null);
    const { default: SettingsPage } = await import("./page");
    await expect(SettingsPage()).rejects.toThrow("redirect:/api/auth/login");
  });

  it("is force-dynamic — it reads the session from headers", async () => {
    const mod = await import("./page");
    expect(mod.dynamic).toBe("force-dynamic");
  });

  // An account page has nothing to offer a crawler and everything to leak.
  it("is excluded from search indexing", async () => {
    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata();
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.alternates?.canonical).toBe("/settings");
  });
});
