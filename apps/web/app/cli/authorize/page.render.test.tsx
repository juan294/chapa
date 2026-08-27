// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// Track redirect calls
const mockRedirect = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    mockRedirect(url);
    // redirect() in Next.js throws to halt execution
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

const mockHeaders = vi.fn();

vi.mock("next/headers", () => ({
  headers: () => mockHeaders(),
}));

const mockGetOptionalServerSessionFromHeaders = vi.fn();
const mockGetSessionSecret = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  getOptionalServerSessionFromHeaders: (...args: unknown[]) =>
    mockGetOptionalServerSessionFromHeaders(...args),
  getSessionSecret: (...args: unknown[]) => mockGetSessionSecret(...args),
}));

vi.mock("./AuthorizeClient", () => ({
  AuthorizeClient: ({
    sessionId,
    handle,
    deviceContext,
  }: {
    sessionId: string;
    handle: string;
    deviceContext?: { ip: string; userAgent: string } | null;
  }) => (
    <div
      data-testid="authorize-client"
      data-session-id={sessionId}
      data-handle={handle}
      data-device-context={JSON.stringify(deviceContext ?? null)}
    >
      AuthorizeClient
    </div>
  ),
}));

const mockCacheGet = vi.fn();

vi.mock("@/lib/cache/redis", () => ({
  cacheGet: (...args: unknown[]) => mockCacheGet(...args),
}));

vi.mock("@/lib/auth/cli-token", () => ({
  cliDeviceContextKey: (sessionId: string) => `cli:device-context:${sessionId}`,
}));

// Mock @/lib/i18n to avoid importing client-side React hooks (useRouter etc.)
// LocaleSync renders a detectable marker (rather than null) so tests can
// confirm it's actually mounted on the page, not just imported.
vi.mock("@/lib/i18n", () => ({
  LocaleSync: ({ queryLang }: { queryLang?: string }) => (
    <span data-testid="locale-sync" data-query-lang={queryLang ?? ""} />
  ),
  LanguageProvider: (props: { children: unknown }) => props.children,
  LanguageContext: null,
  useTranslation: () => ({
    locale: 'en',
    setLocale: async () => {},
    t: (key: string) => key,
  }),
  LangSync: () => null,
  setLocaleAction: async () => {},
  LOCALE_COOKIE: 'chapa-locale',
  SUPPORTED_LOCALES: ['en', 'es'],
  DEFAULT_LOCALE: 'en',
}));

// Mock getServerLocale + getServerT to return English without needing Next.js headers()
vi.mock("@/lib/i18n/server", async () => {
  const { en } = await import("@/lib/i18n/dictionaries/en");
  function deepGet(obj: Record<string, unknown>, key: string): unknown {
    const parts = key.split(".");
    let current: unknown = obj;
    for (const part of parts) {
      if (current === null || typeof current !== "object" || Array.isArray(current)) return key;
      current = (current as Record<string, unknown>)[part];
      if (current === undefined) return key;
    }
    return current;
  }
  return {
    getServerLocale: vi.fn().mockResolvedValue("en"),
    getServerT: vi.fn().mockImplementation(() => (key: string) =>
      deepGet(en as unknown as Record<string, unknown>, key)
    ),
  };
});

beforeEach(() => {
  mockRedirect.mockClear();
  mockHeaders.mockClear();
  mockGetOptionalServerSessionFromHeaders.mockClear();
  mockGetSessionSecret.mockClear();
  mockGetSessionSecret.mockReturnValue("test-secret");
  mockCacheGet.mockReset();
  mockCacheGet.mockResolvedValue(null);
});

afterEach(() => {
  cleanup();
});

// Helper: import and call the async server component
async function renderPage(searchParams: { session?: string; lang?: string }) {
  // Re-import to pick up fresh env vars
  const mod = await import("./page");
  const Page = mod.default;
  const result = await Page({ searchParams: Promise.resolve(searchParams) });
  return render(result as React.ReactElement);
}

