import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRpc = vi.fn();

vi.mock("./supabase", () => ({
  getSupabase: vi.fn(() => ({ rpc: mockRpc })),
}));

import { getSupabase } from "./supabase";
import { dbVerificationRpcV7 } from "./verification";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("dbVerificationRpcV7", () => {
  it("returns the RPC's data on success", async () => {
    mockRpc.mockResolvedValue({ data: { status: "current" }, error: null });

    const result = await dbVerificationRpcV7("scoring_v7_read_verification", { p_revision: "abc" });

    expect(result).toEqual({ status: "current" });
    expect(mockRpc).toHaveBeenCalledWith("scoring_v7_read_verification", { p_revision: "abc" });
  });

  it("fails closed when Supabase is unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);

    await expect(dbVerificationRpcV7("scoring_v7_read_verification", {})).rejects.toThrow(
      "Receipt verification storage unavailable",
    );
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("fails closed and never leaks the underlying database error", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "secret schema detail" } });

    await expect(dbVerificationRpcV7("scoring_v7_read_verification", {})).rejects.toThrow(
      "Receipt verification storage unavailable",
    );
  });
});
