import { beforeEach, describe, expect, it, vi } from "vitest";
import { createScoringWindow } from "@chapa/shared";
import { createSourceCoordinator, type SourceCoordinatorDependencies } from "./source-coordinator";
import type { StoredSourceObservation } from "@/lib/db/source-context";
vi.mock("@/lib/env", () => ({ getGithubToken: () => "fallback", getNextauthSecret: () => "test-secret" }));
const mocks = vi.hoisted(() => ({ scheduleServerEvent: vi.fn() }));
vi.mock("@/lib/analytics/schedule-server-event", () => ({ scheduleServerEvent: mocks.scheduleServerEvent }));
beforeEach(() => mocks.scheduleServerEvent.mockClear());
const window = createScoringWindow("2026-09-05T12:00:00Z");
const input = { owner: "ALICE", provider: "github" as const, window, scope: { discovery: "explicit_repositories" as const, repositoryIds: [], eventKinds: ["accepted_change"] } };
const source = { provider: "github" as const, host: "github.com", subjectId: "canonical" };
const value = { id: "11111111-1111-4111-8111-111111111111", window, coverage: { source, window, dataThrough: window.referenceTime, status: "complete", discovery: "explicit_repositories", repositoryIds: [], repositoryDiscoveryComplete: true, eventKinds: { accepted_change: "complete" }, reasonCodes: [], unknownPeriods: [] }, events: [] } as StoredSourceObservation;
function harness() {
 const deps = { authorize: vi.fn<SourceCoordinatorDependencies["authorize"]>().mockResolvedValue({ status: "authorized", consentVersion: "v1", link: null }), discover: vi.fn<SourceCoordinatorDependencies["discover"]>().mockResolvedValue({ status: "missing" }), read: vi.fn<SourceCoordinatorDependencies["read"]>().mockResolvedValue(null), append: vi.fn<SourceCoordinatorDependencies["append"]>().mockImplementation(async (_ctx, data) => data as StoredSourceObservation), collect: vi.fn<SourceCoordinatorDependencies["collect"]>().mockResolvedValue({ result: value, diagnostics: [] }), refreshLink: vi.fn<SourceCoordinatorDependencies["refreshLink"]>().mockImplementation(async a => a) };
 return { deps, select: createSourceCoordinator(deps) };
}
describe("source selection", () => {
 it("normalizes GitHub login and accepts explicitly undefined optional fields", async () => {
  const { deps, select } = harness();
  expect((await select({ ...input, token: undefined, readOnly: undefined })).status).toBe("observed");
  expect(deps.collect).toHaveBeenCalledWith(expect.objectContaining({ owner: "alice", requestedSource: expect.objectContaining({ login: "alice" }) }), "fallback");
 });
 it("preserves a same-reference complete result after appending an honest partial refresh", async () => {
  const { deps, select } = harness(); deps.discover.mockResolvedValue({ status: "found", source }); deps.read.mockResolvedValue(value);
  deps.collect.mockResolvedValue({ result: { ...value, coverage: { ...value.coverage, status: "partial", reasonCodes: ["pagination_incomplete"] } }, diagnostics: [] });
  expect(await select({ ...input, refresh: true })).toEqual({ status: "observed", observation: value });
  expect(deps.append.mock.calls[0]![1]).toMatchObject({ coverage: { status: "partial" } });
 });
 it("returns unsupported for an unimplemented discovery strategy", async () => {
  const { deps, select } = harness();
  expect(await select({ ...input, scope: { ...input.scope, discovery: "legacy_upload" } })).toEqual({ status: "unsupported" });
  expect(deps.collect).not.toHaveBeenCalled();
 });
 it("supports explicit Bitbucket UUID scopes and binds canonical casing before lookup", async () => {
  const { deps, select } = harness();
  const upper = "{ABCDEFAB-3333-3333-3333-333333333333}";
  const repositoryId = upper.toLowerCase();
  const bitbucket = { provider: "bitbucket" as const, host: "bitbucket.org", subjectId: "canonical-account" };
  deps.authorize.mockResolvedValue({ status: "authorized", consentVersion: "v1", link: {
   id: "11111111-1111-4111-8111-111111111111", updatedAt: "2026-09-05T12:00:00.000001Z", handle: "alice", platform: "bitbucket", remoteLogin: "display-label",
   tokens: { accessToken: "bound-token", refreshToken: null, expiresAt: null },
  } });
  deps.collect.mockResolvedValue({ result: { ...value, coverage: { ...value.coverage, source: bitbucket, repositoryIds: [repositoryId], status: "partial" } }, diagnostics: [] });
  expect((await select({ ...input, provider: "bitbucket", scope: { ...input.scope, repositoryIds: [upper] } })).status).toBe("observed");
  expect(deps.collect).toHaveBeenCalledWith(expect.objectContaining({ scope: expect.objectContaining({ repositoryIds: [repositoryId] }) }), "bound-token");
  expect(deps.discover.mock.calls[0]![0].scope.repositoryIds).toEqual([repositoryId]);
 });
 it.each(["disabled", "unlinked", "unavailable"] as const)("keeps %s distinct before source reads", async status => {
  const { deps, select } = harness(); deps.authorize.mockResolvedValue({ status });
  expect(await select(input)).toEqual({ status }); expect(deps.discover).not.toHaveBeenCalled();
 });
 it("emits one evidence_source_stop event per diagnostic and none for a clean run", async () => {
  const { deps, select } = harness();
  expect((await select(input)).status).toBe("observed");
  expect(mocks.scheduleServerEvent).not.toHaveBeenCalled();
  mocks.scheduleServerEvent.mockClear();
  deps.discover.mockResolvedValue({ status: "missing" });
  deps.collect.mockResolvedValue({ result: value, diagnostics: [
   { provider: "github", operation: "files", stopKind: "deadline", httpStatus: null, retryAfterSeconds: null },
   { provider: "github", operation: "merged", stopKind: "http", httpStatus: 500, retryAfterSeconds: null },
  ] });
  expect((await select({ ...input, refresh: true })).status).toBe("observed");
  expect(mocks.scheduleServerEvent).toHaveBeenCalledTimes(2);
  expect(mocks.scheduleServerEvent).toHaveBeenNthCalledWith(1, "evidence_source_stop", expect.objectContaining({ handle: "alice", operation: "files", stopKind: "deadline" }));
 });
 it("still emits diagnostics from a failed collection that falls back to a stale prior", async () => {
  const { deps, select } = harness();
  deps.discover.mockResolvedValue({ status: "found", source }); deps.read.mockResolvedValue(value);
  deps.collect.mockResolvedValue({ result: null, diagnostics: [
   { provider: "github", operation: "profile", stopKind: "http", httpStatus: 500, retryAfterSeconds: null },
  ] });
  expect(await select({ ...input, refresh: true })).toEqual({ status: "stale", observation: value });
  expect(mocks.scheduleServerEvent).toHaveBeenCalledTimes(1);
 });
});
