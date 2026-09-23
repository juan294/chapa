import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  claimPlatformTokenRefresh,
  finishPlatformTokenRefresh,
  releasePlatformTokenRefreshBarrier,
  releasePlatformTokenRefreshAttempt,
  takeoverPlatformTokenRefresh,
  markPlatformNeedsReconnect,
  REFRESH_CLAIM_TAKEOVER_THRESHOLD_SECONDS,
} from "./platform-token-refresh";
import { getSupabase } from "./supabase";
import { captureServerError } from "@/lib/analytics/server-errors";
vi.mock("./supabase", () => ({ getSupabase: vi.fn() }));
vi.mock("@/lib/env", () => ({ getNextauthSecret: () => "test-secret" }));
vi.mock("@/lib/auth/github", () => ({ encryptToken: (value: string) => `encrypted:${value}` }));
vi.mock("@/lib/analytics/server-errors", () => ({ captureServerError: vi.fn() }));
const rpc = vi.fn();
const link = { id: "11111111-1111-4111-8111-111111111111", updatedAt: "2026-09-05T12:00:00.000001Z", handle: "alice", platform: "gitlab" };
const attemptId = "22222222-2222-4222-8222-222222222222";
beforeEach(() => { rpc.mockReset(); vi.mocked(captureServerError).mockReset(); vi.mocked(getSupabase).mockReturnValue({ rpc } as never); });
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

// #1332 — releasePlatformTokenRefreshAttempt, takeoverPlatformTokenRefresh
// and markPlatformNeedsReconnect: same adapter conventions as claim/finish/
// release above (arg construction, credential redaction, malformed-reply
// rejection), plus the observability every durable write in this module now
// carries (CLAUDE.md: "every durable write failure must be observable").
describe("releasePlatformTokenRefreshAttempt", () => {
 it("releases without needsReconnect by default, carrying no credential", async () => {
  rpc.mockResolvedValue({ data: { status: "released", needsReconnect: false }, error: null });
  expect(await releasePlatformTokenRefreshAttempt(link, attemptId)).toEqual({ status: "released", needsReconnect: false });
  expect(rpc).toHaveBeenCalledWith("platform_token_refresh_release_attempt", { p_owner: "alice", p_actor: "alice", p_platform: "gitlab", p_link_id: link.id, p_link_version: link.updatedAt, p_attempt_id: attemptId, p_needs_reconnect: false });
  expect(rpc.mock.calls[0]![1]).not.toHaveProperty("p_access_token");
  expect(captureServerError).not.toHaveBeenCalled();
 });
 it("marks needsReconnect when the caller requests it (definitive revoke)", async () => {
  rpc.mockResolvedValue({ data: { status: "released", needsReconnect: true }, error: null });
  expect(await releasePlatformTokenRefreshAttempt(link, attemptId, true)).toEqual({ status: "released", needsReconnect: true });
  expect(rpc).toHaveBeenCalledWith("platform_token_refresh_release_attempt", expect.objectContaining({ p_needs_reconnect: true }));
  expect(captureServerError).not.toHaveBeenCalled();
 });
 it("preserves a stale reply without capturing an error", async () => {
  rpc.mockResolvedValue({ data: { status: "stale" }, error: null });
  expect(await releasePlatformTokenRefreshAttempt(link, attemptId)).toEqual({ status: "stale" });
  expect(captureServerError).not.toHaveBeenCalled();
 });
 it("captures and rejects a malformed reply", async () => {
  rpc.mockResolvedValue({ data: { status: "released", needsReconnect: "yes" }, error: null });
  await expect(releasePlatformTokenRefreshAttempt(link, attemptId)).rejects.toThrow("Platform refresh release unavailable");
  expect(captureServerError).toHaveBeenCalledOnce();
  expect(captureServerError).toHaveBeenCalledWith(expect.objectContaining({ route: "lib/db/platform-token-refresh:releasePlatformTokenRefreshAttempt", statusCode: 500, error: expect.any(Error) }));
 });
 it("captures and redacts a Supabase RPC error", async () => {
  rpc.mockResolvedValue({ data: null, error: { message: "private-rpc-detail" } });
  await expect(releasePlatformTokenRefreshAttempt(link, attemptId)).rejects.toThrow("Platform refresh release unavailable");
  const captured = vi.mocked(captureServerError).mock.calls[0]![0];
  expect(captured.route).toBe("lib/db/platform-token-refresh:releasePlatformTokenRefreshAttempt");
  expect(captured.statusCode).toBe(500);
  expect((captured.error as Error).message).toContain("private-rpc-detail");
 });
 it("captures when no Supabase client is available", async () => {
  vi.mocked(getSupabase).mockReturnValue(null);
  await expect(releasePlatformTokenRefreshAttempt(link, attemptId)).rejects.toThrow("Platform refresh release unavailable");
  expect(captureServerError).toHaveBeenCalledWith(expect.objectContaining({ route: "lib/db/platform-token-refresh:releasePlatformTokenRefreshAttempt", statusCode: 500 }));
 });
});

