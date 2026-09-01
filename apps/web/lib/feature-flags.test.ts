import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";

const cacheProducerRejections: unknown[] = [];

// Mock the DB layer
vi.mock("./db/feature-flags", () => ({
  dbGetFeatureFlag: vi.fn(),
}));

// `unstable_cache` requires a Next.js incremental cache that doesn't exist in
// vitest. This spy passes calls through to the mocked DB and records producer
// rejections so timeout tests can distinguish a request fallback from a cache
// revalidation failure.
vi.mock("next/cache", () => ({
  unstable_cache: vi.fn(
    <Args extends unknown[], R>(fn: (...args: Args) => R) =>
      async (...args: Args): Promise<Awaited<R>> => {
        try {
          return await fn(...args);
        } catch (error) {
          cacheProducerRejections.push(error);
          throw error;
        }
      },
  ),
  revalidateTag: vi.fn(),
}));

import { unstable_cache } from "next/cache";
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
  isMcpServerEnabled,
  isGitlabEnabled,
  isGitlabEnabledSync,
  isStudioDemoEnabled,
  isStudioDemoEnabledSync,
  isWebmcpEnabled,
  isWebmcpEnabledSync,
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
// unstable_cache revalidate configuration (#1178 / PE-M3)
//
// The nine `/[locale]/*` content pages declare `export const revalidate =
// 3600` and read flags via the root layout on every render. If the
// `unstable_cache` wrapper around `dbGetFeatureFlag` declares a SHORTER
// revalidate than its page consumers, Next.js clamps each page's effective
// ISR revalidate to whichever value the data-cache dependency happened to
// register on that build worker — nondeterministic per route/locale (the
// same page resolving to 5m for one locale and 1h for the other in the same
// build, verbatim from a real `pnpm run build`). The two values must match
// so the page's declared revalidate is what actually governs it.
// ---------------------------------------------------------------------------

describe("fetchFlagFromDbCached unstable_cache configuration", () => {
  it("declares the same revalidate window as its page consumers (3600s)", () => {
    const call = vi.mocked(unstable_cache).mock.calls[0];
    expect(call).toBeDefined();
    const options = call?.[2] as { revalidate?: number } | undefined;
    expect(options?.revalidate).toBe(3600);
  });
});

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

  it("does not reject the data-cache producer when a DB lookup exceeds the request deadline", async () => {
    vi.useFakeTimers();
    cacheProducerRejections.length = 0;
    vi.mocked(dbGetFeatureFlag).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () => resolve(makeFlag("studio_enabled", true)),
            600,
          );
        }),
    );
    vi.stubEnv("NEXT_PUBLIC_STUDIO_ENABLED", undefined);

    const resultPromise = isStudioEnabled();
    await vi.advanceTimersByTimeAsync(501);

    await expect(resultPromise).resolves.toBe(false);
    expect(cacheProducerRejections).toEqual([]);

    await vi.advanceTimersByTimeAsync(100);
    expect(cacheProducerRejections).toEqual([]);
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

// ---------------------------------------------------------------------------
// WebMCP and Studio demo flags
// ---------------------------------------------------------------------------

describe.each([
  {
    label: "WebMCP",
    dbKey: "webmcp_enabled",
    envKey: "NEXT_PUBLIC_WEBMCP_ENABLED",
    check: isWebmcpEnabled,
    checkSync: isWebmcpEnabledSync,
  },
  {
    label: "Studio demo",
    dbKey: "studio_demo_enabled",
    envKey: "NEXT_PUBLIC_STUDIO_DEMO_ENABLED",
    check: isStudioDemoEnabled,
    checkSync: isStudioDemoEnabledSync,
  },
])("$label feature flag", ({ dbKey, envKey, check, checkSync }) => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    _resetFlagCache();
  });

  it("re-exports the sync env helper", () => {
    vi.stubEnv(envKey, "true");
    expect(checkSync()).toBe(true);
  });

  it("returns the DB flag value when available", async () => {
    vi.mocked(dbGetFeatureFlag).mockResolvedValue(makeFlag(dbKey, true));

    await expect(check()).resolves.toBe(true);
    expect(dbGetFeatureFlag).toHaveBeenCalledWith(dbKey);
  });

  it("keeps a disabled DB flag authoritative over an enabled env fallback", async () => {
    vi.mocked(dbGetFeatureFlag).mockResolvedValue(makeFlag(dbKey, false));
    vi.stubEnv(envKey, "true");

    await expect(check()).resolves.toBe(false);
  });

  it("falls back to the env flag when the DB row is unavailable", async () => {
    vi.mocked(dbGetFeatureFlag).mockResolvedValue(null);
    vi.stubEnv(envKey, " true ");

    await expect(check()).resolves.toBe(true);
  });

  it("defaults to false when both sources are absent", async () => {
    vi.mocked(dbGetFeatureFlag).mockResolvedValue(null);
    vi.stubEnv(envKey, undefined);

    await expect(check()).resolves.toBe(false);
  });
});

