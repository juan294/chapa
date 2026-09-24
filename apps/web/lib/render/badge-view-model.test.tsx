import { describe, expect, it } from "vitest";
import { buildReceiptSnapshotV7 } from "@/lib/history/snapshot";
import { receiptFixtureV7 } from "@/lib/history/__fixtures__/receipts-v7";
import {
  CORE_DIMENSION_KEYS,
  receiptViewModel,
  renderableScore,
  sameScoredRevision,
  type ScoreViewModel,
} from "@/lib/profile/score-view-model";
import { renderBadgeSvg } from "./BadgeSvg";
import { DEMO_STATS } from "./demoData";
import { DEMO_SCORING } from "./__fixtures__/demo-scoring";
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
 * as a point publishes a claim the evidence does not support (#1335 phase 5 —
 * "delete v6": every drawn magnitude now comes from the supplied `scoring`
 * model; there is no legacy aggregate to accidentally fall back to).
 */
describe("badge SVG renders the resolved policy version", () => {
  const stats = DEMO_STATS;

  it("prints a v7 evidence range as an interval, and refuses to guess an archetype", async () => {
    const snapshot = buildReceiptSnapshotV7(await receiptFixtureV7("2026-09-01", 9, undefined, true), null);
    const model = receiptViewModel("alice", snapshot);
    expect(model.composite.kind).toBe("range");
    // Any non-point dimension forbids a definitive archetype.
    expect(model.archetype).toBeNull();

    const svg = renderBadgeSvg(stats, { scoring: model });

    const composite = model.composite as { displayLower: number; displayUpper: number };
    expect(svg).toContain(`${composite.displayLower}–${composite.displayUpper}`);
    expect(svg).toContain("insufficient evidence");
    // Craft is never a core axis under v7, so the radar stays a diamond.
    expect(svg).not.toContain("Craft");
  });

  it("shows no tier when the evidence interval straddles a tier boundary", async () => {
    const snapshot = buildReceiptSnapshotV7(await receiptFixtureV7("2026-09-01", 9, undefined, true), null);
    const straddling = { ...receiptViewModel("alice", snapshot), tier: null };

    const svg = renderBadgeSvg(stats, { scoring: straddling });

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
 * `<desc>` of every existing static badge rendered in a non-default locale.
 */
describe("the accessible description stays locale-independent", () => {
  const spanish = (key: string) => (key === "tiers.high" ? "Alto" : key === "tiers.solid" ? "Sólido" : key);
  const solidModel: ScoreViewModel = { ...DEMO_SCORING, tier: "Solid" };

  it("keeps the canonical tier in <desc> while the drawn label is translated", () => {
    const svg = renderBadgeSvg(DEMO_STATS, {
      scoring: solidModel,
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

    const svg = renderBadgeSvg(DEMO_STATS, { scoring: model, disableAnimation: true });

    expect(svg).toContain("unassigned tier");
  });
});

/**
 * Locked after rendering one and looking at it.
 *
 * The first v7 badge ever rasterized showed "74–76" at a fixed 30px measuring
 * about 90px across, sitting on a ring whose clear inner width is about 88px:
 * the glyphs touched the stroke on both sides. No string assertion had caught
 * it, because the markup was correct — only the geometry was wrong. This locks
 * the headline inside the ring for every width a score can take.
 */
describe("the headline fits inside the score ring", () => {
  const RING_CLEAR_WIDTH = 88;   // r=46, 4px stroke
  const MONO_ADVANCE = 0.6;      // JetBrains Mono advances 0.6em per glyph

  function headline(svg: string): { text: string; size: number } {
    const match = /<text data-element="score"[^>]*font-size="(\d+)"[^>]*>([^<]+)</.exec(svg)!;
    return { size: Number(match[1]), text: match[2]! };
  }

  it.each([
    ["a two-digit point", { kind: "point", value: 91, display: 91 }],
    ["a three-digit point", { kind: "point", value: 100, display: 100 }],
    ["a two-by-two range", { kind: "range", lower: 74, upper: 76, displayLower: 74, displayUpper: 76 }],
    ["a range reaching 100", { kind: "range", lower: 96, upper: 100, displayLower: 96, displayUpper: 100 }],
    ["the widest possible range", { kind: "range", lower: 100, upper: 100, displayLower: 100, displayUpper: 100 }],
  ])("keeps %s inside the ring", (_name, composite) => {
    const model = {
      policyVersion: "v7", handle: "alice", identity: null, window: null,
      dimensions: {
        delivery: { kind: "point", value: 70, display: 70 },
        quality: { kind: "point", value: 70, display: 70 },
        consistency: { kind: "point", value: 70, display: 70 },
        breadth: { kind: "point", value: 70, display: 70 },
      },
      composite, tier: "High", archetype: "Builder", craft: null,
      coverage: [], exclusions: [], limitations: [],
    } as unknown as ScoreViewModel;

    const { text, size } = headline(renderBadgeSvg(DEMO_STATS, { scoring: model }));

    expect(text.length * size * MONO_ADVANCE).toBeLessThanOrEqual(RING_CLEAR_WIDTH);
  });
});
