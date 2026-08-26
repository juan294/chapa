import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_BADGE_CONFIG } from "@chapa/shared";

const mockUpsert = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const { mockCacheDel, mockCacheGet, mockCacheSetVersioned } = vi.hoisted(() => ({
  mockCacheDel: vi.fn(),
  mockCacheGet: vi.fn(),
  mockCacheSetVersioned: vi.fn(),
}));
let terminalResolve: { data: unknown; error: unknown };
let terminalNeverResolves = false;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFrom = vi.fn((): any => {
  const chain: Record<string, unknown> = {};
  chain.upsert = mockUpsert;
  chain.select = (...args: unknown[]) => {
    mockSelect(...args);
    return chain;
  };
  chain.eq = (...args: unknown[]) => {
    mockEq(...args);
    return chain;
  };
  chain.maybeSingle = () => ({
    then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
      if (terminalNeverResolves) return;
      if (terminalResolve.error) reject(terminalResolve.error);
      else resolve(terminalResolve);
    },
  });
  return chain;
});

vi.mock("./supabase", () => ({
  getSupabase: vi.fn(() => ({ from: mockFrom })),
}));

vi.mock("../cache/redis", () => ({
  cacheDel: mockCacheDel,
  cacheGet: mockCacheGet,
  cacheSetVersioned: mockCacheSetVersioned,
}));

import { getSupabase } from "./supabase";
import {
  STUDIO_CONFIG_NEGATIVE_CACHE_ENTRY,
  STUDIO_CONFIG_NEGATIVE_TTL,
  STUDIO_CONFIG_READ_TIMEOUT_MS,
  STUDIO_CONFIG_TTL,
  cacheStudioConfig,
  dbGetStudioConfig,
  dbUpsertStudioConfig,
  loadStudioConfig,
  refreshStudioConfigCache,
} from "./studio";

const config = { ...DEFAULT_BADGE_CONFIG, background: "aurora" as const };

