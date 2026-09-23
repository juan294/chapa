import { describe, expect, it, vi } from "vitest";
import { createScoringWindow } from "@chapa/shared";
import type { StoredSourceObservation } from "@/lib/db/source-context";
import { sourceEventFixture } from "@/lib/db/source-context-fixture";
import { createSourceCoordinator, type SourceCoordinatorDependencies, type SourceCoordinatorInput } from "./source-coordinator";

vi.mock("@/lib/env", () => ({ getGithubToken: () => "server-fixture", getNextauthSecret: () => "source-acceptance-secret" }));

const window = createScoringWindow("2026-09-05T12:00:00Z");
const source = { provider: "github" as const, host: "github.com", subjectId: "canonical-alice" };
const request = (): SourceCoordinatorInput => ({ owner: "alice", provider: "github", window: { ...window },
  scope: { discovery: "explicit_repositories", repositoryIds: ["known"], eventKinds: ["accepted_change"] } });
function observation(at = window): StoredSourceObservation {
  return JSON.parse(JSON.stringify({ id: "11111111-1111-4111-8111-111111111111", window: at,
    coverage: { source, window: at, dataThrough: at.referenceTime, status: "complete", discovery: "explicit_repositories",
      repositoryIds: ["known"], repositoryDiscoveryComplete: true, eventKinds: { accepted_change: "complete" }, reasonCodes: [], unknownPeriods: [] },
    events: [sourceEventFixture(source, at)] })) as StoredSourceObservation;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
function harness() {
  const deps = {
    authorize: vi.fn<SourceCoordinatorDependencies["authorize"]>().mockResolvedValue({ status: "authorized", subjectVersion: "consent1", link: null }),
    discover: vi.fn<SourceCoordinatorDependencies["discover"]>().mockResolvedValue({ status: "missing" }),
    read: vi.fn<SourceCoordinatorDependencies["read"]>().mockResolvedValue(null),
    append: vi.fn<SourceCoordinatorDependencies["append"]>().mockImplementation(async (_context, value) => structuredClone(value) as StoredSourceObservation),
    collect: vi.fn<SourceCoordinatorDependencies["collect"]>().mockResolvedValue({ result: observation(), diagnostics: [] }),
    refreshLink: vi.fn<SourceCoordinatorDependencies["refreshLink"]>().mockImplementation(async authorization => authorization),
  };
  return { deps, select: createSourceCoordinator(deps) };
}

describe("independent source-coordinator acceptance", () => {
  it("keeps a read-only miss separate from an already collecting write", async () => {
    const { deps, select } = harness();
    const started = deferred<void>();
    const finish = deferred<StoredSourceObservation>();
    deps.collect.mockImplementation(async () => { started.resolve(); return { result: await finish.promise, diagnostics: [] }; });
    const write = select(request());
    await started.promise;
    expect(await select({ ...request(), readOnly: true })).toEqual({ status: "readonlymiss" });
    expect(deps.collect).toHaveBeenCalledTimes(1);
    expect(deps.append).not.toHaveBeenCalled();
    expect(deps.refreshLink).not.toHaveBeenCalled();
    finish.resolve(observation());
    expect((await write).status).toBe("observed");
    expect(deps.append).toHaveBeenCalledTimes(1);
  });

  it("never shares concurrent work between two actual PAT principals", async () => {
    const { deps, select } = harness();
    const bothStarted = deferred<void>();
    const finish = deferred<void>();
    const tokens: string[] = [];
    deps.collect.mockImplementation(async (_input, token) => {
      tokens.push(token!);
      if (tokens.length === 2) bothStarted.resolve();
      await finish.promise;
      const value = observation();
      value.events[0]!.eventId = token === "pat-a" ? "event-a" : "event-b";
      return { result: value, diagnostics: [] };
    });
    const first = select({ ...request(), token: "pat-a" });
    const second = select({ ...request(), token: "pat-b" });
    await bothStarted.promise;
    finish.resolve();
    const results = await Promise.all([first, second]);
    expect(tokens.sort()).toEqual(["pat-a", "pat-b"]);
    expect(results.map(result => "observation" in result ? result.observation.events[0]!.eventId : result.status)).toEqual(["event-a", "event-b"]);
    expect(JSON.stringify(results)).not.toMatch(/pat-a|pat-b|accessContextId|selectionId/);
  });

  it("detaches the request before awaiting authorization and detaches every returned result", async () => {
    const { deps, select } = harness();
    const gate = deferred<Awaited<ReturnType<SourceCoordinatorDependencies["authorize"]>>>();
    deps.authorize.mockImplementationOnce(() => gate.promise);
    const input = request();
    const pending = select(input);
    (input.scope.repositoryIds as string[])[0] = "mutated-after-call";
    gate.resolve({ status: "authorized", subjectVersion: "consent1", link: null });
    const first = await pending;
    expect(deps.collect.mock.calls[0]![0].scope.repositoryIds).toEqual(["known"]);
    expect(first.status).toBe("observed");
    if (!("observation" in first)) throw new Error("Expected observation");
    first.observation.events[0]!.eventId = "caller-mutated";
    expect((await deps.collect.mock.results[0]!.value)!.result!.events[0]!.eventId).toBe("event1");
  });

  it("preserves a prior observation's original reference and data-through without collection", async () => {
    const { deps, select } = harness();
    const old = observation(createScoringWindow("2026-09-04T11:00:00Z"));
    deps.discover.mockResolvedValue({ status: "found", source });
    deps.read.mockImplementation(async (_context, prior) => prior ? old : null);
    const result = await select({ ...request(), readOnly: true });
    expect(result).toEqual({ status: "stale", observation: old });
    expect(deps.collect).not.toHaveBeenCalled();
    expect(deps.append).not.toHaveBeenCalled();
    expect(deps.refreshLink).not.toHaveBeenCalled();
  });

  it("withholds an in-memory result when consent is withdrawn during append", async () => {
    const { deps, select } = harness();
    deps.append.mockImplementation(async (_context, value) => {
      deps.authorize.mockResolvedValue({ status: "unavailable" });
      return structuredClone(value) as StoredSourceObservation;
    });
    expect(await select(request())).toEqual({ status: "unavailable" });
    expect(deps.append).toHaveBeenCalledTimes(1);
  });

  it("writes a complete zero when the last prior annual event expires", async () => {
    const { deps, select } = harness();
    const old = observation(createScoringWindow("2026-09-04T11:00:00Z"));
    old.events[0]!.occurredAt = old.window.startInclusive;
    if (old.events[0]!.acceptance.status === "observed") old.events[0]!.acceptance.value.acceptedAt = old.window.startInclusive;
    deps.discover.mockResolvedValue({ status: "found", source });
    deps.read.mockImplementation(async (_context, prior) => prior ? old : null);
    const zero = observation(); zero.events = [];
    deps.collect.mockResolvedValue({ result: zero, diagnostics: [] });
    const result = await select({ ...request(), refresh: true });
    expect(result.status).toBe("observed");
    expect(deps.append).toHaveBeenCalledTimes(1);
    if (!("observation" in result)) throw new Error("Expected observation");
    expect(result.observation.events).toEqual([]);
    expect(result.observation.coverage.status).toBe("complete");
    expect(result.observation.window).toEqual(window);
  });
});
