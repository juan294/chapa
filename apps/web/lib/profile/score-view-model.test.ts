import { describe, expect, it } from "vitest";
import { buildReceiptSnapshotV7 } from "@/lib/history/snapshot";
import { receiptFixtureV7 } from "@/lib/history/__fixtures__/receipts-v7";
import {
  CORE_DIMENSION_KEYS,
  CRAFT_CRITERION_KEYS,
  legacyViewModel,
  receiptViewModel,
  sameScoredRevision,
} from "./score-view-model";
import type { ImpactV6Result } from "@chapa/shared";

const legacy: ImpactV6Result = {
  handle: "Alice",
  profileType: "collaborative",
  dimensions: { delivery: 61.4, quality: 72, consistency: 55.5, breadth: 40 },
  archetype: "Builder",
  compositeScore: 57.2,
  confidence: 90,
  confidencePenalties: [],
  adjustedComposite: 57.2,
  tier: "Solid",
  computedAt: "2026-09-01T12:00:00.000Z",
};

describe("shared score view model", () => {
  it("copies the receipt's own displayed integers rather than re-rounding", async () => {
    const snapshot = buildReceiptSnapshotV7(await receiptFixtureV7("2026-09-01", 4), null);
    const model = receiptViewModel("Alice", snapshot);
    const receipt = snapshot.receipt.receipt;

    expect(model.policyVersion).toBe("v7");
    expect(model.handle).toBe("alice");
    for (const key of CORE_DIMENSION_KEYS) {
      const score = receipt.core.dimensions[key];
      expect(model.dimensions[key]).toEqual(
        score.kind === "point"
          ? { kind: "point", value: score.value, display: score.displayValue }
          : { kind: "range", lower: score.lower, upper: score.upper, displayLower: score.displayLower, displayUpper: score.displayUpper },
      );
    }
    const composite = receipt.core.composite;
    expect(composite.kind).toBe("point");
    if (composite.kind === "point") {
      expect(model.composite).toEqual({ kind: "point", value: composite.value, display: composite.displayValue });
    }
    expect(model.tier).toBe(receipt.core.tier);
    expect(model.archetype).toBe(receipt.core.archetype);
  });

  it("carries the exact issued identity a verification link resolves to", async () => {
    const snapshot = buildReceiptSnapshotV7(await receiptFixtureV7("2026-09-01", 6), null);
    const model = receiptViewModel("alice", snapshot);

    expect(model.identity).toEqual({
      receiptId: snapshot.receipt.receipt.receiptId,
      revisionId: snapshot.receipt.receipt.revisionId,
      revision: 1,
      recordedAt: snapshot.receipt.receipt.recordedAt,
      action: "create",
      supersedesRevisionId: null,
      contentHash: snapshot.receipt.contentHash.value,
    });
    expect(model.window).toEqual(snapshot.receipt.receipt.window);
  });

  it("preserves a range without collapsing it to a point", async () => {
    const snapshot = buildReceiptSnapshotV7(await receiptFixtureV7("2026-09-01", 4, undefined, true), null);
    const model = receiptViewModel("alice", snapshot);

    expect(model.dimensions.delivery.kind).toBe("range");
    expect(model.composite.kind).toBe("range");
    // A range that spans a tier boundary gets no tier, and a non-point
    // dimension set gets no archetype.
    expect(model.tier).toBe(snapshot.receipt.receipt.core.tier);
    expect(model.archetype).toBe(snapshot.receipt.receipt.core.archetype);
  });

  it("reports an absent Craft portfolio as not observed, never as zero", async () => {
    const snapshot = buildReceiptSnapshotV7(await receiptFixtureV7("2026-09-01", 4), null);
    expect(receiptViewModel("alice", snapshot).craft).toEqual({ status: "not_observed" });
  });

  it("projects a v6 aggregate into the same shape, labelled and limited as legacy", () => {
    const model = legacyViewModel(legacy);

    expect(model.policyVersion).toBe("v6");
    expect(model.identity).toBeNull();
    expect(model.window).toBeNull();
    expect(model.craft).toBeNull();
    expect(model.coverage).toEqual([]);
    expect(model.limitations).toEqual(["legacy_aggregate"]);
    expect(model.dimensions.delivery).toEqual({ kind: "point", value: 61.4, display: 61 });
    expect(model.composite).toEqual({ kind: "point", value: 57.2, display: 57 });
    expect(model.tier).toBe("Solid");
    expect(model.archetype).toBe("Builder");
    expect(Object.keys(model.dimensions)).toEqual([...CORE_DIMENSION_KEYS]);
  });

  it("keeps the visitor-redacted v6 shape renderable without confidence data", () => {
    const { confidence: _confidence, confidencePenalties: _penalties, ...visitor } = legacy;
    expect(legacyViewModel(visitor)).toEqual(legacyViewModel(legacy));
  });

  it("identifies the same issued revision, and separates a corrected one", async () => {
    const first = await receiptFixtureV7("2026-09-01", 4);
    const corrected = await receiptFixtureV7("2026-09-01", 5, first.receipt);
    const model = receiptViewModel("alice", buildReceiptSnapshotV7(first, null));

    expect(sameScoredRevision(model, receiptViewModel("alice", buildReceiptSnapshotV7(first, null)))).toBe(true);
    expect(sameScoredRevision(model, receiptViewModel("bob", buildReceiptSnapshotV7(first, null)))).toBe(false);
    expect(sameScoredRevision(model, receiptViewModel("alice", buildReceiptSnapshotV7(corrected, null)))).toBe(false);
    expect(sameScoredRevision(model, legacyViewModel(legacy))).toBe(false);
    expect(sameScoredRevision(legacyViewModel(legacy), legacyViewModel(legacy))).toBe(true);
  });

  it("exposes every Craft criterion key when a portfolio is observed", () => {
    expect(CRAFT_CRITERION_KEYS).toEqual(["framing", "verification_debugging", "tool_judgment", "accepted_outcome"]);
  });
});
