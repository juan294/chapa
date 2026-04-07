import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CraftResult, InsightsUpload } from "@chapa/shared";

// ---------------------------------------------------------------------------
// Mock Supabase client — tracks arguments for all chain methods
// ---------------------------------------------------------------------------

const mockUpsert = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();
const mockEq = vi.fn();
const mockLimit = vi.fn();

const { mockGetSupabase } = vi.hoisted(() => ({
  mockGetSupabase: vi.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFrom = vi.fn((): any => {
  const chain: Record<string, unknown> = {};
  chain.upsert = (...args: unknown[]) => {
    mockUpsert(...args);
    return chain;
  };
  chain.select = (...args: unknown[]) => {
    mockSelect(...args);
    return chain;
  };
  chain.single = () => {
    mockSingle();
    return chain;
  };
  chain.eq = (...args: unknown[]) => {
    mockEq(...args);
    return chain;
  };
  chain.limit = (...args: unknown[]) => {
    mockLimit(...args);
    return chain;
  };
  // Terminal .then to resolve the chain as a promise
  chain.then = (
    resolve: (v: unknown) => void,
    reject: (e: unknown) => void,
  ) => {
    if (terminalResolve.error && terminalResolve.throwOnError) {
      reject(terminalResolve.error);
    } else {
      resolve(terminalResolve);
    }
  };
  return chain;
});

let terminalResolve: { data: unknown; error: unknown; throwOnError?: boolean };

vi.mock("./supabase", () => ({
  getSupabase: mockGetSupabase,
}));

vi.mock("@/lib/insights/scoring", () => ({
  computeCraftScore: vi.fn(),
}));

import { dbUpsertToolInsights, dbGetToolInsights, dbRecomputeCraft } from "./tool-insights";
import { computeCraftScore } from "@/lib/insights/scoring";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validUpload: InsightsUpload = {
  tool: "claude-code",
  reportPeriod: { start: "2025-01-01", end: "2025-03-01" },
  volume: {
    messages: 500,
    linesAdded: 2000,
    linesDeleted: 800,
    files: 50,
    days: 30,
    msgsPerDay: 16.7,
  },
  toolUsage: { Edit: 120, Read: 200 },
  sessionTypes: { feature: 10, bugfix: 5 },
  outcomes: { fullyAchieved: 8, mostlyAchieved: 4, partiallyAchieved: 3 },
  friction: { buggyCode: 2, wrongApproach: 1, misunderstoodRequest: 0 },
  satisfaction: { dissatisfied: 1, likelySatisfied: 5, satisfied: 9 },
  multiClauding: { overlapEvents: 3, sessionsInvolved: 2, messagePercent: 15 },
  responseTime: { medianSeconds: 12, averageSeconds: 18 },
  toolErrors: { Bash: 2 },
  totalSessions: 15,
  totalToolCalls: 320,
};

const validScores: CraftResult = {
  tool: "claude-code",
  dimensions: { proficiency: 72, effectiveness: 65, sophistication: 58 },
  craftScore: 65,
  tier: "Practitioner",
  reportPeriod: { start: "2025-01-01", end: "2025-03-01" },
  computedAt: "2025-03-01T12:00:00Z",
};

/** A valid row as it would come back from Supabase */
const validRow = {
  handle: "testuser",
  tool: "claude-code",
  report_start: "2025-01-01",
  report_end: "2025-03-01",
  raw_data: validUpload,
  proficiency: 72,
  effectiveness: 65,
  sophistication: 58,
  craft_score: 65,
  craft_tier: "Practitioner",
  uploaded_at: "2025-03-01T12:00:00Z",
};

// ---------------------------------------------------------------------------
// Tests — dbUpsertToolInsights
// ---------------------------------------------------------------------------

describe("dbUpsertToolInsights", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    terminalResolve = { data: null, error: null };
  });

  it("returns null when Supabase is unavailable", async () => {
    mockGetSupabase.mockReturnValue(null);
    const result = await dbUpsertToolInsights("testuser", validUpload, validScores);
    expect(result).toBeNull();
  });

  it("upserts into tool_insights table with correct columns", async () => {
    terminalResolve = { data: validRow, error: null };
    mockGetSupabase.mockReturnValue({ from: mockFrom });

    await dbUpsertToolInsights("TestUser", validUpload, validScores);

    expect(mockFrom).toHaveBeenCalledWith("tool_insights");
    expect(mockUpsert).toHaveBeenCalledWith(
      {
        handle: "testuser",
        tool: "claude-code",
        report_start: "2025-01-01",
        report_end: "2025-03-01",
        raw_data: validUpload,
        proficiency: 72,
        effectiveness: 65,
        sophistication: 58,
        craft_score: 65,
        craft_tier: "Practitioner",
      },
      { onConflict: "handle,tool" },
    );
  });

  it("lowercases handle for storage", async () => {
    terminalResolve = { data: validRow, error: null };
    mockGetSupabase.mockReturnValue({ from: mockFrom });

    await dbUpsertToolInsights("TestUser", validUpload, validScores);

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ handle: "testuser" }),
      expect.anything(),
    );
  });

  it("calls .select().single() after upsert", async () => {
    terminalResolve = { data: validRow, error: null };
    mockGetSupabase.mockReturnValue({ from: mockFrom });

    await dbUpsertToolInsights("testuser", validUpload, validScores);

    expect(mockSelect).toHaveBeenCalled();
    expect(mockSingle).toHaveBeenCalled();
  });

  it("returns CraftResult mapped from the returned row", async () => {
    terminalResolve = { data: validRow, error: null };
    mockGetSupabase.mockReturnValue({ from: mockFrom });

    const result = await dbUpsertToolInsights("testuser", validUpload, validScores);

    expect(result).toEqual({
      tool: "claude-code",
      dimensions: { proficiency: 72, effectiveness: 65, sophistication: 58 },
      craftScore: 65,
      tier: "Practitioner",
      reportPeriod: { start: "2025-01-01", end: "2025-03-01" },
      computedAt: "2025-03-01T12:00:00Z",
    });
  });

  it("falls back to input scores when parseRow returns null", async () => {
    // Return data missing a required key so parseRow returns null
    const incompleteRow = { ...validRow };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (incompleteRow as any).handle;
    terminalResolve = { data: incompleteRow, error: null };
    mockGetSupabase.mockReturnValue({ from: mockFrom });

    const result = await dbUpsertToolInsights("testuser", validUpload, validScores);

    // Should fall back to the scores argument
    expect(result).toEqual(validScores);
  });

  it("returns null on Supabase error", async () => {
    terminalResolve = { data: null, error: { message: "unique violation" }, throwOnError: true };
    mockGetSupabase.mockReturnValue({ from: mockFrom });

    const result = await dbUpsertToolInsights("testuser", validUpload, validScores);

    expect(result).toBeNull();
  });

  it("returns null on thrown exception", async () => {
    terminalResolve = { data: null, error: new Error("connection timeout"), throwOnError: true };
    mockGetSupabase.mockReturnValue({ from: mockFrom });

    const result = await dbUpsertToolInsights("testuser", validUpload, validScores);

    expect(result).toBeNull();
  });

  it("returns null on non-throwing upsert error (resolved with error field)", async () => {
    // Error is present in the resolved value, not thrown
    terminalResolve = {
      data: null,
      error: { message: "unique constraint violation" },
      throwOnError: false,
    };
    mockGetSupabase.mockReturnValue({ from: mockFrom });

    const result = await dbUpsertToolInsights("testuser", validUpload, validScores);

    expect(result).toBeNull();
  });

  it("normalizes invalid craft_tier to Novice in returned result", async () => {
    const rowWithBadTier = { ...validRow, craft_tier: "InvalidTier" };
    terminalResolve = { data: rowWithBadTier, error: null };
    mockGetSupabase.mockReturnValue({ from: mockFrom });

    const result = await dbUpsertToolInsights("testuser", validUpload, validScores);

    expect(result).not.toBeNull();
    expect(result!.tier).toBe("Novice");
  });

  it("accepts all valid tier values", async () => {
    for (const tier of ["Novice", "Practitioner", "Expert", "Master"]) {
      vi.clearAllMocks();
      terminalResolve = { data: { ...validRow, craft_tier: tier }, error: null };
      mockGetSupabase.mockReturnValue({ from: mockFrom });

      const result = await dbUpsertToolInsights("testuser", validUpload, validScores);

      expect(result).not.toBeNull();
      expect(result!.tier).toBe(tier);
    }
  });
});

