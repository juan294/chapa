import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The scored-consumer inventory is a contract, not a comment.
 *
 * `docs/scoring-consumer-inventory.md` lists every file that reads a score and
 * the regression that covers it. This suite enforces it in both directions, so
 * a new consumer cannot ship unregistered and a stale row cannot survive a
 * rename. It is the same mechanism `site-tool-map.test.ts` uses for WebMCP, for
 * the same reason: the published description of a surface goes stale the moment
 * nothing checks it.
 */
const repoRoot = resolve(__dirname, "../../../..");
const INVENTORY = "docs/scoring-consumer-inventory.md";

/** A file reads a score if it names one of these. Deliberately broad: a false
 * positive costs one inventory row, a false negative costs a silent second
 * answer somewhere in the product.
 *
 * The v7 cutover (#1311) added the last five: a surface can now reach a score
 * through the resolver or the metadata description without ever naming an
 * `Impact*` type, and the share page did exactly that — it stopped matching
 * this pattern the moment its JSON-LD switched from `adjustedComposite` to the
 * shared model, while still very much publishing a score. */
const SCORED_SYMBOLS =
  /\b(ImpactV6Result|PublicImpactV6Result|ClientImpactV6Result|materializeProfile|materializeImpactState|materializeDisplayProfile|materializeOrchestratedProfile|materializeScoreReceiptV7|readScoreReceiptV7|receiptViewModel|legacyViewModel|renderableScore|ScoreViewModel|explainReceipt|simulateCoreScore|adjustedComposite|compositeScore|resolveScoreModel|scoreModelFrom|readRenderableReceipt|issueScoreReceiptIfConsented|describeScoreForMetadata)\b/;
const SCAN_ROOTS = ["apps/web/app", "apps/web/components", "apps/web/lib", "scripts"];
const NOT_A_CONSUMER = /(\.test\.|\.spec\.|__fixtures__|\/test-helpers\/|\/__mocks__\/)/;

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry !== "node_modules") sourceFiles(path, found);
      continue;
    }
    if (/\.(ts|tsx)$/.test(path) && !NOT_A_CONSUMER.test(path)) found.push(relative(repoRoot, path));
  }
  return found;
}

const inventory = readFileSync(join(repoRoot, INVENTORY), "utf8");
const registered = [...inventory.matchAll(/^\| `([^`]+)` \| `([^`]+)` \|$/gm)].map(match => ({
  consumer: match[1]!,
  regression: match[2]!,
}));
const scanned = SCAN_ROOTS.flatMap(root => sourceFiles(join(repoRoot, root)))
  .filter(path => SCORED_SYMBOLS.test(readFileSync(join(repoRoot, path), "utf8")))
  .sort();

describe("scored-consumer inventory", () => {
  it("registers at least the consumers that existed when the contract was written", () => {
    expect(registered.length).toBeGreaterThanOrEqual(62);
  });

  it("names no consumer twice", () => {
    expect([...new Set(registered.map(row => row.consumer))]).toHaveLength(registered.length);
  });

  it("points every row at a file that exists", () => {
    const missing = registered.filter(row => !existsInRepo(row.consumer));
    expect(missing.map(row => row.consumer)).toEqual([]);
  });

  it("points every row at a regression that exists", () => {
    const missing = registered.filter(row => !existsInRepo(row.regression));
    expect(missing.map(row => `${row.consumer} -> ${row.regression}`)).toEqual([]);
  });

  it("registers every file that reads a score", () => {
    const known = new Set(registered.map(row => row.consumer));
    expect(scanned.filter(path => !known.has(path))).toEqual([]);
  });

  it("keeps no row for a file that no longer reads a score", () => {
    const live = new Set(scanned);
    expect(registered.map(row => row.consumer).filter(path => !live.has(path))).toEqual([]);
  });

  it("states the one-projection contract the rows depend on", () => {
    expect(inventory).toContain("apps/web/lib/profile/score-view-model.ts");
    expect(inventory).toContain("apps/web/lib/profile/score-receipt-v7.ts");
    expect(inventory).toContain("apps/web/lib/impact/simulate.ts");
  });
});

function existsInRepo(path: string): boolean {
  try {
    return statSync(join(repoRoot, path)).isFile();
  } catch {
    return false;
  }
}
