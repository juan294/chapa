import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./score-receipt-observed", () => ({ materializeObservedScoreReceipt: vi.fn() }));
vi.mock("@/lib/db/report-craft", () => ({ dbReadReportCraft: vi.fn(), dbPublishObservedReceiptWithReport: vi.fn() }));
const issueReceiptVerificationV7 = vi.fn();
vi.mock("@/lib/verification/store", () => ({ issueReceiptVerificationV7: (...a: unknown[]) => issueReceiptVerificationV7(...a) }));
const readScoringRenderSelection = vi.fn();
vi.mock("@/lib/scoring-render-selection", () => ({ readScoringRenderSelection: () => readScoringRenderSelection() }));
const captureServerError = vi.fn();
vi.mock("@/lib/analytics/server-errors", () => ({ captureServerError: (...a: unknown[]) => captureServerError(...a) }));

import { materializeObservedScoreReceipt } from "./score-receipt-observed";
import { issueScoreReceipt } from "./issue-receipt";

beforeEach(() => {
  vi.mocked(materializeObservedScoreReceipt).mockReset();
  captureServerError.mockReset();
  readScoringRenderSelection.mockReset().mockResolvedValue({ enabled: true, machinePolicy: "v7.2", cacheable: true, capturedAt: Date.now() });
  issueReceiptVerificationV7.mockReset().mockResolvedValue("v7.token");
});

describe("issueScoreReceipt", () => {
  it("reports an issued receipt", async () => {
    vi.mocked(materializeObservedScoreReceipt).mockResolvedValue({ status: "issued", snapshot: { receipt: { receipt: {} } } as never, publication: "inserted", isCurrent: true, freshness: "current" });
    expect(await issueScoreReceipt("alice")).toBe("issued");
    // The receipt and the link that resolves it are issued together.
    expect(issueReceiptVerificationV7).toHaveBeenCalledOnce();
    expect(captureServerError).not.toHaveBeenCalled();
  });

  it("stays silent for a subject whose evidence is not yet complete", async () => {
    vi.mocked(materializeObservedScoreReceipt).mockResolvedValue({ status: "unavailable", reason: "source_error" });
    expect(await issueScoreReceipt("alice")).toBe("skipped");
    expect(captureServerError).not.toHaveBeenCalled();
  });

  it("captures a storage failure, because a failed durable write must stay observable", async () => {
    vi.mocked(materializeObservedScoreReceipt).mockResolvedValue({ status: "unavailable", reason: "storage_error" });
    expect(await issueScoreReceipt("alice")).toBe("failed");
    expect(captureServerError).toHaveBeenCalledOnce();
  });

  it("never lets a thrown error escape into the caller's response", async () => {
    vi.mocked(materializeObservedScoreReceipt).mockRejectedValue(new Error("boom"));
    expect(await issueScoreReceipt("alice")).toBe("failed");
    expect(captureServerError).toHaveBeenCalledOnce();
  });
});

describe("the scoring_v7_rendering gate", () => {
  it("mints nothing while the flag is off", async () => {
    readScoringRenderSelection.mockResolvedValue({ enabled: false, machinePolicy: "v6", cacheable: true, capturedAt: Date.now() });

    expect(await issueScoreReceipt("alice")).toBe("skipped");
    expect(materializeObservedScoreReceipt).not.toHaveBeenCalled();
  });
});

describe("the receipt and its verification link are one act", () => {
  it("repairs an unchanged durable receipt after verification failed, without issuing another revision", async () => {
    const snapshot = { receipt: { receipt: { revisionId: "same-revision" } } } as never;
    vi.mocked(materializeObservedScoreReceipt)
      .mockResolvedValueOnce({ status: "issued", snapshot, publication: "inserted", isCurrent: true, freshness: "current" })
      .mockResolvedValueOnce({ status: "stored", freshness: "current", snapshot });
    issueReceiptVerificationV7.mockRejectedValueOnce(new Error("temporary signing failure"));
    expect(await issueScoreReceipt("alice")).toBe("failed");
    expect(await issueScoreReceipt("alice")).toBe("skipped");
    expect(issueReceiptVerificationV7).toHaveBeenCalledTimes(2);
    expect(issueReceiptVerificationV7.mock.calls[0]).toEqual(issueReceiptVerificationV7.mock.calls[1]);
  });

  it("keeps repair failure observable, including withdrawal during repair", async () => {
    vi.mocked(materializeObservedScoreReceipt).mockResolvedValue({ status: "stored", freshness: "current", snapshot: { receipt: {} } as never });
    issueReceiptVerificationV7.mockRejectedValue(new Error("Publication withdrawn"));
    expect(await issueScoreReceipt("alice")).toBe("failed");
    expect(captureServerError).toHaveBeenCalledOnce();
  });

  it("reports failure, and captures it, when the receipt issues but its link does not", async () => {
    vi.mocked(materializeObservedScoreReceipt).mockResolvedValue({ status: "issued", snapshot: { receipt: { receipt: {} } } as never, publication: "inserted", isCurrent: true, freshness: "current" });
    issueReceiptVerificationV7.mockRejectedValue(new Error("signing key unavailable"));

    // Not "issued": a receipt whose /verify link answers "not found" is a
    // badge carrying an attestation nobody can resolve.
    expect(await issueScoreReceipt("alice")).toBe("failed");
    expect(captureServerError).toHaveBeenCalledOnce();
  });
});