describe("takeoverPlatformTokenRefresh", () => {
 it("binds a new generated attempt id and the fixed threshold, carrying no credential", async () => {
  rpc.mockImplementation(async (_name, args) => ({ data: { status: "claimed", attemptId: args.p_new_attempt_id }, error: null }));
  expect(await takeoverPlatformTokenRefresh(link)).toEqual({ status: "claimed", attemptId: expect.any(String) });
  expect(rpc).toHaveBeenCalledWith("platform_token_refresh_takeover", { p_owner: "alice", p_actor: "alice", p_platform: "gitlab", p_link_id: link.id, p_link_version: link.updatedAt, p_new_attempt_id: expect.any(String), p_max_age_seconds: REFRESH_CLAIM_TAKEOVER_THRESHOLD_SECONDS });
  expect(rpc.mock.calls[0]![1]).not.toHaveProperty("p_access_token");
  expect(captureServerError).not.toHaveBeenCalled();
 });
 it.each(["too_fresh", "exhausted", "gone", "stale"] as const)("preserves a %s decline without capturing an error", async status => {
  rpc.mockResolvedValue({ data: { status }, error: null });
  expect(await takeoverPlatformTokenRefresh(link)).toEqual({ status });
  expect(captureServerError).not.toHaveBeenCalled();
 });
 it("captures and rejects a claimed reply naming a different attempt id", async () => {
  rpc.mockResolvedValue({ data: { status: "claimed", attemptId }, error: null });
  await expect(takeoverPlatformTokenRefresh(link)).rejects.toThrow("Platform refresh takeover unavailable");
  expect(captureServerError).toHaveBeenCalledWith(expect.objectContaining({ route: "lib/db/platform-token-refresh:takeoverPlatformTokenRefresh", statusCode: 500, error: expect.any(Error) }));
 });
 it("captures and redacts a Supabase RPC error", async () => {
  rpc.mockResolvedValue({ data: null, error: { message: "private-rpc-detail" } });
  await expect(takeoverPlatformTokenRefresh(link)).rejects.toThrow("Platform refresh takeover unavailable");
  const captured = vi.mocked(captureServerError).mock.calls[0]![0];
  expect(captured.route).toBe("lib/db/platform-token-refresh:takeoverPlatformTokenRefresh");
  expect((captured.error as Error).message).toContain("private-rpc-detail");
 });
 it("captures when no Supabase client is available", async () => {
  vi.mocked(getSupabase).mockReturnValue(null);
  await expect(takeoverPlatformTokenRefresh(link)).rejects.toThrow("Platform refresh takeover unavailable");
  expect(captureServerError).toHaveBeenCalledWith(expect.objectContaining({ route: "lib/db/platform-token-refresh:takeoverPlatformTokenRefresh", statusCode: 500 }));
 });
 it("does not echo transport bodies on a thrown rejection", async () => {
  rpc.mockRejectedValue(new Error("private-response-sentinel"));
  await expect(takeoverPlatformTokenRefresh(link)).rejects.toThrow("Platform refresh takeover unavailable");
  expect(captureServerError).toHaveBeenCalledOnce();
 });
});

describe("markPlatformNeedsReconnect", () => {
 function tableChain(resolveValue: { data: unknown; error: unknown }) {
  const chain = {
   update: vi.fn(() => chain),
   eq: vi.fn(() => chain),
   select: vi.fn(() => Promise.resolve(resolveValue)),
  };
  return chain;
 }
 it("sets needs_reconnect and sends only that boolean, never a credential", async () => {
  const chain = tableChain({ data: [{ id: link.id }], error: null });
  const from = vi.fn(() => chain);
  vi.mocked(getSupabase).mockReturnValue({ rpc, from } as never);
  await markPlatformNeedsReconnect(link);
  expect(from).toHaveBeenCalledWith("user_platforms");
  expect(chain.update).toHaveBeenCalledWith({ needs_reconnect: true });
  expect(chain.eq).toHaveBeenCalledWith("id", link.id);
  expect(chain.eq).toHaveBeenCalledWith("updated_at", link.updatedAt);
  expect(captureServerError).not.toHaveBeenCalled();
 });
 it("captures when no Supabase client is available, without throwing", async () => {
  vi.mocked(getSupabase).mockReturnValue(null);
  await expect(markPlatformNeedsReconnect(link)).resolves.toBeUndefined();
  expect(captureServerError).toHaveBeenCalledWith(expect.objectContaining({ route: "lib/db/platform-token-refresh:markPlatformNeedsReconnect", statusCode: 500 }));
  expect((vi.mocked(captureServerError).mock.calls[0]![0].error as Error).message).toContain(link.id);
 });
 it("captures a Supabase error result, without throwing", async () => {
  const chain = tableChain({ data: null, error: { message: "private-update-detail" } });
  vi.mocked(getSupabase).mockReturnValue({ rpc, from: vi.fn(() => chain) } as never);
  await expect(markPlatformNeedsReconnect(link)).resolves.toBeUndefined();
  const captured = vi.mocked(captureServerError).mock.calls[0]![0];
  expect(captured.route).toBe("lib/db/platform-token-refresh:markPlatformNeedsReconnect");
  expect((captured.error as Error).message).toContain("private-update-detail");
 });
 it("captures a version-guard miss (zero rows matched) as observable, not silent", async () => {
  const chain = tableChain({ data: [], error: null });
  vi.mocked(getSupabase).mockReturnValue({ rpc, from: vi.fn(() => chain) } as never);
  await expect(markPlatformNeedsReconnect(link)).resolves.toBeUndefined();
  const captured = vi.mocked(captureServerError).mock.calls[0]![0];
  expect(captured.route).toBe("lib/db/platform-token-refresh:markPlatformNeedsReconnect");
  expect((captured.error as Error).message).toContain("version-guard miss");
 });
 it("captures a thrown exception without letting it propagate", async () => {
  const from = vi.fn(() => { throw new Error("private-throw-detail"); });
  vi.mocked(getSupabase).mockReturnValue({ rpc, from } as never);
  await expect(markPlatformNeedsReconnect(link)).resolves.toBeUndefined();
  expect(captureServerError).toHaveBeenCalledWith(expect.objectContaining({ route: "lib/db/platform-token-refresh:markPlatformNeedsReconnect", statusCode: 500 }));
 });
});
