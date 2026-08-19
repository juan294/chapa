import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockCacheMGet,
  mockCacheSet,
  mockIsGitlabEnabled,
  mockDbGetLinkedPlatform,
  mockDbDeleteLinkedPlatform,
  mockDbUpdatePlatformTokens,
  mockIsTokenExpired,
  mockRefreshGitlabToken,
  mockFetchGitlabUser,
  mockFetchGitlabStats,
} = vi.hoisted(() => ({
  mockCacheMGet: vi.fn(),
  mockCacheSet: vi.fn(),
  mockIsGitlabEnabled: vi.fn(),
  mockDbGetLinkedPlatform: vi.fn(),
  mockDbDeleteLinkedPlatform: vi.fn(),
  mockDbUpdatePlatformTokens: vi.fn(),
  mockIsTokenExpired: vi.fn(),
  mockRefreshGitlabToken: vi.fn(),
  mockFetchGitlabUser: vi.fn(),
  mockFetchGitlabStats: vi.fn(),
}));

vi.mock("@/lib/cache/redis", () => ({
  cacheMGet: mockCacheMGet,
  cacheSet: mockCacheSet,
}));

vi.mock("@/lib/feature-flags", () => ({
  isGitlabEnabled: mockIsGitlabEnabled,
}));

// BE-L3: getGitlabClientId/Secret are now mutable per-test
const { mockGetGitlabClientId, mockGetGitlabClientSecret } = vi.hoisted(() => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockGetGitlabClientId: vi.fn<() => string | null | undefined>(() => "gl-client-id" as any),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockGetGitlabClientSecret: vi.fn<() => string | null | undefined>(() => "gl-client-secret" as any),
}));

vi.mock("@/lib/env", () => ({
  getGitlabClientId: () => mockGetGitlabClientId(),
  getGitlabClientSecret: () => mockGetGitlabClientSecret(),
}));

vi.mock("@/lib/db/user-platforms", () => ({
  dbGetLinkedPlatform: mockDbGetLinkedPlatform,
  dbDeleteLinkedPlatform: mockDbDeleteLinkedPlatform,
  dbUpdatePlatformTokens: mockDbUpdatePlatformTokens,
}));

vi.mock("@/lib/auth/bitbucket", () => ({
  isTokenExpired: mockIsTokenExpired,
}));

vi.mock("@/lib/auth/gitlab", () => ({
  refreshGitlabToken: mockRefreshGitlabToken,
  fetchGitlabUser: mockFetchGitlabUser,
}));

vi.mock("./stats", () => ({
  fetchGitlabStats: mockFetchGitlabStats,
}));

import { fetchGitlabIfLinked } from "./client";
import { makeStats } from "../test-helpers/fixtures";

const HANDLE = "test-user";
const LOWER = "test-user";
const CACHE_KEY = `stats:v2:gitlab:${LOWER}`;

const linkedBase = {
  remoteLogin: "gl-user",
  tokens: {
    accessToken: "gl-token",
    refreshToken: "gl-refresh",
    expiresAt: new Date("2099-12-31"),
  },
};

const GL_USER = { id: 4242, login: "gl-user", full_name: "GL User", avatar_url: "" };

