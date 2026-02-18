import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";

// Mock the DB layer
vi.mock("./db/feature-flags", () => ({
  dbGetFeatureFlag: vi.fn(),
}));

import { dbGetFeatureFlag } from "./db/feature-flags";
import {
  isStudioEnabled,
  isExperimentsEnabled,
  isAgentEnabled,
  _resetFlagCache,
} from "./feature-flags";

// ---------------------------------------------------------------------------
// Helper: make a mock FeatureFlag
// ---------------------------------------------------------------------------

function makeFlag(key: string, enabled: boolean) {
  return {
    id: `uuid-${key}`,
    key,
    enabled,
    description: null,
    config: {},
    createdAt: "",
    updatedAt: "",
  };
}

// ---------------------------------------------------------------------------
// isStudioEnabled
// ---------------------------------------------------------------------------

describe("isStudioEnabled", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_STUDIO_ENABLED;
    vi.clearAllMocks();
    _resetFlagCache();
  });

  it("returns true when DB flag is enabled", async () => {
    vi.mocked(dbGetFeatureFlag).mockResolvedValue(makeFlag("studio_enabled", true));

    const result = await isStudioEnabled();
    expect(result).toBe(true);
  });

  it("returns false when DB flag is disabled", async () => {
    vi.mocked(dbGetFeatureFlag).mockResolvedValue(makeFlag("studio_enabled", false));

    const result = await isStudioEnabled();
    expect(result).toBe(false);
  });

  it("falls back to env var when DB returns null", async () => {
    vi.mocked(dbGetFeatureFlag).mockResolvedValue(null);
    process.env.NEXT_PUBLIC_STUDIO_ENABLED = "true";

    const result = await isStudioEnabled();
    expect(result).toBe(true);
  });

  it("returns false when both DB and env var are absent", async () => {
    vi.mocked(dbGetFeatureFlag).mockResolvedValue(null);
    delete process.env.NEXT_PUBLIC_STUDIO_ENABLED;

    const result = await isStudioEnabled();
    expect(result).toBe(false);
  });

  it("handles whitespace around the env var value", async () => {
    vi.mocked(dbGetFeatureFlag).mockResolvedValue(null);
    process.env.NEXT_PUBLIC_STUDIO_ENABLED = "  true  ";

    const result = await isStudioEnabled();
    expect(result).toBe(true);
  });

  it('returns false for env var "1" (must be exactly "true")', async () => {
    vi.mocked(dbGetFeatureFlag).mockResolvedValue(null);
    process.env.NEXT_PUBLIC_STUDIO_ENABLED = "1";

    const result = await isStudioEnabled();
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isExperimentsEnabled
// ---------------------------------------------------------------------------

describe("isExperimentsEnabled", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_EXPERIMENTS_ENABLED;
    vi.clearAllMocks();
    _resetFlagCache();
  });

  it("returns true when DB flag is enabled", async () => {
    vi.mocked(dbGetFeatureFlag).mockResolvedValue(makeFlag("experiments_enabled", true));

    const result = await isExperimentsEnabled();
    expect(result).toBe(true);
  });

  it("falls back to env var when DB unavailable", async () => {
    vi.mocked(dbGetFeatureFlag).mockResolvedValue(null);
    process.env.NEXT_PUBLIC_EXPERIMENTS_ENABLED = "true";

    const result = await isExperimentsEnabled();
    expect(result).toBe(true);
  });

  it("returns false when both DB and env var are absent", async () => {
    vi.mocked(dbGetFeatureFlag).mockResolvedValue(null);
    delete process.env.NEXT_PUBLIC_EXPERIMENTS_ENABLED;

    const result = await isExperimentsEnabled();
    expect(result).toBe(false);
  });

  it("handles whitespace around the env var", async () => {
    vi.mocked(dbGetFeatureFlag).mockResolvedValue(null);
    process.env.NEXT_PUBLIC_EXPERIMENTS_ENABLED = "  true  ";

    const result = await isExperimentsEnabled();
    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isAgentEnabled
// ---------------------------------------------------------------------------

describe("isAgentEnabled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetFlagCache();
  });

  it("returns true when master toggle AND individual agent are enabled", async () => {
    vi.mocked(dbGetFeatureFlag)
      .mockResolvedValueOnce(makeFlag("automated_agents", true))
      .mockResolvedValueOnce(makeFlag("coverage_agent", true));

    const result = await isAgentEnabled("coverage_agent");
    expect(result).toBe(true);
  });

  it("returns false when master toggle is disabled", async () => {
    vi.mocked(dbGetFeatureFlag).mockResolvedValueOnce(makeFlag("automated_agents", false));

    const result = await isAgentEnabled("coverage_agent");
    expect(result).toBe(false);
    // Should not check individual flag when master is off
    expect(dbGetFeatureFlag).toHaveBeenCalledTimes(1);
  });

  it("returns false when individual agent is disabled", async () => {
    vi.mocked(dbGetFeatureFlag)
      .mockResolvedValueOnce(makeFlag("automated_agents", true))
      .mockResolvedValueOnce(makeFlag("coverage_agent", false));

    const result = await isAgentEnabled("coverage_agent");
    expect(result).toBe(false);
  });

  it("returns false when master toggle not found in DB", async () => {
    vi.mocked(dbGetFeatureFlag).mockResolvedValue(null);

    const result = await isAgentEnabled("coverage_agent");
    expect(result).toBe(false);
  });

  it("returns false when individual agent not found in DB", async () => {
    vi.mocked(dbGetFeatureFlag)
      .mockResolvedValueOnce(makeFlag("automated_agents", true))
      .mockResolvedValueOnce(null);

    const result = await isAgentEnabled("nonexistent_agent");
    expect(result).toBe(false);
  });
});
