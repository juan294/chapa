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
  /\b(ImpactV6Result|PublicImpactV6Result|ClientImpactV6Result|materializeProfile|materializeImpactState|materializeDisplayProfile|materializeOrchestratedProfile|materializeScoreReceiptV7|readScoreReceiptV7|receiptViewModel|legacyViewModel|renderableScore|ScoreViewModel|explainReceipt|simulateCoreScore|adjustedComposite|compositeScore|resolveScoreModel|scoreModelFrom|readRenderableReceipt|issueScoreReceipt|describeScoreForMetadata|PublicObservedScoringReceipt|ObservedReceiptSnapshot|observedReceiptViewModel|materializeObservedScoreReceipt|publicScoreProjection|comparePublicScores|simulateObservedScore|scoringObservation|dbReadObservedReceipt|resolvePostWriteScore|readObservedScoringHistory)\b/;
const SCAN_ROOTS = ["apps/web/app", "apps/web/components", "apps/web/lib", "scripts"];
const NOT_A_CONSUMER = /(\.test\.|\.spec\.|__fixtures__|\/test-helpers\/|\/__mocks__\/|\/e2e\/)/;

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
    // #1335 phase 5 ("delete v6") legitimately shrank this count: twelve rows
    // named a file that was deleted outright (dashboard's CoachingInsights/
    // ScoreBoldNumber/ScoreExplanationPanel/score-explanation.ts, the two
    // maintenance scripts, generate-insights.ts's own function) or a file
    // that no longer names a SCORED_SYMBOLS token (demoData.ts,
    // landing-demo-data.ts, the two experiments fixtures, ImpactBreakdown.tsx,
    // use-insights-import.ts).
    expect(registered.length).toBeGreaterThanOrEqual(60);
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

/**
 * #1335 phase 5.12 ("delete v6") — none of these seven retired v6 tokens may
 * reappear under `apps/web` or `packages/shared/src`: a revert, a merge, or a
 * new caller copying an old pattern must fail here instead of silently
 * resurrecting legacy scoring/rendering/persistence.
 *
 * Two carve-outs, both narrower than "every file":
 * - The 15 byte-digested v7.2 algorithm artifacts (CLAUDE.md goal #2) cannot
 *   change at all, so a token frozen inside one of them is not a violation.
 * - `ImpactV6Result` additionally survives in `packages/shared/src/types.ts`
 *   and `index.ts` only: the digested `scoring-evidence.ts` imports it for
 *   its archived `VersionedScoringRecord` union's `"v6"` branch, so the type
 *   itself must stay exported from a non-digested file for that digested one
 *   to keep compiling.
 * - Test/spec/fixture/mock files (the same `NOT_A_CONSUMER` shape used above)
 *   and this file itself are exempt: a regression test proves a token's
 *   *absence* by naming it (see `SCORED_SYMBOLS`, and the 410-retired-code
 *   tests for `/api/verify`, `/verify` and the MCP `verify_badge` tool),
 *   which needs the literal string. `scripts/` is out of scope entirely —
 *   `delete-user.ts` and `clone-prod-db.ts` still legitimately name
 *   `metrics_snapshots`/`verification_records` (real tables until the
 *   contract migration 058 drops them) and old `v6`-labelled Redis cache
 *   keys (real, if aging out, until their TTL expires).
 */
