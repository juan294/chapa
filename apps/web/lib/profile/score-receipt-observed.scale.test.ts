import { performance } from "node:perf_hooks";
import { writeFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { projectReceiptEvidence, type EngineeringEvidenceInput, type HashedObservedScoreReceipt,
  type NormalizedEngineeringEvent } from "@chapa/shared";
import { syntheticCollectionEvents, syntheticCollectionSource, SYNTHETIC_COLLECTION_WINDOW } from "@/lib/db/synthetic-collection-fixture";
import { projectEngineeringLedger } from "@/lib/evidence/projection";
import { computeObservedImpactV7 } from "@/lib/impact/observed-v7";
import { canonicalizeReceiptEvidence, observedSemanticIdentity, receiptSemanticIdentity } from "./receipt-semantic-identity";

vi.mock("@/lib/platform/source-collectors", () => ({ selectSourceEvidence: vi.fn(), selectSourceManifest: vi.fn() }));
vi.mock("@/lib/db/engineering-evidence", () => ({ dbReadEngineeringEvidence: vi.fn() }));
vi.mock("@/lib/db/score-receipts-observed", () => ({ dbReadObservedReceipt: vi.fn(), dbPublishObservedReceipt: vi.fn() }));
vi.mock("@/lib/analytics/server-errors", () => ({ captureServerError: vi.fn() }));
import { selectSourceManifest } from "@/lib/platform/source-collectors";
import { dbReadEngineeringEvidence } from "@/lib/db/engineering-evidence";
import { dbReadObservedReceipt, dbPublishObservedReceipt } from "@/lib/db/score-receipts-observed";
import { materializeObservedScoreReceipt } from "./score-receipt-observed";

const window = SYNTHETIC_COLLECTION_WINDOW;
const referenceTime = window.referenceTime;
const source = { ...syntheticCollectionSource(294), provider: "github" as const };
const ledger = { ownerId: "alice", claims: [], assessments: [], references: [] };
const craft = { status: "no_report" as const, unlocked: false as const, report: null };
/** Retains the Phase 1 fixture's mix and roughly 1.7 KB event bodies, while
 * generating only one 500-event page at a time for the measured issuance. */
function page(offset: number, size: number): NormalizedEngineeringEvent[] {
  const suffix = `-batch-${Math.floor(offset / 500)}`;
  return syntheticCollectionEvents({ count: size, seed: 294, window }).map(row => ({
    ...row, eventId: `${row.eventId}${suffix}`, workItemId: `${row.workItemId}${suffix}`,
    artifactRevision: `${row.artifactRevision}${suffix}`,
    artifactReferenceIds: row.artifactReferenceIds.map(reference => `${reference}${suffix}`),
    categories: row.categories.map(category => ({ ...category,
      evidenceReferenceIds: category.evidenceReferenceIds.map(reference => `${reference}${suffix}`) })),
    acceptance: row.acceptance.status === "observed"
      ? { ...row.acceptance, value: { ...row.acceptance.value, acceptedResultId: `${row.acceptance.value.acceptedResultId}${suffix}` } }
      : row.acceptance,
  }));
}

function fixture(count: number) {
  const coverage = { source, window, dataThrough: referenceTime, status: "complete" as const,
    discovery: "owned_and_contributed" as const,
    repositoryIds: Array.from({ length: 24 }, (_, index) => `synthetic-repo-${index}`),
    repositoryDiscoveryComplete: true,
    eventKinds: { accepted_change: "complete" as const, authored_commit: "complete" as const, review: "complete" as const },
    reasonCodes: [], unknownPeriods: [] };
  const manifest = { id: "11111111-1111-4111-8111-111111111111", window, coverage,
    storageMode: "rows" as const, eventCount: count,
    eventGenerationId: "22222222-2222-4222-8222-222222222222", eventKeysSha256: "0".repeat(64) };
  let yielded = 0;
  let completed = false;
  let authorizationChecks = 0;
  const pages = async function* () {
    for (let offset = 0; offset < count; offset += 500) {
      const batch = page(offset, Math.min(500, count - offset));
      yielded += batch.length;
      yield batch;
    }
    completed = true;
  };
  const assertCurrent = async () => { authorizationChecks++; };
  return { manifest, pages, assertCurrent, stats: () => ({ yielded, completed, authorizationChecks }) };
}

async function issue(count: number) {
  vi.clearAllMocks();
  const selected = fixture(count);
  let published: { envelope: HashedObservedScoreReceipt; semanticDigest: string; coreSemanticDigest: string | null } | null = null;
  vi.mocked(dbReadEngineeringEvidence).mockResolvedValue(ledger);
  vi.mocked(dbReadObservedReceipt).mockResolvedValue({ status: "missing" });
  vi.mocked(selectSourceManifest).mockImplementation(async input => input.provider === "github"
    ? { status: "observed", manifest: selected.manifest, pages: selected.pages,
        assertCurrent: selected.assertCurrent, inProgress: false }
    : { status: "unlinked" });
  vi.mocked(dbPublishObservedReceipt).mockImplementation(async (_owner, _actor, envelope, semanticDigest, coreSemanticDigest) => {
    peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
    expect(selected.stats()).toEqual({ yielded: count, completed: true, authorizationChecks: 1 });
    published = { envelope, semanticDigest, coreSemanticDigest: coreSemanticDigest ?? null };
    return { status: "inserted", ...published, trend: null, isCurrent: true };
  });
  const baselineRssBytes = process.memoryUsage().rss;
  let peakRssBytes = baselineRssBytes;
  const sample = setInterval(() => { peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss); }, 50);
  const start = performance.now();
  let result: Awaited<ReturnType<typeof materializeObservedScoreReceipt>>;
  try {
    result = await materializeObservedScoreReceipt("alice", { referenceTime, readCraft: async () => craft });
  } finally {
    clearInterval(sample);
    peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
  }
  const wallMs = Math.round(performance.now() - start);
  const measurement = { count, wallMs, baselineRssBytes, peakRssBytes, rssGrowthBytes: peakRssBytes - baselineRssBytes,
    ...selected.stats(), status: result.status };
  console.info(`observed-materializer-scale ${JSON.stringify(measurement)}`);
  if (process.env.SCORING_MATERIALIZER_BENCHMARK_OUTPUT) {
    await writeFile(process.env.SCORING_MATERIALIZER_BENCHMARK_OUTPUT, `${JSON.stringify(measurement, null, 2)}\n`, { mode: 0o600 });
  }
  expect(result.status).toBe("issued");
  expect(published).not.toBeNull();
  expect(dbPublishObservedReceipt).toHaveBeenCalledTimes(1);
  return { published: published!, measurement, coverage: selected.manifest.coverage };
}

