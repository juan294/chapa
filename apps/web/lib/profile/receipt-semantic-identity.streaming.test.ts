import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createScoringWindow, mergeEngineeringEvidence, type EngineeringEvidenceInput, type NormalizedEngineeringEvent, type PublicObservedScoringReceipt } from "@chapa/shared";
import { sourceEventFixture } from "../db/source-context-fixture";
import { beginCanonicalReceiptEvidenceSpool, receiptSemanticIdentity } from "./receipt-semantic-identity";

const time = "2026-09-08T10:00:00.000Z";
const window = createScoringWindow(time);
const source = { provider: "github" as const, host: "github.com", subjectId: "canonical-node" };

function receipt(referenceTime = time): PublicObservedScoringReceipt {
  const scoringWindow = createScoringWindow(referenceTime);
  return {
    schemaVersion: "v7", policyVersion: "v7.2", receiptId: randomUUID(),
    revisionId: randomUUID(), revision: 2, supersedesRevisionId: randomUUID(),
    action: "correct", recordedAt: referenceTime, window: scoringWindow,
    inputs: { window: scoringWindow, counts: { delivery: 3 } },
    core: { exact: 30 }, craft: { status: "no_report" },
    algorithm: { revision: "v7.2", digest: "pinned" },
    calculation: { rules: { tieOrder: ["b", "a"] }, core: { scalar: 0.3 } },
    coverage: [{ sourceRef: "source-1", provider: "portfolio", discovery: "registered_ledger", dataThrough: referenceTime }],
    criteria: [], exclusions: [], limitations: [],
  } as unknown as PublicObservedScoringReceipt;
}
function events(count: number): NormalizedEngineeringEvent[] {
  const base = sourceEventFixture(source, window);
  return Array.from({ length: count }, (_, index) => ({
    ...base, eventId: `event-${index}`,
    artifactReferenceIds: index % 2 ? ["z", "a", "z"] : ["a", "z"],
    categories: index % 2
      ? [{ category: "verification_review" as const, evidenceReferenceIds: ["z", "a"] },
        { category: "implementation" as const, evidenceReferenceIds: ["b", "a"] }]
      : [{ category: "implementation" as const, evidenceReferenceIds: ["a", "b"] }],
  }));
}
function evidence(rows: readonly NormalizedEngineeringEvent[]): EngineeringEvidenceInput {
  return {
    schemaVersion: "v7", window,
    scope: { sources: [], excludedSources: [], ledgerRevisionIds: ["b", "a", "b"] },
    events: rows, assessments: [], repositoryAliases: [], equivalentWorkItems: [],
  };
}
function metadata(input: EngineeringEvidenceInput): Omit<EngineeringEvidenceInput, "events"> {
  const { events: _events, ...rest } = input;
  void _events;
  return rest;
}

async function digestFromPages(
  selectedReceipt: PublicObservedScoringReceipt,
  input: EngineeringEvidenceInput,
  pages: readonly (readonly NormalizedEngineeringEvent[])[],
  ledger: unknown = null,
) {
  const spool = await beginCanonicalReceiptEvidenceSpool();
  try {
    for (const page of pages) await spool.addPage(page);
    const chunks: string[] = [];
    for await (const chunk of spool.canonicalChunks(selectedReceipt, metadata(input), ledger)) chunks.push(chunk);
    return { bytes: chunks.join(""), digest: await spool.digest(selectedReceipt, metadata(input), ledger) };
  } finally {
    await spool.dispose();
  }
}

