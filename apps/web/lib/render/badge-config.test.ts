import { describe, it, expect, vi, beforeEach } from "vitest";
import { DEFAULT_BADGE_CONFIG } from "@chapa/shared";

const { mockDbGetStudioConfig } = vi.hoisted(() => ({
  mockDbGetStudioConfig: vi.fn(),
}));
vi.mock("@/lib/db/studio", () => ({
  dbGetStudioConfig: (...args: unknown[]) => mockDbGetStudioConfig(...args),
}));

import { resolveBadgeConfig, resolveBadgeConfigSnapshot } from "./badge-config";

const CUSTOM = { ...DEFAULT_BADGE_CONFIG, border: "none" as const };

/**
 * #1191 — every badge render site resolves config through this one function,
 * because they all write to the same cache slot. A site that resolved
 * differently would overwrite the others' work with no error anywhere.
 */
describe("resolveBadgeConfig (#1191)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the saved config when there is one", async () => {
    mockDbGetStudioConfig.mockResolvedValue({
      status: "found",
      config: CUSTOM,
      revision: 7,
    });
    await expect(resolveBadgeConfig("octocat")).resolves.toEqual(CUSTOM);
  });

  it.each(["not_found", "unavailable"] as const)(
    "falls back to the default when the read reports %s",
    async (status) => {
      mockDbGetStudioConfig.mockResolvedValue({ status });
      await expect(resolveBadgeConfig("octocat")).resolves.toEqual(
        DEFAULT_BADGE_CONFIG,
      );
    },
  );

  it("falls back to the default when the read throws", async () => {
    // A badge that renders in its default look beats a badge that fails to
    // render because a styling lookup was unavailable.
    mockDbGetStudioConfig.mockRejectedValue(new Error("supabase down"));
    await expect(resolveBadgeConfig("octocat")).resolves.toEqual(
      DEFAULT_BADGE_CONFIG,
    );
  });

  it("exposes the database revision for cache-write fencing", async () => {
    mockDbGetStudioConfig.mockResolvedValue({
      status: "found",
      config: CUSTOM,
      revision: 7,
    });

    await expect(resolveBadgeConfigSnapshot("octocat")).resolves.toEqual({
      config: CUSTOM,
      revision: 7,
      cacheable: true,
    });
  });

  it("treats a confirmed missing config as a stable default revision", async () => {
    mockDbGetStudioConfig.mockResolvedValue({ status: "not_found" });

    await expect(resolveBadgeConfigSnapshot("octocat")).resolves.toEqual({
      config: DEFAULT_BADGE_CONFIG,
      revision: null,
      cacheable: true,
    });
  });

  it.each(["unavailable", "invalid"] as const)(
    "disables cache publication when the revision is %s",
    async (status) => {
      mockDbGetStudioConfig.mockResolvedValue({ status });

      await expect(resolveBadgeConfigSnapshot("octocat")).resolves.toEqual({
        config: DEFAULT_BADGE_CONFIG,
        revision: null,
        cacheable: false,
      });
    },
  );
});

describe("every badge render site resolves config the same way (#1191)", () => {
  // They all write to buildBadgeSvgCacheKey's slot. If one rendered with a
  // different config it would overwrite the others — the warm-cache cron
  // rendering the default would silently replace a user's configured badge.
  it.each([
    "app/u/[handle]/badge.svg/route.ts",
    "app/u/[handle]/page.tsx",
    "app/u/[handle]/og-image/route.ts",
    "app/api/cron/warm-cache/route.ts",
  ])("%s passes a resolved config to renderBadgeSvg", async (relative) => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const source = fs.readFileSync(
      path.resolve(__dirname, "../..", relative),
      "utf8",
    );
    expect(source).toContain("resolveBadgeConfig");
    expect(source).toMatch(/config[:,]/);
  });
});