describe("fetchGitlabIfLinked", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCacheMGet.mockResolvedValue([null, null]);
    mockCacheSet.mockResolvedValue(undefined);
    mockIsGitlabEnabled.mockResolvedValue(true);
    mockDbGetLinkedPlatform.mockResolvedValue(linkedBase);
    mockIsTokenExpired.mockReturnValue(false);
    mockDbDeleteLinkedPlatform.mockResolvedValue(true);
    mockDbUpdatePlatformTokens.mockResolvedValue(true);
    mockFetchGitlabUser.mockResolvedValue(GL_USER);
    // Reset BE-L3 mocks to defaults
    mockGetGitlabClientId.mockReturnValue("gl-client-id");
    mockGetGitlabClientSecret.mockReturnValue("gl-client-secret");
  });

  it("returns cached stats when cache hit", async () => {
    const cached = makeStats({ commitsTotal: 25 });
    mockCacheMGet.mockResolvedValue([cached, null]);

    const result = await fetchGitlabIfLinked(HANDLE, LOWER);

    expect(result).toEqual(cached);
    expect(mockIsGitlabEnabled).not.toHaveBeenCalled();
    expect(mockFetchGitlabStats).not.toHaveBeenCalled();
  });

  it("returns null when GitLab is not enabled", async () => {
    mockIsGitlabEnabled.mockResolvedValue(false);

    const result = await fetchGitlabIfLinked(HANDLE, LOWER);

    expect(result).toBeNull();
    expect(mockDbGetLinkedPlatform).not.toHaveBeenCalled();
  });

  it("returns null when user has no linked GitLab account", async () => {
    mockDbGetLinkedPlatform.mockResolvedValue(null);

    const result = await fetchGitlabIfLinked(HANDLE, LOWER);

    expect(result).toBeNull();
    expect(mockFetchGitlabStats).not.toHaveBeenCalled();
  });

  it("resolves the numeric user id and fetches stats when token is valid", async () => {
    const stats = makeStats({ commitsTotal: 20 });
    mockFetchGitlabStats.mockResolvedValue(stats);

    const result = await fetchGitlabIfLinked(HANDLE, LOWER);

    expect(result).toEqual(stats);
    expect(mockFetchGitlabUser).toHaveBeenCalledWith("gl-token");
    expect(mockFetchGitlabStats).toHaveBeenCalledWith(
      4242,
      "gl-user",
      "gl-token",
      { displayName: "gl-user", avatarUrl: "" },
    );
    expect(mockCacheSet).toHaveBeenCalledWith(CACHE_KEY, stats, 21600);
  });

  it("returns null when the user-id resolution fails", async () => {
    mockFetchGitlabUser.mockResolvedValue(null);

    const result = await fetchGitlabIfLinked(HANDLE, LOWER);

    expect(result).toBeNull();
    expect(mockFetchGitlabStats).not.toHaveBeenCalled();
  });

  it("does not cache when fetch returns null", async () => {
    mockFetchGitlabStats.mockResolvedValue(null);

    const result = await fetchGitlabIfLinked(HANDLE, LOWER);

    expect(result).toBeNull();
    expect(mockCacheSet).not.toHaveBeenCalled();
  });

  describe("token refresh", () => {
    it("refreshes token when expired and uses new token", async () => {
      const stats = makeStats({ commitsTotal: 12 });
      mockIsTokenExpired.mockReturnValue(true);
      mockRefreshGitlabToken.mockResolvedValue({
        ok: true,
        tokens: {
          access_token: "new-gl-token",
          refresh_token: "new-gl-refresh",
          expires_in: 7200,
        },
      });
      mockFetchGitlabStats.mockResolvedValue(stats);

      const result = await fetchGitlabIfLinked(HANDLE, LOWER);

      expect(result).toEqual(stats);
      expect(mockFetchGitlabUser).toHaveBeenCalledWith("new-gl-token");
      expect(mockFetchGitlabStats).toHaveBeenCalledWith(
        4242,
        "gl-user",
        "new-gl-token",
        expect.any(Object),
      );
      expect(mockDbUpdatePlatformTokens).toHaveBeenCalled();
    });

    it("unlinks account when no refresh token and expiresAt is set", async () => {
      mockIsTokenExpired.mockReturnValue(true);
      mockDbGetLinkedPlatform.mockResolvedValue({
        remoteLogin: "gl-user",
        tokens: { accessToken: "old", refreshToken: null, expiresAt: new Date("2020-01-01") },
      });

      const result = await fetchGitlabIfLinked(HANDLE, LOWER);

      expect(result).toBeNull();
      expect(mockDbDeleteLinkedPlatform).toHaveBeenCalledWith(HANDLE, "gitlab");
      expect(mockFetchGitlabStats).not.toHaveBeenCalled();
    });

    it("unlinks account when refresh token is revoked", async () => {
      mockIsTokenExpired.mockReturnValue(true);
      mockRefreshGitlabToken.mockResolvedValue({ ok: false, reason: "revoked" });

      const result = await fetchGitlabIfLinked(HANDLE, LOWER);

      expect(result).toBeNull();
      expect(mockDbDeleteLinkedPlatform).toHaveBeenCalledWith(HANDLE, "gitlab");
    });

    it("keeps link and returns null on transient refresh failure", async () => {
      mockIsTokenExpired.mockReturnValue(true);
      mockRefreshGitlabToken.mockResolvedValue({ ok: false, reason: "transient" });

      const result = await fetchGitlabIfLinked(HANDLE, LOWER);

      expect(result).toBeNull();
      expect(mockDbDeleteLinkedPlatform).not.toHaveBeenCalled();
    });

    // -------------------------------------------------------------------------
    // BE-L3 (#888): Short-circuit when client id/secret are missing
    // -------------------------------------------------------------------------

    it("BE-L3: returns null without attempting refresh when client id is missing", async () => {
      mockIsTokenExpired.mockReturnValue(true);
      mockGetGitlabClientId.mockReturnValue(null);
      mockGetGitlabClientSecret.mockReturnValue("gl-client-secret");

      const result = await fetchGitlabIfLinked(HANDLE, LOWER);

      expect(result).toBeNull();
      // Must not have tried the upstream refresh call
      expect(mockRefreshGitlabToken).not.toHaveBeenCalled();
    });

    it("BE-L3: returns null without attempting refresh when client secret is missing", async () => {
      mockIsTokenExpired.mockReturnValue(true);
      mockGetGitlabClientId.mockReturnValue("gl-client-id");
      mockGetGitlabClientSecret.mockReturnValue(null);

      const result = await fetchGitlabIfLinked(HANDLE, LOWER);

      expect(result).toBeNull();
      expect(mockRefreshGitlabToken).not.toHaveBeenCalled();
    });

    it("BE-L3: returns null without attempting refresh when both id and secret are missing", async () => {
      mockIsTokenExpired.mockReturnValue(true);
      mockGetGitlabClientId.mockReturnValue(null);
      mockGetGitlabClientSecret.mockReturnValue(null);

      const result = await fetchGitlabIfLinked(HANDLE, LOWER);

      expect(result).toBeNull();
      expect(mockRefreshGitlabToken).not.toHaveBeenCalled();
    });
  });

  describe("negative-result caching (P3)", () => {
    it("caches negative result for 1h when GitLab is not enabled", async () => {
      mockIsGitlabEnabled.mockResolvedValue(false);

      await fetchGitlabIfLinked(HANDLE, LOWER);

      expect(mockCacheSet).toHaveBeenCalledWith(`${CACHE_KEY}:neg`, true, 3600);
    });

    it("caches negative result for 1h when user is not linked", async () => {
      mockDbGetLinkedPlatform.mockResolvedValue(null);

      await fetchGitlabIfLinked(HANDLE, LOWER);

      expect(mockCacheSet).toHaveBeenCalledWith(`${CACHE_KEY}:neg`, true, 3600);
    });

    it("returns null immediately on negative cache hit without DB/flag reads", async () => {
      mockCacheMGet.mockResolvedValueOnce([null, true]);

      const result = await fetchGitlabIfLinked(HANDLE, LOWER);

      expect(result).toBeNull();
      expect(mockIsGitlabEnabled).not.toHaveBeenCalled();
      expect(mockDbGetLinkedPlatform).not.toHaveBeenCalled();
    });
  });
});
