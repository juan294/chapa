import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_BADGE_CONFIG } from "@chapa/shared";

const mockUpsert = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const { mockCacheGet, mockCacheSet } = vi.hoisted(() => ({
  mockCacheGet: vi.fn(),
  mockCacheSet: vi.fn(),
}));
let terminalResolve: { data: unknown; error: unknown };

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
  cacheGet: mockCacheGet,
  cacheSet: mockCacheSet,
}));

import { getSupabase } from "./supabase";
import {
  STUDIO_CONFIG_TTL,
  dbGetStudioConfig,
  dbUpsertStudioConfig,
  loadStudioConfig,
} from "./studio";

const config = { ...DEFAULT_BADGE_CONFIG, background: "aurora" as const };

beforeEach(() => {
  vi.clearAllMocks();
  terminalResolve = { data: null, error: null };
  mockCacheGet.mockResolvedValue(null);
  mockCacheSet.mockResolvedValue(true);
});

afterEach(() => {
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

describe("dbGetStudioConfig", () => {
  it("returns the config on hit", async () => {
    terminalResolve = {
      data: { handle: "juan294", config, updated_at: "2026-06-25T00:00:00Z" },
      error: null,
    };

    const result = await dbGetStudioConfig("juan294");

    expect(result).toEqual(config);
  });

  it("queries by lowercased handle", async () => {
    await dbGetStudioConfig("Juan294");

    expect(mockEq).toHaveBeenCalledWith("handle", "juan294");
  });

  it("returns null on miss", async () => {
    terminalResolve = { data: null, error: null };
    expect(await dbGetStudioConfig("nobody")).toBeNull();
  });

  it("returns null when DB is unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);
    expect(await dbGetStudioConfig("juan294")).toBeNull();
  });

  it("returns null on error without throwing", async () => {
    terminalResolve = { data: null, error: new Error("DB error") };
    expect(await dbGetStudioConfig("juan294")).toBeNull();
  });

  it("returns null when row is missing config field", async () => {
    terminalResolve = {
      data: { handle: "juan294", updated_at: "2026-06-25T00:00:00Z" },
      error: null,
    };
    expect(await dbGetStudioConfig("juan294")).toBeNull();
  });
});

describe("loadStudioConfig", () => {
  it("returns a Redis cache hit without querying Supabase", async () => {
    mockCacheGet.mockResolvedValue(config);

    await expect(loadStudioConfig("juan294")).resolves.toEqual(config);

    expect(mockCacheGet).toHaveBeenCalledWith("config:juan294");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("falls back to Supabase and rehydrates Redis after a cache miss", async () => {
    terminalResolve = {
      data: { handle: "juan294", config, updated_at: "2026-06-25T00:00:00Z" },
      error: null,
    };

    await expect(loadStudioConfig("juan294")).resolves.toEqual(config);

    expect(mockCacheSet).toHaveBeenCalledWith(
      "config:juan294",
      config,
      STUDIO_CONFIG_TTL,
    );
  });

  it("returns null when both Redis and Supabase miss", async () => {
    await expect(loadStudioConfig("nobody")).resolves.toBeNull();

    expect(mockCacheSet).not.toHaveBeenCalled();
  });

  it("swallows a best-effort Redis rehydration rejection", async () => {
    terminalResolve = {
      data: { handle: "juan294", config, updated_at: "2026-06-25T00:00:00Z" },
      error: null,
    };
    mockCacheSet.mockRejectedValue(new Error("Redis down"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(loadStudioConfig("juan294")).resolves.toEqual(config);
    expect(warn).toHaveBeenCalledWith(
      "[studio/config] Redis rehydration failed (best-effort):",
      "Redis down",
    );
  });
});
