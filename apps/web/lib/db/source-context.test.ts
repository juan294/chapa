import { beforeEach, describe, expect, it, vi } from "vitest";
import { createScoringWindow } from "@chapa/shared";
import { appendSourceObservation, readSourceObservation, discoverStoredSource } from "./source-context";
import { sourceEventFixture } from "./source-context-fixture";
import { getSupabase } from "./supabase";
vi.mock("./supabase", () => ({ getSupabase: vi.fn() }));
vi.mock("@/lib/env", () => ({ getNextauthSecret: () => "secret" }));
vi.mock("@/lib/auth/github", () => ({ encryptToken: (token: string) => `encrypted:${token}` }));
const window = createScoringWindow("2026-09-05T12:00:00Z");
const source = { provider: "github" as const, host: "github.com", subjectId: "canonical-node-id" };
const context = { owner: "alice", requestedSource: { provider: "github", host: "github.com", login: "alice" }, source, window, scope: { discovery: "explicit_repositories" as const, repositoryIds: [], eventKinds: ["accepted_change"] }, accessContextId: "a".repeat(64), link: null };
const value = { id: "11111111-1111-4111-8111-111111111111", window, coverage: { source, window, dataThrough: window.referenceTime, status: "complete", discovery: "explicit_repositories", repositoryIds: [], repositoryDiscoveryComplete: true, eventKinds: { accepted_change: "complete" }, reasonCodes: [], unknownPeriods: [] }, events: [] };
const rpc = vi.fn();
beforeEach(() => { rpc.mockReset(); vi.mocked(getSupabase).mockReturnValue({ rpc } as never); });
describe("private source storage", () => {
 it("discovers canonical stored IDs and refuses ambiguous identities without guessing", async () => {
  rpc.mockResolvedValue({ data: { status: "found", source }, error: null });
  expect(await discoverStoredSource(context)).toEqual({ status: "found", source });
  expect(source.subjectId).not.toBe(context.requestedSource.login);
  rpc.mockResolvedValue({ data: { status: "ambiguous" }, error: null });
  expect(await discoverStoredSource(context)).toEqual({ status: "ambiguous" });
  rpc.mockResolvedValue({ data: { status: "missing" }, error: null });
  expect(await discoverStoredSource(context)).toEqual({ status: "missing" });
 });
 it("binds append to exact context and returns detached validated committed data", async () => {
  rpc.mockResolvedValue({ data: value, error: null });
  const result = await appendSourceObservation(context, value);
  expect(rpc).toHaveBeenCalledWith("scoring_v7_append_source", expect.objectContaining({ p_owner: "alice", p_actor: "alice", p_source: source, p_access: context.accessContextId, p_window: window, p_payload: { events: [] } }));
  expect(result).toEqual(value); expect(result).not.toBe(value);
 });
 it("rejects progress/raw bodies and source/window mismatches before append", async () => {
  for (const change of [{ progress: [{ url: "private-url" }] }, { coverage: { ...value.coverage, source: { ...source, subjectId: "foreign" } } }, { window: createScoringWindow("2026-09-06T12:00:00Z") }]) {
   await expect(appendSourceObservation(context, { ...value, ...change })).rejects.toThrow("Source storage");
  }
  expect(rpc).not.toHaveBeenCalled();
 });
 it("keeps known partial evidence from a subset of requested repositories and rejects out-of-scope repositories", async () => {
  const requested = { ...context, scope: { ...context.scope, repositoryIds: ["known", "inaccessible"] } };
  const partial = { ...value, coverage: { ...value.coverage, status: "partial", repositoryDiscoveryComplete: false, repositoryIds: ["known"], reasonCodes: ["not_accessible"] } };
  rpc.mockResolvedValue({ data: partial, error: null });
  expect(await appendSourceObservation(requested, partial)).toEqual(partial);
  rpc.mockClear();
  await expect(appendSourceObservation(requested, { ...partial, coverage: { ...partial.coverage, repositoryIds: ["foreign"] } })).rejects.toThrow("Source storage append failed");
  expect(rpc).not.toHaveBeenCalled();
 });
 it("persists a real normalized event, including a known event within partial explicit scope", async () => {
  const event = sourceEventFixture(source, window);
  const scoped = { ...context, scope: { ...context.scope, repositoryIds: ["known", "inaccessible"] } };
  const observation = { ...value, coverage: { ...value.coverage, status: "partial", repositoryDiscoveryComplete: false, repositoryIds: ["known"] }, events: [event] };
  rpc.mockResolvedValue({ data: observation, error: null });
  expect(await appendSourceObservation(scoped, observation)).toEqual(observation);
 });
 it("rejects foreign repositories, malformed measurement values and invalid acceptance times", async () => {
  const event = sourceEventFixture(source, window);
  const scoped = { ...context, scope: { ...context.scope, repositoryIds: ["known"] } };
  const observation = { ...value, coverage: { ...value.coverage, repositoryIds: ["known"] }, events: [event] };
  const changed = [
   { ...event, repositoryId: "foreign" },
   { ...event, measurements: { ...event.measurements, additions: { status: "observed", coverage: "complete", provenance: "source_observed", value: { body: "private-raw-body" } } } },
   ...["2026-09-06T00:00:00.000Z", "2026-09-01T11:00:00.000Z"].map(acceptedAt => ({ ...event, acceptance: { status: "observed", coverage: "complete", provenance: "source_observed", value: { method: "merged_change", acceptedAt, acceptedResultId: "result1" } } })),
  ];
  for (const bad of changed) await expect(appendSourceObservation(scoped, { ...observation, events: [bad] })).rejects.toThrow("Source storage append failed");
  expect(rpc).not.toHaveBeenCalled();
 });
 it("preserves prior window/data-through on fallback", async () => {
  const priorWindow = createScoringWindow("2026-09-04T12:00:00Z");
  const prior = { ...value, window: priorWindow, coverage: { ...value.coverage, window: priorWindow, dataThrough: priorWindow.referenceTime } };
  rpc.mockResolvedValue({ data: prior, error: null });
  expect(await readSourceObservation(context, true)).toEqual(prior);
 });
 it("rejects inconsistent read windows before requesting storage", async () => {
  await expect(readSourceObservation({ ...context, window: { ...window, startInclusive: window.endExclusive } })).rejects.toThrow("Source storage unavailable");
  expect(rpc).not.toHaveBeenCalled();
 });
 it("fails closed without echoing transport errors", async () => {
  rpc.mockRejectedValue(new Error("private-token"));
  await expect(readSourceObservation(context)).rejects.toThrow("Source storage unavailable");
 });
});
