import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase before importing the module under test
const mockFrom = vi.fn();
const mockSupabase = { from: mockFrom };
vi.mock("./supabase", () => ({
  getSupabase: vi.fn(() => mockSupabase),
}));

// Mock Redis cache layer
const mockCacheGet = vi.fn();
const mockCacheSet = vi.fn();
const mockCacheDel = vi.fn();
vi.mock("../cache/redis", () => ({
  cacheGet: (...args: unknown[]) => mockCacheGet(...args),
  cacheSet: (...args: unknown[]) => mockCacheSet(...args),
  cacheDel: (...args: unknown[]) => mockCacheDel(...args),
}));

import { getSupabase } from "./supabase";
import {
  dbGetFeatureFlags,
  dbGetFeatureFlag,
  dbUpdateFeatureFlag,
} from "./feature-flags";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRow(key: string, enabled: boolean, overrides?: Record<string, unknown>) {
  return {
    id: `uuid-${key}`,
    key,
    enabled,
    description: `${key} flag`,
    config: {},
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function mockSelectAll(rows: unknown[], error: unknown = null) {
  mockFrom.mockReturnValue({
    select: vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({ data: rows, error }),
    }),
  });
}

function mockSelectSingle(row: unknown | null, error: unknown = null) {
  mockFrom.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: row, error }),
      }),
    }),
  });
}

function mockUpdate(error: unknown = null) {
  mockFrom.mockReturnValue({
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error }),
    }),
  });
}

// ---------------------------------------------------------------------------
// dbGetFeatureFlags
// ---------------------------------------------------------------------------

describe("dbGetFeatureFlags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCacheGet.mockResolvedValue(null); // default: cache miss
    mockCacheSet.mockResolvedValue(true);
    mockCacheDel.mockResolvedValue(undefined);
  });

  it("returns all flags from the database on cache miss", async () => {
    const rows = [
      makeRow("automated_agents", false),
      makeRow("coverage_agent", true),
    ];
    mockSelectAll(rows);

    const result = await dbGetFeatureFlags();
    expect(result).toHaveLength(2);
    expect(result[0]!.key).toBe("automated_agents");
    expect(result[0]!.enabled).toBe(false);
    expect(result[1]!.key).toBe("coverage_agent");
    expect(result[1]!.enabled).toBe(true);
    // Verify camelCase transformation
    expect(result[0]!.createdAt).toBe("2026-01-01T00:00:00Z");
    expect(result[0]!.updatedAt).toBe("2026-01-01T00:00:00Z");
  });

  it("caches result in Redis with 1h TTL after fetching from Supabase", async () => {
    const rows = [makeRow("studio_enabled", true)];
    mockSelectAll(rows);

    await dbGetFeatureFlags();

    expect(mockCacheSet).toHaveBeenCalledWith(
      "ff:all",
      expect.arrayContaining([
        expect.objectContaining({ key: "studio_enabled", enabled: true }),
      ]),
      3600,
    );
  });

  it("returns cached flags from Redis without hitting Supabase", async () => {
    const cachedFlags = [
      { id: "uuid-1", key: "cached_flag", enabled: true, description: null, config: {}, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
    ];
    mockCacheGet.mockResolvedValue(cachedFlags);

    const result = await dbGetFeatureFlags();

    expect(result).toEqual(cachedFlags);
    expect(mockFrom).not.toHaveBeenCalled(); // No Supabase call
  });

  it("returns empty array when DB is unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);
    const result = await dbGetFeatureFlags();
    expect(result).toEqual([]);
  });

  it("returns empty array on query error", async () => {
    mockSelectAll([], { message: "connection failed" });
    const result = await dbGetFeatureFlags();
    expect(result).toEqual([]);
  });

  it("filters out rows with missing required keys", async () => {
    const rows = [
      makeRow("valid_flag", true),
      { id: "missing-key", enabled: true }, // missing 'key' field
    ];
    mockSelectAll(rows);

    const result = await dbGetFeatureFlags();
    expect(result).toHaveLength(1);
    expect(result[0]!.key).toBe("valid_flag");
  });

  it("falls through to Supabase when Redis throws (fail-open)", async () => {
    mockCacheGet.mockRejectedValue(new Error("Redis connection refused"));
    const rows = [makeRow("fallback_flag", true)];
    mockSelectAll(rows);

    const result = await dbGetFeatureFlags();
    expect(result).toHaveLength(1);
    expect(result[0]!.key).toBe("fallback_flag");
  });
});

// ---------------------------------------------------------------------------
// dbGetFeatureFlag
// ---------------------------------------------------------------------------