beforeEach(() => {
  vi.clearAllMocks();
  terminalResolve = { data: null, error: null };
  terminalNeverResolves = false;
  mockCacheGet.mockResolvedValue(null);
  mockCacheSetVersioned.mockResolvedValue("stored");
  mockCacheDel.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("dbUpsertStudioConfig", () => {
  it("upserts row keyed on handle (lowercased)", async () => {
    mockUpsert.mockResolvedValue({ error: null });

    await dbUpsertStudioConfig("Juan294", config);

    expect(mockFrom).toHaveBeenCalledWith("studio_configs");
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        handle: "juan294",
        config,
      }),
      { onConflict: "handle" },
    );
  });

  it("returns an ok result on success", async () => {
    mockUpsert.mockResolvedValue({ error: null });

    const result = await dbUpsertStudioConfig("juan294", config);

    expect(result).toEqual({ ok: true });
  });

  it("treats a duplicate-key error as idempotent success", async () => {
    mockUpsert.mockResolvedValue({
      error: Object.assign(new Error("duplicate"), { code: "23505" }),
    });

    const result = await dbUpsertStudioConfig("juan294", config);

    expect(result).toEqual({ ok: true });
  });

  it.each(["23502", "22P02", "22003"])(
    "classifies Postgres constraint code %s",
    async (code) => {
      mockUpsert.mockResolvedValue({
        error: Object.assign(new Error("constraint"), { code }),
      });

      const result = await dbUpsertStudioConfig("juan294", config);

      expect(result).toEqual({ ok: false, reason: "constraint", code });
    },
  );

  it("classifies an unexpected database error", async () => {
    mockUpsert.mockResolvedValue({
      error: Object.assign(new Error("DB down"), { code: "XX000" }),
    });

    const result = await dbUpsertStudioConfig("juan294", config);

    expect(result).toEqual({ ok: false, reason: "error", code: "XX000" });
  });

  it("logs the message from a plain PostgREST error object", async () => {
    mockUpsert.mockResolvedValue({
      error: { code: "XX000", message: "DB down" },
    });
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await dbUpsertStudioConfig("juan294", config);

    expect(result).toEqual({ ok: false, reason: "error", code: "XX000" });
    expect(errorLog).toHaveBeenCalledWith(
      "[db] dbUpsertStudioConfig failed:",
      "DB down",
    );
  });

  it("classifies an error without a Postgres code", async () => {
    mockUpsert.mockRejectedValue(new Error("network down"));

    const result = await dbUpsertStudioConfig("juan294", config);

    expect(result).toEqual({ ok: false, reason: "error" });
  });

  it("reports when DB is unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);

    const result = await dbUpsertStudioConfig("juan294", config);

    expect(result).toEqual({ ok: false, reason: "unavailable" });
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe("cacheStudioConfig", () => {
  it("publishes a committed config under the normalized handle", async () => {
    await cacheStudioConfig("Juan294", config, 42);

    expect(mockCacheSetVersioned).toHaveBeenCalledWith(
      "config:juan294",
      {
        kind: "studio-config",
        version: 1,
        revision: 42,
        config,
      },
      42,
      STUDIO_CONFIG_TTL,
    );
  });

  it("logs a false Redis result without rejecting the committed save", async () => {
    mockCacheSetVersioned.mockResolvedValue("failed");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(cacheStudioConfig("juan294", config, 42)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      "[studio/config] Redis write failed (best-effort):",
      "cacheSetVersioned returned failed",
    );
    expect(mockCacheDel).toHaveBeenCalledWith("config:juan294");
  });
});

describe("dbGetStudioConfig", () => {
  it("returns the config on hit", async () => {
    terminalResolve = {
      data: { handle: "juan294", config, updated_at: "2026-06-25T00:00:00Z", revision: 42 },
      error: null,
    };

    const result = await dbGetStudioConfig("juan294");

    expect(result).toEqual({ status: "found", config, revision: 42 });
  });

  it("queries by lowercased handle", async () => {
    await dbGetStudioConfig("Juan294");

    expect(mockEq).toHaveBeenCalledWith("handle", "juan294");
  });

  it("returns not_found on miss", async () => {
    terminalResolve = { data: null, error: null };
    expect(await dbGetStudioConfig("nobody")).toEqual({ status: "not_found" });
  });

  it("returns unavailable when DB is not configured", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);
    expect(await dbGetStudioConfig("juan294")).toEqual({ status: "unavailable" });
  });

  it("returns unavailable on a query error without throwing", async () => {
    terminalResolve = { data: null, error: new Error("DB error") };
    expect(await dbGetStudioConfig("juan294")).toEqual({ status: "unavailable" });
  });

  it("returns invalid when the row is missing its config field", async () => {
    terminalResolve = {
      data: { handle: "juan294", updated_at: "2026-06-25T00:00:00Z" },
      error: null,
    };
    expect(await dbGetStudioConfig("juan294")).toEqual({ status: "invalid" });
  });

  it("returns invalid when the persisted config fails BadgeConfig validation", async () => {
    terminalResolve = {
      data: {
        handle: "juan294",
        config: { ...config, background: "not-a-background" },
        updated_at: "2026-06-25T00:00:00Z",
        revision: 42,
      },
      error: null,
    };

    expect(await dbGetStudioConfig("juan294")).toEqual({ status: "invalid" });
  });

  it("fails open with unavailable when the Supabase read exceeds its deadline", async () => {
    vi.useFakeTimers();
    terminalNeverResolves = true;

    const result = dbGetStudioConfig("juan294");
    await vi.advanceTimersByTimeAsync(STUDIO_CONFIG_READ_TIMEOUT_MS + 1);

    await expect(result).resolves.toEqual({ status: "unavailable" });
  });
});

