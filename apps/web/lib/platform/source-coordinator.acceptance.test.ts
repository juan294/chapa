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
    enqueue: vi.fn<SourceCoordinatorDependencies["enqueue"]>().mockResolvedValue(undefined),
    jobInProgress: vi.fn<SourceCoordinatorDependencies["jobInProgress"]>().mockResolvedValue(false),
  };
  return { deps, select: createSourceCoordinator(deps) };
}

describe("independent source-coordinator acceptance (read-only, #1335 phase 3)", () => {
  it("a read-only caller never races an in-flight refresh's enqueue -- they use disjoint inflight keys", async () => {
    const { deps, select } = harness();
    deps.discover.mockResolvedValue({ status: "found", source });
    deps.read.mockResolvedValue(observation());
    const gate = deferred<unknown>();
    deps.enqueue.mockImplementation(() => gate.promise as Promise<unknown>);
    const refresh = select({ ...request(), refresh: true });
    const readOnly = await select({ ...request(), readOnly: true });
    expect(readOnly).toEqual({ status: "observed", observation: observation(), inProgress: false });
    expect(deps.enqueue).toHaveBeenCalledTimes(1);
    gate.resolve(undefined);
    await refresh;
  });

  it("never shares in-flight reads between two distinct owners", async () => {
    const { deps, select } = harness();
    const bothStarted = deferred<void>();
    const finish = deferred<void>();
    const owners: string[] = [];
    deps.discover.mockImplementation(async (context) => {
      owners.push(context.owner);
      if (owners.length === 2) bothStarted.resolve();
      await finish.promise;
      return { status: "found", source: { ...source, subjectId: `canonical-${context.owner}` } };
    });
    deps.read.mockImplementation(async () => observation());
    const first = select({ ...request(), owner: "alice" });
    const second = select({ ...request(), owner: "bob" });
    await bothStarted.promise;
    finish.resolve();
    const results = await Promise.all([first, second]);
    expect(owners.sort()).toEqual(["alice", "bob"]);
    for (const result of results) expect(result.status).toBe("observed");
  });

  it("detaches the request before awaiting authorization -- a caller mutation after calling select() cannot reach the in-flight read", async () => {
    const { deps, select } = harness();
    deps.discover.mockResolvedValue({ status: "found", source });
    deps.read.mockResolvedValue(observation());
    const gate = deferred<Awaited<ReturnType<SourceCoordinatorDependencies["authorize"]>>>();
    deps.authorize.mockImplementationOnce(() => gate.promise);
    const input = request();
    const pending = select(input);
    (input.scope.repositoryIds as string[])[0] = "mutated-after-call";
    gate.resolve({ status: "authorized", subjectVersion: "consent1", link: null });
    const first = await pending;
    expect(deps.discover.mock.calls[0]![0].scope.repositoryIds).toEqual(["known"]);
    expect(first.status).toBe("observed");
    if (!("observation" in first)) throw new Error("Expected observation");
    first.observation.events[0]!.eventId = "caller-mutated";
    // A second, fresh read is unaffected by the first result's mutation.
    const second = await select(request());
    if (!("observation" in second)) throw new Error("Expected observation");
    expect(second.observation.events[0]!.eventId).toBe("event1");
  });

  it("preserves a prior observation's original reference and data-through without any enqueue on a plain read", async () => {
    const { deps, select } = harness();
    const old = observation(createScoringWindow("2026-09-04T11:00:00Z"));
    deps.discover.mockResolvedValue({ status: "found", source });
    deps.read.mockImplementation(async (_context, prior) => prior ? old : null);
    const result = await select({ ...request(), readOnly: true });
    expect(result).toEqual({ status: "stale", observation: old, inProgress: false });
    expect(deps.enqueue).not.toHaveBeenCalled();
  });

  it("withholds an in-memory result when authorization changes during the read", async () => {
    const { deps, select } = harness();
    deps.discover.mockResolvedValue({ status: "found", source });
    deps.read.mockImplementation(async () => {
      deps.authorize.mockResolvedValue({ status: "unavailable" });
      return observation();
    });
    expect(await select(request())).toEqual({ status: "unavailable" });
  });

  it("enqueues a refresh job and still returns the current read once it settles", async () => {
    const { deps, select } = harness();
    deps.discover.mockResolvedValue({ status: "found", source });
    deps.read.mockResolvedValue(observation());
    const result = await select({ ...request(), refresh: true });
    expect(result.status).toBe("observed");
    expect(deps.enqueue).toHaveBeenCalledTimes(1);
    expect(deps.enqueue).toHaveBeenCalledWith("alice", "github", "refresh", window.referenceTime);
  });
});
