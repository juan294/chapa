import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_BADGE_CONFIG } from "@chapa/shared";

const mockUpsert = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
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

import { getSupabase } from "./supabase";
import {
  STUDIO_CONFIG_READ_TIMEOUT_MS,
  dbGetStudioConfig,
  dbUpsertStudioConfig,
  loadStudioConfig,
} from "./studio";

const config = { ...DEFAULT_BADGE_CONFIG, background: "aurora" as const };

beforeEach(() => {
  vi.clearAllMocks();
  terminalResolve = { data: null, error: null };
  terminalNeverResolves = false;
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

  // #1191 step 5 — rows written before the three preview-only categories were
  // dropped still carry nine keys. isValidBadgeConfig rejects extra fields, so
  // without stripping them on read every one of those saved configs would come
  // back "invalid" and the owner would silently get the default instead of the
  // badge they saved. A durable write must not be discarded by a schema change.
  it("loads a legacy nine-key row as a valid six-key config", async () => {
    terminalResolve = {
      data: {
        handle: "juan294",
        config: {
          ...config,
          interaction: "tilt-3d",
          statsDisplay: "animated-ease",
          celebration: "confetti",
        },
        updated_at: "2026-06-25T00:00:00Z",
        revision: 42,
      },
      error: null,
    };

    expect(await dbGetStudioConfig("juan294")).toEqual({
      status: "found",
      config,
      revision: 42,
    });
  });

  it("still reports invalid when a legacy row's surviving values are bad", async () => {
    terminalResolve = {
      data: {
        handle: "juan294",
        config: {
          ...config,
          background: "not-a-background",
          interaction: "tilt-3d",
          statsDisplay: "animated-ease",
          celebration: "confetti",
        },
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
  // BE-L1 (#1186): loadStudioConfig used to consult Redis first and then
  // *always* re-validate against a separate Supabase revision-only read on
  // every cache hit — costing strictly more than reading Supabase directly,
  // while adding a failure mode where a valid cached config was discarded
  // because that second, independent Supabase call failed. It now reads
  // Supabase directly, once, with no Redis involvement — the single
  // mechanism that matters (Supabase is always the fresh source of truth,
  // so there is nothing left for the read path to go stale against).

  it("reads directly from Supabase without any Redis round trip", async () => {
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
    expect(mockSelect).toHaveBeenCalledWith("handle, config, updated_at, revision");
  });

  it("lowercases the handle when reading", async () => {
    terminalResolve = {
      data: { handle: "juan294", config, updated_at: "2026-06-25T00:00:00Z", revision: 42 },
      error: null,
    };

    await loadStudioConfig("Juan294");

    expect(mockEq).toHaveBeenCalledWith("handle", "juan294");
  });

  it("returns not_found on a durable miss", async () => {
    terminalResolve = { data: null, error: null };

    await expect(loadStudioConfig("nobody")).resolves.toEqual({
      status: "not_found",
    });
  });

  it("returns unavailable when Supabase is unreachable — no stale cache to fall back to", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);

    await expect(loadStudioConfig("juan294")).resolves.toEqual({
      status: "unavailable",
    });
  });

  it("returns unavailable after the bounded Supabase read deadline", async () => {
    vi.useFakeTimers();
    terminalNeverResolves = true;

    const result = loadStudioConfig("juan294");
    await vi.advanceTimersByTimeAsync(STUDIO_CONFIG_READ_TIMEOUT_MS + 1);

    await expect(result).resolves.toEqual({ status: "unavailable" });
  });

  it("returns invalid when the persisted config fails validation", async () => {
    terminalResolve = {
      data: {
        handle: "juan294",
        config: { ...config, background: "not-a-background" },
        updated_at: "2026-06-25T00:00:00Z",
        revision: 42,
      },
      error: null,
    };

    await expect(loadStudioConfig("juan294")).resolves.toEqual({
      status: "invalid",
    });
  });
});
