import { describe, expect, it, vi } from "vitest";
import { createScoringWindow } from "@chapa/shared";
import { createSourceCoordinator, createSourceManifestCoordinator, type SourceCoordinatorDependencies, type SourceManifestCoordinatorDependencies } from "./source-coordinator";
import type { SourceObservationManifest, StoredSourceObservation } from "@/lib/db/source-context";

vi.mock("@/lib/env", () => ({ getGithubToken: () => "fallback", getNextauthSecret: () => "test-secret" }));

const window = createScoringWindow("2026-09-05T12:00:00Z");
const input = { owner: "ALICE", provider: "github" as const, window, scope: { discovery: "explicit_repositories" as const, repositoryIds: [], eventKinds: ["accepted_change"] } };
const source = { provider: "github" as const, host: "github.com", subjectId: "canonical" };
const value = { id: "11111111-1111-4111-8111-111111111111", window, coverage: { source, window, dataThrough: window.referenceTime, status: "complete", discovery: "explicit_repositories", repositoryIds: [], repositoryDiscoveryComplete: true, eventKinds: { accepted_change: "complete" }, reasonCodes: [], unknownPeriods: [] }, events: [] } as StoredSourceObservation;
const manifest: SourceObservationManifest = { id: value.id, window, coverage: value.coverage, storageMode: "rows", eventCount: 0,
  eventGenerationId: "22222222-2222-4222-8222-222222222222", eventKeysSha256: "0".repeat(64) };

function harness() {
  const deps = {
    authorize: vi.fn<SourceCoordinatorDependencies["authorize"]>().mockResolvedValue({ status: "authorized", subjectVersion: "v1", link: null }),
    discover: vi.fn<SourceCoordinatorDependencies["discover"]>().mockResolvedValue({ status: "missing" }),
    read: vi.fn<SourceCoordinatorDependencies["read"]>().mockResolvedValue(null),
    enqueue: vi.fn<SourceCoordinatorDependencies["enqueue"]>().mockResolvedValue(undefined),
    jobInProgress: vi.fn<SourceCoordinatorDependencies["jobInProgress"]>().mockResolvedValue(false),
  };
  return { deps, select: createSourceCoordinator(deps) };
}

