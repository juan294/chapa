import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "overall-health-banner.tsx"),
  "utf-8",
);

// Export shape, prop types, the getOverallHealth priority logic (red >
// yellow > green > unknown, including the empty-agents and
// red-over-yellow branches), all four HEALTH_CONFIG labels, health
// counts display (including the "0 = hidden" branch), role=status +
// aria-label, the terminal command prefix, and the terminal color
// classes on the health dot/label are all exercised behaviorally by
// overall-health-banner.render.test.tsx. Whether the server/client
// boundary is respected has no jsdom-observable difference (jsdom
// always renders client-side), so that one check stays a source check.
describe("OverallHealthBanner", () => {
  it("is a server component (no 'use client' directive)", () => {
    expect(SOURCE).not.toContain('"use client"');
  });
});
