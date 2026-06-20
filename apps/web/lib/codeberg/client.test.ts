import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockCacheGet,
  mockCacheSet,
  mockIsCodebergEnabled,
  mockDbGetLinkedPlatform,
  mockDbDeleteLinkedPlatform,
  mockDbUpdatePlatformTokens,
  mockIsTokenExpired,
  mockRefreshCodebergToken,
  mockFetchCodebergStats,
} = vi.hoisted(() => ({
  mockCacheGet: vi.fn(),
  mockCacheSet: vi.fn(),
  mockIsCodebergEnabled: vi.fn(),
  mockDbGetLinkedPlatform: vi.fn(),
  mockDbDeleteLinkedPlatform: vi.fn(),
  mockDbUpdatePlatformTokens: vi.fn(),
  mockIsTokenExpired: vi.fn(),
  mockRefreshCodebergToken: vi.fn(),
  mockFetchCodebergStats: vi.fn(),
}));

vi.mock("@/lib/cache/redis", () => ({
  cacheGet: mockCacheGet,
  cacheSet: mockCacheSet,
}));

vi.mock("@/lib/feature-flags", () => ({
  isCodebergEnabled: mockIsCodebergEnabled,
}));

vi.mock("@/lib/db/user-platforms", () => ({
  dbGetLinkedPlatform: mockDbGetLinkedPlatform,
  dbDeleteLinkedPlatform: mockDbDeleteLinkedPlatform,
  dbUpdatePlatformTokens: mockDbUpdatePlatformTokens,
}));

vi.mock("@/lib/auth/bitbucket", () => ({
  isTokenExpired: mockIsTokenExpired,
}));

vi.mock("@/lib/auth/codeberg", () => ({
  refreshCodebergToken: mockRefreshCodebergToken,
}));

vi.mock("./stats", () => ({
  fetchCodebergStats: mockFetchCodebergStats,
}));

import { fetchCodebergIfLinked } from "./client";
import { makeStats } from "../test-helpers/fixtures";

const HANDLE = "test-user";
const LOWER = "test-user";
const CACHE_KEY = `stats:v2:codeberg:${LOWER}`;

const linkedBase = {
  remoteLogin: "cb-user",
  tokens: {
    accessToken: "cb-token",
    refreshToken: "cb-refresh",
    expiresAt: new Date("2099-12-31"),
  },
};

