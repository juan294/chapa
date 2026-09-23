import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_CHECKPOINT, type CollectorCheckpoint } from "@/lib/collection/plan";
import { getSupabase } from "./supabase";
import { EMPTY_PROGRESS, claimCollectionJobs, enqueueCollectionJob, type CollectionProgress } from "./collection-queue";

vi.mock("./supabase", () => ({ getSupabase: vi.fn() }));

/**
 * Fast, DB-free round-trip of the checkpoint/progress zod schemas (#1335
 * phase 3, step 3.1). `collection-queue.ts` keeps those schemas private, so
 * this exercises them the same way `source-context.test.ts` exercises its
 * own private schemas: through the public functions that parse an RPC's
 * returned row, with `getSupabase` mocked so no database is involved.
 */

const rpc = vi.fn();
beforeEach(() => {
  rpc.mockReset();
  vi.mocked(getSupabase).mockReturnValue({ rpc } as never);
});

const baseRow = {
  id: "11111111-1111-4111-8111-111111111111",
  owner_handle: "alice",
  provider: "github",
  reference_date: "2026-09-05",
  reference_time: "2026-09-05T12:00:00.000Z",
  state: "queued",
  attempt: 0,
  next_run_at: "2026-09-05T12:00:00.000Z",
  lease_token: null,
  lease_expires_at: null,
  last_stop: null,
  enqueue_reason: "signup",
  observation_id: null,
};

const fullCheckpoint: CollectorCheckpoint = {
  version: 1,
  operations: [
    { key: "repositories", cursor: "page-2", done: false },
    { key: "files:PR_abc123", cursor: null, done: true },
  ],
  discovered: { repositoryIds: ["repo-1", "repo-2"], itemIds: { "repo-1": ["issue-1"] } },
  state: { githubRateLimitRemaining: 4200 },
};

const fullProgress: CollectionProgress = { operationsDone: 3, operationsKnown: 10, events: 42, requests: 17 };

describe("collection queue checkpoint/progress schema round-trip (no database)", () => {
  it("round-trips a full checkpoint through enqueueCollectionJob's row parsing", async () => {
    rpc.mockResolvedValue({ data: { ...baseRow, checkpoint: fullCheckpoint, progress: EMPTY_PROGRESS }, error: null });
    const job = await enqueueCollectionJob("alice", "github", "signup", "2026-09-05T12:00:00.000Z");
    expect(job.checkpoint).toEqual(fullCheckpoint);
  });

  it("round-trips full progress counters through the same parsing", async () => {
    rpc.mockResolvedValue({ data: { ...baseRow, checkpoint: EMPTY_CHECKPOINT, progress: fullProgress }, error: null });
    const job = await enqueueCollectionJob("alice", "github", "signup", "2026-09-05T12:00:00.000Z");
    expect(job.progress).toEqual(fullProgress);
  });

  it("maps the DB's pre-first-slice '{}' sentinel to EMPTY_CHECKPOINT and EMPTY_PROGRESS", async () => {
    rpc.mockResolvedValue({ data: { ...baseRow, checkpoint: {}, progress: {} }, error: null });
    const job = await enqueueCollectionJob("alice", "github", "signup", "2026-09-05T12:00:00.000Z");
    expect(job.checkpoint).toEqual(EMPTY_CHECKPOINT);
    expect(job.progress).toEqual(EMPTY_PROGRESS);
  });

  it("round-trips a full checkpoint and progress through a claimed batch of rows too", async () => {
    rpc.mockResolvedValue({ data: [{ ...baseRow, state: "running", checkpoint: fullCheckpoint, progress: fullProgress }], error: null });
    const [job] = await claimCollectionJobs(1, 120);
    expect(job!.checkpoint).toEqual(fullCheckpoint);
    expect(job!.progress).toEqual(fullProgress);
  });

  it("rejects a checkpoint with an unknown version", async () => {
    rpc.mockResolvedValue({ data: { ...baseRow, checkpoint: { ...fullCheckpoint, version: 2 }, progress: EMPTY_PROGRESS }, error: null });
    await expect(enqueueCollectionJob("alice", "github", "signup", "2026-09-05T12:00:00.000Z")).rejects.toThrow();
  });

  it("rejects a checkpoint operation missing a required field", async () => {
    const malformed = { ...fullCheckpoint, operations: [{ key: "repositories", done: false }] };
    rpc.mockResolvedValue({ data: { ...baseRow, checkpoint: malformed, progress: EMPTY_PROGRESS }, error: null });
    await expect(enqueueCollectionJob("alice", "github", "signup", "2026-09-05T12:00:00.000Z")).rejects.toThrow();
  });

  it("rejects a checkpoint with an unknown top-level key (strict shape)", async () => {
    const malformed = { ...fullCheckpoint, extra: "not allowed" };
    rpc.mockResolvedValue({ data: { ...baseRow, checkpoint: malformed, progress: EMPTY_PROGRESS }, error: null });
    await expect(enqueueCollectionJob("alice", "github", "signup", "2026-09-05T12:00:00.000Z")).rejects.toThrow();
  });

  it("rejects negative or non-integer progress counters", async () => {
    for (const bad of [{ ...fullProgress, events: -1 }, { ...fullProgress, requests: 1.5 }]) {
      rpc.mockResolvedValue({ data: { ...baseRow, checkpoint: EMPTY_CHECKPOINT, progress: bad }, error: null });
      await expect(enqueueCollectionJob("alice", "github", "signup", "2026-09-05T12:00:00.000Z")).rejects.toThrow();
    }
  });

  it("rejects a progress object with an unknown key (strict shape)", async () => {
    const malformed = { ...fullProgress, extra: 1 };
    rpc.mockResolvedValue({ data: { ...baseRow, checkpoint: EMPTY_CHECKPOINT, progress: malformed }, error: null });
    await expect(enqueueCollectionJob("alice", "github", "signup", "2026-09-05T12:00:00.000Z")).rejects.toThrow();
  });
});
