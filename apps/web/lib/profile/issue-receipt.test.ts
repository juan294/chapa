import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./score-receipt-v7", () => ({ materializeScoreReceiptV7: vi.fn() }));
const issueReceiptVerificationV7 = vi.fn();
vi.mock("@/lib/verification/store", () => ({ issueReceiptVerificationV7: (...a: unknown[]) => issueReceiptVerificationV7(...a) }));
const isScoringV7RenderingEnabled = vi.fn();
vi.mock("@/lib/feature-flags", () => ({ isScoringV7RenderingEnabled: () => isScoringV7RenderingEnabled() }));
const captureServerError = vi.fn();
vi.mock("@/lib/analytics/server-errors", () => ({ captureServerError: (...a: unknown[]) => captureServerError(...a) }));

import { materializeScoreReceiptV7 } from "./score-receipt-v7";
import { issueScoreReceiptIfConsented } from "./issue-receipt";

beforeEach(() => {
  vi.mocked(materializeScoreReceiptV7).mockReset();
  captureServerError.mockReset();
  isScoringV7RenderingEnabled.mockReset().mockResolvedValue(true);
  issueReceiptVerificationV7.mockReset().mockResolvedValue("v7.token");
});

describe("issueScoreReceiptIfConsented", () => {
  it("reports an issued receipt", async () => {
    vi.mocked(materializeScoreReceiptV7).mockResolvedValue({ status: "issued", snapshot: { receipt: { receipt: {} } } as never, publication: "inserted" });
    expect(await issueScoreReceiptIfConsented("alice")).toBe("issued");
    // The receipt and the link that resolves it are issued together.
    expect(issueReceiptVerificationV7).toHaveBeenCalledOnce();
    expect(captureServerError).not.toHaveBeenCalled();
  });

  it("stays silent for a subject who has not consented to publication", async () => {
    vi.mocked(materializeScoreReceiptV7).mockResolvedValue({ status: "unavailable", reason: "not_consented" });
    expect(await issueScoreReceiptIfConsented("alice")).toBe("skipped");
    expect(captureServerError).not.toHaveBeenCalled();
  });

  it("captures a storage failure, because a failed durable write must stay observable", async () => {
    vi.mocked(materializeScoreReceiptV7).mockResolvedValue({ status: "unavailable", reason: "storage_error" });
    expect(await issueScoreReceiptIfConsented("alice")).toBe("failed");
    expect(captureServerError).toHaveBeenCalledOnce();
  });

  it("never lets a thrown error escape into the caller's response", async () => {
    vi.mocked(materializeScoreReceiptV7).mockRejectedValue(new Error("boom"));
    expect(await issueScoreReceiptIfConsented("alice")).toBe("failed");
    expect(captureServerError).toHaveBeenCalledOnce();
  });
});

describe("the scoring_v7_rendering gate", () => {
  it("mints nothing while the flag is off", async () => {
    isScoringV7RenderingEnabled.mockResolvedValue(false);

    expect(await issueScoreReceiptIfConsented("alice")).toBe("skipped");
    expect(materializeScoreReceiptV7).not.toHaveBeenCalled();
  });
});

describe("the receipt and its verification link are one act", () => {
  it("repairs an unchanged durable receipt after verification failed, without issuing another revision", async () => {
    const snapshot = { receipt: { receipt: { revisionId: "same-revision" } } } as never;
    vi.mocked(materializeScoreReceiptV7)
      .mockResolvedValueOnce({ status: "issued", snapshot, publication: "inserted" })
      .mockResolvedValueOnce({ status: "stored", snapshot });
    issueReceiptVerificationV7.mockRejectedValueOnce(new Error("temporary signing failure"));
    expect(await issueScoreReceiptIfConsented("alice")).toBe("failed");
    expect(await issueScoreReceiptIfConsented("alice")).toBe("skipped");
    expect(issueReceiptVerificationV7).toHaveBeenCalledTimes(2);
    expect(issueReceiptVerificationV7.mock.calls[0]).toEqual(issueReceiptVerificationV7.mock.calls[1]);
  });

  it("keeps repair failure observable, including withdrawal during repair", async () => {
    vi.mocked(materializeScoreReceiptV7).mockResolvedValue({ status: "stored", snapshot: { receipt: {} } as never });
    issueReceiptVerificationV7.mockRejectedValue(new Error("Publication withdrawn"));
    expect(await issueScoreReceiptIfConsented("alice")).toBe("failed");
    expect(captureServerError).toHaveBeenCalledOnce();
  });

  it("reports failure, and captures it, when the receipt issues but its link does not", async () => {
    vi.mocked(materializeScoreReceiptV7).mockResolvedValue({ status: "issued", snapshot: { receipt: { receipt: {} } } as never, publication: "inserted" });
    issueReceiptVerificationV7.mockRejectedValue(new Error("signing key unavailable"));

    // Not "issued": a receipt whose /verify link answers "not found" is a
    // badge carrying an attestation nobody can resolve.
    expect(await issueScoreReceiptIfConsented("alice")).toBe("failed");
    expect(captureServerError).toHaveBeenCalledOnce();
  });
});
