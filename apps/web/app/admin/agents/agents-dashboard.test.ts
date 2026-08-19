import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "agents-dashboard.tsx"),
  "utf-8",
);

// Export shape, prop types, state management, data fetching (incl. error
// parsing/fallback), the command-bar custom event, handleToggle/handleRun
// /handleStop (URLs, methods, bodies, follow-up refetches), master-toggle
// derivation, loading/error/null-data branches, child component wiring,
// and imports (mocked by path in the render suite — a wrong path means
// the mock never intercepts and the render test fails) are all exercised
// behaviorally by agents-dashboard.test.tsx, including error-text styling
// and event-listener cleanup on unmount.
describe("AgentsDashboard", () => {
  it("is a client component", () => {
    expect(SOURCE).toContain('"use client"');
  });
});
