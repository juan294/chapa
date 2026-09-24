import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./score-receipt-observed", () => ({ materializeObservedScoreReceipt: vi.fn() }));
vi.mock("@/lib/db/report-craft", () => ({ dbReadReportCraft: vi.fn(), dbPublishObservedReceiptWithReport: vi.fn() }));
const issueReceiptVerificationV7 = vi.fn();
vi.mock("@/lib/verification/store", () => ({ issueReceiptVerificationV7: (...a: unknown[]) => issueReceiptVerificationV7(...a) }));

import { materializeObservedScoreReceipt } from "./score-receipt-observed";
import { issueScoreReceipt } from "./issue-receipt";

beforeEach(() => {
  vi.mocked(materializeObservedScoreReceipt).mockReset();
  issueReceiptVerificationV7.mockReset().mockResolvedValue("v7.token");
});

describe("issueScoreReceipt", () => {
  it("reports an issued receipt", async () => {
    vi.mocked(materializeObservedScoreReceipt).mockResolvedValue({ status: "issued", snapshot: { receipt: { receipt: {} } } as never, publication: "inserted", isCurrent: true, freshness: "current" });
    expect(await issueScoreReceipt("alice")).toEqual({ status: "issued" });
    // The receipt and the link that resolves it are issued together.
    expect(issueReceiptVerificationV7).toHaveBeenCalledOnce();
  });

  it("reports the specific reason when evidence is not yet complete — never a silent skip (the 2026-09-23 incident)", async () => {
    vi.mocked(materializeObservedScoreReceipt).mockResolvedValue({ status: "unavailable", reason: "source_error" });
    expect(await issueScoreReceipt("alice")).toEqual({ status: "failed", reason: "source_error" });
  });

  it("reports a storage failure as an explicit failed outcome (the caller, lib/collection/fan-in.ts, is the sole capture point)", async () => {
    vi.mocked(materializeObservedScoreReceipt).mockResolvedValue({ status: "unavailable", reason: "storage_error" });
    expect(await issueScoreReceipt("alice")).toEqual({ status: "failed", reason: "storage_error" });
  });

  it("folds a no_receipt reason into storage_error, since it is not one of the four recorded failure reasons", async () => {
    vi.mocked(materializeObservedScoreReceipt).mockResolvedValue({ status: "unavailable", reason: "no_receipt" });
    expect(await issueScoreReceipt("alice")).toEqual({ status: "failed", reason: "storage_error" });
  });

  it("reports a preserved-but-stale receipt (an error occurred, a prior current receipt was kept) as an explicit failure, not unchanged", async () => {
    vi.mocked(materializeObservedScoreReceipt).mockResolvedValue({ status: "stored", freshness: "stale", reason: "craft_error", snapshot: { receipt: {} } as never });
    expect(await issueScoreReceipt("alice")).toEqual({ status: "failed", reason: "craft_error" });
    expect(issueReceiptVerificationV7).not.toHaveBeenCalled();
  });

  it("reports empty_evidence distinctly from source_error when a recompute would have regressed an established receipt to zero", async () => {
    vi.mocked(materializeObservedScoreReceipt).mockResolvedValue({ status: "stored", freshness: "stale", reason: "empty_evidence", snapshot: { receipt: {} } as never });
    expect(await issueScoreReceipt("alice")).toEqual({ status: "failed", reason: "empty_evidence" });
    expect(issueReceiptVerificationV7).not.toHaveBeenCalled();
  });

  it("never lets a thrown error escape into the caller's response", async () => {
    vi.mocked(materializeObservedScoreReceipt).mockRejectedValue(new Error("boom"));
    expect(await issueScoreReceipt("alice")).toEqual({ status: "failed", reason: "storage_error" });
  });
});

describe("the receipt and its verification link are one act", () => {
  it("repairs an unchanged durable receipt after verification failed, without issuing another revision", async () => {
    const snapshot = { receipt: { receipt: { revisionId: "same-revision" } } } as never;
    vi.mocked(materializeObservedScoreReceipt)
      .mockResolvedValueOnce({ status: "issued", snapshot, publication: "inserted", isCurrent: true, freshness: "current" })
      .mockResolvedValueOnce({ status: "stored", freshness: "current", snapshot });
    issueReceiptVerificationV7.mockRejectedValueOnce(new Error("temporary signing failure"));
    expect(await issueScoreReceipt("alice")).toEqual({ status: "failed", reason: "storage_error" });
    expect(await issueScoreReceipt("alice")).toEqual({ status: "unchanged" });
    expect(issueReceiptVerificationV7).toHaveBeenCalledTimes(2);
    expect(issueReceiptVerificationV7.mock.calls[0]).toEqual(issueReceiptVerificationV7.mock.calls[1]);
  });

  it("keeps repair failure observable as a failed outcome, including withdrawal during repair", async () => {
    vi.mocked(materializeObservedScoreReceipt).mockResolvedValue({ status: "stored", freshness: "current", snapshot: { receipt: {} } as never });
    issueReceiptVerificationV7.mockRejectedValue(new Error("Publication withdrawn"));
    expect(await issueScoreReceipt("alice")).toEqual({ status: "failed", reason: "storage_error" });
  });

  it("reports failure when the receipt issues but its link does not", async () => {
    vi.mocked(materializeObservedScoreReceipt).mockResolvedValue({ status: "issued", snapshot: { receipt: { receipt: {} } } as never, publication: "inserted", isCurrent: true, freshness: "current" });
    issueReceiptVerificationV7.mockRejectedValue(new Error("signing key unavailable"));

    // Not "issued": a receipt whose /verify link answers "not found" is a
    // badge carrying an attestation nobody can resolve.
    expect(await issueScoreReceipt("alice")).toEqual({ status: "failed", reason: "storage_error" });
  });
});
