import { beforeEach, describe, expect, it, vi } from "vitest";
import { refreshSourceLink } from "./source-refresh";
import { readSourceAuthorization, type SourceAuthorization } from "./source-authorization";
import {
  claimPlatformTokenRefresh,
  finishPlatformTokenRefresh,
  releasePlatformTokenRefreshAttempt,
  takeoverPlatformTokenRefresh,
  markPlatformNeedsReconnect,
} from "@/lib/db/platform-token-refresh";
import { refreshGitlabToken } from "@/lib/auth/gitlab";
vi.mock("./source-authorization", async original => ({ ...await original<typeof import("./source-authorization")>(), readSourceAuthorization: vi.fn() }));
vi.mock("@/lib/db/platform-token-refresh", () => ({
  claimPlatformTokenRefresh: vi.fn(),
  finishPlatformTokenRefresh: vi.fn(),
  releasePlatformTokenRefreshAttempt: vi.fn(),
  takeoverPlatformTokenRefresh: vi.fn(),
  markPlatformNeedsReconnect: vi.fn(),
}));
vi.mock("@/lib/auth/bitbucket", () => ({ isTokenExpired: () => true, refreshBitbucketToken: vi.fn() }));
vi.mock("@/lib/auth/codeberg", () => ({ refreshCodebergToken: vi.fn() }));
vi.mock("@/lib/auth/gitlab", () => ({ refreshGitlabToken: vi.fn() }));
vi.mock("@/lib/env", () => ({ getGitlabClientId: () => "client", getGitlabClientSecret: () => "secret" }));
const initial: Extract<SourceAuthorization, { status: "authorized" }> = { status: "authorized", consentVersion: "v1", link: { id: "11111111-1111-4111-8111-111111111111", updatedAt: "2026-09-05T12:00:00.000001Z", handle: "alice", platform: "gitlab", remoteLogin: "alice-lab", tokens: { accessToken: "old", refreshToken: "refresh", expiresAt: new Date("2026-09-01") } } };
const input = { owner: "alice", provider: "gitlab" as const };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(readSourceAuthorization).mockResolvedValue(initial);
  vi.mocked(claimPlatformTokenRefresh).mockResolvedValue({ status: "claimed", attemptId: "attempt1" });
  vi.mocked(releasePlatformTokenRefreshAttempt).mockResolvedValue({ status: "released", needsReconnect: false });
});
describe("durable current grant refresh", () => {
 it("never claims, refreshes or mutates on a read-only request", async () => {
  expect(await refreshSourceLink(initial, { ...input, readOnly: true })).toBe(initial);
  expect(refreshGitlabToken).not.toHaveBeenCalled(); expect(claimPlatformTokenRefresh).not.toHaveBeenCalled();
 });
 it("retains a connected expired account lacking a refresh token", async () => {
  expect(await refreshSourceLink({ ...initial, link: { ...initial.link!, tokens: { ...initial.link!.tokens, refreshToken: null } } }, input)).toEqual({ status: "unavailable" });
  expect(claimPlatformTokenRefresh).not.toHaveBeenCalled(); expect(refreshGitlabToken).not.toHaveBeenCalled();
 });
 it("does not contact the provider after a stale claim", async () => {
  vi.mocked(claimPlatformTokenRefresh).mockResolvedValue({ status: "stale" });
  expect(await refreshSourceLink(initial, input)).toEqual({ status: "unavailable" });
  expect(refreshGitlabToken).not.toHaveBeenCalled(); expect(finishPlatformTokenRefresh).not.toHaveBeenCalled();
  expect(takeoverPlatformTokenRefresh).not.toHaveBeenCalled();
 });
 it("fails closed without HTTP if claim storage is unavailable or consent is missing", async () => {
  vi.mocked(claimPlatformTokenRefresh).mockRejectedValue(new Error("private transport body"));
  expect(await refreshSourceLink(initial, input, false)).toEqual({ status: "unavailable" }); expect(refreshGitlabToken).not.toHaveBeenCalled();
 });
 it("releases the claim (case 1: no provider request sent) when linkage changes before the request", async () => {
  // The pre-claim recheck must still match `initial` (or the flow never
  // reaches a claim at all); only the POST-claim, pre-request recheck sees
  // the change.
  vi.mocked(readSourceAuthorization)
   .mockResolvedValueOnce(initial)
   .mockResolvedValue({ ...initial, link: { ...initial.link!, updatedAt: "2026-09-05T12:00:00.000009Z" } });
  expect(await refreshSourceLink(initial, input)).toEqual({ status: "unavailable" });
  expect(refreshGitlabToken).not.toHaveBeenCalled();
  expect(claimPlatformTokenRefresh).toHaveBeenCalledOnce();
  expect(releasePlatformTokenRefreshAttempt).toHaveBeenCalledWith(initial.link, "attempt1");
 });
 it("releases the claim and marks needs-reconnect on a definitive revoke (#1332 case 2)", async () => {
  vi.mocked(refreshGitlabToken).mockResolvedValue({ ok: false, outcome: "definitive", reason: "revoked" });
  expect(await refreshSourceLink(initial, input)).toEqual({ status: "unavailable" });
  expect(claimPlatformTokenRefresh).toHaveBeenCalledOnce(); expect(refreshGitlabToken).toHaveBeenCalledOnce();
  expect(releasePlatformTokenRefreshAttempt).toHaveBeenCalledWith(initial.link, "attempt1", true);
  expect(finishPlatformTokenRefresh).not.toHaveBeenCalled();
  expect(markPlatformNeedsReconnect).not.toHaveBeenCalled();
 });
 it("releases the claim without needs-reconnect on a definitive non-revoke failure", async () => {
  vi.mocked(refreshGitlabToken).mockResolvedValue({ ok: false, outcome: "definitive", reason: "transient" });
  expect(await refreshSourceLink(initial, input)).toEqual({ status: "unavailable" });
  expect(releasePlatformTokenRefreshAttempt).toHaveBeenCalledWith(initial.link, "attempt1", false);
  expect(markPlatformNeedsReconnect).not.toHaveBeenCalled();
 });
 it("keeps the barrier on a first-ever ambiguous outcome, releasing and marking nothing", async () => {
  vi.mocked(refreshGitlabToken).mockResolvedValue({ ok: false, outcome: "ambiguous" });
  expect(await refreshSourceLink(initial, input)).toEqual({ status: "unavailable" });
  expect(releasePlatformTokenRefreshAttempt).not.toHaveBeenCalled();
  expect(markPlatformNeedsReconnect).not.toHaveBeenCalled();
 });
 it("does not finish after metadata or linkage changes while the provider is pending", async () => {
  vi.mocked(refreshGitlabToken).mockImplementation(async () => {
   vi.mocked(readSourceAuthorization).mockResolvedValue({ ...initial, link: { ...initial.link!, updatedAt: "2026-09-05T12:00:00.000002Z" } });
   return { ok: true, tokens: { access_token: "new", token_type: "bearer", refresh_token: "next", expires_in: 3600 } };
  });
  expect(await refreshSourceLink(initial, input)).toEqual({ status: "unavailable" }); expect(finishPlatformTokenRefresh).not.toHaveBeenCalled();
  // The request DID complete and succeed, but the caller can no longer trust
  // the linkage it was issued against, so the claim is still released rather
  // than left blocking a now-stale comparison forever.
  expect(releasePlatformTokenRefreshAttempt).toHaveBeenCalledWith(initial.link, "attempt1", false);
 });
 it("leaves the barrier if linkage changes while an ambiguous provider outcome is pending", async () => {
  vi.mocked(refreshGitlabToken).mockImplementation(async () => {
   vi.mocked(readSourceAuthorization).mockResolvedValue({ ...initial, link: { ...initial.link!, updatedAt: "2026-09-05T12:00:00.000002Z" } });
   return { ok: false, outcome: "ambiguous" };
  });
  expect(await refreshSourceLink(initial, input)).toEqual({ status: "unavailable" });
  expect(releasePlatformTokenRefreshAttempt).not.toHaveBeenCalled();
 });
 it.each(["refresh", undefined])("atomically finishes known success with reusable/omitted refresh token %s", async refreshToken => {
  const version = "2026-09-05T12:00:00.000002Z";
  vi.mocked(refreshGitlabToken).mockResolvedValue({ ok: true, tokens: { access_token: "new", token_type: "bearer", ...(refreshToken ? { refresh_token: refreshToken } : {}), expires_in: 3600 } });
  const after = { ...initial, link: { ...initial.link!, updatedAt: version, tokens: { ...initial.link!.tokens, accessToken: "new" } } };
  vi.mocked(finishPlatformTokenRefresh).mockImplementation(async () => { vi.mocked(readSourceAuthorization).mockResolvedValue(after); return { status: "updated", id: initial.link!.id, updatedAt: version }; });
  expect(await refreshSourceLink(initial, input)).toEqual(after);
  expect(finishPlatformTokenRefresh).toHaveBeenCalledWith(initial.link, "attempt1", expect.objectContaining({ accessToken: "new", refreshToken: "refresh" }));
  expect(releasePlatformTokenRefreshAttempt).not.toHaveBeenCalled();
 });
});

