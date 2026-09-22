import { beforeEach, describe, expect, it, vi } from "vitest";
import { receiptFixtureV7 } from "@/lib/history/__fixtures__/receipts-v7";
import { getSupabase } from "./supabase";
import { dbPublishReceiptV7 } from "./snapshots";
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