describe("dbGetFeatureFlag", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCacheGet.mockResolvedValue(null); // default: cache miss
    mockCacheSet.mockResolvedValue(true);
    mockCacheDel.mockResolvedValue(undefined);
  });

  it("returns a single flag by key on cache miss", async () => {
    const row = makeRow("studio_enabled", true);
    mockSelectSingle(row);

    const result = await dbGetFeatureFlag("studio_enabled");
    expect(result).not.toBeNull();
    expect(result!.key).toBe("studio_enabled");
    expect(result!.enabled).toBe(true);
  });

  it("caches result in Redis with 1h TTL after fetching from Supabase", async () => {
    const row = makeRow("studio_enabled", true);
    mockSelectSingle(row);

    await dbGetFeatureFlag("studio_enabled");

    expect(mockCacheSet).toHaveBeenCalledWith(
      "ff:key:studio_enabled",
      expect.objectContaining({ key: "studio_enabled", enabled: true }),
      3600,
    );
  });

  it("returns cached flag from Redis without hitting Supabase", async () => {
    const cachedFlag = {
      id: "uuid-1",
      key: "cached_flag",
      enabled: false,
      description: null,
      config: {},
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };
    mockCacheGet.mockResolvedValue(cachedFlag);

    const result = await dbGetFeatureFlag("cached_flag");

    expect(result).toEqual(cachedFlag);
    expect(mockFrom).not.toHaveBeenCalled(); // No Supabase call
  });

  it("returns null when flag not found", async () => {
    mockSelectSingle(null);

    const result = await dbGetFeatureFlag("nonexistent");
    expect(result).toBeNull();
  });

  it("does not warn when flag not found (absence is the env-var fallback path)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockSelectSingle(null);

    await dbGetFeatureFlag("nonexistent");

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("returns null when DB is unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);
    const result = await dbGetFeatureFlag("any_key");
    expect(result).toBeNull();
  });

  it("returns null on query error", async () => {
    mockSelectSingle(null, { message: "connection failed" });
    const result = await dbGetFeatureFlag("any_key");
    expect(result).toBeNull();
  });

  it("falls through to Supabase when Redis throws (fail-open)", async () => {
    mockCacheGet.mockRejectedValue(new Error("Redis connection refused"));
    const row = makeRow("fallback_flag", true);
    mockSelectSingle(row);

    const result = await dbGetFeatureFlag("fallback_flag");
    expect(result).not.toBeNull();
    expect(result!.key).toBe("fallback_flag");
  });
});

// ---------------------------------------------------------------------------
// dbUpdateFeatureFlag
// ---------------------------------------------------------------------------

describe("dbUpdateFeatureFlag", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockResolvedValue(true);
    mockCacheDel.mockResolvedValue(undefined);
  });

  it("updates a flag and returns true on success", async () => {
    mockUpdate(null);

    const result = await dbUpdateFeatureFlag("coverage_agent", {
      enabled: false,
    });
    expect(result).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith("feature_flags");
  });

  it("invalidates both single-key and all-keys cache on successful update", async () => {
    mockUpdate(null);

    await dbUpdateFeatureFlag("coverage_agent", { enabled: false });

    expect(mockCacheDel).toHaveBeenCalledWith("ff:key:coverage_agent");
    expect(mockCacheDel).toHaveBeenCalledWith("ff:all");
  });

  it("does not invalidate cache when update fails", async () => {
    mockUpdate({ message: "permission denied" });

    await dbUpdateFeatureFlag("any_key", { enabled: true });

    expect(mockCacheDel).not.toHaveBeenCalled();
  });

  it("returns false when DB is unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);
    const result = await dbUpdateFeatureFlag("any_key", { enabled: true });
    expect(result).toBe(false);
  });

  it("returns false on query error", async () => {
    mockUpdate({ message: "permission denied" });
    const result = await dbUpdateFeatureFlag("any_key", { enabled: true });
    expect(result).toBe(false);
  });

  it("includes updated_at in the update payload", async () => {
    const mockUpdateFn = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    mockFrom.mockReturnValue({ update: mockUpdateFn });

    await dbUpdateFeatureFlag("test_flag", { enabled: true });

    const updatePayload = mockUpdateFn.mock.calls[0]![0];
    expect(updatePayload).toHaveProperty("enabled", true);
    expect(updatePayload).toHaveProperty("updated_at");
  });

  it("passes config when provided", async () => {
    const mockUpdateFn = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    mockFrom.mockReturnValue({ update: mockUpdateFn });

    await dbUpdateFeatureFlag("test_flag", {
      config: { prompt: "custom prompt" },
    });

    const updatePayload = mockUpdateFn.mock.calls[0]![0];
    expect(updatePayload).toHaveProperty("config", { prompt: "custom prompt" });
  });
});
