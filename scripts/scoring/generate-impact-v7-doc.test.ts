import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BEGIN, DOC_PATH, END, workedFiguresTable } from "./generate-impact-v7-doc";

/**
 * Archived v7/v7.1 figures remain bound to their unchanged historical scorer.
 * Current v7.2 methodology is documented separately from that generated block.
 */
const repoRoot = resolve(__dirname, "../..");
const doc = readFileSync(join(repoRoot, DOC_PATH), "utf8");

describe("archived v7 methodology figures and current policy scope", () => {
  it("matches a fresh generation from the scorer", () => {
    const start = doc.indexOf(BEGIN);
    const finish = doc.indexOf(END);
    expect(start).toBeGreaterThan(-1);
    expect(finish).toBeGreaterThan(start);

    expect(doc.slice(start, finish + END.length)).toBe(workedFiguresTable());
  });

  // Prose wraps, so compare against the text with its line breaks collapsed.
  const flowed = doc.replace(/\s+/g, " ");

  it("states the limits the numbers do not carry", () => {
    for (const claim of [
      "does not certify developer ability",
      "recorded evidence in a declared source scope",
      "not percentiles or externally validated mastery thresholds",
      "Missing or inaccessible evidence does not receive estimated credit",
      "Craft, confidence, recency and solo/collaborative switches never enter this average",
      "local conformance tests do not constitute that pilot",
    ]) {
      expect(flowed).toContain(claim);
    }
  });

  it("keeps v6 documented separately rather than rewriting it", () => {
    expect(flowed).toContain("impact-v6.md");
    expect(flowed).toContain("is retired: its scoring code and stored data no longer");
    expect(flowed).toContain("original immutable receipts, range arithmetic and replay");
    expect(flowed).toContain("archived range policy, not current v7.2");
  });
});