describe("streamed private receipt identity", () => {
  it("emits byte-identical canonical JSON to the legacy WebCrypto input", async () => {
    const selectedReceipt = receipt();
    const rows = events(7);
    const input = evidence(rows);
    const ledger = { revisions: ["b", "a", "b"], recordedAt: time };
    const originalDigest = globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle);
    let legacyBytes: string | null = null;
    const digestSpy = vi.spyOn(globalThis.crypto.subtle, "digest").mockImplementation(async (algorithm, data) => {
      legacyBytes = Buffer.from(data as ArrayBuffer).toString("utf8");
      return originalDigest(algorithm, data);
    });
    let legacy: string;
    try {
      legacy = await receiptSemanticIdentity(selectedReceipt, input, ledger);
    } finally {
      digestSpy.mockRestore();
    }
    expect(legacyBytes).not.toBeNull();
    const streamed = await digestFromPages(selectedReceipt, input, [rows.slice(0, 2), rows.slice(2)], ledger);
    expect(streamed.bytes).toBe(legacyBytes);
    expect(streamed.digest).toBe(legacy);
  });

  it("preserves digest across page sizes, event order, nested sets, and duplicate layouts", async () => {
    const selectedReceipt = receipt();
    const original = events(1_001);
    const input = evidence(original);
    const expected = await receiptSemanticIdentity(selectedReceipt, input);
    for (const size of [1, 17, 500, 1_001]) {
      const shuffled = [...original].reverse();
      const withDuplicates = [...shuffled.slice(0, 50), ...shuffled, ...shuffled.slice(-50)];
      const pages = Array.from({ length: Math.ceil(withDuplicates.length / size) }, (_, index) =>
        withDuplicates.slice(index * size, (index + 1) * size));
      expect((await digestFromPages(selectedReceipt, input, pages)).digest).toBe(expected);
    }
  }, 120_000);

  it("deduplicates before synthetic-ledger reference normalization", async () => {
    const selectedReceipt = receipt();
    const first = { ...events(1)[0]!, provider: "portfolio" as const, host: "ledger.chapa", dataThrough: time };
    const second = { ...first, dataThrough: "2026-09-08T09:00:00.000Z" };
    const input = evidence([first, second] as NormalizedEngineeringEvent[]);
    const expected = await receiptSemanticIdentity(selectedReceipt, input);
    expect((await digestFromPages(selectedReceipt, input, [[second], [first]])).digest).toBe(expected);
  });

  it("streams scorer events in the legacy raw full-value order", async () => {
    const first = events(1)[0]!;
    const second = { ...first, dataThrough: "2026-09-08T09:00:00.000Z" };
    const third = { ...first, dataThrough: "2026-09-08T11:00:00.000Z" };
    const raw = [third, first, second, first];
    const spool = await beginCanonicalReceiptEvidenceSpool();
    try {
      await spool.addPage(raw.slice(0, 2));
      await spool.addPage(raw.slice(2));
      const actual: NormalizedEngineeringEvent[] = [];
      for await (const event of spool.scorerSortedEvents()) actual.push(event);
      expect(actual).toEqual(mergeEngineeringEvidence(evidence(raw)).events);
    } finally {
      await spool.dispose();
    }
  });

  it("preserves scorer and digest parity through a multi-pass run merge", async () => {
    const selectedReceipt = receipt();
    const raw = events(1_001).reverse();
    const input = evidence(raw);
    const expected = await receiptSemanticIdentity(selectedReceipt, input);
    const spool = await beginCanonicalReceiptEvidenceSpool({ runBytes: 8 * 1_024 });
    try {
      for (let offset = 0; offset < raw.length; offset += 17) await spool.addPage(raw.slice(offset, offset + 17));
      expect(spool.scratchStats().runCount).toBeGreaterThan(64);
      const actual: NormalizedEngineeringEvent[] = [];
      for await (const event of spool.scorerSortedEvents()) actual.push(event);
      expect(actual).toEqual(mergeEngineeringEvidence(input).events);
      expect(await spool.digest(selectedReceipt, metadata(input))).toBe(expected);
    } finally {
      await spool.dispose();
    }
  }, 120_000);

  it("fails closed when the private scratch budget is exhausted", async () => {
    const spool = await beginCanonicalReceiptEvidenceSpool({ runBytes: 8 * 1_024, maxScratchBytes: 16 * 1_024 });
    try {
      await expect(spool.addPage(events(20))).rejects.toThrow(/scratch budget exceeded/);
    } finally {
      await spool.dispose();
    }
  });

  it("handles 100,000 duplicate inputs without retaining an event array", async () => {
    const selectedReceipt = receipt();
    const row = events(1)[0]!;
    const input = evidence([row]);
    const expected = await receiptSemanticIdentity(selectedReceipt, input);
    const spool = await beginCanonicalReceiptEvidenceSpool();
    try {
      for (let batch = 0; batch < 100; batch++) {
        await spool.addPage(Array.from({ length: 1_000 }, () => row));
      }
      expect(await spool.digest(selectedReceipt, metadata(input))).toBe(expected);
    } finally {
      await spool.dispose();
    }
  }, 180_000);

  it("keeps 100,000 distinct fixture events within a bounded private scratch budget", async () => {
    const selectedReceipt = receipt();
    const input = evidence([]);
    const base = events(1_000);
    const spool = await beginCanonicalReceiptEvidenceSpool();
    try {
      for (let batch = 0; batch < 100; batch++) {
        await spool.addPage(base.map((row, index) => ({ ...row, eventId: `event-${batch * 1_000 + index}` })));
      }
      let counted = 0;
      for await (const event of spool.scorerSortedEvents()) {
        if (!event.eventId) throw new Error("Missing streamed event ID");
        counted++;
      }
      expect(counted).toBe(100_000);
      expect(await spool.digest(selectedReceipt, metadata(input))).toMatch(/^[0-9a-f]{64}$/);
      expect(spool.scratchStats().peakDiskBytes).toBeLessThan(256 * 1024 * 1024);
    } finally {
      await spool.dispose();
    }
  }, 180_000);
});
