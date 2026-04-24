import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — hoisted before any imports that depend on them
// ---------------------------------------------------------------------------

const {
  mockIsCliToken,
  mockVerifyCliToken,
  mockFetchGitHubUser,
  mockGetOptionalRequestSession,
  mockGetSessionSecret,
  mockGetSessionGitHubToken,
} = vi.hoisted(() => ({
  mockIsCliToken: vi.fn(),
  mockVerifyCliToken: vi.fn(),
  mockFetchGitHubUser: vi.fn(),
  mockGetOptionalRequestSession: vi.fn(),
  mockGetSessionSecret: vi.fn(),
  mockGetSessionGitHubToken: vi.fn(),
}));

vi.mock("@/lib/auth/cli-token", () => ({
  isCliToken: mockIsCliToken,
  verifyCliToken: mockVerifyCliToken,
}));

vi.mock("@/lib/auth/github", () => ({
  fetchGitHubUser: mockFetchGitHubUser,
}));

vi.mock("@/lib/auth/session", () => ({
  getOptionalRequestSession: mockGetOptionalRequestSession,
  getSessionSecret: mockGetSessionSecret,
}));

vi.mock("@/lib/auth/github-session-token", () => ({
  getSessionGitHubToken: mockGetSessionGitHubToken,
}));

// ---------------------------------------------------------------------------
// Import AFTER mocks
// ---------------------------------------------------------------------------

import { resolveRequestAuth } from "./resolve-request-auth";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("https://chapa.thecreativetoken.com/api/test", {
    method: "POST",
    headers,
  });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionSecret.mockReturnValue("test-secret-key");
  mockGetSessionGitHubToken.mockResolvedValue("ghp_test");
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("resolveRequestAuth", () => {
  describe("Bearer CLI token", () => {
    it("resolves handle from a valid CLI token", async () => {
      mockIsCliToken.mockReturnValue(true);
      mockVerifyCliToken.mockReturnValue({ handle: "juan294" });

      const result = await resolveRequestAuth(
        makeRequest({ Authorization: "Bearer cli.token.here" }),
      );

      expect(result).toEqual({ handle: "juan294" });
      expect(mockIsCliToken).toHaveBeenCalledWith("cli.token.here");
      expect(mockVerifyCliToken).toHaveBeenCalledWith("cli.token.here", "test-secret-key");
    });

    it("returns null for expired CLI token", async () => {
      mockIsCliToken.mockReturnValue(true);
      mockVerifyCliToken.mockReturnValue(null);

      const result = await resolveRequestAuth(
        makeRequest({ Authorization: "Bearer expired.cli.token" }),
      );

      expect(result).toBeNull();
    });

    it("trims whitespace and newlines from the Authorization bearer token", async () => {
      mockIsCliToken.mockReturnValue(true);
      mockVerifyCliToken.mockReturnValue({ handle: "juan294" });

      const result = await resolveRequestAuth(
        makeRequest({ Authorization: "Bearer \tcli.token.here\n " }),
      );

      expect(result).toEqual({ handle: "juan294" });
      expect(mockIsCliToken).toHaveBeenCalledWith("cli.token.here");
      expect(mockVerifyCliToken).toHaveBeenCalledWith(
        "cli.token.here",
        "test-secret-key",
      );
    });
  });

  describe("Bearer GitHub PAT", () => {
    it("resolves handle via fetchGitHubUser", async () => {
      mockIsCliToken.mockReturnValue(false);
      mockFetchGitHubUser.mockResolvedValue({ login: "octocat" });

      const result = await resolveRequestAuth(
        makeRequest({ Authorization: "Bearer ghp_abc123" }),
      );

      expect(result).toEqual({ handle: "octocat" });
      expect(mockFetchGitHubUser).toHaveBeenCalledWith("ghp_abc123");
    });

    it("returns null for invalid GitHub PAT", async () => {
      mockIsCliToken.mockReturnValue(false);
      mockFetchGitHubUser.mockResolvedValue(null);

      const result = await resolveRequestAuth(
        makeRequest({ Authorization: "Bearer ghp_invalid" }),
      );

      expect(result).toBeNull();
    });
  });

  describe("session cookie fallback", () => {
    it("resolves handle from session cookie when no Bearer header", async () => {
      mockGetOptionalRequestSession.mockReturnValue({
        login: "juan294",
        name: "Juan",
        avatar_url: "https://example.com/avatar.png",
      });

      const result = await resolveRequestAuth(
        makeRequest({ cookie: "chapa_session=encrypted_value" }),
      );

      expect(result).toEqual({ handle: "juan294", token: "ghp_test" });
      expect(mockGetOptionalRequestSession).toHaveBeenCalled();
      expect(mockGetSessionGitHubToken).toHaveBeenCalledWith({
        login: "juan294",
        name: "Juan",
        avatar_url: "https://example.com/avatar.png",
      });
    });
  });

  describe("no auth", () => {
    it("returns null when no Bearer header and no session cookie", async () => {
      mockGetOptionalRequestSession.mockReturnValue(null);

      const result = await resolveRequestAuth(makeRequest());

      expect(result).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("returns null when NEXTAUTH_SECRET is not set", async () => {
      mockGetSessionSecret.mockReturnValue(null);

      const result = await resolveRequestAuth(
        makeRequest({ Authorization: "Bearer cli.token" }),
      );

      expect(result).toBeNull();
    });

    it("prefers Bearer token over session cookie", async () => {
      mockIsCliToken.mockReturnValue(true);
      mockVerifyCliToken.mockReturnValue({ handle: "bearer-user" });

      const result = await resolveRequestAuth(
        makeRequest({
          Authorization: "Bearer cli.token",
          cookie: "chapa_session=encrypted",
        }),
      );

      expect(result).toEqual({ handle: "bearer-user" });
      expect(mockGetOptionalRequestSession).not.toHaveBeenCalled();
    });

    it("returns the handle without a token when the stored GitHub token is unavailable", async () => {
      mockGetOptionalRequestSession.mockReturnValue({
        login: "juan294",
        name: "Juan",
        avatar_url: "https://example.com/avatar.png",
      });
      mockGetSessionGitHubToken.mockResolvedValue(null);

      const result = await resolveRequestAuth(
        makeRequest({ cookie: "chapa_session=encrypted_value" }),
      );

      expect(result).toEqual({ handle: "juan294" });
    });
  });
});
