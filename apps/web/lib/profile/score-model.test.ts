import { describe, expect, it, vi, beforeEach } from "vitest";
import { observedReceiptFixture } from "@/lib/history/__fixtures__/receipts-observed";

vi.mock("./score-receipt-observed", () => ({ readObservedScoreReceipt: vi.fn() }));

import { readObservedScoreReceipt } from "./score-receipt-observed";
import { readRenderableReceipt, resolveScoreModel, scoreModelFrom } from "./score-model";

beforeEach(() => {
  vi.mocked(readObservedScoreReceipt).mockReset();
});

describe("resolveScoreModel", () => {
  it("projects the issued v7.2 receipt when one exists", async () => {
    const envelope = await observedReceiptFixture();
    vi.mocked(readObservedScoreReceipt).mockResolvedValue({ status: "found", envelope, trend: null, semanticDigest: "private", coreSemanticDigest: null, isCurrent: true });

    const model = await resolveScoreModel("Alice");

    expect(model?.policyVersion).toBe("v7.2");
    expect(model?.identity).not.toBeNull();
  });

  it("returns undefined for a handle with no receipt — nothing to draw here", async () => {
    vi.mocked(readObservedScoreReceipt).mockResolvedValue({ status: "missing" });

    const model = await resolveScoreModel("Alice");

    expect(model).toBeUndefined();
  });

  it("returns undefined when the receipt authority read fails", async () => {
    vi.mocked(readObservedScoreReceipt).mockResolvedValue({ status: "unavailable" });

    const model = await resolveScoreModel("Alice");

    expect(model).toBeUndefined();
  });

  it("returns undefined for a retracted receipt", async () => {
    const envelope = await observedReceiptFixture();
    const retracted = { ...envelope, receipt: { ...envelope.receipt, action: "retract" as const } };
    vi.mocked(readObservedScoreReceipt).mockResolvedValue({ status: "found", envelope: retracted, trend: null, semanticDigest: "private", coreSemanticDigest: null, isCurrent: true });

    const model = await resolveScoreModel("Alice");

    expect(model).toBeUndefined();
  });
});

describe("readRenderableReceipt", () => {
  it("catches a thrown read and treats it the same as an authority failure", async () => {
    vi.mocked(readObservedScoreReceipt).mockRejectedValue(new Error("db down"));

    expect(await readRenderableReceipt("Alice")).toBeNull();
  });
});

describe("scoreModelFrom", () => {
  it("projects a receipt snapshot into the v7.2 view model", async () => {
    const envelope = await observedReceiptFixture();

    const model = scoreModelFrom("Alice", { receipt: envelope, trend: null });

    expect(model?.policyVersion).toBe("v7.2");
    expect(model?.handle).toBe("alice");
  });

  it("returns undefined for a null receipt", () => {
    expect(scoreModelFrom("Alice", null)).toBeUndefined();
  });
});