describe("loadStudioConfig", () => {
  it("repairs a valid cache entry when Supabase has a newer revision", async () => {
    const staleConfig = { ...config, background: "solid" as const };
    mockCacheGet.mockResolvedValue({
      kind: "studio-config",
      version: 1,
      revision: 41,
      config: staleConfig,
    });
    terminalResolve = {
      data: {
        handle: "juan294",
        config,
        updated_at: "2026-06-25T00:00:00Z",
        revision: 42,
      },
      error: null,
    };

    await expect(loadStudioConfig("juan294")).resolves.toEqual({
      status: "found",
      config,
      revision: 42,
    });
    expect(mockCacheDel).toHaveBeenCalledWith("config:juan294");
    expect(mockCacheSetVersioned).toHaveBeenCalledWith(
      "config:juan294",
      {
        kind: "studio-config",
        version: 1,
        revision: 42,
        config,
      },
      42,
      STUDIO_CONFIG_TTL,
    );
  });

  it("never trusts a stale entry that survives repeated Redis repair failures", async () => {
    const staleConfig = { ...config, background: "solid" as const };
    mockCacheGet.mockResolvedValue({
      kind: "studio-config",
      version: 1,
      revision: 41,
      config: staleConfig,
    });
    mockCacheSetVersioned.mockResolvedValue("failed");
    terminalResolve = {
      data: {
        handle: "juan294",
        config,
        updated_at: "2026-06-25T00:00:00Z",
        revision: 42,
      },
      error: null,
    };
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(loadStudioConfig("juan294")).resolves.toEqual({
      status: "found",
      config,
      revision: 42,
    });
    await expect(loadStudioConfig("juan294")).resolves.toEqual({
      status: "found",
      config,
      revision: 42,
    });
    expect(mockSelect).toHaveBeenCalledWith("revision");
    expect(mockSelect).toHaveBeenCalledWith(
      "handle, config, updated_at, revision",
    );
  });

  it("returns a Redis cache hit after validating its durable revision", async () => {
    mockCacheGet.mockResolvedValue({
      kind: "studio-config",
      version: 1,
      revision: 42,
      config,
    });
    terminalResolve = { data: { revision: 42 }, error: null };

    await expect(loadStudioConfig("juan294")).resolves.toEqual({
      status: "found",
      config,
      revision: 42,
    });

    expect(mockCacheGet).toHaveBeenCalledWith("config:juan294");
    expect(mockFrom).toHaveBeenCalledWith("studio_configs");
    expect(mockSelect).toHaveBeenCalledWith("revision");
  });

  it("falls back to Supabase and rehydrates Redis after a cache miss", async () => {
    terminalResolve = {
      data: { handle: "juan294", config, updated_at: "2026-06-25T00:00:00Z", revision: 42 },
      error: null,
    };

    await expect(loadStudioConfig("juan294")).resolves.toEqual({
      status: "found",
      config,
      revision: 42,
    });

    expect(mockCacheSetVersioned).toHaveBeenCalledWith(
      "config:juan294",
      {
        kind: "studio-config",
        version: 1,
        revision: 42,
        config,
      },
      42,
      STUDIO_CONFIG_TTL,
    );
  });

  it("returns not_found and caches a typed sentinel when both stores miss", async () => {
    await expect(loadStudioConfig("nobody")).resolves.toEqual({
      status: "not_found",
    });

    expect(mockCacheSetVersioned).toHaveBeenCalledWith(
      "config:nobody",
      STUDIO_CONFIG_NEGATIVE_CACHE_ENTRY,
      0,
      STUDIO_CONFIG_NEGATIVE_TTL,
    );
  });

  it("returns a typed negative-cache hit after validating the durable miss", async () => {
    mockCacheGet.mockResolvedValue(STUDIO_CONFIG_NEGATIVE_CACHE_ENTRY);

    await expect(loadStudioConfig("nobody")).resolves.toEqual({
      status: "not_found",
    });

    expect(mockFrom).toHaveBeenCalledWith("studio_configs");
    expect(mockSelect).toHaveBeenCalledWith("revision");
  });

  it("does not trust a valid cache entry when revision validation is unavailable", async () => {
    mockCacheGet.mockResolvedValue({
      kind: "studio-config",
      version: 1,
      revision: 42,
      config,
    });
    vi.mocked(getSupabase).mockReturnValueOnce(null);

    await expect(loadStudioConfig("juan294")).resolves.toEqual({
      status: "unavailable",
    });
  });

  it("repairs a legacy negative-cache entry without a revision", async () => {
    mockCacheGet.mockResolvedValue({
      kind: "studio-config-not-found",
      version: 1,
    });
    terminalResolve = {
      data: {
        handle: "juan294",
        config,
        updated_at: "2026-06-25T00:00:00Z",
        revision: 42,
      },
      error: null,
    };

    await expect(loadStudioConfig("juan294")).resolves.toEqual({
      status: "found",
      config,
      revision: 42,
    });
    expect(mockCacheDel).toHaveBeenCalledWith("config:juan294");
    expect(mockFrom).toHaveBeenCalledWith("studio_configs");
  });

  it("rejects malformed cached data and repairs it from Supabase", async () => {
    mockCacheGet.mockResolvedValue({ ...config, background: "invalid" });
    terminalResolve = {
      data: { handle: "juan294", config, updated_at: "2026-06-25T00:00:00Z", revision: 42 },
      error: null,
    };

    await expect(loadStudioConfig("juan294")).resolves.toEqual({
      status: "found",
      config,
      revision: 42,
    });
    expect(mockFrom).toHaveBeenCalledWith("studio_configs");
    expect(mockCacheDel).toHaveBeenCalledWith("config:juan294");
    expect(mockCacheSetVersioned).toHaveBeenCalledWith(
      "config:juan294",
      {
        kind: "studio-config",
        version: 1,
        revision: 42,
        config,
      },
      42,
      STUDIO_CONFIG_TTL,
    );
  });

  it("returns unavailable after a bounded cache read and database outage", async () => {
    vi.useFakeTimers();
    mockCacheGet.mockImplementation(() => new Promise(() => undefined));
    vi.mocked(getSupabase).mockReturnValueOnce(null);

    const result = loadStudioConfig("juan294");
    await vi.advanceTimersByTimeAsync(STUDIO_CONFIG_READ_TIMEOUT_MS + 1);

    await expect(result).resolves.toEqual({ status: "unavailable" });
  });

  it("swallows a best-effort Redis rehydration rejection", async () => {
    terminalResolve = {
      data: { handle: "juan294", config, updated_at: "2026-06-25T00:00:00Z", revision: 42 },
      error: null,
    };
    mockCacheSetVersioned.mockResolvedValue("failed");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(loadStudioConfig("juan294")).resolves.toEqual({
      status: "found",
      config,
      revision: 42,
    });
    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalledWith(
        "[studio/config] Redis write failed (best-effort):",
        "cacheSetVersioned returned failed",
      );
    });
  });

  it("logs when Redis returns false while rehydrating a durable config", async () => {
    terminalResolve = {
      data: { handle: "juan294", config, updated_at: "2026-06-25T00:00:00Z", revision: 42 },
      error: null,
    };
    mockCacheSetVersioned.mockResolvedValue("failed");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(loadStudioConfig("juan294")).resolves.toEqual({
      status: "found",
      config,
      revision: 42,
    });
    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalledWith(
        "[studio/config] Redis write failed (best-effort):",
        "cacheSetVersioned returned failed",
      );
    });
  });

  it("repairs an unversioned legacy cache entry from Supabase", async () => {
    mockCacheGet.mockResolvedValue(config);
    terminalResolve = {
      data: { handle: "juan294", config, updated_at: "2026-06-25T00:00:00Z", revision: 42 },
      error: null,
    };
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(loadStudioConfig("juan294")).resolves.toEqual({
      status: "found",
      config,
      revision: 42,
    });
    expect(mockCacheDel).toHaveBeenCalledWith("config:juan294");
  });
});

describe("refreshStudioConfigCache", () => {
  it("publishes the current durable revision instead of the request body", async () => {
    const latest = { ...config, background: "particles" as const };
    terminalResolve = {
      data: { handle: "juan294", config: latest, updated_at: "2026-06-25T00:00:01Z", revision: 43 },
      error: null,
    };

    await refreshStudioConfigCache("Juan294");

    expect(mockCacheSetVersioned).toHaveBeenCalledWith(
      "config:juan294",
      { kind: "studio-config", version: 1, revision: 43, config: latest },
      43,
      STUDIO_CONFIG_TTL,
    );
  });

  it("removes an older cache value when durable readback is unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);

    await refreshStudioConfigCache("Juan294");

    expect(mockCacheSetVersioned).not.toHaveBeenCalled();
    expect(mockCacheDel).toHaveBeenCalledWith("config:juan294");
  });
});
