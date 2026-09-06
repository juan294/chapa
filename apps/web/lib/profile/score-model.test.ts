import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ImpactV6Result } from "@chapa/shared";
import { buildReceiptSnapshotV7 } from "@/lib/history/snapshot";
import { receiptFixtureV7 } from "@/lib/history/__fixtures__/receipts-v7";

vi.mock("./score-receipt-v7", () => ({ readScoreReceiptV7: vi.fn() }));
vi.mock("@/lib/feature-flags", () => ({ isScoringV7RenderingEnabled: vi.fn() }));

import { readScoreReceiptV7 } from "./score-receipt-v7";
import { isScoringV7RenderingEnabled } from "@/lib/feature-flags";
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
  vi.mocked(readScoreReceiptV7).mockReset();
  vi.mocked(isScoringV7RenderingEnabled).mockReset().mockResolvedValue(true);
});

describe("resolveScoreModel", () => {
  it("projects the issued v7 receipt when one exists", async () => {
    const snapshot = buildReceiptSnapshotV7(await receiptFixtureV7("2026-09-01", 4), null);
    vi.mocked(readScoreReceiptV7).mockResolvedValue(snapshot);

    const model = await resolveScoreModel("Alice", legacy);

    expect(model.policyVersion).toBe("v7");
    expect(model.identity).not.toBeNull();
  });

  it("falls back to the labelled legacy aggregate for a handle with no receipt", async () => {
    vi.mocked(readScoreReceiptV7).mockResolvedValue(null);

    const model = await resolveScoreModel("Alice", legacy);

    expect(model.policyVersion).toBe("v6");
    expect(model.identity).toBeNull();
    expect(model.composite).toEqual({ kind: "point", value: 57.2, display: 57 });
    expect(model.limitations).toEqual(["legacy_aggregate"]);
  });
});

describe("the scoring_v7_rendering gate", () => {
  it("serves the legacy aggregate and never reads a receipt while the flag is off", async () => {
    vi.mocked(isScoringV7RenderingEnabled).mockResolvedValue(false);

    const model = await resolveScoreModel("Alice", legacy);

    expect(model.policyVersion).toBe("v6");
    // Not merely ignored: the Supabase read never happens, so the gate costs
    // nothing on the badge path it is not yet serving.
    expect(readScoreReceiptV7).not.toHaveBeenCalled();
  });
});
