import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BEGIN, DOC_PATH, END, workedFiguresTable } from "./generate-impact-v7-doc";

/**
 * The published methodology has to agree with the scorer, so its figures are
 * generated rather than transcribed. This test is what makes that checkable: it
 * fails when the committed table and a fresh generation disagree, which is the
 * only way a stale example gets noticed before a reader finds it.
 */
const repoRoot = resolve(__dirname, "../..");
const doc = readFileSync(join(repoRoot, DOC_PATH), "utf8");

describe("published v7 methodology figures", () => {
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
      "does not certify ability",
      "evidence-completion range",
      "not a statistical confidence interval",
      "never means all work a person has done",
      "never enters it",
    ]) {
      expect(flowed).toContain(claim);
    }
  });

  it("keeps v6 documented separately rather than rewriting it", () => {
    expect(flowed).toContain("impact-v6.md");
    expect(flowed).toContain("non-replayable legacy status");
  });
});