describe("CliAuthorizePage", () => {
  // ─── Missing session parameter ────────────────────────────────────────

  it("renders error card when session param is missing", async () => {
    await renderPage({});
    expect(
      screen.getByText("Authorize Chapa CLI"),
    ).toBeDefined();
    expect(
      screen.getByText(/Missing session parameter/),
    ).toBeDefined();
  });

  it("does not redirect when session param is missing", async () => {
    await renderPage({});
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("has a main landmark with id=main-content", async () => {
    const { container } = await renderPage({});
    expect(container.querySelector("#main-content")).not.toBeNull();
  });

  it("renders the missing-session message as an h1 heading", async () => {
    await renderPage({});
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toBe("Authorize Chapa CLI");
  });

  it("applies design-system tokens to the missing-session card", async () => {
    const { container } = await renderPage({});
    const main = container.querySelector("#main-content");
    expect(main?.className).toContain("bg-bg");
    const card = main?.querySelector(":scope > div");
    expect(card?.className).toContain("bg-card");
    expect(card?.className).toContain("border-stroke");
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.className).toContain("font-heading");
    const errorText = screen.getByText(/Missing session parameter/);
    expect(errorText.className).toContain("text-terminal-red");
  });

  it("mounts LocaleSync with the query lang param", async () => {
    await renderPage({ lang: "es" });
    const sync = screen.getByTestId("locale-sync");
    expect(sync.getAttribute("data-query-lang")).toBe("es");
  });

  // ─── Missing NEXTAUTH_SECRET ──────────────────────────────────────────

  it("redirects to '/' when NEXTAUTH_SECRET is not set", async () => {
    mockGetSessionSecret.mockReturnValue(null);

    await expect(renderPage({ session: "test-session-id" })).rejects.toThrow(
      "NEXT_REDIRECT:/",
    );
    expect(mockRedirect).toHaveBeenCalledWith("/");
  });

  // ─── No session cookie (not logged in) ────────────────────────────────

  it("redirects to login with return URL when no session cookie", async () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://chapa.example.com");

    mockHeaders.mockResolvedValue({
      get: (name: string) => (name === "cookie" ? null : null),
    });
    mockGetOptionalServerSessionFromHeaders.mockReturnValue(null);

    await expect(
      renderPage({ session: "abc123" }),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRedirect).toHaveBeenCalledTimes(1);
    const redirectUrl = mockRedirect.mock.calls[0]![0];
    expect(redirectUrl).toContain("/api/auth/login?redirect=");
    expect(redirectUrl).toContain(
      encodeURIComponent("https://chapa.example.com/cli/authorize?session=abc123"),
    );
  });

  it("uses empty base URL when NEXT_PUBLIC_BASE_URL is not set", async () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", undefined);

    mockHeaders.mockResolvedValue({
      get: () => null,
    });
    mockGetOptionalServerSessionFromHeaders.mockReturnValue(null);

    await expect(
      renderPage({ session: "abc123" }),
    ).rejects.toThrow("NEXT_REDIRECT");

    const redirectUrl = mockRedirect.mock.calls[0]![0];
    expect(redirectUrl).toContain(
      encodeURIComponent("/cli/authorize?session=abc123"),
    );
  });

  // ─── Valid session — renders AuthorizeClient ──────────────────────────

  it("renders AuthorizeClient with correct props when session is valid", async () => {
    mockHeaders.mockResolvedValue({
      get: (name: string) =>
        name === "cookie" ? "chapa_session=encrypted-value" : null,
    });
    mockGetOptionalServerSessionFromHeaders.mockReturnValue({
      login: "testuser",
      token: "gh-token",
    });

    await renderPage({ session: "my-session-id" });

    const client = screen.getByTestId("authorize-client");
    expect(client).toBeDefined();
    expect(client.getAttribute("data-session-id")).toBe("my-session-id");
    expect(client.getAttribute("data-handle")).toBe("testuser");
  });

  it("passes the headers store to getOptionalServerSessionFromHeaders", async () => {
    const cookieValue = "chapa_session=some-encrypted-cookie";
    const headerStore = {
      get: (name: string) => (name === "cookie" ? cookieValue : null),
    };
    mockHeaders.mockResolvedValue(headerStore);
    mockGetOptionalServerSessionFromHeaders.mockReturnValue({
      login: "user1",
      token: "tok",
    });

    await renderPage({ session: "sess-1" });

    expect(mockGetOptionalServerSessionFromHeaders).toHaveBeenCalledWith(
      headerStore,
    );
  });

  // ─── Device context (SE-H1 interim mitigation, #1174) ─────────────────

  it("fetches device context from the correct Redis key and forwards it to AuthorizeClient", async () => {
    mockHeaders.mockResolvedValue({
      get: (name: string) =>
        name === "cookie" ? "chapa_session=encrypted-value" : null,
    });
    mockGetOptionalServerSessionFromHeaders.mockReturnValue({
      login: "testuser",
      token: "gh-token",
    });
    mockCacheGet.mockResolvedValue({ ip: "9.9.9.9", userAgent: "TestAgent/1.0" });

    await renderPage({ session: "my-session-id" });

    expect(mockCacheGet).toHaveBeenCalledWith(
      "cli:device-context:my-session-id",
    );
    const client = screen.getByTestId("authorize-client");
    expect(JSON.parse(client.getAttribute("data-device-context")!)).toEqual({
      ip: "9.9.9.9",
      userAgent: "TestAgent/1.0",
    });
  });

  it("forwards null device context when Redis has no entry for the session", async () => {
    mockHeaders.mockResolvedValue({
      get: (name: string) =>
        name === "cookie" ? "chapa_session=encrypted-value" : null,
    });
    mockGetOptionalServerSessionFromHeaders.mockReturnValue({
      login: "testuser",
      token: "gh-token",
    });
    mockCacheGet.mockResolvedValue(null);

    await renderPage({ session: "my-session-id" });

    const client = screen.getByTestId("authorize-client");
    expect(JSON.parse(client.getAttribute("data-device-context")!)).toBeNull();
  });
});