// ---------------------------------------------------------------------------
// Tests — dbGetToolInsights
// ---------------------------------------------------------------------------

describe("dbGetToolInsights", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    terminalResolve = { data: null, error: null };
  });

  it("returns null when Supabase is unavailable", async () => {
    mockGetSupabase.mockReturnValue(null);
    const result = await dbGetToolInsights("testuser");
    expect(result).toBeNull();
  });

  it("queries tool_insights table with correct select columns", async () => {
    terminalResolve = { data: validRow, error: null };
    mockGetSupabase.mockReturnValue({ from: mockFrom });

    await dbGetToolInsights("testuser");

    expect(mockFrom).toHaveBeenCalledWith("tool_insights");
    expect(mockSelect).toHaveBeenCalledWith(
      "handle, tool, report_start, report_end, proficiency, effectiveness, sophistication, craft_score, craft_tier, uploaded_at",
    );
  });

  it("filters by lowercase handle", async () => {
    terminalResolve = { data: validRow, error: null };
    mockGetSupabase.mockReturnValue({ from: mockFrom });

    await dbGetToolInsights("TestUser");

    expect(mockEq).toHaveBeenCalledWith("handle", "testuser");
  });

  it("limits to 1 row and calls .single()", async () => {
    terminalResolve = { data: validRow, error: null };
    mockGetSupabase.mockReturnValue({ from: mockFrom });

    await dbGetToolInsights("testuser");

    expect(mockLimit).toHaveBeenCalledWith(1);
    expect(mockSingle).toHaveBeenCalled();
  });

  it("returns CraftResult from a valid row", async () => {
    terminalResolve = { data: validRow, error: null };
    mockGetSupabase.mockReturnValue({ from: mockFrom });

    const result = await dbGetToolInsights("testuser");

    expect(result).toEqual({
      tool: "claude-code",
      dimensions: { proficiency: 72, effectiveness: 65, sophistication: 58 },
      craftScore: 65,
      tier: "Practitioner",
      reportPeriod: { start: "2025-01-01", end: "2025-03-01" },
      computedAt: "2025-03-01T12:00:00Z",
    });
  });

  it("returns null on PGRST116 error (no rows found)", async () => {
    terminalResolve = {
      data: null,
      error: { code: "PGRST116", message: "The result contains 0 rows" },
    };
    mockGetSupabase.mockReturnValue({ from: mockFrom });

    const result = await dbGetToolInsights("nonexistent");

    expect(result).toBeNull();
  });

  it("returns null on non-PGRST116 error (fail-open)", async () => {
    terminalResolve = {
      data: null,
      error: { code: "42501", message: "permission denied" },
      throwOnError: true,
    };
    mockGetSupabase.mockReturnValue({ from: mockFrom });

    const result = await dbGetToolInsights("testuser");

    expect(result).toBeNull();
  });

  it("returns null on thrown exception (fail-open)", async () => {
    terminalResolve = {
      data: null,
      error: new Error("network error"),
      throwOnError: true,
    };
    mockGetSupabase.mockReturnValue({ from: mockFrom });

    const result = await dbGetToolInsights("testuser");

    expect(result).toBeNull();
  });

  it("returns null when row is missing required keys (parseRow returns null)", async () => {
    // Row with missing required key
    const incompleteRow = { tool: "claude-code", proficiency: 72 };
    terminalResolve = { data: incompleteRow, error: null };
    mockGetSupabase.mockReturnValue({ from: mockFrom });

    const result = await dbGetToolInsights("testuser");

    expect(result).toBeNull();
  });

  it("normalizes invalid craft_tier to Novice", async () => {
    const rowWithBadTier = { ...validRow, craft_tier: "Grandmaster" };
    terminalResolve = { data: rowWithBadTier, error: null };
    mockGetSupabase.mockReturnValue({ from: mockFrom });

    const result = await dbGetToolInsights("testuser");

    expect(result).not.toBeNull();
    expect(result!.tier).toBe("Novice");
  });

  it("returns null when data is null (not an error)", async () => {
    terminalResolve = { data: null, error: null };
    mockGetSupabase.mockReturnValue({ from: mockFrom });

    const result = await dbGetToolInsights("testuser");

    expect(result).toBeNull();
  });

  it("returns null on non-PGRST116 non-throwing error (resolved with error)", async () => {
    // Error is present but not thrown — the source `if (error) ... throw error` catches it
    terminalResolve = {
      data: null,
      error: { code: "42P01", message: "relation does not exist" },
      throwOnError: false, // resolves, doesn't reject
    };
    mockGetSupabase.mockReturnValue({ from: mockFrom });

    const result = await dbGetToolInsights("testuser");

    expect(result).toBeNull();
  });

  it("maps all row fields correctly to CraftResult", async () => {
    const customRow = {
      handle: "anotheruser",
      tool: "claude-code",
      report_start: "2024-06-01",
      report_end: "2024-09-01",
      raw_data: validUpload,
      proficiency: 90,
      effectiveness: 85,
      sophistication: 80,
      craft_score: 85,
      craft_tier: "Expert",
      uploaded_at: "2024-09-01T00:00:00Z",
    };
    terminalResolve = { data: customRow, error: null };
    mockGetSupabase.mockReturnValue({ from: mockFrom });

    const result = await dbGetToolInsights("anotheruser");

    expect(result).toEqual({
      tool: "claude-code",
      dimensions: { proficiency: 90, effectiveness: 85, sophistication: 80 },
      craftScore: 85,
      tier: "Expert",
      reportPeriod: { start: "2024-06-01", end: "2024-09-01" },
      computedAt: "2024-09-01T00:00:00Z",
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — dbRecomputeCraft
// ---------------------------------------------------------------------------

/** Create a simple chain that always resolves to `result`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeChain(result: { data: unknown; error: unknown }): any {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.upsert = () => chain;
  chain.eq = () => chain;
  chain.limit = () => chain;
  chain.single = () => chain;
  chain.then = (resolve: (v: unknown) => void) => resolve(result);
  return chain;
}

describe("dbRecomputeCraft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    terminalResolve = { data: null, error: null };
  });

  it("returns null when Supabase is unavailable", async () => {
    mockGetSupabase.mockReturnValue(null);
    const result = await dbRecomputeCraft("testuser");
    expect(result).toBeNull();
  });

  it("returns null on PGRST116 (no insights uploaded)", async () => {
    terminalResolve = {
      data: null,
      error: { code: "PGRST116", message: "The result contains 0 rows" },
    };
    mockGetSupabase.mockReturnValue({ from: mockFrom });

    const result = await dbRecomputeCraft("testuser");
    expect(result).toBeNull();
  });

  it("returns null on non-PGRST116 DB error (fail-open)", async () => {
    terminalResolve = {
      data: null,
      error: { code: "42501", message: "permission denied" },
      throwOnError: true,
    };
    mockGetSupabase.mockReturnValue({ from: mockFrom });

    const result = await dbRecomputeCraft("testuser");
    expect(result).toBeNull();
  });

  it("returns null when raw_data is missing from the row", async () => {
    terminalResolve = { data: { raw_data: undefined }, error: null };
    mockGetSupabase.mockReturnValue({ from: mockFrom });

    const result = await dbRecomputeCraft("testuser");
    expect(result).toBeNull();
  });

  it("recomputes craft from stored raw data and delegates to dbUpsertToolInsights", async () => {
    // Two sequential DB calls: select raw_data, then upsert updated scores
    const selectChain = makeChain({ data: { raw_data: validUpload }, error: null });
    const upsertChain = makeChain({ data: validRow, error: null });
    const mockFromFn = vi.fn()
      .mockImplementationOnce(() => selectChain)
      .mockImplementationOnce(() => upsertChain);
    mockGetSupabase.mockReturnValue({ from: mockFromFn });
    vi.mocked(computeCraftScore).mockReturnValue(validScores);

    const result = await dbRecomputeCraft("testuser");

    expect(computeCraftScore).toHaveBeenCalledWith(validUpload);
    expect(result).toEqual({
      tool: "claude-code",
      dimensions: { proficiency: 72, effectiveness: 65, sophistication: 58 },
      craftScore: 65,
      tier: "Practitioner",
      reportPeriod: { start: "2025-01-01", end: "2025-03-01" },
      computedAt: "2025-03-01T12:00:00Z",
    });
  });

  it("lowercases handle when querying DB", async () => {
    terminalResolve = {
      data: null,
      error: { code: "PGRST116", message: "0 rows" },
    };
    mockGetSupabase.mockReturnValue({ from: mockFrom });

    await dbRecomputeCraft("TestUser");

    expect(mockEq).toHaveBeenCalledWith("handle", "testuser");
  });
});
