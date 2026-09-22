import { describe, expect, it, vi } from "vitest";
import { createScoringWindow } from "@chapa/shared";
import { fetchBitbucketEvidence } from "@/lib/bitbucket/evidence";
import { collectSource } from "./source-collectors";
vi.mock("@/lib/bitbucket/evidence", () => ({ fetchBitbucketEvidence: vi.fn() }));
describe("production evidence bindings", () => {
 it.each([undefined, ["{abcdefab-3333-3333-3333-333333333333}"]])("uses current Bitbucket account_id and forwards the explicit scope %s", async repositoryIds => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ account_id: "canonical-account", nickname: "nonunique-label", uuid: "{stable-uuid}" }) });
  vi.stubGlobal("fetch", fetch);
  try {
   const window = createScoringWindow("2026-09-05T12:00:00Z");
   await collectSource({ owner: "alice", requestedSource: { provider: "bitbucket", host: "bitbucket.org", login: "historic-link-login" }, window, scope: { discovery: repositoryIds ? "explicit_repositories" : "owned_and_contributed", repositoryIds: repositoryIds ?? [], eventKinds: ["accepted_change"] } }, "bound-token");
   expect(fetchBitbucketEvidence).toHaveBeenLastCalledWith("canonical-account", "bound-token", window, repositoryIds ? { repositoryIds } : {});
   expect(fetch).toHaveBeenCalledWith("https://api.bitbucket.org/2.0/user", expect.objectContaining({ headers: { Authorization: "Bearer bound-token" } }));
  } finally { vi.unstubAllGlobals(); }
 });
});
