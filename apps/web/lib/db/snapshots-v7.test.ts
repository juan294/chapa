import { beforeEach, describe, expect, it, vi } from "vitest";
import { canonicalJson } from "@chapa/shared";
import { receiptFixtureV7 } from "@/lib/history/__fixtures__/receipts-v7";
import { getSupabase } from "./supabase";
import { dbPublishReceiptV7, dbReceiptManifestV7, dbReadReceiptV7 } from "./snapshots";
vi.mock("./supabase", () => ({ getSupabase: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
describe("detached receipt publication", () => {
  it("returns the validated frozen payload when the caller mutates its object during storage await", async () => {
    const original = await receiptFixtureV7();
    const mutable = structuredClone(original);
    const rpc = vi.fn(async (_name: string, args: { p_canonical: string }) => {
      Object.assign(mutable.receipt, { subjectRef: "private-identity" });
      return { data: { status: "inserted", canonicalReceipt: args.p_canonical, trend: null }, error: null };
    });
    vi.mocked(getSupabase).mockReturnValue({ rpc } as unknown as NonNullable<ReturnType<typeof getSupabase>>);
    const result = await dbPublishReceiptV7("owner", "owner", mutable);
    expect(result.snapshot.receipt).toEqual(original);
    expect(result.snapshot.receipt).not.toBe(mutable);
    expect(Object.isFrozen(result.snapshot.receipt.receipt)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// #1335 phase 5 followup — dbReceiptManifestV7/dbReadReceiptV7 are exercised
// everywhere they're consumed (score-receipt-v7.ts, snapshot-cache.ts) only
// through a mocked "@/lib/db/snapshots", and the real-DB contract test calls
// the underlying `scoring_v7_receipt_manifest`/`scoring_v7_read_receipt` RPCs
// directly, bypassing these wrapper functions' own row-shape validation
// (`receiptManifest()`) and canonical/identity round-trip checks. Nothing
// exercised the wrappers' real implementation until this file.
// ---------------------------------------------------------------------------

function mockRpc(rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { code: string } | null }>) {
  vi.mocked(getSupabase).mockReturnValue({ rpc } as unknown as NonNullable<ReturnType<typeof getSupabase>>);
}

describe("dbReceiptManifestV7", () => {
  it("returns null and lowercases the owner when the manifest RPC reports no current subject", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: null }));
    mockRpc(rpc);
    expect(await dbReceiptManifestV7("Owner")).toBeNull();
    expect(rpc).toHaveBeenCalledWith("scoring_v7_receipt_manifest", { p_owner: "owner", p_revision: null });
  });

  it("passes an explicit revisionId through as p_revision", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: null }));
    mockRpc(rpc);
    await dbReceiptManifestV7("owner", "rev-1");
    expect(rpc).toHaveBeenCalledWith("scoring_v7_receipt_manifest", { p_owner: "owner", p_revision: "rev-1" });
  });

  it("maps a manifest row with no trend", async () => {
    mockRpc(async () => ({ data: { revisionId: "rev-1", policyVersion: "v7", trend: null }, error: null }));
    expect(await dbReceiptManifestV7("owner")).toEqual({ revisionId: "rev-1", policyVersion: "v7", trend: null });
  });

  it("maps a manifest row's snake_case trend into a TrendAnchor", async () => {
    mockRpc(async () => ({
      data: {
        revisionId: "rev-1", policyVersion: "v7",
        trend: { policy_version: "v7", date: "2026-09-01", receipt_id: "rev-1", raw_value: 40, value: 42.5, previous_receipt_id: "rev-0" },
      },
      error: null,
    }));
    expect(await dbReceiptManifestV7("owner")).toEqual({
      revisionId: "rev-1", policyVersion: "v7",
      trend: { policyVersion: "v7", referenceDate: "2026-09-01", receiptRevisionId: "rev-1", rawPoint: 40, unroundedValue: 42.5, previousAnchorRevisionId: "rev-0" },
    });
  });

  it("throws unavailable when there is no Supabase client", async () => {
    vi.mocked(getSupabase).mockReturnValue(null);
    await expect(dbReceiptManifestV7("owner")).rejects.toMatchObject({ code: "unavailable" });
  });

  it("throws the RPC's own error code", async () => {
    mockRpc(async () => ({ data: null, error: { code: "42501" } }));
    await expect(dbReceiptManifestV7("owner")).rejects.toMatchObject({ code: "42501" });
  });

  it.each([
    ["missing revisionId", { policyVersion: "v7", trend: null }],
    ["wrong policyVersion", { revisionId: "rev-1", policyVersion: "v7.2", trend: null }],
    ["trend receipt_id mismatch", { revisionId: "rev-1", policyVersion: "v7", trend: { policy_version: "v7", date: "2026-09-01", receipt_id: "other", raw_value: 1, value: 1, previous_receipt_id: null } }],
    ["trend value out of range", { revisionId: "rev-1", policyVersion: "v7", trend: { policy_version: "v7", date: "2026-09-01", receipt_id: "rev-1", raw_value: 1, value: 101, previous_receipt_id: null } }],
    ["trend previous_receipt_id not a string", { revisionId: "rev-1", policyVersion: "v7", trend: { policy_version: "v7", date: "2026-09-01", receipt_id: "rev-1", raw_value: 1, value: 1, previous_receipt_id: 7 } }],
  ])("rejects a malformed manifest row (%s) as a contract violation", async (_label, data) => {
    mockRpc(async () => ({ data, error: null }));
    await expect(dbReceiptManifestV7("owner")).rejects.toMatchObject({ code: "contract" });
  });
});

