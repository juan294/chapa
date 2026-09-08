import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "@chapa/shared";
import { receiptFixtureV7 } from "@/lib/history/__fixtures__/receipts-v7";
import { observedReceiptFixture } from "@/lib/history/__fixtures__/receipts-observed";
import { signReceiptV7, authenticateReceiptV7 } from "./hmac";
import { parseVerificationTokenV7 } from "./constants";

describe("v7 full receipt authentication", () => {
  it("authenticates the registered v7.2 point receipt without relabelling historical v7.1", async () => {
    const envelope = await observedReceiptFixture();
    const token = await signReceiptV7(envelope, "secret");
    expect(await authenticateReceiptV7(token, envelope, "secret")).toBe(true);
    expect(envelope.receipt.policyVersion).toBe("v7.2");
    expect(envelope.receipt.core.composite.displayValue).toBe(46);
    const tampered = { ...envelope, receipt: { ...envelope.receipt, core: { ...envelope.receipt.core,
      composite: { ...envelope.receipt.core.composite, exact: envelope.receipt.core.composite.exact + 1 },
    } } };
    expect(await authenticateReceiptV7(token, tampered, "secret")).toBe(false);
  });
  it("signs every canonical byte and carries the immutable revision identity", async () => {
    const envelope = await receiptFixtureV7();
    const token = await signReceiptV7(envelope, "secret");
    const signature = createHmac("sha256", "secret").update(canonicalJson(envelope.receipt), "utf8").digest("hex");
    expect(token).toBe(`v7.${envelope.receipt.revisionId}.${signature}`);
    expect(token).toHaveLength(104);
    expect(await authenticateReceiptV7(token, envelope, "secret")).toBe(true);
    expect(await authenticateReceiptV7(token, envelope, "rotated-secret")).toBe(false);
    expect(await authenticateReceiptV7(token, envelope, null)).toBe(false);
  });
  it("rejects another revision and malformed/truncated tokens", async () => {
    const first = await receiptFixtureV7();
    const second = await receiptFixtureV7();
    const token = await signReceiptV7(first, "secret");
    expect(await authenticateReceiptV7(token, second, "secret")).toBe(false);
    expect(parseVerificationTokenV7(token.slice(0, -1))).toBeNull();
    expect(parseVerificationTokenV7(token.toUpperCase())).toBeNull();
  });
});
