import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./score-receipt-v7", () => ({ materializeScoreReceiptV7: vi.fn() }));
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
});

describe("issueScoreReceiptIfConsented", () => {
  it("reports an issued receipt", async () => {
    vi.mocked(materializeScoreReceiptV7).mockResolvedValue({ status: "issued", snapshot: {} as never, publication: "inserted" });
    expect(await issueScoreReceiptIfConsented("alice")).toBe("issued");
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
