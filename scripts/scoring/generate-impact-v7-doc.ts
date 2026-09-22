/**
 * Regenerate the worked-figures table in `docs/impact-v7.md`.
 *
 * The prose in that document is written by hand; the numbers are not. Running
 * this script replaces the block between the two markers with figures produced
 * by `calculateCoreV7`, so a published example cannot drift from the scorer.
 *
 *   pnpm exec tsx scripts/scoring/generate-impact-v7-doc.ts
 *
 * `scripts/scoring/generate-impact-v7-doc.test.ts` fails if the committed table and a fresh
 * generation disagree, which is what makes this checkable rather than a
 * convention.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { workedExampleDisplay, workedExamples, WORKED_EXAMPLE_REFERENCE } from "../../apps/web/lib/impact/worked-examples";

export const DOC_PATH = "docs/impact-v7.md";
export const BEGIN = "<!-- worked-figures:begin -->";
export const END = "<!-- worked-figures:end -->";

const LABEL: Record<string, string> = {
  complete: "Complete evidence",
  partial: "One source incomplete",
  zero: "No observed evidence",
};

export function workedFiguresTable(): string {
  const rows = workedExamples().map(example => {
    const shown = workedExampleDisplay(example);
    return `| ${LABEL[shown.id]} | ${shown.delivery} | ${shown.quality} | ${shown.consistency} | ${shown.breadth} | ${shown.composite} | ${shown.tier ?? "none"} | ${shown.archetype ?? "none"} |`;
  });
  return [
    BEGIN,
    `Generated from \`calculateCoreV7\` at reference time \`${WORKED_EXAMPLE_REFERENCE}\`.`,
    "",
    "| Case | Delivery | Quality | Consistency | Breadth | Core | Tier | Archetype |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
    END,
  ].join("\n");
}

export function renderDoc(current: string): string {
  const start = current.indexOf(BEGIN);
  const finish = current.indexOf(END);
  if (start === -1 || finish === -1) throw new Error(`Missing worked-figure markers in ${DOC_PATH}`);
  return current.slice(0, start) + workedFiguresTable() + current.slice(finish + END.length);
}

if (process.argv[1]?.endsWith("generate-impact-v7-doc.ts")) {
  writeFileSync(DOC_PATH, renderDoc(readFileSync(DOC_PATH, "utf8")));
  process.stdout.write(`Updated worked figures in ${DOC_PATH}\n`);
}