describe("takeover of a stale ambiguous claim (#1332)", () => {
 beforeEach(() => { vi.mocked(claimPlatformTokenRefresh).mockResolvedValue({ status: "busy" }); });

 it.each(["too_fresh", "exhausted", "gone", "stale"] as const)("does not contact the provider when takeover declines (%s)", async status => {
  vi.mocked(takeoverPlatformTokenRefresh).mockResolvedValue({ status });
  expect(await refreshSourceLink(initial, input)).toEqual({ status: "unavailable" });
  expect(refreshGitlabToken).not.toHaveBeenCalled();
  expect(finishPlatformTokenRefresh).not.toHaveBeenCalled();
 });

 it("proceeds with a real provider request using the takeover's attempt id, and finishes on success", async () => {
  vi.mocked(takeoverPlatformTokenRefresh).mockResolvedValue({ status: "claimed", attemptId: "takeover-attempt" });
  const version = "2026-09-05T12:00:00.000002Z";
  vi.mocked(refreshGitlabToken).mockResolvedValue({ ok: true, tokens: { access_token: "new", token_type: "bearer", refresh_token: "next", expires_in: 3600 } });
  const after = { ...initial, link: { ...initial.link!, updatedAt: version, tokens: { ...initial.link!.tokens, accessToken: "new" } } };
  vi.mocked(finishPlatformTokenRefresh).mockImplementation(async () => { vi.mocked(readSourceAuthorization).mockResolvedValue(after); return { status: "updated", id: initial.link!.id, updatedAt: version }; });
  expect(await refreshSourceLink(initial, input)).toEqual(after);
  expect(finishPlatformTokenRefresh).toHaveBeenCalledWith(initial.link, "takeover-attempt", expect.objectContaining({ accessToken: "new" }));
  expect(markPlatformNeedsReconnect).not.toHaveBeenCalled();
 });

 it("releases and marks needs-reconnect when the takeover's own request is a definitive revoke", async () => {
  vi.mocked(takeoverPlatformTokenRefresh).mockResolvedValue({ status: "claimed", attemptId: "takeover-attempt" });
  vi.mocked(refreshGitlabToken).mockResolvedValue({ ok: false, outcome: "definitive", reason: "revoked" });
  expect(await refreshSourceLink(initial, input)).toEqual({ status: "unavailable" });
  expect(releasePlatformTokenRefreshAttempt).toHaveBeenCalledWith(initial.link, "takeover-attempt", true);
  expect(markPlatformNeedsReconnect).not.toHaveBeenCalled();
 });

 it("marks needs-reconnect WITHOUT releasing the barrier when the takeover's own request is also ambiguous", async () => {
  vi.mocked(takeoverPlatformTokenRefresh).mockResolvedValue({ status: "claimed", attemptId: "takeover-attempt" });
  vi.mocked(refreshGitlabToken).mockResolvedValue({ ok: false, outcome: "ambiguous" });
  expect(await refreshSourceLink(initial, input)).toEqual({ status: "unavailable" });
  expect(markPlatformNeedsReconnect).toHaveBeenCalledWith(initial.link);
  // A second ambiguous outcome must never be released: the row's
  // `takeover_used` flag already forbids a second takeover, so there is
  // nothing further this call can safely do to the barrier itself.
  expect(releasePlatformTokenRefreshAttempt).not.toHaveBeenCalled();
 });
});
