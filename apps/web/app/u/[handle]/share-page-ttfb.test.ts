/**
 * #800 — share-page TTFB invariants:
 *  - Avatar deadline must be 250ms or less (not the original 500ms).
 *  - When the avatar fetch times out, the rendered (degraded) SVG must NOT
 *    be written to the shared cache. Otherwise badge.svg later reads a
 *    placeholder version and visitors see a missing avatar for up to 24h.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SHARE_PAGE = fs.readFileSync(
  path.resolve(__dirname, "page.tsx"),
  "utf-8",
);

describe("share page TTFB (#800)", () => {
  it("avatar deadline is at most 250ms", () => {
    const match = SHARE_PAGE.match(
      /AVATAR_DEADLINE_MS\s*=\s*(\d+)/,
    );
    expect(match).not.toBeNull();
    const deadline = Number(match![1]);
    expect(deadline).toBeGreaterThan(0);
    expect(deadline).toBeLessThanOrEqual(250);
  });

  it("only writes to badge SVG cache when avatar fetch resolved (no degraded caching)", () => {
    // The cache write must be guarded by a flag that's set only when avatar
    // resolved (not on timeout). Otherwise a slow avatar fetch poisons the
    // shared cache with a placeholder version for up to 24h.
    expect(SHARE_PAGE).toMatch(/avatarResolved/);

    // The writeBadgeSvgCache call must be inside an avatarResolved-gated branch.
    const writeIdx = SHARE_PAGE.indexOf("writeBadgeSvgCache(");
    expect(writeIdx).toBeGreaterThan(-1);
    // Look back a reasonable window from the write call for the gate.
    const window = SHARE_PAGE.slice(Math.max(0, writeIdx - 600), writeIdx);
    expect(window).toMatch(/avatarResolved/);
  });
});