describe("source selection (read-only, #1335 phase 3)", () => {
  it("normalizes GitHub login and reads the exact observation without collecting", async () => {
    const { deps, select } = harness();
    deps.discover.mockResolvedValue({ status: "found", source });
    deps.read.mockResolvedValue(value);
    expect(await select({ ...input, token: undefined, readOnly: undefined })).toEqual({ status: "observed", observation: value, inProgress: false });
    expect(deps.discover.mock.calls[0]![0]).toMatchObject({ owner: "alice", requestedSource: expect.objectContaining({ login: "alice" }) });
    expect(deps.enqueue).not.toHaveBeenCalled();
  });

  it("returns unsupported for an unimplemented discovery strategy", async () => {
    const { deps, select } = harness();
    expect(await select({ ...input, scope: { ...input.scope, discovery: "legacy_upload" } })).toEqual({ status: "unsupported" });
    expect(deps.discover).not.toHaveBeenCalled();
  });

  it.each(["disabled", "unlinked", "unavailable"] as const)("keeps %s distinct before source reads", async status => {
    const { deps, select } = harness(); deps.authorize.mockResolvedValue({ status });
    expect(await select(input)).toEqual({ status }); expect(deps.discover).not.toHaveBeenCalled();
  });

  it("falls back to a stale prior observation when no exact match exists", async () => {
    const { deps, select } = harness();
    deps.discover.mockResolvedValue({ status: "found", source });
    deps.read.mockImplementation(async (_context, prior) => (prior ? value : null));
    expect(await select(input)).toEqual({ status: "stale", observation: value, inProgress: false });
  });

  it("reports readonlymiss for a read-only caller with nothing observed yet", async () => {
    const { deps, select } = harness();
    expect(await select({ ...input, readOnly: true })).toEqual({ status: "readonlymiss" });
    expect(deps.enqueue).not.toHaveBeenCalled();
  });

  it("reports unavailable (not readonlymiss) for a live caller with nothing observed yet", async () => {
    const { select } = harness();
    expect(await select(input)).toEqual({ status: "unavailable" });
  });

  it("enqueues a refresh job exactly once and still returns the read result", async () => {
    const { deps, select } = harness();
    deps.discover.mockResolvedValue({ status: "found", source });
    deps.read.mockResolvedValue(value);
    expect(await select({ ...input, refresh: true })).toEqual({ status: "observed", observation: value, inProgress: false });
    expect(deps.enqueue).toHaveBeenCalledTimes(1);
    expect(deps.enqueue).toHaveBeenCalledWith("alice", "github", "refresh", window.referenceTime);
  });

  it("never enqueues for a read-only + refresh combination -- read-only must never join enqueuing work", async () => {
    const { deps, select } = harness();
    deps.discover.mockResolvedValue({ status: "found", source });
    deps.read.mockResolvedValue(value);
    expect(await select({ ...input, refresh: true, readOnly: true })).toEqual({ status: "observed", observation: value, inProgress: false });
    expect(deps.enqueue).not.toHaveBeenCalled();
  });

  it("degrades a failed enqueue into an ordinary read rather than failing the request", async () => {
    const { deps, select } = harness();
    deps.discover.mockResolvedValue({ status: "found", source });
    deps.read.mockResolvedValue(value);
    deps.enqueue.mockRejectedValue(new Error("db unavailable"));
    expect(await select({ ...input, refresh: true })).toEqual({ status: "observed", observation: value, inProgress: false });
  });

  it("surfaces inProgress from the job-status dependency", async () => {
    const { deps, select } = harness();
    deps.discover.mockResolvedValue({ status: "found", source });
    deps.read.mockResolvedValue(value);
    deps.jobInProgress.mockResolvedValue(true);
    expect(await select(input)).toEqual({ status: "observed", observation: value, inProgress: true });
    expect(deps.jobInProgress).toHaveBeenCalledWith("alice", "github", window.referenceDate);
  });

  it("degrades a failing inProgress check to false rather than failing the request", async () => {
    const { deps, select } = harness();
    deps.discover.mockResolvedValue({ status: "found", source });
    deps.read.mockResolvedValue(value);
    deps.jobInProgress.mockRejectedValue(new Error("db unavailable"));
    expect(await select(input)).toEqual({ status: "observed", observation: value, inProgress: false });
  });

  it("supports explicit Bitbucket UUID scopes and binds canonical casing before lookup", async () => {
    const { deps, select } = harness();
    const upper = "{ABCDEFAB-3333-3333-3333-333333333333}";
    const repositoryId = upper.toLowerCase();
    deps.authorize.mockResolvedValue({ status: "authorized", subjectVersion: "v1", link: {
      id: "11111111-1111-4111-8111-111111111111", updatedAt: "2026-09-05T12:00:00.000001Z", handle: "alice", platform: "bitbucket", remoteLogin: "display-label",
      tokens: { accessToken: "bound-token", refreshToken: null, expiresAt: null },
    } });
    expect((await select({ ...input, provider: "bitbucket", scope: { ...input.scope, repositoryIds: [upper] } })).status).toBe("unavailable");
    expect(deps.discover.mock.calls[0]![0].scope.repositoryIds).toEqual([repositoryId]);
  });

  it("returns unavailable when the current authorization changes mid-read", async () => {
    const { deps, select } = harness();
    deps.discover.mockResolvedValue({ status: "found", source });
    deps.read.mockImplementation(async () => {
      deps.authorize.mockResolvedValue({ status: "unavailable" });
      return value;
    });
    expect(await select(input)).toEqual({ status: "unavailable" });
  });

  it("detaches the returned observation so caller mutation cannot reach shared state", async () => {
    const { deps, select } = harness();
    deps.discover.mockResolvedValue({ status: "found", source });
    deps.read.mockResolvedValue(value);
    const first = await select(input);
    if (!("observation" in first)) throw new Error("Expected an observation");
    (first.observation.events as unknown[]).push("mutated");
    const second = await select(input);
    if (!("observation" in second)) throw new Error("Expected an observation");
    expect(second.observation.events).toEqual([]);
  });
});

