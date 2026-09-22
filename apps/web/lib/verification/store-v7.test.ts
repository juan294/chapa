import { beforeEach, describe, expect, it, vi } from "vitest";
import { canonicalJson } from "@chapa/shared";
import { receiptFixtureV7 } from "@/lib/history/__fixtures__/receipts-v7";
import { observedReceiptFixture } from "@/lib/history/__fixtures__/receipts-observed";
import { signReceiptV7 } from "./hmac";
import { getReceiptVerificationV7, issueReceiptVerificationV7 } from "./store";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), secret: vi.fn((): string | null => "secret") }));
vi.mock("@/lib/db/verification", () => ({ dbVerificationRpcV7: mocks.rpc, dbGetVerification: vi.fn(), dbStoreVerification: vi.fn() }));
vi.mock("@/lib/env", () => ({ getChapaVerificationSecret: mocks.secret, getVercelEnv: () => "test" }));
beforeEach(() => { vi.resetAllMocks(); mocks.secret.mockReturnValue("secret"); });
describe("durable v7 verification", () => {
  it("reads authenticated current-policy issuance with its exact numerical receipt", async () => {
    const envelope = await observedReceiptFixture();
    const token = await signReceiptV7(envelope, "secret");
    mocks.rpc.mockResolvedValue({ status: "current", canonical: canonicalJson(envelope.receipt), keyVersion: "v7-1" });
    expect(await getReceiptVerificationV7(token)).toMatchObject({
      issuanceRecorded: true, signatureAuthenticated: true,
      envelope: { receipt: { policyVersion: "v7.2", core: { composite: { displayValue: 46 } } } },
    });
  });
  it("reports recorded issuance honestly when the signing key rotates", async () => {
    const envelope = await receiptFixtureV7();
    const token = await signReceiptV7(envelope, "old-secret");
    mocks.rpc.mockResolvedValue({ status: "current", canonical: canonicalJson(envelope.receipt), keyVersion: "v7-1" });
    const result = await getReceiptVerificationV7(token);
    expect(result).toMatchObject({ issuanceRecorded: true, signatureAuthenticated: false, sourceEvidence: "not_verified" });
  });
  it("returns only an unauthenticated tombstone after withdrawal during a read", async () => {
    const envelope = await receiptFixtureV7();
    const token = await signReceiptV7(envelope, "secret");
    mocks.rpc.mockResolvedValueOnce({ status: "current", canonical: canonicalJson(envelope.receipt), keyVersion: "v7-1" }).mockResolvedValueOnce({ status: "revoked" });
    expect(await getReceiptVerificationV7(token)).toEqual({ version: "v7", status: "revoked", revisionId: envelope.receipt.revisionId, signatureAuthenticated: false });
  });
  it("cannot publish a link after persistence fails", async () => {
    mocks.rpc.mockRejectedValue(new Error("Storage unavailable"));
    await expect(issueReceiptVerificationV7("owner", "owner", await receiptFixtureV7())).rejects.toThrow();
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("does not authenticate fabricated signatures on revoked UUIDs", async () => {
    const envelope = await receiptFixtureV7();
    mocks.rpc.mockResolvedValue({ status: "revoked" });
    expect(await getReceiptVerificationV7(`v7.${envelope.receipt.revisionId}.${"0".repeat(64)}`)).toMatchObject({ status: "revoked", signatureAuthenticated: false });
  });
});
