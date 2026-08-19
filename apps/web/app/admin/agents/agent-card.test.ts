import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "agent-card.tsx"),
  "utf-8",
);

// Almost everything here is exercised behaviorally by agent-card.test.tsx
// (render + query): export shape, prop types (guarded by typecheck via the
// render test's typed usage), all 4 health-dot colors, the running/pulse
// state, run/stop buttons and their handlers/disabled state, schedule,
// health summary, and the lastRun/"Never run" branches. Styling-only
// classes with no render-test className assertion are the one genuine
// carve-out that stays here — see agent-card.test.tsx's "styling"
// describe block for the render-based checks that replaced the rest.
describe("AgentCard", () => {
  it("is a client component", () => {
    expect(SOURCE).toContain('"use client"');
  });
});
