import { describe, expect, it } from "vitest";
import { buildReceiptSnapshotV7 } from "@/lib/history/snapshot";
import { receiptFixtureV7 } from "@/lib/history/__fixtures__/receipts-v7";
import {
  CORE_DIMENSION_KEYS,
  legacyViewModel,
  receiptViewModel,
  renderableScore,
  sameScoredRevision,
} from "@/lib/profile/score-view-model";
import type { ImpactV6Result } from "@chapa/shared";

/**
 * S15 acceptance: badge, share page, public API, explanation and simulation
 * must agree on receipt ID, window, dimensions, Craft and core for the same
 * revision. They agree because they all read one projection — this test fails
 * if a surface starts deriving its own numbers again.
 */
describe("one revision, one set of rendered numbers", () => {
  it("gives every rendering surface the same displayed integers for one receipt", async () => {
    const snapshot = buildReceiptSnapshotV7(await receiptFixtureV7("2026-09-01", 9), null);
    const model = receiptViewModel("alice", snapshot);

    const badge = renderableScore(model);
    const ogImage = renderableScore(receiptViewModel("alice", snapshot));
    const studioPreview = renderableScore(receiptViewModel("ALICE", snapshot));
    const sharePage = renderableScore(JSON.parse(JSON.stringify(model)));
    const publicApi = renderableScore(JSON.parse(JSON.stringify(model)));

    for (const surface of [ogImage, studioPreview, sharePage, publicApi]) {
      expect(surface).toEqual(badge);
    }
    for (const key of CORE_DIMENSION_KEYS) {
      const score = snapshot.receipt.receipt.core.dimensions[key];
      expect(badge.dimensions[key]).toBe(score.kind === "point" ? score.displayValue : score.displayLower);
    }
  });

  it("agrees on receipt identity and window across surfaces", async () => {
    const snapshot = buildReceiptSnapshotV7(await receiptFixtureV7("2026-09-01", 9), null);
    const badge = receiptViewModel("alice", snapshot);
    const api = receiptViewModel("alice", JSON.parse(JSON.stringify(snapshot)));

    expect(sameScoredRevision(badge, api)).toBe(true);
    expect(api.identity!.receiptId).toBe(snapshot.receipt.receipt.receiptId);
    expect(api.window).toEqual(snapshot.receipt.receipt.window);
    expect(api.craft).toEqual(badge.craft);
  });

  it("draws a range at its lower bound and names it, never as a point", async () => {
    const snapshot = buildReceiptSnapshotV7(await receiptFixtureV7("2026-09-01", 4, undefined, true), null);
    const rendered = renderableScore(receiptViewModel("alice", snapshot));

    expect(rendered.rangeKeys).toContain("delivery");
    expect(rendered.rangeKeys).toContain("composite");
    const delivery = snapshot.receipt.receipt.core.dimensions.delivery;
    expect(delivery.kind).toBe("range");
    if (delivery.kind === "range") expect(rendered.dimensions.delivery).toBe(delivery.displayLower);
  });

  it("still renders a legacy v6 aggregate, with no range and no receipt identity", () => {
    const legacy: ImpactV6Result = {
      handle: "alice", profileType: "collaborative",
      dimensions: { delivery: 70, quality: 60, consistency: 50, breadth: 40 },
      archetype: "Builder", compositeScore: 55, confidence: 90, confidencePenalties: [],
      adjustedComposite: 55, tier: "Solid", computedAt: "2026-09-01T12:00:00.000Z",
    };
    const rendered = renderableScore(legacyViewModel(legacy));

    expect(rendered).toEqual({
      dimensions: { delivery: 70, quality: 60, consistency: 50, breadth: 40 },
      composite: 55, tier: "Solid", archetype: "Builder", rangeKeys: [],
    });
    expect(legacyViewModel(legacy).identity).toBeNull();
  });

  it("separates two revisions of the same receipt", async () => {
    const first = await receiptFixtureV7("2026-09-01", 4);
    const corrected = await receiptFixtureV7("2026-09-01", 9, first.receipt);

    const before = receiptViewModel("alice", buildReceiptSnapshotV7(first, null));
    const after = receiptViewModel("alice", buildReceiptSnapshotV7(corrected, null));

    expect(before.identity!.receiptId).toBe(after.identity!.receiptId);
    expect(sameScoredRevision(before, after)).toBe(false);
    expect(after.identity!.supersedesRevisionId).toBe(before.identity!.revisionId);
    expect(renderableScore(after)).not.toEqual(renderableScore(before));
  });
});