function manifestHarness() {
  const deps = {
    authorize: vi.fn<SourceManifestCoordinatorDependencies["authorize"]>().mockResolvedValue({ status: "authorized", subjectVersion: "v1", link: null }),
    discover: vi.fn<SourceManifestCoordinatorDependencies["discover"]>().mockResolvedValue({ status: "found", source }),
    readManifest: vi.fn<SourceManifestCoordinatorDependencies["readManifest"]>().mockResolvedValue(manifest),
    readPages: vi.fn<SourceManifestCoordinatorDependencies["readPages"]>().mockImplementation(async function* () { yield value.events; }),
    enqueue: vi.fn<SourceManifestCoordinatorDependencies["enqueue"]>().mockResolvedValue(undefined),
    jobInProgress: vi.fn<SourceManifestCoordinatorDependencies["jobInProgress"]>().mockResolvedValue(false),
  };
  return { deps, select: createSourceManifestCoordinator(deps) };
}

describe("manifest source selection", () => {
  it("selects exact metadata without reading pages until consumption, retaining private context", async () => {
    const { deps, select } = manifestHarness();
    const result = await select(input);
    expect(result.status).toBe("observed");
    if (result.status !== "observed") throw new Error("Expected manifest");
    expect(result.manifest).toEqual(manifest);
    expect(JSON.stringify(result)).not.toContain("accessContextId");
    expect(deps.readPages).not.toHaveBeenCalled();
    for await (const page of result.pages()) expect(page).toEqual([]);
    expect(deps.readPages).toHaveBeenCalledWith(expect.objectContaining({ owner: "alice", source }), manifest);
  });

  it("selects prior metadata and keeps read-only refresh separate from enqueue", async () => {
    const { deps, select } = manifestHarness();
    const prior = { ...manifest, window: createScoringWindow("2026-09-04T12:00:00Z") };
    deps.readManifest.mockImplementation(async (_context, isPrior) => isPrior ? prior : null);
    const result = await select({ ...input, readOnly: true, refresh: true });
    expect(result.status).toBe("stale");
    if (result.status === "stale") expect(result.manifest).toEqual(prior);
    expect(deps.enqueue).not.toHaveBeenCalled();
  });

  it("withholds a manifest when consent changes during selection", async () => {
    const { deps, select } = manifestHarness();
    deps.readManifest.mockImplementation(async () => {
      deps.authorize.mockResolvedValue({ status: "disabled" });
      return manifest;
    });
    expect(await select(input)).toEqual({ status: "unavailable" });
    expect(deps.readPages).not.toHaveBeenCalled();
  });

  it("aborts an iterator if consent changes between pages", async () => {
    const { deps, select } = manifestHarness();
    deps.readPages.mockImplementation(async function* () {
      yield value.events;
      deps.authorize.mockResolvedValue({ status: "disabled" });
      yield value.events;
    });
    const result = await select(input);
    if (result.status !== "observed") throw new Error("Expected manifest");
    const pages = result.pages()[Symbol.asyncIterator]();
    expect((await pages.next()).done).toBe(false);
    await expect(pages.next()).rejects.toThrow("Source authorization changed");
  });

  it("propagates page failure, including one after a previously yielded page", async () => {
    const { deps, select } = manifestHarness();
    deps.readPages.mockImplementation(async function* () { yield value.events; throw new Error("Page integrity failed"); });
    const result = await select(input);
    if (result.status !== "observed") throw new Error("Expected manifest");
    const pages = result.pages()[Symbol.asyncIterator]();
    expect((await pages.next()).done).toBe(false);
    await expect(pages.next()).rejects.toThrow("Page integrity failed");
  });

  it("rechecks consent after the final page before confirming a complete stream", async () => {
    const { deps, select } = manifestHarness();
    deps.readPages.mockImplementation(async function* () {
      yield value.events;
      deps.authorize.mockResolvedValue({ status: "disabled" });
    });
    const result = await select(input);
    if (result.status !== "observed") throw new Error("Expected manifest");
    const pages = result.pages()[Symbol.asyncIterator]();
    expect((await pages.next()).done).toBe(false);
    await expect(pages.next()).rejects.toThrow("Source authorization changed");
  });

  it("keeps the selected immutable generation separate from caller mutation", async () => {
    const { deps, select } = manifestHarness();
    const result = await select(input);
    if (result.status !== "observed") throw new Error("Expected manifest");
    (result.manifest.coverage.reasonCodes as string[]).push("source_error");
    for await (const page of result.pages()) expect(page).toEqual([]);
    expect(deps.readPages.mock.calls[0]![1].coverage.reasonCodes).toEqual([]);
  });
});
