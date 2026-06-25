import { describe, it, expect, vi, beforeEach } from "vitest";
import { DEFAULT_BADGE_CONFIG } from "@chapa/shared";

const mockUpsert = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
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

import { getSupabase } from "./supabase";
import { dbUpsertStudioConfig, dbGetStudioConfig } from "./studio";

const config = { ...DEFAULT_BADGE_CONFIG, background: "aurora" as const };

beforeEach(() => {
  vi.clearAllMocks();
  terminalResolve = { data: null, error: null };
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

  it("returns true on success", async () => {
    mockUpsert.mockResolvedValue({ error: null });

    const result = await dbUpsertStudioConfig("juan294", config);

    expect(result).toBe(true);
  });

  it("returns false on error", async () => {
    mockUpsert.mockResolvedValue({ error: new Error("DB down") });

    const result = await dbUpsertStudioConfig("juan294", config);

    expect(result).toBe(false);
  });

  it("returns false when DB is unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);

    const result = await dbUpsertStudioConfig("juan294", config);

    expect(result).toBe(false);
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