describe("remote MCP server feature flag", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    _resetFlagCache();
  });

  it("returns the DB flag value when available", async () => {
    vi.mocked(dbGetFeatureFlag).mockResolvedValue(
      makeFlag("mcp_server_enabled", true),
    );

    await expect(isMcpServerEnabled()).resolves.toBe(true);
    expect(dbGetFeatureFlag).toHaveBeenCalledWith("mcp_server_enabled");
  });

  it("keeps a disabled DB flag authoritative over the env fallback", async () => {
    vi.mocked(dbGetFeatureFlag).mockResolvedValue(
      makeFlag("mcp_server_enabled", false),
    );
    vi.stubEnv("MCP_SERVER_ENABLED", "true");

    await expect(isMcpServerEnabled()).resolves.toBe(false);
  });

  it("falls back to the server-only env flag when the DB row is absent", async () => {
    vi.mocked(dbGetFeatureFlag).mockResolvedValue(null);
    vi.stubEnv("MCP_SERVER_ENABLED", " true ");

    await expect(isMcpServerEnabled()).resolves.toBe(true);
  });

  it("defaults to false when both sources are absent", async () => {
    vi.mocked(dbGetFeatureFlag).mockResolvedValue(null);
    vi.stubEnv("MCP_SERVER_ENABLED", undefined);

    await expect(isMcpServerEnabled()).resolves.toBe(false);
  });
});

// ---------------------------------------------------------------------------
// #1203 — a FAILED lookup must never be cached as a negative.
//
// `fetchFlagFromDbCached` used to swallow the error INSIDE `unstable_cache`
// (`.catch(() => null)`), so a single 500ms timeout resolved to `null`, and
// `null` is indistinguishable from "no such row". `checkFlag` then fell back
// to the env var, and Next cached that outcome for an hour (and baked it into
// statically prerendered output). In production `NEXT_PUBLIC_STUDIO_ENABLED`
// is unset, so one transient DB blip disabled Creator Studio outright while
// the `studio_enabled` row still said `true`: `/studio?demo=1` answered 200
// with a `<meta http-equiv="refresh" content="1;url=/">`, which curl ignores
// and every real browser obeys.
//
// The failure must degrade for the CURRENT request only and leave nothing
// behind, so the next call retries and picks up the real row.
// ---------------------------------------------------------------------------
describe("feature flags — a failed DB lookup is not cached (#1203)", () => {
  beforeEach(() => {
    _resetFlagCache();
    vi.mocked(dbGetFeatureFlag).mockReset();
  });

  it("retries on the next call after a rejected lookup, instead of sticking to the fallback", async () => {
    vi.mocked(dbGetFeatureFlag).mockRejectedValueOnce(new Error("db timeout"));
    expect(await isStudioEnabled()).toBe(false); // degraded for this request

    vi.mocked(dbGetFeatureFlag).mockResolvedValueOnce(makeFlag("studio_enabled", true));
    expect(await isStudioEnabled()).toBe(true); // real row wins on retry
  });

  it("does not poison the in-process cache with the degraded value", async () => {
    vi.mocked(dbGetFeatureFlag).mockRejectedValueOnce(new Error("db down"));
    await isStudioEnabled();

    // A second call must actually consult the DB again rather than serve a
    // cached `false` for the full 5-minute TTL.
    vi.mocked(dbGetFeatureFlag).mockResolvedValue(makeFlag("studio_enabled", true));
    await isStudioEnabled();
    expect(vi.mocked(dbGetFeatureFlag)).toHaveBeenCalledTimes(2);
  });

  it("still caches a successful lookup", async () => {
    vi.mocked(dbGetFeatureFlag).mockResolvedValue(makeFlag("studio_enabled", true));
    expect(await isStudioEnabled()).toBe(true);
    expect(await isStudioEnabled()).toBe(true);
    expect(vi.mocked(dbGetFeatureFlag)).toHaveBeenCalledTimes(1);
  });

  it("still falls back to the env var when the row genuinely does not exist", async () => {
    vi.mocked(dbGetFeatureFlag).mockResolvedValue(null);
    expect(await isStudioEnabled()).toBe(false);
  });
});
