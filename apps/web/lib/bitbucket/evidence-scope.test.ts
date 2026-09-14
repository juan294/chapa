import { afterEach, describe, expect, it, vi } from "vitest";
import { createScoringWindow } from "@chapa/shared";
import { fetchBitbucketEvidence } from "./evidence";
const window = createScoringWindow("2026-09-05T12:00:00Z");
const U = "{11111111-1111-1111-1111-111111111111}";
const W = "{22222222-2222-2222-2222-222222222222}";
const R = "{abcdefab-3333-3333-3333-333333333333}";
const missing = "{44444444-4444-4444-4444-444444444444}";
const repository = { uuid: R, workspace: { uuid: W }, full_name: "workspace/project" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
function api(lookup: (id: string) => Response = () => json(repository)) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string, options?: RequestInit) => {
    const path = decodeURIComponent(new URL(input).pathname); calls.push(path);
    expect(options?.headers).toMatchObject({ Authorization: "Bearer bound-token" });
    if (path === "/2.0/user") return json({ uuid: U, account_id: "account", nickname: "display label" });
    if (path.startsWith("/2.0/repositories/{}/")) return lookup(path.slice("/2.0/repositories/{}/".length));
    if (path === `/2.0/repositories/${W}/${R}/commits` || path === `/2.0/repositories/${W}/${R}/pullrequests`) return json({ values: [], size: 0 });
    throw new Error("Unexpected provider collection scope");
  }));
  return calls;
}
afterEach(() => vi.unstubAllGlobals());
describe("Bitbucket explicit repository UUID discovery", () => {
  it("resolves the declared UUID to its current workspace without enumerating unrelated workspaces", async () => {
    const calls = api();
    const result = await fetchBitbucketEvidence("account", "bound-token", window, { repositoryIds: [R, R.toUpperCase()] });
    expect(calls).toEqual(["/2.0/user", `/2.0/repositories/{}/${R}`, `/2.0/repositories/${W}/${R}/commits`, `/2.0/repositories/${W}/${R}/pullrequests`]);
    expect(result.coverage).toMatchObject({ discovery: "explicit_repositories", repositoryIds: [R], repositoryDiscoveryComplete: true, status: "partial" });
    expect(result.coverage.eventKinds.issue_work).toBe("unavailable");
    expect(result.requestCount).toBe(4);
  });
  it("keeps failed requested repositories unknown while retaining the accessible subset", async () => {
    api(id => id === R ? json(repository) : json({ error: { message: "private upstream text" } }, 403));
    const result = await fetchBitbucketEvidence("account", "bound-token", window, { repositoryIds: [R, missing] });
    expect(result.coverage).toMatchObject({ repositoryIds: [R], repositoryDiscoveryComplete: false, status: "partial" });
    expect(result.coverage.reasonCodes).toContain("not_accessible");
    expect(result.coverage.unknownPeriods).toEqual([{ startInclusive: window.startInclusive, endExclusive: window.endExclusive }]);
    expect(JSON.stringify(result)).not.toContain("private upstream text");
  });
  it.each([{ ...repository, uuid: missing }, { uuid: R, full_name: "workspace/project" }])("rejects mismatched or unresolved repository identity", async body => {
    const calls = api(() => json(body));
    const result = await fetchBitbucketEvidence("account", "bound-token", window, { repositoryIds: [R] });
    expect(result.coverage.repositoryIds).toEqual([]); expect(result.coverage.repositoryDiscoveryComplete).toBe(false);
    expect(result.coverage.reasonCodes).toContain("source_error"); expect(result.events).toEqual([]); expect(calls).toHaveLength(2);
  });
  it("keeps repository resolution within the shared request budget", async () => {
    const calls = api();
    const result = await fetchBitbucketEvidence("account", "bound-token", window, { repositoryIds: [R, missing], maxRequests: 1 });
    expect(calls).toEqual(["/2.0/user"]); expect(result.requestCount).toBe(1);
    expect(result.coverage.repositoryDiscoveryComplete).toBe(false); expect(result.coverage.reasonCodes).toContain("pagination_incomplete");
  });
  it("rejects ambiguous scope inputs and malformed IDs before network access", async () => {
    const calls = api();
    await expect(fetchBitbucketEvidence("account", "bound-token", window, { repositoryIds: [R], repositories: [{ workspaceId: W, repositoryId: R }] })).rejects.toThrow("Ambiguous");
    await expect(fetchBitbucketEvidence("account", "bound-token", window, { repositoryIds: ["repo-name"] })).rejects.toThrow("UUID");
    expect(calls).toEqual([]);
  });
});
