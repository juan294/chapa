import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "agent-status-grid.tsx"),
  "utf-8",
);

// Export shape, prop types (guarded by typecheck via the render test's
// typed usage), the agents.map rendering, isRunning derivation,
// onRun/onStop wiring, and grid layout classes are all exercised
// behaviorally by agent-status-grid.test.tsx. React's `key` prop is
// consumed internally by the reconciler and never appears on rendered
// DOM or as an observable prop, so "passes agent key as React key" had
// no behavioral equivalent to convert to and was removed as a no-op.
describe("AgentStatusGrid", () => {
  it("is a client component", () => {
    expect(SOURCE).toContain('"use client"');
  });
});
