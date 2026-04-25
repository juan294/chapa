import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockCacheGet,
  mockCacheSet,
  mockIsBitbucketEnabled,
  mockDbGetLinkedPlatform,
  mockDbDeleteLinkedPlatform,
  mockDbUpdatePlatformTokens,
  mockIsTokenExpired,
  mockRefreshBitbucketToken,
  mockFetchBitbucketStats,
} = vi.hoisted(() => ({
  mockCacheGet: vi.fn(),
  mockCacheSet: vi.fn(),
  mockIsBitbucketEnabled: vi.fn(),
  mockDbGetLinkedPlatform: vi.fn(),
  mockDbDeleteLinkedPlatform: vi.fn(),
  mockDbUpdatePlatformTokens: vi.fn(),
  mockIsTokenExpired: vi.fn(),
  mockRefreshBitbucketToken: vi.fn(),
  mockFetchBitbucketStats: vi.fn(),
}));

vi.mock("@/lib/cache/redis", () => ({
  cacheGet: mockCacheGet,
  cacheSet: mockCacheSet,
}));

vi.mock("@/lib/feature-flags", () => ({
  isBitbucketEnabled: mockIsBitbucketEnabled,
}));

vi.mock("@/lib/db/user-platforms", () => ({
  dbGetLinkedPlatform: mockDbGetLinkedPlatform,
  dbDeleteLinkedPlatform: mockDbDeleteLinkedPlatform,
  dbUpdatePlatformTokens: mockDbUpdatePlatformTokens,
}));

vi.mock("@/lib/auth/bitbucket", () => ({
  isTokenExpired: mockIsTokenExpired,
  refreshBitbucketToken: mockRefreshBitbucketToken,
}));

vi.mock("./stats", () => ({
  fetchBitbucketStats: mockFetchBitbucketStats,
}));

import { fetchBitbucketIfLinked } from "./client";
import { makeStats } from "../test-helpers/fixtures";

const HANDLE = "test-user";
const LOWER = "test-user";
const CACHE_KEY = `stats:v2:bitbucket:${LOWER}`;

const linkedBase = {
  remoteLogin: "bb-user",
  tokens: {
    accessToken: "bb-token",
    refreshToken: "bb-refresh",
    expiresAt: new Date("2099-12-31"),
  },
};

describe("fetchBitbucketIfLinked", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockResolvedValue(undefined);
    mockIsBitbucketEnabled.mockResolvedValue(true);
    mockDbGetLinkedPlatform.mockResolvedValue(linkedBase);
    mockIsTokenExpired.mockReturnValue(false);
    mockDbDeleteLinkedPlatform.mockResolvedValue(true);
    mockDbUpdatePlatformTokens.mockResolvedValue(true);
  });

  it("returns cached stats when cache hit", async () => {
    const cached = makeStats({ commitsTotal: 20 });
    mockCacheGet.mockResolvedValue(cached);

    const result = await fetchBitbucketIfLinked(HANDLE, LOWER);

    expect(result).toEqual(cached);
    expect(mockIsBitbucketEnabled).not.toHaveBeenCalled();
    expect(mockFetchBitbucketStats).not.toHaveBeenCalled();
  });

  it("returns null when Bitbucket is not enabled", async () => {
    mockIsBitbucketEnabled.mockResolvedValue(false);

    const result = await fetchBitbucketIfLinked(HANDLE, LOWER);

    expect(result).toBeNull();
    expect(mockDbGetLinkedPlatform).not.toHaveBeenCalled();
  });

  it("returns null when user has no linked Bitbucket account", async () => {
    mockDbGetLinkedPlatform.mockResolvedValue(null);

    const result = await fetchBitbucketIfLinked(HANDLE, LOWER);

    expect(result).toBeNull();
    expect(mockFetchBitbucketStats).not.toHaveBeenCalled();
  });

  it("fetches stats when token is valid", async () => {
    const stats = makeStats({ commitsTotal: 15 });
    mockFetchBitbucketStats.mockResolvedValue(stats);

    const result = await fetchBitbucketIfLinked(HANDLE, LOWER);

    expect(result).toEqual(stats);
    expect(mockFetchBitbucketStats).toHaveBeenCalledWith(
      "bb-user",
      "bb-token",
      { displayName: "bb-user", avatarUrl: "" },
    );
    expect(mockCacheSet).toHaveBeenCalledWith(CACHE_KEY, stats, 21600);
  });

  it("does not cache when fetch returns null", async () => {
    mockFetchBitbucketStats.mockResolvedValue(null);

    const result = await fetchBitbucketIfLinked(HANDLE, LOWER);

    expect(result).toBeNull();
    expect(mockCacheSet).not.toHaveBeenCalled();
  });

  describe("token refresh", () => {
    it("refreshes token when expired and uses new token", async () => {
      const stats = makeStats({ commitsTotal: 10 });
      mockIsTokenExpired.mockReturnValue(true);
      mockRefreshBitbucketToken.mockResolvedValue({
        ok: true,
        tokens: {
          access_token: "new-token",
          refresh_token: "new-refresh",
          expires_in: 3600,
        },
      });
      mockFetchBitbucketStats.mockResolvedValue(stats);

      const result = await fetchBitbucketIfLinked(HANDLE, LOWER);

      expect(result).toEqual(stats);
      expect(mockFetchBitbucketStats).toHaveBeenCalledWith(
        "bb-user",
        "new-token",
        expect.any(Object),
      );
      expect(mockDbUpdatePlatformTokens).toHaveBeenCalled();
    });

    it("unlinks account and returns null when no refresh token and token expired", async () => {
      mockIsTokenExpired.mockReturnValue(true);
      mockDbGetLinkedPlatform.mockResolvedValue({
        remoteLogin: "bb-user",
        tokens: { accessToken: "old", refreshToken: null, expiresAt: new Date("2020-01-01") },
      });

      const result = await fetchBitbucketIfLinked(HANDLE, LOWER);

      expect(result).toBeNull();
      expect(mockDbDeleteLinkedPlatform).toHaveBeenCalledWith(HANDLE, "bitbucket");
      expect(mockFetchBitbucketStats).not.toHaveBeenCalled();
    });

    it("unlinks account when refresh token is revoked", async () => {
      mockIsTokenExpired.mockReturnValue(true);
      mockRefreshBitbucketToken.mockResolvedValue({
        ok: false,
        reason: "revoked",
      });

      const result = await fetchBitbucketIfLinked(HANDLE, LOWER);

      expect(result).toBeNull();
      expect(mockDbDeleteLinkedPlatform).toHaveBeenCalledWith(HANDLE, "bitbucket");
    });

    it("keeps link and returns null on transient refresh failure", async () => {
      mockIsTokenExpired.mockReturnValue(true);
      mockRefreshBitbucketToken.mockResolvedValue({
        ok: false,
        reason: "network_error",
      });

      const result = await fetchBitbucketIfLinked(HANDLE, LOWER);

      expect(result).toBeNull();
      expect(mockDbDeleteLinkedPlatform).not.toHaveBeenCalled();
    });
  });
});