describe("retired v6 tokens do not reappear (#1335 phase 5.12)", () => {
  const RETIRED_TOKENS = [
    "computeImpactV6",
    "ImpactV6Result",
    "legacyViewModel",
    "metrics_snapshots",
    "verification_records",
    "machinePolicy",
    "scoring_v7_rendering",
    '"v6"',
  ] as const;

  // Digested artifacts (score-receipt-observed.test.ts enforces byte
  // identity with `develop`) — frozen, so a token inside one is not this
  // suite's concern.
  const DIGESTED_FILES = new Set([
    "apps/web/lib/impact/observed-v7.ts",
    "apps/web/lib/impact/v7.ts",
    "apps/web/lib/impact/v7-evidence.ts",
    "apps/web/lib/insights/report-craft.ts",
    "apps/web/lib/insights/report-craft-import.ts",
    "apps/web/lib/insights/report-craft-selection.ts",
    "packages/shared/src/scoring-observed.ts",
    "packages/shared/src/scoring-evidence.ts",
    "packages/shared/src/scoring-aggregation-v7.ts",
    "packages/shared/src/scoring-window.ts",
    "packages/shared/src/stats-schema.ts",
    "packages/shared/src/stats-aggregation.ts",
    "packages/shared/src/constants.ts",
    "packages/shared/src/canonical-json.ts",
    "packages/shared/src/score-receipt-observed.ts",
  ]);

  const TOKEN_EXTRA_ALLOWANCES: Partial<Record<(typeof RETIRED_TOKENS)[number], Set<string>>> = {
    ImpactV6Result: new Set(["packages/shared/src/types.ts", "packages/shared/src/index.ts"]),
  };

  const THIS_FILE = relative(repoRoot, __filename);
  const guardRoots = ["apps/web", "packages/shared/src"];

  function guardedSourceFiles(): string[] {
    return guardRoots
      .flatMap(root => sourceFiles(join(repoRoot, root)))
      .filter(path => path !== THIS_FILE)
      .sort();
  }

  /** Comments are where the retirement itself gets explained ("X is gone
   * along with metrics_snapshots") — that prose is the opposite of a
   * resurrection risk, so it is stripped before matching. A live query, an
   * import, or a discriminant value never lives only in a comment. */
  function stripComments(text: string): string {
    return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  }

  it.each(RETIRED_TOKENS)("does not appear outside its documented exceptions: %s", (token) => {
    const allowed = TOKEN_EXTRA_ALLOWANCES[token];
    const offenders = guardedSourceFiles().filter((path) => {
      if (DIGESTED_FILES.has(path)) return false;
      if (allowed?.has(path)) return false;
      return stripComments(readFileSync(join(repoRoot, path), "utf8")).includes(token);
    });
    expect(offenders).toEqual([]);
  });
});

/**
 * Publication consent is retired (#1335 phase 2): every registered subject is
 * collected and published without an opt-in. This fails if consent comes
 * back — accidentally reintroduced by a revert, a merge, or a new caller
 * copying an old pattern — the same way `sourceFiles`/`SCORED_SYMBOLS` above
 * catch a scored consumer going unregistered.
 */
describe("retired publication consent", () => {
  const RETIRED_CONSENT = /\b(publicConsent|public_evidence_consent|PublicationConsent|publicationAcknowledged)\b/;
  const allSourceFiles = () => sourceFiles(join(repoRoot, "apps/web"));

  it("appears nowhere under apps/web", () => {
    const hits = allSourceFiles().filter(path => RETIRED_CONSENT.test(readFileSync(join(repoRoot, path), "utf8")));
    expect(hits).toEqual([]);
  });
});

/** Membership does not establish correctness: run real outward projections
 * against sealed evidence and conflicting legacy fields in the same assertion. */
describe("scored-consumer value agreement", () => {
  it.each([57, 0] as const)("binds SVG, metadata, public data and history to the same receipt with Craft %s", async craft => {
    const { scoringConsistencyFixture } = await import("./__fixtures__/scoring-consistency");
    const { publicScoreProjection } = await import("./public-score-projection");
    const { scoringObservation } = await import("@/lib/history/scoring-observations");
    const { describeScoreForMetadata } = await import("./score-description");
    const { renderBadgeSvg } = await import("@/lib/render/BadgeSvg");
    for (const boundary of [false, true]) {
      const fixture = await scoringConsistencyFixture({ craft, boundary });
      const receipt = fixture.envelope.receipt;
      const data = publicScoreProjection(fixture.model);
      const observation = scoringObservation(fixture.model)!;
      const svg = renderBadgeSvg(fixture.stats, { scoring: fixture.model, disableAnimation: true });
      const expected = boundary ? 69.99 : 46;
      expect(receipt.core.composite.displayValue).toBe(expected);
      expect(data.displayScore).toBe(expected);
      expect(observation.composite.display).toBe(expected);
      expect(data.exactScore).toBe(receipt.core.composite.exact);
      expect(observation.composite.exact).toBe(receipt.core.composite.exact);
      expect(data.identity?.contentHash).toBe(fixture.envelope.contentHash.value);
      expect(observation.identity).toEqual(data.identity);
      expect(observation.window).toEqual(data.window);
      expect(data.policyVersion).toBe("v7.2");
      expect(data.dimensions.craft).toBe(craft);
      expect(observation.craft?.display).toBe(craft);
      expect(svg).toContain(`data-axis="craft" data-value="${craft}"`);
      expect(svg).toMatch(new RegExp(`data-element="score"[^>]*>${String(expected).replace(".", "\\.")}<`));
      expect(describeScoreForMetadata(fixture.model)).toContain(`${expected} (Solid tier)`);
      expect(data.archetype).toBe(receipt.core.archetype);
      expect(data.tier).toBe(receipt.core.tier);
      expect(data).not.toHaveProperty("confidence");
    }
  });
});
