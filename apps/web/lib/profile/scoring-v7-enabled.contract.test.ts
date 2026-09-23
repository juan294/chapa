import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getServiceClient } from "@/test/contract/invoke";
import { readScoringRenderSelection } from "@/lib/scoring-render-selection";
import { getReceiptVerificationV7 } from "@/lib/verification/store";
import { readRenderableReceipt } from "./score-model";
import { resolveBadgeVerification } from "./badge-verification";
import { issueScoreReceipt } from "./issue-receipt";
import { observedReceiptViewModel } from "./score-view-model";

/**
 * The v7 path with `scoring_v7_rendering` ON, against real persistence (#1320).
 *
 * The suite default is off, because off is what ships today. This file turns it
 * on for its own scope so the behaviour the flag exists to enable is exercised
 * where the manifest, the cache and the durable table can actually disagree
 * with each other.
 *
 * That distinction is not theoretical. An optimization to `readScoreReceiptV7`
 * assumed a null from the cached path proved no receipt existed; the unit test
 * mocked that path and asserted the same false assumption, so it passed, and
 * only real persistence showed the manifest can be absent while the receipt is
 * durably stored. Every remaining seam here has the same shape.
 */

// No network: the receipt is assembled from the ledger and the collectors are
// not what this file is testing.
vi.mock("@/lib/platform/source-collectors", () => ({
  selectSourceEvidence: vi.fn(async () => ({ status: "unlinked" })),
}));
// Exercise the durable path rather than the Redis mirror.
vi.mock("@/lib/cache/snapshot-cache", () => ({ getCachedReceiptSnapshotV7: vi.fn(async () => null) }));
vi.mock("@/lib/profile/post-write-invalidation", () => ({
  invalidateProfileReadModels: vi.fn(async () => undefined),
}));

vi.mock("@/lib/scoring-render-selection", () => ({ readScoringRenderSelection: vi.fn() }));
const owner = "contract-v7-flag-on";
const db = () => getServiceClient();
const register = async () => db().rpc("scoring_v7_ensure_subject", { p_owner: owner });

beforeEach(async () => {
  vi.mocked(readScoringRenderSelection).mockResolvedValue({ enabled: true, machinePolicy: "v7.2", cacheable: true, capturedAt: Date.parse("2026-09-08T12:00:00.000Z") });
  expect((await db().rpc("scoring_v7_withdraw", { p_owner: owner })).error).toBeNull();
  expect((await register()).error).toBeNull();
});
afterEach(async () => { expect((await db().rpc("scoring_v7_withdraw", { p_owner: owner })).error).toBeNull(); });

describe("the v7 path with rendering enabled", () => {
  it("issues a receipt and the verification record that resolves it, together", async () => {
    // The helper is the production entry point, and it is what binds the two:
    // a receipt whose /verify link answers "not found" is a badge carrying an
    // attestation nobody can resolve.
    expect(await issueScoreReceipt(owner)).toEqual({ status: "issued" });

    const snapshot = await readRenderableReceipt(owner);
    if (!snapshot || "unavailable" in snapshot) throw new Error("Expected observed receipt");
    expect(snapshot).not.toBeNull();

    // The badge's attestation is derived from that receipt rather than stored,
    // so this also proves the derivation and the issued record agree.
    const verification = await resolveBadgeVerification({
      stats: { handle: owner },
      displayImpact: {},
      statsComplete: true,
      scoring: observedReceiptViewModel(owner, snapshot!),
    } as never);
    expect(verification?.hash).toMatch(/^v7\./);

    const resolved = await getReceiptVerificationV7(verification!.hash);
    expect(resolved).not.toBeNull();
    expect(resolved!.signatureAuthenticated).toBe(true);
  });

  it("issues nothing on a second pass over identical evidence", async () => {
    expect(await issueScoreReceipt(owner)).toEqual({ status: "issued" });
    const first = await readRenderableReceipt(owner);

    // What the hourly warm-cache cron does. Without the skip this published a
    // correction every hour, each with its own verification token.
    expect(await issueScoreReceipt(owner)).toEqual({ status: "unchanged" });

    const second = await readRenderableReceipt(owner);
    if (!first || "unavailable" in first || !second || "unavailable" in second) throw new Error("Expected observed receipts");
    expect(second.receipt.receipt.revisionId).toBe(first.receipt.receipt.revisionId);
    expect((await db().from("scoring_v7_receipts").select("id").eq("owner_handle", owner)).data)
      .toHaveLength(1);
  });

  it("stops attesting once publication is withdrawn", async () => {
    expect(await issueScoreReceipt(owner)).toEqual({ status: "issued" });
    const snapshot = await readRenderableReceipt(owner);
    if (!snapshot || "unavailable" in snapshot) throw new Error("Expected observed receipt");
    const verification = await resolveBadgeVerification({
      stats: { handle: owner }, displayImpact: {}, statsComplete: true,
      scoring: observedReceiptViewModel(owner, snapshot!),
    } as never);
    expect(verification).not.toBeNull();

    expect((await db().rpc("scoring_v7_withdraw", { p_owner: owner })).error).toBeNull();

    expect(await readRenderableReceipt(owner)).toBeNull();
    const after = await getReceiptVerificationV7(verification!.hash);
    expect(after === null || after.status === "revoked").toBe(true);
  });

  it("reads and issues nothing at all while the flag is off", async () => {
    expect(await issueScoreReceipt(owner)).toEqual({ status: "issued" });
    vi.mocked(readScoringRenderSelection).mockResolvedValue({ enabled: false, machinePolicy: "v6", cacheable: true, capturedAt: Date.parse("2026-09-08T12:00:00.000Z") });

    // The gate is what keeps this branch inert in an environment whose schema
    // does not have these tables at all.
    expect(await readRenderableReceipt(owner)).toBeNull();
    expect(await issueScoreReceipt(owner)).toEqual({ status: "unchanged" });
  });
});
