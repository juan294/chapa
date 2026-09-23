import { beforeEach, describe, expect, it, vi } from "vitest";
import { createScoringWindow } from "@chapa/shared";
import { buildReceiptSnapshotV7 } from "@/lib/history/snapshot";
import { receiptFixtureV7 } from "@/lib/history/__fixtures__/receipts-v7";

vi.mock("@/lib/platform/source-collectors", () => ({ selectSourceEvidence: vi.fn() }));
vi.mock("@/lib/db/engineering-evidence", () => ({ dbReadEngineeringEvidence: vi.fn() }));
vi.mock("@/lib/db/craft-v7", () => ({ dbReadCraftV7: vi.fn() }));
vi.mock("@/lib/db/snapshots", () => ({ dbPublishReceiptV7: vi.fn(), dbReadReceiptV7: vi.fn() }));
vi.mock("@/lib/cache/snapshot-cache", () => ({ getCachedReceiptSnapshotV7: vi.fn() }));
vi.mock("@/lib/analytics/server-errors", () => ({ captureServerError: vi.fn() }));

import { selectSourceEvidence } from "@/lib/platform/source-collectors";
import { dbReadEngineeringEvidence } from "@/lib/db/engineering-evidence";
import { dbReadCraftV7 } from "@/lib/db/craft-v7";
import { dbPublishReceiptV7, dbReadReceiptV7 } from "@/lib/db/snapshots";
import { getCachedReceiptSnapshotV7 } from "@/lib/cache/snapshot-cache";
import { materializeScoreReceiptV7, readScoreReceiptV7, RECEIPT_SOURCE_PROVIDERS } from "./score-receipt-v7";

const referenceTime = "2026-09-01T12:00:00.000Z";
const ledgerSnapshot = {
  ownerId: "alice", claims: [], assessments: [], references: [],
};


const zero = { lower: 0, upper: 0 };
const zeroCriterion = { input: zero, cap: 8, clamped: zero, normalized: zero, multiplier: 25, weighted: zero };
/** The shape `dbReadCraftV7` returns for a consented subject with no eligible
 * episodes: a real trace, an explicit not_observed result. */
function emptyCraftPortfolio() {
  const window = createScoringWindow(referenceTime);
  return {
    inputs: { policyVersion: "v7", window, eligibleEpisodes: 0,
      counts: { framing: zero, verification_debugging: zero, tool_judgment: zero, accepted_outcome: zero },
      independentlyCorroboratedCompleteEpisodes: 0 },
    result: { status: "not_observed" },
    trace: { criteria: { framing: zeroCriterion, verification_debugging: zeroCriterion, tool_judgment: zeroCriterion, accepted_outcome: zeroCriterion },
      composite: zero, displayed: { status: "not_observed" } },
  } as never;
}

async function snapshot() {
  return buildReceiptSnapshotV7(await receiptFixtureV7("2026-09-01", 4), null);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(dbReadEngineeringEvidence).mockResolvedValue(ledgerSnapshot as never);
  vi.mocked(selectSourceEvidence).mockResolvedValue({ status: "unlinked" } as never);
  vi.mocked(dbReadCraftV7).mockRejectedValue(new Error("no portfolio"));
  vi.mocked(dbPublishReceiptV7).mockImplementation(async () => ({ status: "inserted", snapshot: await snapshot() }) as never);
});

