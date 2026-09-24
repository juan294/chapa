import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./score-receipt-v7", () => ({ readScoreReceiptV7: vi.fn() }));
vi.mock("./score-receipt-observed", () => ({ readObservedScoreReceipt: vi.fn() }));
vi.mock("@/lib/verification/receipt-token", () => ({ deriveReceiptVerificationTokenV7: vi.fn() }));
vi.mock("@/lib/verification/store", () => ({ getReceiptVerificationV7: vi.fn() }));

import { readScoreReceiptV7 } from "./score-receipt-v7";
import { readObservedScoreReceipt } from "./score-receipt-observed";
import { deriveReceiptVerificationTokenV7 } from "@/lib/verification/receipt-token";
import { getReceiptVerificationV7 } from "@/lib/verification/store";
import { resolveBadgeVerification } from "./badge-verification";

const identity = { receiptId: "family-a", revisionId: "revision-a", revision: 1, contentHash: "hash-a" };
const snapshot = {
  receipt: {
    receipt: { policyVersion: "v7", ...identity, window: { referenceDate: "2026-09-01" } },
    contentHash: { value: "hash-a" },
  },
};
const profile = (policyVersion: "v7" | "v7.2") => ({
  stats: { handle: "alice" },
  scoring: { policyVersion, identity },
}) as unknown as Parameters<typeof resolveBadgeVerification>[0];

beforeEach(() => {
  vi.mocked(readObservedScoreReceipt).mockReset();
  vi.mocked(readScoreReceiptV7).mockReset().mockResolvedValue(snapshot as never);
  vi.mocked(deriveReceiptVerificationTokenV7).mockReset().mockResolvedValue("v7.revision-a.sig");
  vi.mocked(getReceiptVerificationV7).mockReset().mockResolvedValue({
    version: "v7", status: "current", revisionId: "revision-a", issuanceRecorded: true,
    signatureAuthenticated: true, envelope: snapshot.receipt,
  } as never);
});

describe("resolveBadgeVerification", () => {
  it("binds the current point policy to its exact registered issuance", async () => {
    const envelope = { ...snapshot.receipt, receipt: { ...snapshot.receipt.receipt, policyVersion: "v7.2" } };
    vi.mocked(readObservedScoreReceipt).mockResolvedValue({ status: "found", envelope } as never);
    vi.mocked(getReceiptVerificationV7).mockResolvedValue({
      status: "current", revisionId: "revision-a", issuanceRecorded: true, signatureAuthenticated: true, envelope,
    } as never);
    expect(await resolveBadgeVerification(profile("v7.2"))).toEqual({ hash: "v7.revision-a.sig", date: "2026-09-01" });
    expect(readObservedScoreReceipt).toHaveBeenCalledWith("alice", "revision-a");
    expect(readScoreReceiptV7).not.toHaveBeenCalled();
  });

  it("returns null when there is no receipt to attest (no scoring model)", async () => {
    expect(await resolveBadgeVerification({ stats: { handle: "alice" }, scoring: undefined } as unknown as Parameters<typeof resolveBadgeVerification>[0])).toBeNull();
    expect(readScoreReceiptV7).not.toHaveBeenCalled();
    expect(readObservedScoreReceipt).not.toHaveBeenCalled();
  });

  it("reads materialized A exactly even when latest B exists", async () => {
    vi.mocked(readScoreReceiptV7).mockImplementation(async (_handle, revision) => revision === "revision-a" ? snapshot as never : {
      receipt: { receipt: { ...snapshot.receipt.receipt, revisionId: "revision-b" }, contentHash: { value: "hash-b" } },
    } as never);
    expect(await resolveBadgeVerification(profile("v7"))).toEqual({ hash: "v7.revision-a.sig", date: "2026-09-01" });
    expect(readScoreReceiptV7).toHaveBeenCalledWith("alice", "revision-a");
  });

  it("permits recorded superseded A to verify the badge that still displays A", async () => {
    vi.mocked(getReceiptVerificationV7).mockResolvedValue({
      version: "v7", status: "superseded", revisionId: "revision-a", issuanceRecorded: true,
      signatureAuthenticated: true, envelope: snapshot.receipt,
    } as never);
    expect(await resolveBadgeVerification(profile("v7"))).toEqual({ hash: "v7.revision-a.sig", date: "2026-09-01" });
  });

  it.each([null, { status: "revoked" }, { status: "current", issuanceRecorded: true, signatureAuthenticated: false }])(
    "shows no strip without authenticated recorded issuance (%j)", async record => {
      vi.mocked(getReceiptVerificationV7).mockResolvedValue(record as never);
      expect(await resolveBadgeVerification(profile("v7"))).toBeNull();
    },
  );

  it.each(["receiptId", "revisionId", "revision", "policyVersion"])("rejects mismatched %s from storage", async key => {
    vi.mocked(readScoreReceiptV7).mockResolvedValue({ ...snapshot, receipt: {
      ...snapshot.receipt, receipt: { ...snapshot.receipt.receipt, [key]: "different" },
    } } as never);
    expect(await resolveBadgeVerification(profile("v7"))).toBeNull();
    expect(deriveReceiptVerificationTokenV7).not.toHaveBeenCalled();
  });

  it("rejects a changed content hash", async () => {
    vi.mocked(readScoreReceiptV7).mockResolvedValue({ ...snapshot, receipt: { ...snapshot.receipt, contentHash: { value: "other" } } } as never);
    expect(await resolveBadgeVerification(profile("v7"))).toBeNull();
  });

  it("fails closed on missing receipt or failed verification read", async () => {
    vi.mocked(readScoreReceiptV7).mockResolvedValueOnce(null);
    expect(await resolveBadgeVerification(profile("v7"))).toBeNull();
    vi.mocked(getReceiptVerificationV7).mockRejectedValueOnce(new Error("storage unavailable"));
    expect(await resolveBadgeVerification(profile("v7"))).toBeNull();
  });
});
