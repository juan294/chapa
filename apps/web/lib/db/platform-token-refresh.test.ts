import { beforeEach, describe, expect, it, vi } from "vitest";
import { claimPlatformTokenRefresh, finishPlatformTokenRefresh, releasePlatformTokenRefreshBarrier } from "./platform-token-refresh";
import { getSupabase } from "./supabase";
vi.mock("./supabase", () => ({ getSupabase: vi.fn() }));
vi.mock("@/lib/env", () => ({ getNextauthSecret: () => "test-secret" }));
vi.mock("@/lib/auth/github", () => ({ encryptToken: (value: string) => `encrypted:${value}` }));
const rpc = vi.fn();
const link = { id: "11111111-1111-4111-8111-111111111111", updatedAt: "2026-09-05T12:00:00.000001Z", handle: "alice", platform: "gitlab" };
const attemptId = "22222222-2222-4222-8222-222222222222";
beforeEach(() => { rpc.mockReset(); vi.mocked(getSupabase).mockReturnValue({ rpc } as never); });
describe("private refresh barrier adapter", () => {
 it("binds a generated attempt to the exact owner/link/version without credentials", async () => {
  rpc.mockImplementation(async (_name, args) => ({ data: { status: "claimed", attemptId: args.p_attempt_id }, error: null }));
  expect((await claimPlatformTokenRefresh(link)).status).toBe("claimed");
  expect(rpc).toHaveBeenCalledWith("platform_token_refresh_claim", { p_owner: "alice", p_actor: "alice", p_platform: "gitlab", p_link_id: link.id, p_link_version: link.updatedAt, p_attempt_id: expect.any(String) });
 });
 it.each(["busy", "stale"] as const)("preserves a %s claim response", async status => {
  rpc.mockResolvedValue({ data: { status }, error: null });
  expect(await claimPlatformTokenRefresh(link)).toEqual({ status });
 });
 it("rejects a claimed response naming another attempt", async () => {
  rpc.mockResolvedValue({ data: { status: "claimed", attemptId }, error: null });
  await expect(claimPlatformTokenRefresh(link)).rejects.toThrow("Platform refresh claim unavailable");
 });
 it("encrypts only finish credentials and verifies the returned microsecond advance", async () => {
  const reply = { status: "updated", id: link.id, updatedAt: "2026-09-05T12:00:00.000002+00:00" };
  rpc.mockResolvedValue({ data: reply, error: null });
  expect(await finishPlatformTokenRefresh(link, attemptId, { accessToken: "new", refreshToken: "same", expiresAt: null })).toEqual(reply);
  expect(rpc).toHaveBeenCalledWith("platform_token_refresh_finish", expect.objectContaining({ p_link_id: link.id, p_link_version: link.updatedAt, p_attempt_id: attemptId, p_access_token: "encrypted:new", p_refresh_token: "encrypted:same" }));
 });
 it.each([{ status: "updated", id: attemptId, updatedAt: "2026-09-05T12:00:00.000002Z" }, { status: "updated", id: link.id, updatedAt: link.updatedAt }, { status: "updated", id: link.id, updatedAt: "infinity" }])("rejects a mismatched finish reply", async data => {
  rpc.mockResolvedValue({ data, error: null });
  await expect(finishPlatformTokenRefresh(link, attemptId, { accessToken: "new", refreshToken: null, expiresAt: null })).rejects.toThrow("Platform refresh completion unavailable");
 });
 it("releases superseded attempts against the exact current link version", async () => {
  rpc.mockResolvedValue({ data: { status: "released", cleared: 1 }, error: null });
  expect(await releasePlatformTokenRefreshBarrier(link)).toEqual({ status: "released", cleared: 1 });
  expect(rpc).toHaveBeenCalledWith("platform_token_refresh_release", { p_owner: "alice", p_actor: "alice", p_platform: "gitlab", p_link_id: link.id, p_link_version: link.updatedAt });
 });
 it("carries no credential into a release and rejects an unexpected reply", async () => {
  rpc.mockResolvedValue({ data: { status: "released", cleared: -1 }, error: null });
  await expect(releasePlatformTokenRefreshBarrier(link)).rejects.toThrow("Platform refresh release unavailable");
  expect(rpc.mock.calls[0]![1]).not.toHaveProperty("p_access_token");
 });
 it("does not echo transport bodies and does not retry an uncertain claim", async () => {
  rpc.mockRejectedValue(new Error("private-response-sentinel"));
  await expect(claimPlatformTokenRefresh(link)).rejects.toThrow("Platform refresh claim unavailable"); expect(rpc).toHaveBeenCalledOnce();
 });
});
