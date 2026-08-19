import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "agent-toggles-table.tsx"),
  "utf-8",
);

// Export shape, prop types (guarded by typecheck via the render test's
// typed usage), table structure, the master/individual toggle rows,
// pending/disabled state, aria-checked/aria-label wiring, and all
// styling classes are exercised behaviorally by
// agent-toggles-table.render.test.tsx. React's `key` prop is consumed
// internally by the reconciler and never appears on rendered DOM, so
// "uses agent key as React key" had no behavioral equivalent to convert
// to and was removed as a no-op. Whether pending state is tracked via an
// internal ToggleSwitch sub-component or inlined is an implementation
// choice with no observable difference once the switch's rendered
// role/aria-checked/aria-label/disabled behavior is covered, so that
// check was also removed as a duplicate.
describe("AgentTogglesTable", () => {
  it("is a client component", () => {
    expect(SOURCE).toContain('"use client"');
  });

  it("uses try/finally to ensure pending is cleared even if onToggle rejects", () => {
    // The render suite covers the happy path (pending clears once the
    // returned promise resolves). Driving a real rejected onToggle
    // through fireEvent would require either an unhandled-rejection
    // workaround or a production-code change to swallow the error, so
    // the failure-path robustness of try/finally stays a source check.
    expect(SOURCE).toContain("finally");
  });
});
