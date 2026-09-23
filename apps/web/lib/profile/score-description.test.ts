import { describe, expect, it } from "vitest";
import { buildReceiptSnapshotV7 } from "@/lib/history/snapshot";
import { receiptFixtureV7 } from "@/lib/history/__fixtures__/receipts-v7";
import { receiptViewModel } from "./score-view-model";
import { describeScoreForMetadata } from "./score-description";

describe("describeScoreForMetadata", () => {
  it("describes nothing when there is no model", () => {
    expect(describeScoreForMetadata(null)).toBeNull();
  });

  // #1335 phase 5 ("delete v6") — there is no legacy aggregate projection any
  // more (`legacyViewModel` is gone with it); this branch is now reached by
  // the archived, immutable "v7" machine-engine receipt's point case, which
  // keeps its historical non-"v7.2" wording.
  it("keeps the historical sentence for an archived v7 point receipt", async () => {
    const snapshot = buildReceiptSnapshotV7(await receiptFixtureV7("2026-04-17", 4), null);
    const model = receiptViewModel("alice", snapshot);
    expect(model.policyVersion).toBe("v7");
    expect(model.composite.kind).toBe("point");

    const composite = model.composite as { display: number };
    expect(describeScoreForMetadata(model))
      .toBe(`Developer with a Chapa Impact Score of ${composite.display} (${model.tier} tier).`);
  });

  it("names a v7 range as a range, never as a point", async () => {
    const snapshot = buildReceiptSnapshotV7(await receiptFixtureV7("2026-09-01", 9, undefined, true), null);
    const model = receiptViewModel("alice", snapshot);
    expect(model.composite.kind).toBe("range");

    const description = describeScoreForMetadata(model)!;

    const composite = model.composite as { displayLower: number; displayUpper: number };
    expect(description).toContain(`${composite.displayLower}–${composite.displayUpper}`);
    expect(description).toContain("evidence range");
    // The failure this guards: a single number quoted into a search index.
    expect(description).not.toMatch(/Impact Score of \d+/);
  });

  it("claims no tier when the range earned none", async () => {
    const snapshot = buildReceiptSnapshotV7(await receiptFixtureV7("2026-09-01", 9, undefined, true), null);
    const model = { ...receiptViewModel("alice", snapshot), tier: null };

    const description = describeScoreForMetadata(model)!;

    expect(description).not.toContain("tier");
  });
});


describe("current receipt metadata agreement", () => {
  it("uses canonical69.99 and recorded scope, never a rounded70 or legacy80", async () => {
    const { scoringConsistencyFixture } = await import("./__fixtures__/scoring-consistency");
    const { model } = await scoringConsistencyFixture({ boundary: true, craft: 0 });
    const text = describeScoreForMetadata(model)!;
    expect(text).toContain("69.99");
    expect(text).toContain("Solid");
    expect(text).toContain("v7.2");
    expect(text).toContain("recorded evidence");
    expect(text).not.toContain("70");
    expect(text).not.toContain("80");
  });
});
