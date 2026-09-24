import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * #1335 phase 4 fix (team-lead review) — bulk-recalculate must still be able
 * to re-publish from stored observations after a scoring-code fix, for a
 * handle whose collection is already complete for today: it calls fan-in's
 * `maybeIssue` directly (it reads finished observations and needs no
 * collection), rather than enqueueing a redundant `admin` job that would
 * never itself trigger a re-issue for an already-complete day.
 */
const mocks = vi.hoisted(() => ({
  materialize: vi.fn(),
  invalidate: vi.fn(),
  listJobs: vi.fn(),
  maybeIssue: vi.fn(),
  enqueueCollection: vi.fn(),
  scheduleCollectionAdvance: vi.fn(),
  postWriteScore: vi.fn(),
  dbGetUserHandlePage: vi.fn(),
}));

vi.mock("@/lib/auth/admin", () => ({ verifyAdminSecret: () => null }));
vi.mock("@/lib/cache/redis", () => ({ rateLimit: vi.fn().mockResolvedValue({ allowed: true }) }));
vi.mock("@/lib/http/client-ip", () => ({ getClientIp: () => "127.0.0.1" }));
vi.mock("@/lib/profile/orchestrated-profile", () => ({
  materializeOrchestratedProfile: mocks.materialize,
}));
vi.mock("@/lib/profile/post-write-invalidation", () => ({ invalidateProfileReadModels: mocks.invalidate }));
vi.mock("@/lib/db/users", () => ({ dbGetUserHandlePage: mocks.dbGetUserHandlePage }));
vi.mock("@/lib/db/collection-queue", () => ({ listCollectionJobsForDate: mocks.listJobs }));
vi.mock("@/lib/collection/fan-in", () => ({ maybeIssue: mocks.maybeIssue }));
vi.mock("@/lib/collection/enqueue", () => ({
  enqueueCollection: mocks.enqueueCollection,
  scheduleCollectionAdvance: mocks.scheduleCollectionAdvance,
}));
vi.mock("@/lib/profile/post-write-score", () => ({ postWriteScore: mocks.postWriteScore }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { POST } from "./route";

const materialized = { stats: { handle: "x" }, statsComplete: true, craftResult: null };

function job(state: string) {
  return { id: "j", ownerHandle: "x", provider: "github", referenceDate: "2026-09-23", referenceTime: "2026-09-23T10:00:00.000Z",
    state, checkpoint: {}, progress: {}, attempt: 0, nextRunAt: "", leaseToken: null, leaseExpiresAt: null, lastStop: null,
    enqueueReason: "admin", observationId: null };
}

function makeRequest(handles: string[]): NextRequest {
  return new NextRequest("https://chapa.test/api/admin/bulk-recalculate", {
    method: "POST",
    headers: { Authorization: "Bearer secret", "Content-Type": "application/json" },
    body: JSON.stringify({ handles }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.materialize.mockResolvedValue(materialized);
  mocks.invalidate.mockResolvedValue(undefined);
  mocks.maybeIssue.mockResolvedValue(undefined);
  mocks.enqueueCollection.mockResolvedValue([]);
  mocks.postWriteScore.mockResolvedValue({ kind: "ready", receiptDate: "2026-09-23", updating: false });
});

describe("admin bulk-recalculate: fan-in direct issuance vs enqueue", () => {
  it("calls fan-in's maybeIssue directly for a handle whose jobs are all complete today, without enqueueing", async () => {
    mocks.listJobs.mockResolvedValue([job("complete"), job("complete")]);

    const res = await POST(makeRequest(["alice"]));
    expect(res.status).toBe(200);

    expect(mocks.maybeIssue).toHaveBeenCalledWith("alice", expect.any(String), expect.any(String));
    expect(mocks.enqueueCollection).not.toHaveBeenCalled();
  });

  it("enqueues instead of issuing when a job is still in progress", async () => {
    mocks.listJobs.mockResolvedValue([job("complete"), job("running")]);

    await POST(makeRequest(["alice"]));

    expect(mocks.enqueueCollection).toHaveBeenCalledWith("alice", "admin");
    expect(mocks.maybeIssue).not.toHaveBeenCalled();
  });

  it("enqueues instead of issuing when there are no jobs at all for today", async () => {
    mocks.listJobs.mockResolvedValue([]);

    await POST(makeRequest(["alice"]));

    expect(mocks.enqueueCollection).toHaveBeenCalledWith("alice", "admin");
    expect(mocks.maybeIssue).not.toHaveBeenCalled();
  });

  it("handles each handle in a batch independently", async () => {
    mocks.listJobs.mockImplementation(async (handle: string) =>
      handle === "alice" ? [job("complete")] : [job("running")],
    );

    await POST(makeRequest(["alice", "bob"]));

    expect(mocks.maybeIssue).toHaveBeenCalledWith("alice", expect.any(String), expect.any(String));
    expect(mocks.enqueueCollection).toHaveBeenCalledWith("bob", "admin");
  });

  it("still reports the resulting scoring status after a direct fan-in issuance", async () => {
    mocks.listJobs.mockResolvedValue([job("complete")]);

    const res = await POST(makeRequest(["alice"]));
    const body = await res.json();

    expect(body.publications).toEqual([{ handle: "alice", result: { kind: "ready", receiptDate: "2026-09-23", updating: false } }]);
  });

  it("does not fail the batch when the job-completeness check itself throws", async () => {
    mocks.listJobs.mockRejectedValue(new Error("db unavailable"));

    const res = await POST(makeRequest(["alice"]));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.failed).toBe(1);
    expect(body.errors[0].handle).toBe("alice");
  });
});