describe("dbReadReceiptV7", () => {
  it("returns null when the read RPC reports no current subject", async () => {
    mockRpc(async () => ({ data: null, error: null }));
    expect(await dbReadReceiptV7("owner")).toBeNull();
  });

  it("returns the receipt snapshot for a valid canonical row with no trend", async () => {
    const fixture = await receiptFixtureV7();
    const canonical = canonicalJson(fixture.receipt);
    mockRpc(async () => ({ data: { revisionId: fixture.receipt.revisionId, policyVersion: "v7", trend: null, canonicalReceipt: canonical }, error: null }));
    const snapshot = await dbReadReceiptV7("owner");
    expect(snapshot?.receipt.receipt).toEqual(fixture.receipt);
    expect(snapshot?.trend).toEqual({ status: "gap", referenceDate: fixture.receipt.window.referenceDate, reason: "missing" });
  });

  it("throws a contract violation when canonicalReceipt is not a string", async () => {
    const fixture = await receiptFixtureV7();
    mockRpc(async () => ({ data: { revisionId: fixture.receipt.revisionId, policyVersion: "v7", trend: null, canonicalReceipt: 12345 }, error: null }));
    await expect(dbReadReceiptV7("owner")).rejects.toMatchObject({ code: "contract" });
  });

  it("throws a contract violation when the stored canonical bytes are not actually canonical (tamper/corruption)", async () => {
    const fixture = await receiptFixtureV7();
    const notReallyCanonical = `${canonicalJson(fixture.receipt)} `; // trailing whitespace parses fine but re-canonicalizes differently
    mockRpc(async () => ({ data: { revisionId: fixture.receipt.revisionId, policyVersion: "v7", trend: null, canonicalReceipt: notReallyCanonical }, error: null }));
    await expect(dbReadReceiptV7("owner")).rejects.toMatchObject({ code: "contract" });
  });

  it("throws a contract violation when the manifest's revisionId does not match the embedded receipt", async () => {
    const fixture = await receiptFixtureV7();
    const canonical = canonicalJson(fixture.receipt);
    mockRpc(async () => ({ data: { revisionId: "a-different-revision", policyVersion: "v7", trend: null, canonicalReceipt: canonical }, error: null }));
    await expect(dbReadReceiptV7("owner")).rejects.toMatchObject({ code: "contract" });
  });

  it("throws the RPC's own error code", async () => {
    mockRpc(async () => ({ data: null, error: { code: "57014" } }));
    await expect(dbReadReceiptV7("owner")).rejects.toMatchObject({ code: "57014" });
  });
});