describe("v7 receipt materialization", () => {
  it("captures one reference time and threads it through window, sources and receipt", async () => {
    const result = await materializeScoreReceiptV7("Alice", { referenceTime });

    expect(result.status).toBe("issued");
    expect(selectSourceEvidence).toHaveBeenCalledTimes(RECEIPT_SOURCE_PROVIDERS.length);
    for (const call of vi.mocked(selectSourceEvidence).mock.calls) {
      expect(call[0]!.owner).toBe("alice");
      expect(call[0]!.window.referenceTime).toBe(referenceTime);
    }
    expect(vi.mocked(dbReadEngineeringEvidence).mock.calls[0]).toEqual(["alice", "alice", expect.objectContaining({ referenceTime })]);
    const [, , envelope] = vi.mocked(dbPublishReceiptV7).mock.calls[0]!;
    expect(envelope.receipt.window.referenceTime).toBe(referenceTime);
    expect(envelope.receipt.recordedAt).toBe(referenceTime);
  });

  it("discloses an unconnected provider as an exclusion instead of dropping it", async () => {
    await materializeScoreReceiptV7("alice", { referenceTime });

    const [, , envelope] = vi.mocked(dbPublishReceiptV7).mock.calls[0]!;
    expect(envelope.receipt.exclusions).toEqual(
      RECEIPT_SOURCE_PROVIDERS.map(provider => ({ provider, reason: "not_connected" })),
    );
    // The registered evidence ledger is itself a declared source in scope.
    expect(envelope.receipt.coverage).toEqual([
      expect.objectContaining({ provider: "portfolio", discovery: "registered_ledger" }),
    ]);
  });

  it("keeps a connected but unreadable source in scope as unavailable coverage", async () => {
    vi.mocked(selectSourceEvidence).mockImplementation(async input =>
      (input.provider === "github" ? { status: "unavailable" } : { status: "unlinked" }) as never);

    await materializeScoreReceiptV7("alice", { referenceTime });

    const [, , envelope] = vi.mocked(dbPublishReceiptV7).mock.calls[0]!;
    expect(envelope.receipt.coverage).toEqual([
      expect.objectContaining({ provider: "github", status: "unavailable", repositoryDiscoveryComplete: false, reasonCodes: ["not_accessible"] }),
      expect.objectContaining({ provider: "portfolio" }),
    ]);
    expect(envelope.receipt.exclusions.map(row => row.provider)).not.toContain("github");
  });

  it("marks a served stale observation as stale coverage", async () => {
    vi.mocked(selectSourceEvidence).mockImplementation(async input =>
      (input.provider === "github"
        ? { status: "stale", observation: {
            window: input.window, events: [],
            coverage: { source: { provider: "github", host: "github.com", subjectId: "alice" }, window: input.window,
              dataThrough: "2026-08-20T00:00:00.000Z", status: "complete", discovery: "owned_and_contributed",
              repositoryIds: [], repositoryDiscoveryComplete: true, eventKinds: {}, reasonCodes: [], unknownPeriods: [] } } }
        : { status: "unlinked" }) as never);

    await materializeScoreReceiptV7("alice", { referenceTime });

    const [, , envelope] = vi.mocked(dbPublishReceiptV7).mock.calls[0]!;
    expect(envelope.receipt.coverage[0]).toEqual(expect.objectContaining({ provider: "github", status: "stale", reasonCodes: ["stale_data"] }));
  });

  it("does not let a missing Craft portfolio change the core", async () => {
    await materializeScoreReceiptV7("alice", { referenceTime });
    const [, , withoutCraft] = vi.mocked(dbPublishReceiptV7).mock.calls[0]!;

    expect(withoutCraft.receipt.craft).toBeNull();
    expect(withoutCraft.receipt.core.composite).toEqual({ kind: "point", value: 0, displayValue: 0 });
  });

  it("reads durable evidence and publishes nothing on a read-only call", async () => {
    const stored = await snapshot();
    vi.mocked(getCachedReceiptSnapshotV7).mockResolvedValue(stored);

    expect(await materializeScoreReceiptV7("alice", { referenceTime, readOnly: true })).toEqual({ status: "stored", snapshot: stored });
    expect(selectSourceEvidence).not.toHaveBeenCalled();
    expect(dbReadEngineeringEvidence).not.toHaveBeenCalled();
    expect(dbPublishReceiptV7).not.toHaveBeenCalled();
  });

  it("reports an explicit miss rather than inventing a read-only result", async () => {
    vi.mocked(getCachedReceiptSnapshotV7).mockResolvedValue(null);
    vi.mocked(dbReadReceiptV7).mockResolvedValue(null);

    expect(await materializeScoreReceiptV7("alice", { referenceTime, readOnly: true })).toEqual({ status: "unavailable", reason: "no_receipt" });
  });

  it("falls back to durable storage when the receipt cache is unavailable", async () => {
    const stored = await snapshot();
    vi.mocked(getCachedReceiptSnapshotV7).mockRejectedValue(new Error("redis down"));
    vi.mocked(dbReadReceiptV7).mockResolvedValue(stored);

    expect(await readScoreReceiptV7("Alice")).toBe(stored);
    expect(vi.mocked(dbReadReceiptV7).mock.calls[0]![0]).toBe("alice");
  });

  it("reports a storage failure instead of an unpublished score", async () => {
    vi.mocked(dbPublishReceiptV7).mockRejectedValue(new Error("supabase down"));

    expect(await materializeScoreReceiptV7("alice", { referenceTime })).toEqual({ status: "unavailable", reason: "storage_error" });
  });

  // The core denominator is four fixed dimensions at 0.25 each. Nothing an
  // upload or a source error does may change that, or quietly drop the unknown
  // flags that make incomplete coverage visible.
  it("keeps the core denominator and unknown flags fixed when Craft is present", async () => {
    vi.mocked(dbReadCraftV7).mockResolvedValue(emptyCraftPortfolio());

    await materializeScoreReceiptV7("alice", { referenceTime });
    const [, , withCraft] = vi.mocked(dbPublishReceiptV7).mock.calls[0]!;

    vi.mocked(dbPublishReceiptV7).mockClear();
    vi.mocked(dbReadCraftV7).mockRejectedValue(new Error("no portfolio"));
    await materializeScoreReceiptV7("alice", { referenceTime });
    const [, , withoutCraft] = vi.mocked(dbPublishReceiptV7).mock.calls[0]!;

    expect(withCraft.receipt.core).toEqual(withoutCraft.receipt.core);
    expect(withCraft.receipt.inputs).toEqual(withoutCraft.receipt.inputs);
    expect(withCraft.receipt.limitations).toEqual(withoutCraft.receipt.limitations);
  });

  it("retains the unknown flags a source error produces", async () => {
    vi.mocked(selectSourceEvidence).mockResolvedValue({ status: "unavailable" } as never);

    await materializeScoreReceiptV7("alice", { referenceTime });
    const [, , envelope] = vi.mocked(dbPublishReceiptV7).mock.calls[0]!;

    const unreadable = envelope.receipt.coverage.filter(row => row.status === "unavailable");
    expect(unreadable).toHaveLength(RECEIPT_SOURCE_PROVIDERS.length);
    for (const row of unreadable) {
      expect(row.reasonCodes).toContain("not_accessible");
      expect(row.unknownPeriods).toHaveLength(1);
      expect(row.repositoryDiscoveryComplete).toBe(false);
    }
  });

  it("drops an unusable Craft channel instead of losing the whole receipt", async () => {
    vi.mocked(dbReadCraftV7).mockResolvedValue({ ...(emptyCraftPortfolio() as object), trace: null } as never);

    const result = await materializeScoreReceiptV7("alice", { referenceTime });

    expect(result.status).toBe("issued");
    const [, , envelope] = vi.mocked(dbPublishReceiptV7).mock.calls[0]!;
    expect(envelope.receipt.craft).toBeNull();
    expect(envelope.receipt.calculation.craft).toBeNull();
  });

  // A truthfully empty profile is a real result, not a failure to publish.
  it("issues and persists a receipt for a legitimate zero profile", async () => {
    const result = await materializeScoreReceiptV7("alice", { referenceTime });

    expect(result.status).toBe("issued");
    const [, , envelope] = vi.mocked(dbPublishReceiptV7).mock.calls[0]!;
    expect(envelope.receipt.core.composite).toEqual({ kind: "point", value: 0, displayValue: 0 });
    expect(envelope.receipt.criteria).toEqual([]);
    expect(envelope.contentHash.value).toMatch(/^[0-9a-f]{64}$/);
  });

  // The public receipt is the visitor projection: structured verdicts only.
  it("publishes no private rationale, path or evaluator identity", async () => {
    await materializeScoreReceiptV7("alice", { referenceTime });
    const [, , envelope] = vi.mocked(dbPublishReceiptV7).mock.calls[0]!;

    const serialized = JSON.stringify(envelope.receipt);
    // "rationale" is a public criterion NAME; the private fields below are
    // what must never reach an issued receipt.
    expect(serialized).not.toContain("evaluator");
    expect(serialized).not.toContain("artifactUri");
    for (const row of envelope.receipt.criteria) {
      expect(Object.keys(row).sort()).toEqual(
        ["criterion", "provenance", "qualifyingCount", "reasonCode", "rubricVersion", "status", "workItemRef"],
      );
    }
  });
});

