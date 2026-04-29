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
  }: {
    sessionId: string;
    handle: string;
  }) => (
    <div data-testid="authorize-client" data-session-id={sessionId} data-handle={handle}>
      AuthorizeClient
    </div>
  ),
}));

beforeEach(() => {
  mockRedirect.mockClear();
  mockHeaders.mockClear();
  mockGetOptionalServerSessionFromHeaders.mockClear();
  mockGetSessionSecret.mockClear();
  mockGetSessionSecret.mockReturnValue("test-secret");
});

afterEach(() => {
  cleanup();
});

// Helper: import and call the async server component
async function renderPage(searchParams: { session?: string }) {
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
    expect(
      screen.getByText(/chapa login/),
    ).toBeDefined();
  });

  it("does not redirect when session param is missing", async () => {
    await renderPage({});
    expect(mockRedirect).not.toHaveBeenCalled();
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
});