const scale = process.env.SCORING_RUN_SCALE_CONTRACT === "1" ? describe : describe.skip;
scale("synthetic full observed materialization (opt in)", () => {
  it("matches the legacy public receipt and private digest at 17,572 events", async () => {
    const issued = await issue(17_572);
    const projectedLedger = projectEngineeringLedger(ledger, window);
    const legacyInput: EngineeringEvidenceInput = canonicalizeReceiptEvidence({ schemaVersion: "v7", window,
      scope: { sources: [issued.coverage, ...projectedLedger.scope.sources],
        excludedSources: [{ provider: "gitlab", reason: "not_connected" }, { provider: "bitbucket", reason: "not_connected" }, { provider: "codeberg", reason: "not_connected" }],
        ledgerRevisionIds: projectedLedger.scope.ledgerRevisionIds },
      events: [...Array.from({ length: Math.ceil(17_572 / 500) }, (_, batch) =>
        page(batch * 500, Math.min(500, 17_572 - batch * 500))).flat(), ...projectedLedger.events],
      repositoryAliases: projectedLedger.repositoryAliases, equivalentWorkItems: projectedLedger.equivalentWorkItems,
      assessments: projectedLedger.assessments });
    const legacy = computeObservedImpactV7(legacyInput);
    const receipt = issued.published.envelope.receipt;
    expect(receipt.inputs).toEqual(legacy.inputs);
    expect(receipt.core).toEqual(legacy.core);
    expect(receipt.calculation.core).toEqual(legacy.trace);
    expect(receipt.limitations).toEqual([...legacy.limitations].sort());
    const expectedPublic = projectReceiptEvidence(legacyInput.scope, []);
    expect({ coverage: receipt.coverage, exclusions: receipt.exclusions }).toEqual({ coverage: expectedPublic.coverage, exclusions: expectedPublic.exclusions });
    const expectedCoreDigest = await receiptSemanticIdentity({ ...receipt, craft }, legacyInput, ledger);
    expect(issued.published.coreSemanticDigest).toBe(expectedCoreDigest);
    expect(issued.published.semanticDigest).toBe(await observedSemanticIdentity(expectedCoreDigest, craft));
  }, 900_000);

  it("measures full 100,000-event materialization through mocked publication", async () => {
    const issued = await issue(100_000);
    expect(issued.measurement.yielded).toBe(100_000);
    expect(issued.measurement.completed).toBe(true);
    expect(issued.measurement.authorizationChecks).toBe(1);
    expect(issued.published.coreSemanticDigest).toMatch(/^[a-f0-9]{64}$/);
  }, 900_000);
});
