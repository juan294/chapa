import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "cross-agent-insights.tsx"),
  "utf-8",
);

// Export shape, prop types, entry grouping/dedup, the empty state, agent
// pill navigation and highlighting, timestamp/markdown content rendering,
// and all styling classes are exercised behaviorally by
// cross-agent-insights.render.test.tsx (render + query). The
// renderMarkdown/inlineFormat markdown-to-HTML conversion (headings,
// bullets, bold, inline code, empty lines, XSS escaping) is exercised
// even more rigorously by cross-agent-insights.test.tsx, which calls the
// exported renderMarkdown() function directly with real input/output
// assertions rather than matching its source text.
describe("CrossAgentInsights", () => {
  it("is a client component", () => {
    expect(SOURCE).toContain('"use client"');
  });
});