describe("fetchCodebergIfLinked", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockResolvedValue(undefined);
    mockIsCodebergEnabled.mockResolvedValue(true);
    mockDbGetLinkedPlatform.mockResolvedValue(linkedBase);
    mockIsTokenExpired.mockReturnValue(false);
    mockDbDeleteLinkedPlatform.mockResolvedValue(true);
    mockDbUpdatePlatformTokens.mockResolvedValue(true);
  });

  it("returns cached stats when cache hit", async () => {
    const cached = makeStats({ commitsTotal: 25 });
    mockCacheGet.mockResolvedValue(cached);

    const result = await fetchCodebergIfLinked(HANDLE, LOWER);

    expect(result).toEqual(cached);
    expect(mockIsCodebergEnabled).not.toHaveBeenCalled();
    expect(mockFetchCodebergStats).not.toHaveBeenCalled();
  });

  it("returns null when Codeberg is not enabled", async () => {
    mockIsCodebergEnabled.mockResolvedValue(false);

    const result = await fetchCodebergIfLinked(HANDLE, LOWER);

    expect(result).toBeNull();
    expect(mockDbGetLinkedPlatform).not.toHaveBeenCalled();
  });

  it("returns null when user has no linked Codeberg account", async () => {
    mockDbGetLinkedPlatform.mockResolvedValue(null);

    const result = await fetchCodebergIfLinked(HANDLE, LOWER);

    expect(result).toBeNull();
    expect(mockFetchCodebergStats).not.toHaveBeenCalled();
  });

  it("fetches stats when token is valid", async () => {
    const stats = makeStats({ commitsTotal: 20 });
    mockFetchCodebergStats.mockResolvedValue(stats);

    const result = await fetchCodebergIfLinked(HANDLE, LOWER);

    expect(result).toEqual(stats);
    expect(mockFetchCodebergStats).toHaveBeenCalledWith(
      "cb-user",
      "cb-token",
      { displayName: "cb-user", avatarUrl: "" },
    );
    expect(mockCacheSet).toHaveBeenCalledWith(CACHE_KEY, stats, 21600);
  });

  it("does not cache when fetch returns null", async () => {
    mockFetchCodebergStats.mockResolvedValue(null);

    const result = await fetchCodebergIfLinked(HANDLE, LOWER);

    expect(result).toBeNull();
    expect(mockCacheSet).not.toHaveBeenCalled();
  });

  describe("token refresh", () => {
    it("refreshes token when expired and uses new token", async () => {
      const stats = makeStats({ commitsTotal: 12 });
      mockIsTokenExpired.mockReturnValue(true);
      mockRefreshCodebergToken.mockResolvedValue({
        ok: true,
        tokens: {
          access_token: "new-cb-token",
          refresh_token: "new-cb-refresh",
          expires_in: 7200,
        },
      });
      mockFetchCodebergStats.mockResolvedValue(stats);

      const result = await fetchCodebergIfLinked(HANDLE, LOWER);

      expect(result).toEqual(stats);
      expect(mockFetchCodebergStats).toHaveBeenCalledWith(
        "cb-user",
        "new-cb-token",
        expect.any(Object),
      );
      expect(mockDbUpdatePlatformTokens).toHaveBeenCalled();
    });

    it("proceeds with current token when expiresAt is null (long-lived token)", async () => {
      const stats = makeStats({ commitsTotal: 30 });
      mockIsTokenExpired.mockReturnValue(true); // isTokenExpired(null) → true
      mockDbGetLinkedPlatform.mockResolvedValue({
        remoteLogin: "cb-user",
        tokens: { accessToken: "long-lived", refreshToken: null, expiresAt: null },
      });
      mockFetchCodebergStats.mockResolvedValue(stats);

      const result = await fetchCodebergIfLinked(HANDLE, LOWER);

      expect(result).toEqual(stats);
      expect(mockRefreshCodebergToken).not.toHaveBeenCalled();
      expect(mockDbDeleteLinkedPlatform).not.toHaveBeenCalled();
      expect(mockFetchCodebergStats).toHaveBeenCalledWith(
        "cb-user",
        "long-lived",
        expect.any(Object),
      );
    });

    it("unlinks account when no refresh token and expiresAt is set", async () => {
      mockIsTokenExpired.mockReturnValue(true);
      mockDbGetLinkedPlatform.mockResolvedValue({
        remoteLogin: "cb-user",
        tokens: { accessToken: "old", refreshToken: null, expiresAt: new Date("2020-01-01") },
      });

      const result = await fetchCodebergIfLinked(HANDLE, LOWER);

      expect(result).toBeNull();
      expect(mockDbDeleteLinkedPlatform).toHaveBeenCalledWith(HANDLE, "codeberg");
      expect(mockFetchCodebergStats).not.toHaveBeenCalled();
    });

    it("unlinks account when refresh token is revoked", async () => {
      mockIsTokenExpired.mockReturnValue(true);
      mockRefreshCodebergToken.mockResolvedValue({
        ok: false,
        reason: "revoked",
      });

      const result = await fetchCodebergIfLinked(HANDLE, LOWER);

      expect(result).toBeNull();
      expect(mockDbDeleteLinkedPlatform).toHaveBeenCalledWith(HANDLE, "codeberg");
    });

    it("keeps link and returns null on transient refresh failure", async () => {
      mockIsTokenExpired.mockReturnValue(true);
      mockRefreshCodebergToken.mockResolvedValue({
        ok: false,
        reason: "network_error",
      });

      const result = await fetchCodebergIfLinked(HANDLE, LOWER);

      expect(result).toBeNull();
      expect(mockDbDeleteLinkedPlatform).not.toHaveBeenCalled();
    });
  });

  describe("negative-result caching (P3)", () => {
    it("caches negative result for 1h when Codeberg is not enabled", async () => {
      mockIsCodebergEnabled.mockResolvedValue(false);

      await fetchCodebergIfLinked(HANDLE, LOWER);

      expect(mockCacheSet).toHaveBeenCalledWith(`${CACHE_KEY}:neg`, true, 3600);
    });

    it("caches negative result for 1h when user is not linked", async () => {
      mockDbGetLinkedPlatform.mockResolvedValue(null);

      await fetchCodebergIfLinked(HANDLE, LOWER);

      expect(mockCacheSet).toHaveBeenCalledWith(`${CACHE_KEY}:neg`, true, 3600);
    });

    it("returns null immediately on negative cache hit without DB/flag reads", async () => {
      mockCacheGet
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(true);

      const result = await fetchCodebergIfLinked(HANDLE, LOWER);

      expect(result).toBeNull();
      expect(mockIsCodebergEnabled).not.toHaveBeenCalled();
      expect(mockDbGetLinkedPlatform).not.toHaveBeenCalled();
    });
  });
});
