import { beforeEach, describe, expect, it, vi } from "vitest";
import { refreshSourceLink } from "./source-refresh";
import { readSourceAuthorization, type SourceAuthorization } from "./source-authorization";
import { claimPlatformTokenRefresh, finishPlatformTokenRefresh } from "@/lib/db/platform-token-refresh";
import { refreshGitlabToken } from "@/lib/auth/gitlab";
vi.mock("./source-authorization", async original => ({ ...await original<typeof import("./source-authorization")>(), readSourceAuthorization: vi.fn() }));
vi.mock("@/lib/db/platform-token-refresh", () => ({ claimPlatformTokenRefresh: vi.fn(), finishPlatformTokenRefresh: vi.fn() }));
vi.mock("@/lib/auth/bitbucket", () => ({ isTokenExpired: () => true, refreshBitbucketToken: vi.fn() }));
vi.mock("@/lib/auth/codeberg", () => ({ refreshCodebergToken: vi.fn() }));
vi.mock("@/lib/auth/gitlab", () => ({ refreshGitlabToken: vi.fn() }));
vi.mock("@/lib/env", () => ({ getGitlabClientId: () => "client", getGitlabClientSecret: () => "secret" }));
const initial: Extract<SourceAuthorization, { status: "authorized" }> = { status: "authorized", consentVersion: "v1", link: { id: "11111111-1111-4111-8111-111111111111", updatedAt: "2026-09-05T12:00:00.000001Z", handle: "alice", platform: "gitlab", remoteLogin: "alice-lab", tokens: { accessToken: "old", refreshToken: "refresh", expiresAt: new Date("2026-09-01") } } };
const input = { owner: "alice", provider: "gitlab" as const };
beforeEach(() => { vi.resetAllMocks(); vi.mocked(readSourceAuthorization).mockResolvedValue(initial); vi.mocked(claimPlatformTokenRefresh).mockResolvedValue({ status: "claimed", attemptId: "attempt1" }); });
describe("durable current grant refresh", () => {
 it("never claims, refreshes or mutates on a read-only request", async () => {
  expect(await refreshSourceLink(initial, { ...input, readOnly: true })).toBe(initial);
  expect(refreshGitlabToken).not.toHaveBeenCalled(); expect(claimPlatformTokenRefresh).not.toHaveBeenCalled();
 });
 it("retains a connected expired account lacking a refresh token", async () => {
  expect(await refreshSourceLink({ ...initial, link: { ...initial.link!, tokens: { ...initial.link!.tokens, refreshToken: null } } }, input)).toEqual({ status: "unavailable" });
  expect(claimPlatformTokenRefresh).not.toHaveBeenCalled(); expect(refreshGitlabToken).not.toHaveBeenCalled();
 });
 it.each(["busy", "stale"] as const)("does not contact the provider after a %s claim", async status => {
  vi.mocked(claimPlatformTokenRefresh).mockResolvedValue({ status });
  expect(await refreshSourceLink(initial, input)).toEqual({ status: "unavailable" });
  expect(refreshGitlabToken).not.toHaveBeenCalled(); expect(finishPlatformTokenRefresh).not.toHaveBeenCalled();
 });
 it("fails closed without HTTP if claim storage is unavailable or consent is missing", async () => {
  vi.mocked(claimPlatformTokenRefresh).mockRejectedValue(new Error("private transport body"));
  expect(await refreshSourceLink(initial, input, false)).toEqual({ status: "unavailable" }); expect(refreshGitlabToken).not.toHaveBeenCalled();
 });
 it.each(["revoked", "transient"] as const)("retains the barrier and connection after %s", async reason => {
  vi.mocked(refreshGitlabToken).mockResolvedValue({ ok: false, reason });
  expect(await refreshSourceLink(initial, input)).toEqual({ status: "unavailable" });
  expect(claimPlatformTokenRefresh).toHaveBeenCalledOnce(); expect(refreshGitlabToken).toHaveBeenCalledOnce();
  expect(finishPlatformTokenRefresh).not.toHaveBeenCalled();
 });
 it("does not finish after metadata or linkage changes while the provider is pending", async () => {
  vi.mocked(refreshGitlabToken).mockImplementation(async () => {
   vi.mocked(readSourceAuthorization).mockResolvedValue({ ...initial, link: { ...initial.link!, updatedAt: "2026-09-05T12:00:00.000002Z" } });
   return { ok: true, tokens: { access_token: "new", token_type: "bearer", refresh_token: "next", expires_in: 3600 } };
  });
  expect(await refreshSourceLink(initial, input)).toEqual({ status: "unavailable" }); expect(finishPlatformTokenRefresh).not.toHaveBeenCalled();
 });
 it.each(["refresh", undefined])("atomically finishes known success with reusable/omitted refresh token %s", async refreshToken => {
  const version = "2026-09-05T12:00:00.000002Z";
  vi.mocked(refreshGitlabToken).mockResolvedValue({ ok: true, tokens: { access_token: "new", token_type: "bearer", ...(refreshToken ? { refresh_token: refreshToken } : {}), expires_in: 3600 } });
  const after = { ...initial, link: { ...initial.link!, updatedAt: version, tokens: { ...initial.link!.tokens, accessToken: "new" } } };
  vi.mocked(finishPlatformTokenRefresh).mockImplementation(async () => { vi.mocked(readSourceAuthorization).mockResolvedValue(after); return { status: "updated", id: initial.link!.id, updatedAt: version }; });
  expect(await refreshSourceLink(initial, input)).toEqual(after);
  expect(finishPlatformTokenRefresh).toHaveBeenCalledWith(initial.link, "attempt1", expect.objectContaining({ accessToken: "new", refreshToken: "refresh" }));
 });
});