/**
 * #1311 — revisions are a chain, and re-scoring unchanged evidence is not a
 * revision at all.
 *
 * Before this, every call minted `revision: 1` with no supersedes link and its
 * own verification token. Once the hourly warm-cache cron began calling this,
 * that was roughly 24 unrelated root receipts per consented subject per day,
 * each claiming to be the first.
 */
describe("revision identity", () => {
  it("supersedes the stored revision instead of minting a second root", async () => {
    const stored = buildReceiptSnapshotV7(await receiptFixtureV7("2026-09-01", 4), null);
    vi.mocked(dbReadReceiptV7).mockResolvedValue(stored);
    // Different evidence than the stored receipt, so a new revision is due.
    vi.mocked(dbReadCraftV7).mockResolvedValue(emptyCraftPortfolio());

    await materializeScoreReceiptV7("alice", { referenceTime });

    const [, , envelope] = vi.mocked(dbPublishReceiptV7).mock.calls[0]!;
    const issued = (envelope as unknown as { receipt: Record<string, unknown> }).receipt;
    const prior = stored.receipt.receipt;
    expect(issued.receiptId).toBe(prior.receiptId);
    expect(issued.revision).toBe(prior.revision + 1);
    expect(issued.supersedesRevisionId).toBe(prior.revisionId);
    expect(issued.action).toBe("correct");
  });

  it("issues nothing when the same evidence is scored again in the same window", async () => {
    // The mocked ledger has no events and no connected source, so the
    // materializer computes zero counts — the stored receipt must carry the
    // same ones for this to be a re-score rather than a real change.
    const stored = buildReceiptSnapshotV7(await receiptFixtureV7("2026-09-01", 0), null);
    vi.mocked(dbReadReceiptV7).mockResolvedValue(stored);
    vi.mocked(dbReadCraftV7).mockRejectedValue(new Error("no portfolio"));

    const result = await materializeScoreReceiptV7("alice", { referenceTime });

    expect(dbPublishReceiptV7).not.toHaveBeenCalled();
    expect(result.status).toBe("stored");
  });
});

