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
import { renderBadgeSvg } from "./BadgeSvg";
import { DEMO_STATS } from "./demoData";
import { buildBadgeI18nStrings } from "./badge-i18n-strings";

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

/**
 * The cutover regression. The badge is the artifact people embed, so it is the
 * surface where a wrong policy version does the most damage: a v7 range drawn
 * as a v6 point publishes a claim the evidence does not support, and a v6
 * aggregate drawn as v7 explains legacy arithmetic that never ran.
 */
describe("badge SVG renders the resolved policy version", () => {
  const stats = DEMO_STATS;
  /** The badge still takes a v6 impact; with a v7 model supplied every drawn
   *  magnitude comes from the model, so these values must never surface. */
  const unusedLegacy: ImpactV6Result = {
    handle: "alice", profileType: "collaborative",
    dimensions: { delivery: 1, quality: 2, consistency: 3, breadth: 4 },
    archetype: "Emerging", compositeScore: 3, confidence: 50, confidencePenalties: [],
    adjustedComposite: 3, tier: "Emerging", computedAt: "2026-09-01T12:00:00.000Z",
  };

  it("draws a v6 aggregate unchanged, with its Craft axis intact", () => {
    const impact: ImpactV6Result = {
      handle: "alice", profileType: "collaborative",
      dimensions: { delivery: 61, quality: 72, consistency: 55, breadth: 40, craft: 66 },
      archetype: "Builder", compositeScore: 57, confidence: 90, confidencePenalties: [],
      adjustedComposite: 57, tier: "Solid", computedAt: "2026-09-01T12:00:00.000Z",
    };

    const svg = renderBadgeSvg(stats, impact);

    expect(svg).toContain(">57<");
    expect(svg).toContain("Solid");
    expect(svg).toContain("Builder");
    // Five axes: Craft is a core dimension under v6 semantics.
    expect(svg).toContain("Craft");
  });

  it("prints a v7 evidence range as an interval, and refuses to guess an archetype", async () => {
    const snapshot = buildReceiptSnapshotV7(await receiptFixtureV7("2026-09-01", 9, undefined, true), null);
    const model = receiptViewModel("alice", snapshot);
    expect(model.composite.kind).toBe("range");
    // Any non-point dimension forbids a definitive archetype.
    expect(model.archetype).toBeNull();

    const svg = renderBadgeSvg(stats, unusedLegacy, { scoring: model });

    const composite = model.composite as { displayLower: number; displayUpper: number };
    expect(svg).toContain(`${composite.displayLower}\u2013${composite.displayUpper}`);
    expect(svg).toContain("insufficient evidence");
    // Craft is never a core axis under v7, so the radar stays a diamond.
    expect(svg).not.toContain("Craft");
  });

  it("shows no tier when the evidence interval straddles a tier boundary", async () => {
    const snapshot = buildReceiptSnapshotV7(await receiptFixtureV7("2026-09-01", 9, undefined, true), null);
    const straddling = { ...receiptViewModel("alice", snapshot), tier: null };

    const svg = renderBadgeSvg(stats, unusedLegacy, { scoring: straddling });

    expect(svg).toContain("evidence range");
    for (const tier of ["Emerging", "Solid", "High", "Elite"]) expect(svg).not.toContain(`>${tier}<`);
  });
});

/**
 * The label bug the first cutover shipped: every caller resolved its tier
 * string from the v6 aggregate, and the renderer preferred a caller-supplied
 * label whenever the v7 tier was non-null. A v7 core of 72 therefore printed
 * the v6 word "Solid" beside it, and Spanish badges fell back to English for
 * the two v7-only labels because no caller supplied them.
 */
describe("the drawn label comes from the drawn model", () => {
  const t = (key: string) => (key === "badge.tierUnknown" ? "rango de evidencia"
    : key === "badge.archetypeUnknown" ? "evidencia insuficiente"
    : key === "tiers.high" ? "Alto"
    : key === "tiers.solid" ? "Sólido"
    : key);

  it("labels a v7 tier from the v7 tier, not the v6 aggregate's", () => {
    expect(buildBadgeI18nStrings(t, "High").tierLabel).toBe("Alto");
    expect(buildBadgeI18nStrings(t, "Solid").tierLabel).toBe("Sólido");
  });

  it("supplies no tier label at all when the range earns no tier", () => {
    const strings = buildBadgeI18nStrings(t, null);
    expect(strings.tierLabel).toBeUndefined();
    expect(strings.tierUnknownLabel).toBe("rango de evidencia");
  });

  it("always carries the two v7-only labels, so they are never English by default", () => {
    for (const tier of ["High", null]) {
      const strings = buildBadgeI18nStrings(t, tier);
      expect(strings.tierUnknownLabel).toBe("rango de evidencia");
      expect(strings.archetypeUnknownLabel).toBe("evidencia insuficiente");
    }
  });
});

/**
 * The accessible description is assembled in English and continued in English
 * by `describeScoringEvidence`, so the tier inside it stays canonical. A
 * translated word there would read as "Alto tier" mid-sentence, and — the
 * reason this is a regression rather than a preference — it would change the
 * `<desc>` of every existing v6 static badge rendered in a non-default locale.
 */
describe("the accessible description stays locale-independent", () => {
  const spanish = (key: string) => (key === "tiers.high" ? "Alto" : key === "tiers.solid" ? "Sólido" : key);
  const v6: ImpactV6Result = {
    handle: "alice", profileType: "collaborative",
    dimensions: { delivery: 61, quality: 72, consistency: 55, breadth: 40 },
    archetype: "Builder", compositeScore: 57, confidence: 90, confidencePenalties: [],
    adjustedComposite: 57, tier: "Solid", computedAt: "2026-09-01T12:00:00.000Z",
  };

  it("keeps the canonical tier in <desc> while the drawn label is translated", () => {
    const svg = renderBadgeSvg(DEMO_STATS, v6, {
      disableAnimation: true,
      strings: buildBadgeI18nStrings(spanish, "Solid"),
    });

    expect(svg).toContain("<desc>");
    expect(svg).toContain("Solid tier");
    expect(svg).not.toContain("Sólido tier");
    // The visible label is still the translated one.
    expect(svg).toContain(">Sólido<");
  });

  it("says the tier is unassigned rather than naming one, for a v7 range", async () => {
    const snapshot = buildReceiptSnapshotV7(await receiptFixtureV7("2026-09-01", 9, undefined, true), null);
    const model = { ...receiptViewModel("alice", snapshot), tier: null };

    const svg = renderBadgeSvg(DEMO_STATS, v6, { scoring: model, disableAnimation: true });

    expect(svg).toContain("unassigned tier");
  });
});
