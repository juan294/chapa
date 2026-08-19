import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "terminal-display.tsx"),
  "utf-8",
);

// Export shape, prop types, polling (URL/query params, 2s interval,
// 404 handling, terminal-status stop condition, interval/timeout
// cleanup on unmount, appended lines), elapsed-timer formatting and its
// 1s tick, header content/colors, Copy (incl. actual clipboard write)
// and Close buttons, log-area rendering (waiting state, timestamps,
// stdout/stderr coloring), and all styling classes are exercised
// behaviorally by terminal-display.render.test.tsx. LogLine's field
// types are TS-only and already guarded by typecheck via the render
// test's real fixture objects, so those checks were removed as no-ops.
// Auto-scroll (`scrollRef.current.scrollTop = scrollHeight`) has no
// meaningful jsdom equivalent — jsdom never lays out content, so
// scrollHeight is always 0 and a render assertion on it would be
// vacuous — so it stays a source check.
describe("TerminalDisplay", () => {
  it("scrolls the log container to the bottom when new lines arrive", () => {
    expect(SOURCE).toContain("scrollRef.current");
    expect(SOURCE).toContain("scrollTop");
    expect(SOURCE).toContain("scrollHeight");
  });
});