/**
 * #1311 — a clean `null` from the cached path is an answer, not a miss.
 *
 * The cached path consults the receipt manifest first and already falls back
 * to the durable read on a cache miss, so repeating that read spent a second
 * RPC to be told the same thing — on every badge cache miss, for the handles
 * that have no receipt, which is nearly all of them.
 */
describe("the durable store is the authority on issuance", () => {
  it("still reads durably when the cached path returns nothing", async () => {
    // The manifest the cached path resolves through can be absent while the
    // receipt is durably stored; the contract suite against real persistence
    // is what established that, after an optimization assumed otherwise.
    vi.mocked(getCachedReceiptSnapshotV7).mockResolvedValue(null);
    const stored = buildReceiptSnapshotV7(await receiptFixtureV7("2026-09-01", 4), null);
    vi.mocked(dbReadReceiptV7).mockResolvedValue(stored);

    expect(await readScoreReceiptV7("alice")).toBe(stored);
  });

  it("still falls back when the cached path fails outright", async () => {
    vi.mocked(getCachedReceiptSnapshotV7).mockRejectedValue(new Error("redis down"));
    const stored = buildReceiptSnapshotV7(await receiptFixtureV7("2026-09-01", 4), null);
    vi.mocked(dbReadReceiptV7).mockResolvedValue(stored);

    expect(await readScoreReceiptV7("alice")).toBe(stored);
  });
});
