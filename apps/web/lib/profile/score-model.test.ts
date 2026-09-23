import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ImpactV6Result } from "@chapa/shared";
import { observedReceiptFixture } from "@/lib/history/__fixtures__/receipts-observed";

vi.mock("./score-receipt-observed", () => ({ readObservedScoreReceipt: vi.fn() }));
vi.mock("@/lib/scoring-render-selection", () => ({ readScoringRenderSelection: vi.fn() }));

import { readObservedScoreReceipt } from "./score-receipt-observed";
import { readScoringRenderSelection } from "@/lib/scoring-render-selection";
import { resolveScoreModel } from "./score-model";

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

beforeEach(() => {
  vi.mocked(readObservedScoreReceipt).mockReset();
  vi.mocked(readScoringRenderSelection).mockReset().mockResolvedValue({ enabled: true, machinePolicy: "v7.2", cacheable: true, capturedAt: Date.parse("2026-09-07T17:20:02.164Z") });
});

describe("resolveScoreModel", () => {
  it("projects the issued v7 receipt when one exists", async () => {
    const envelope = await observedReceiptFixture();
    vi.mocked(readObservedScoreReceipt).mockResolvedValue({ status: "found", envelope, trend: null, semanticDigest: "private", coreSemanticDigest: null, isCurrent: true });

    const model = await resolveScoreModel("Alice", legacy);

    expect(model.policyVersion).toBe("v7.2");
    expect(model.identity).not.toBeNull();
  });

  it("falls back to the labelled legacy aggregate for a handle with no receipt", async () => {
    vi.mocked(readObservedScoreReceipt).mockResolvedValue({ status: "missing" });

    const model = await resolveScoreModel("Alice", legacy);

    expect(model.policyVersion).toBe("v6");
    expect(model.identity).toBeNull();
    expect(model.composite).toEqual({ kind: "point", value: 57.2, display: 57 });
    expect(model.limitations).toEqual(["legacy_aggregate"]);
  });
});

describe("the scoring_v7_rendering gate", () => {
  it("serves the legacy aggregate and never reads a receipt while the flag is off", async () => {
    vi.mocked(readScoringRenderSelection).mockResolvedValue({ enabled: false, machinePolicy: "v6", cacheable: true, capturedAt: Date.now() });

    const model = await resolveScoreModel("Alice", legacy);

    expect(model.policyVersion).toBe("v6");
    // Not merely ignored: the Supabase read never happens, so the gate costs
    // nothing on the badge path it is not yet serving.
    expect(readObservedScoreReceipt).not.toHaveBeenCalled();
  });
});

it("uses an injected selection without rereading the flag", async () => {
  vi.mocked(readObservedScoreReceipt).mockResolvedValue({ status: "missing" });
  await resolveScoreModel("Alice", legacy, { enabled: true, machinePolicy: "v7.2", cacheable: true, capturedAt: Date.now() });
  expect(readScoringRenderSelection).not.toHaveBeenCalled();
});

it("distinguishes an unavailable authority from genuine receipt absence", async () => {
  vi.mocked(readObservedScoreReceipt).mockResolvedValue({ status: "unavailable" });
  expect(await resolveScoreModel("Alice", legacy)).toMatchObject({ policyVersion: "v6", freshness: "unavailable" });
});

// badge-source-outage-resilience (2026-09-22) — `scoreModelFrom`'s explicit
// `statsFreshness` param only ever reaches the labelled v6 aggregate; a
// committed receipt keeps its own freshness authority regardless of it.
describe("scoreModelFrom stats freshness (badge-source-outage-resilience)", () => {
  it("labels the legacy v6 model with the caller's current/stale stats freshness", async () => {
    const { scoreModelFrom } = await import("./score-model");
    vi.mocked(readScoringRenderSelection).mockResolvedValue({ enabled: false, machinePolicy: "v6", cacheable: true, capturedAt: Date.now() });

    expect(scoreModelFrom("Alice", legacy, null, undefined, "current").freshness).toBe("current");
    expect(scoreModelFrom("Alice", legacy, null, undefined, "stale").freshness).toBe("stale");
    expect(scoreModelFrom("Alice", legacy, null, undefined).freshness).toBeUndefined();
  });

  it("never lets stats freshness override a receipt-read failure's unavailable signal", async () => {
    const { scoreModelFrom } = await import("./score-model");
    const model = scoreModelFrom("Alice", legacy, { unavailable: true }, undefined, "current");
    expect(model.policyVersion).toBe("v6");
    expect(model.freshness).toBe("unavailable");
  });

  it("leaves a committed receipt's own freshness untouched by the stats freshness param", async () => {
    const { scoreModelFrom } = await import("./score-model");
    const envelope = await observedReceiptFixture();

    const withCurrentStats = scoreModelFrom("Alice", legacy, { receipt: envelope, trend: null }, undefined, "current");
    const withStaleStats = scoreModelFrom("Alice", legacy, { receipt: envelope, trend: null }, undefined, "stale");

    expect(withCurrentStats.policyVersion).toBe("v7.2");
    // Derived from the receipt's own window/capture time, never the stats
    // freshness param — identical either way it is called.
    expect(withCurrentStats.freshness).toBe(withStaleStats.freshness);
  });
});
