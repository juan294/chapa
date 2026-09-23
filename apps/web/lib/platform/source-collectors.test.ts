import { describe, expect, it, vi } from "vitest";
import { createScoringWindow } from "@chapa/shared";
import { fetchBitbucketEvidence } from "@/lib/bitbucket/evidence";
import { collectSource } from "./source-collectors";
vi.mock("@/lib/bitbucket/evidence", () => ({ fetchBitbucketEvidence: vi.fn() }));
const bitbucketEvidence = { coverage: {}, events: [], progress: [], requestCount: 1, diagnostics: [] };
describe("production evidence bindings", () => {
 it.each([undefined, ["{abcdefab-3333-3333-3333-333333333333}"]])("uses current Bitbucket account_id and forwards the explicit scope %s", async repositoryIds => {
  vi.mocked(fetchBitbucketEvidence).mockResolvedValue(bitbucketEvidence as never);
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ account_id: "canonical-account", nickname: "nonunique-label", uuid: "{stable-uuid}" }) });
  vi.stubGlobal("fetch", fetch);
  try {
   const window = createScoringWindow("2026-09-05T12:00:00Z");
   const outcome = await collectSource({ owner: "alice", requestedSource: { provider: "bitbucket", host: "bitbucket.org", login: "historic-link-login" }, window, scope: { discovery: repositoryIds ? "explicit_repositories" : "owned_and_contributed", repositoryIds: repositoryIds ?? [], eventKinds: ["accepted_change"] } }, "bound-token");
   expect(fetchBitbucketEvidence).toHaveBeenLastCalledWith("canonical-account", "bound-token", window, repositoryIds ? { repositoryIds } : {});
   expect(fetch).toHaveBeenCalledWith("https://api.bitbucket.org/2.0/user", expect.objectContaining({ headers: { Authorization: "Bearer bound-token" } }));
   expect(outcome).toEqual({ result: bitbucketEvidence, diagnostics: [] });
  } finally { vi.unstubAllGlobals(); }
 });
 it("emits a preflight_user diagnostic instead of a bare null when the /user precheck fails", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, headers: new Headers() });
  vi.stubGlobal("fetch", fetch);
  try {
   const window = createScoringWindow("2026-09-05T12:00:00Z");
   const outcome = await collectSource({ owner: "alice", requestedSource: { provider: "gitlab", host: "gitlab.com", login: "alice" }, window, scope: { discovery: "owned_and_contributed", repositoryIds: [], eventKinds: ["accepted_change"] } }, "bound-token");
   expect(outcome.result).toBeNull();
   expect(outcome.diagnostics).toEqual([{ provider: "gitlab", operation: "preflight_user", stopKind: "http", httpStatus: 500, retryAfterSeconds: null }]);
  } finally { vi.unstubAllGlobals(); }
 });
});
