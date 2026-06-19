import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";

// Mock the DB layer
vi.mock("./db/feature-flags", () => ({
  dbGetFeatureFlag: vi.fn(),
}));

// `unstable_cache` requires a Next.js incremental cache that doesn't exist in
// vitest. Pass-through so the wrapped function still calls the mocked DB.
vi.mock("next/cache", () => ({
  unstable_cache: <Args extends unknown[], R>(fn: (...args: Args) => R) => fn,
  revalidateTag: vi.fn(),
}));

import { dbGetFeatureFlag } from "./db/feature-flags";
import {
  isStudioEnabled,
  isStudioEnabledSync,
  isExperimentsEnabled,
  isAgentEnabled,
  isBitbucketEnabled,
  isBitbucketEnabledSync,
  isCodebergEnabled,
  isCodebergEnabledSync,
  isInsightsEnabled,
  isInsightsEnabledSync,
  isGitlabEnabled,
  isGitlabEnabledSync,
  invalidateFeatureFlagCache,
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
    vi.unstubAllEnvs();
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
    vi.stubEnv("NEXT_PUBLIC_STUDIO_ENABLED", "true");

    const result = await isStudioEnabled();
    expect(result).toBe(true);
  });

  it("returns false when both DB and env var are absent", async () => {
    vi.mocked(dbGetFeatureFlag).mockResolvedValue(null);
    vi.stubEnv("NEXT_PUBLIC_STUDIO_ENABLED", undefined);

    const result = await isStudioEnabled();
    expect(result).toBe(false);
  });

  it("handles whitespace around the env var value", async () => {
    vi.mocked(dbGetFeatureFlag).mockResolvedValue(null);
    vi.stubEnv("NEXT_PUBLIC_STUDIO_ENABLED", "  true  ");

    const result = await isStudioEnabled();
    expect(result).toBe(true);
  });

  it('returns false for env var "1" (must be exactly "true")', async () => {
    vi.mocked(dbGetFeatureFlag).mockResolvedValue(null);
    vi.stubEnv("NEXT_PUBLIC_STUDIO_ENABLED", "1");

    const result = await isStudioEnabled();
    expect(result).toBe(false);
  });

  it("falls back after 500ms when the DB lookup hangs", async () => {
    vi.useFakeTimers();
    vi.mocked(dbGetFeatureFlag).mockReturnValue(new Promise(() => {}));
    vi.stubEnv("NEXT_PUBLIC_STUDIO_ENABLED", "true");

    const resultPromise = isStudioEnabled();
    await vi.advanceTimersByTimeAsync(501);

    await expect(resultPromise).resolves.toBe(true);
    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// isExperimentsEnabled
// ---------------------------------------------------------------------------

describe("isExperimentsEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
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
    vi.stubEnv("NEXT_PUBLIC_EXPERIMENTS_ENABLED", "true");

    const result = await isExperimentsEnabled();
    expect(result).toBe(true);
  });

  it("returns false when both DB and env var are absent", async () => {
    vi.mocked(dbGetFeatureFlag).mockResolvedValue(null);
    vi.stubEnv("NEXT_PUBLIC_EXPERIMENTS_ENABLED", undefined);

    const result = await isExperimentsEnabled();
    expect(result).toBe(false);
  });

  it("handles whitespace around the env var", async () => {
    vi.mocked(dbGetFeatureFlag).mockResolvedValue(null);
    vi.stubEnv("NEXT_PUBLIC_EXPERIMENTS_ENABLED", "  true  ");

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

  it("returns false when master flag lookup times out", async () => {
    vi.useFakeTimers();
    vi.mocked(dbGetFeatureFlag).mockReturnValue(new Promise(() => {}));

    const resultPromise = isAgentEnabled("coverage_agent");
    await vi.advanceTimersByTimeAsync(501);

    await expect(resultPromise).resolves.toBe(false);
    vi.useRealTimers();
  });

  it("returns false when agent flag lookup times out", async () => {
    vi.useFakeTimers();
    vi.mocked(dbGetFeatureFlag)
      .mockResolvedValueOnce(makeFlag("automated_agents", true))
      .mockReturnValueOnce(new Promise(() => {}));

    const resultPromise = isAgentEnabled("coverage_agent");
    await vi.advanceTimersByTimeAsync(501);

    await expect(resultPromise).resolves.toBe(false);
    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// isBitbucketEnabledSync
// ---------------------------------------------------------------------------

describe("isBitbucketEnabledSync", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns false when env var not set", () => {
    vi.stubEnv("NEXT_PUBLIC_BITBUCKET_ENABLED", undefined);
    expect(isBitbucketEnabledSync()).toBe(false);
  });

  it('returns true when env var is "true"', () => {
    vi.stubEnv("NEXT_PUBLIC_BITBUCKET_ENABLED", "true");
    expect(isBitbucketEnabledSync()).toBe(true);
  });

  it('returns false when env var is "false"', () => {
    vi.stubEnv("NEXT_PUBLIC_BITBUCKET_ENABLED", "false");
    expect(isBitbucketEnabledSync()).toBe(false);
  });

  it("handles whitespace", () => {
    vi.stubEnv("NEXT_PUBLIC_BITBUCKET_ENABLED", "  true  ");
    expect(isBitbucketEnabledSync()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isBitbucketEnabled (async, DB-backed)
// ---------------------------------------------------------------------------

describe("isBitbucketEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    _resetFlagCache();
  });

  it("returns DB flag value when available", async () => {
    vi.mocked(dbGetFeatureFlag).mockResolvedValue(
      makeFlag("bitbucket_integration", true),
    );

    const result = await isBitbucketEnabled();
    expect(result).toBe(true);
  });

  it("returns false when DB flag is disabled", async () => {
    vi.mocked(dbGetFeatureFlag).mockResolvedValue(
      makeFlag("bitbucket_integration", false),
    );

    const result = await isBitbucketEnabled();
    expect(result).toBe(false);
  });

  it("falls back to env var when DB unavailable", async () => {
    vi.mocked(dbGetFeatureFlag).mockResolvedValue(null);
    vi.stubEnv("NEXT_PUBLIC_BITBUCKET_ENABLED", "true");

    const result = await isBitbucketEnabled();
    expect(result).toBe(true);
  });

  it("returns false when both DB and env var are absent", async () => {
    vi.mocked(dbGetFeatureFlag).mockResolvedValue(null);
    vi.stubEnv("NEXT_PUBLIC_BITBUCKET_ENABLED", undefined);

    const result = await isBitbucketEnabled();
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isCodebergEnabledSync
// ---------------------------------------------------------------------------

describe("isCodebergEnabledSync", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns false when env var not set", () => {
    vi.stubEnv("NEXT_PUBLIC_CODEBERG_ENABLED", undefined);
    expect(isCodebergEnabledSync()).toBe(false);
  });

  it('returns true when env var is "true"', () => {
    vi.stubEnv("NEXT_PUBLIC_CODEBERG_ENABLED", "true");
    expect(isCodebergEnabledSync()).toBe(true);
  });

  it('returns false when env var is "false"', () => {
    vi.stubEnv("NEXT_PUBLIC_CODEBERG_ENABLED", "false");
    expect(isCodebergEnabledSync()).toBe(false);
  });

  it("handles whitespace", () => {
    vi.stubEnv("NEXT_PUBLIC_CODEBERG_ENABLED", "  true  ");
    expect(isCodebergEnabledSync()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isCodebergEnabled (async, DB-backed)
// ---------------------------------------------------------------------------

describe("isCodebergEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    _resetFlagCache();
  });

  it("returns DB flag value when available", async () => {
    vi.mocked(dbGetFeatureFlag).mockResolvedValue(
      makeFlag("codeberg_integration", true),
    );

    const result = await isCodebergEnabled();
    expect(result).toBe(true);
  });

  it("returns false when DB flag is disabled", async () => {
    vi.mocked(dbGetFeatureFlag).mockResolvedValue(
      makeFlag("codeberg_integration", false),
    );

    const result = await isCodebergEnabled();
    expect(result).toBe(false);
  });

  it("falls back to env var when DB unavailable", async () => {
    vi.mocked(dbGetFeatureFlag).mockResolvedValue(null);
    vi.stubEnv("NEXT_PUBLIC_CODEBERG_ENABLED", "true");

    const result = await isCodebergEnabled();
    expect(result).toBe(true);
  });

  it("returns false when both DB and env var are absent", async () => {
    vi.mocked(dbGetFeatureFlag).mockResolvedValue(null);
    vi.stubEnv("NEXT_PUBLIC_CODEBERG_ENABLED", undefined);

    const result = await isCodebergEnabled();
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isGitlabEnabledSync
// ---------------------------------------------------------------------------

describe("isGitlabEnabledSync", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns false when env var not set", () => {
    vi.stubEnv("NEXT_PUBLIC_GITLAB_ENABLED", undefined);
    expect(isGitlabEnabledSync()).toBe(false);
  });

  it('returns true when env var is "true"', () => {
    vi.stubEnv("NEXT_PUBLIC_GITLAB_ENABLED", "true");
    expect(isGitlabEnabledSync()).toBe(true);
  });

  it('returns false when env var is "false"', () => {
    vi.stubEnv("NEXT_PUBLIC_GITLAB_ENABLED", "false");
    expect(isGitlabEnabledSync()).toBe(false);
  });

  it("handles whitespace", () => {
    vi.stubEnv("NEXT_PUBLIC_GITLAB_ENABLED", "  true  ");
    expect(isGitlabEnabledSync()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isGitlabEnabled (async, DB-backed)
// ---------------------------------------------------------------------------

describe("isGitlabEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    _resetFlagCache();
  });

  it("returns DB flag value when available", async () => {
    vi.mocked(dbGetFeatureFlag).mockResolvedValue(
      makeFlag("gitlab_integration", true),
    );

    const result = await isGitlabEnabled();
    expect(result).toBe(true);
  });

  it("returns false when DB flag is disabled", async () => {
    vi.mocked(dbGetFeatureFlag).mockResolvedValue(
      makeFlag("gitlab_integration", false),
    );

    const result = await isGitlabEnabled();
    expect(result).toBe(false);
  });

  it("falls back to env var when DB unavailable", async () => {
    vi.mocked(dbGetFeatureFlag).mockResolvedValue(null);
    vi.stubEnv("NEXT_PUBLIC_GITLAB_ENABLED", "true");

    const result = await isGitlabEnabled();
    expect(result).toBe(true);
  });

  it("returns false when both DB and env var are absent", async () => {
    vi.mocked(dbGetFeatureFlag).mockResolvedValue(null);
    vi.stubEnv("NEXT_PUBLIC_GITLAB_ENABLED", undefined);

    const result = await isGitlabEnabled();
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isInsightsEnabledSync
// ---------------------------------------------------------------------------

describe("isInsightsEnabledSync", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns false when env var not set", () => {
    vi.stubEnv("NEXT_PUBLIC_INSIGHTS_ENABLED", undefined);
    expect(isInsightsEnabledSync()).toBe(false);
  });

  it('returns true when env var is "true"', () => {
    vi.stubEnv("NEXT_PUBLIC_INSIGHTS_ENABLED", "true");
    expect(isInsightsEnabledSync()).toBe(true);
  });

  it('returns false when env var is "false"', () => {
    vi.stubEnv("NEXT_PUBLIC_INSIGHTS_ENABLED", "false");
    expect(isInsightsEnabledSync()).toBe(false);
  });

  it("handles whitespace", () => {
    vi.stubEnv("NEXT_PUBLIC_INSIGHTS_ENABLED", "  true  ");
    expect(isInsightsEnabledSync()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isStudioEnabledSync
// ---------------------------------------------------------------------------

describe("isStudioEnabledSync", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns false when env var not set", () => {
    vi.stubEnv("NEXT_PUBLIC_STUDIO_ENABLED", undefined);
    expect(isStudioEnabledSync()).toBe(false);
  });

  it('returns true when env var is "true"', () => {
    vi.stubEnv("NEXT_PUBLIC_STUDIO_ENABLED", "true");
    expect(isStudioEnabledSync()).toBe(true);
  });

  it('returns false when env var is "false"', () => {
    vi.stubEnv("NEXT_PUBLIC_STUDIO_ENABLED", "false");
    expect(isStudioEnabledSync()).toBe(false);
  });

  it("handles whitespace", () => {
    vi.stubEnv("NEXT_PUBLIC_STUDIO_ENABLED", "  true  ");
    expect(isStudioEnabledSync()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// checkFlag TTL cache behavior
// ---------------------------------------------------------------------------

describe("feature flag TTL cache", () => {
  afterEach(() => {
    vi.clearAllMocks();
    _resetFlagCache();
  });

  it("returns cached result on second call without hitting DB again", async () => {
    vi.mocked(dbGetFeatureFlag).mockResolvedValue(
      makeFlag("codeberg_integration", true),
    );

    await isCodebergEnabled();
    await isCodebergEnabled();

    expect(dbGetFeatureFlag).toHaveBeenCalledTimes(1);
  });

  it("hits DB again after cache is reset", async () => {
    vi.mocked(dbGetFeatureFlag).mockResolvedValue(
      makeFlag("codeberg_integration", true),
    );

    await isCodebergEnabled();
    _resetFlagCache();
    await isCodebergEnabled();

    expect(dbGetFeatureFlag).toHaveBeenCalledTimes(2);
  });

  it("caches separate entries per flag key", async () => {
    vi.mocked(dbGetFeatureFlag)
      .mockResolvedValueOnce(makeFlag("codeberg_integration", true))
      .mockResolvedValueOnce(makeFlag("bitbucket_integration", false));

    await isCodebergEnabled();
    await isBitbucketEnabled();
    // second calls — both should be served from cache
    const cb = await isCodebergEnabled();
    const bb = await isBitbucketEnabled();

    expect(dbGetFeatureFlag).toHaveBeenCalledTimes(2);
    expect(cb).toBe(true);
    expect(bb).toBe(false);
  });

  it("caches env-var fallback result so DB is not re-queried", async () => {
    vi.mocked(dbGetFeatureFlag).mockResolvedValue(null);
    vi.stubEnv("NEXT_PUBLIC_CODEBERG_ENABLED", "true");

    await isCodebergEnabled();
    await isCodebergEnabled();

    expect(dbGetFeatureFlag).toHaveBeenCalledTimes(1);
  });

  it("serves updated values immediately after invalidating the in-process cache", async () => {
    vi.mocked(dbGetFeatureFlag)
      .mockResolvedValueOnce(makeFlag("studio_enabled", false))
      .mockResolvedValueOnce(makeFlag("studio_enabled", true));

    const before = await isStudioEnabled();
    invalidateFeatureFlagCache("studio_enabled");
    const after = await isStudioEnabled();

    expect(before).toBe(false);
    expect(after).toBe(true);
    expect(dbGetFeatureFlag).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// unstable_cache wrapping (ISR-safe DB fetch)
// ---------------------------------------------------------------------------

describe("feature-flags ISR-safe DB wrapper", () => {
  it("imports unstable_cache from next/cache so ISR is not defeated", async () => {
    // The root layout calls isStudioEnabled(), which transitively hits Upstash
    // Redis with a `no-store` fetch. Without unstable_cache, that defeats ISR
    // for every page that inherits the root layout. This guards against a
    // regression that removes the wrapper.
    const source = await import("node:fs").then((fs) =>
      fs.promises.readFile(
        new URL("./feature-flags.ts", import.meta.url),
        "utf8",
      ),
    );
    expect(source).toMatch(/from "next\/cache"/);
    expect(source).toMatch(/unstable_cache\(/);
  });
});

// ---------------------------------------------------------------------------
// isInsightsEnabled (async, DB-backed)
// ---------------------------------------------------------------------------

describe("isInsightsEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    _resetFlagCache();
  });

  it("returns DB flag value when available", async () => {
    vi.mocked(dbGetFeatureFlag).mockResolvedValue(
      makeFlag("insights_integration", true),
    );

    const result = await isInsightsEnabled();
    expect(result).toBe(true);
  });

  it("returns false when DB flag is disabled", async () => {
    vi.mocked(dbGetFeatureFlag).mockResolvedValue(
      makeFlag("insights_integration", false),
    );

    const result = await isInsightsEnabled();
    expect(result).toBe(false);
  });

  it("falls back to env var when DB unavailable", async () => {
    vi.mocked(dbGetFeatureFlag).mockResolvedValue(null);
    vi.stubEnv("NEXT_PUBLIC_INSIGHTS_ENABLED", "true");

    const result = await isInsightsEnabled();
    expect(result).toBe(true);
  });

  it("returns false when both DB and env var are absent", async () => {
    vi.mocked(dbGetFeatureFlag).mockResolvedValue(null);
    vi.stubEnv("NEXT_PUBLIC_INSIGHTS_ENABLED", undefined);

    const result = await isInsightsEnabled();
    expect(result).toBe(false);
  });
});
