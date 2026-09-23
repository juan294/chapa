import { describe, expect, it, vi, beforeEach } from "vitest";
import { maybeIssue, onJobComplete, retryPendingFanIns, type FanInDeps } from "./fan-in";
import type { CollectionJob, CollectionJobState } from "@/lib/db/collection-queue";
import { EMPTY_CHECKPOINT } from "./plan";
import { scoringConsistencyFixture } from "@/lib/profile/__fixtures__/scoring-consistency";

const listPendingFanIns = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/collection-queue", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/db/collection-queue")>()),
  listPendingFanIns: (...args: unknown[]) => listPendingFanIns(...args),
}));

function job(provider: string, state: CollectionJobState, referenceDate = "2026-09-23"): CollectionJob {
  return {
    id: `job-${provider}`,
    ownerHandle: "octocat",
    provider: provider as CollectionJob["provider"],
    state,
    referenceDate,
    referenceTime: "2026-09-23T10:00:00.000Z",
    checkpoint: EMPTY_CHECKPOINT,
    progress: { operationsDone: 0, operationsKnown: 0, events: 0, requests: 0 },
    attempt: 0,
    nextRunAt: "2026-09-23T10:00:00.000Z",
    leaseToken: null,
    leaseExpiresAt: null,
    lastStop: null,
    enqueueReason: "signup",
    observationId: null,
  };
}

function harness(): FanInDeps {
  return {
    listJobsForDate: vi.fn().mockResolvedValue([]),
    issue: vi.fn().mockResolvedValue({ status: "issued" }),
    recordAttempt: vi.fn().mockResolvedValue(true),
    scheduleEvent: vi.fn(),
    captureError: vi.fn().mockResolvedValue(undefined),
    alertFailure: vi.fn().mockResolvedValue(undefined),
    readReceipt: vi.fn().mockResolvedValue(null),
    notifyScoreChange: vi.fn().mockResolvedValue(true),
  };
}

describe("maybeIssue", () => {
  it("issues nothing while a connected provider's job is still in progress", async () => {
    const deps = harness();
    vi.mocked(deps.listJobsForDate).mockResolvedValue([job("github", "complete"), job("bitbucket", "running")]);
    await maybeIssue("octocat", "2026-09-23", "2026-09-23T10:00:00.000Z", deps);
    expect(deps.issue).not.toHaveBeenCalled();
    expect(deps.recordAttempt).not.toHaveBeenCalled();
  });

  it("issues exactly once once the second (and last) provider completes", async () => {
    const deps = harness();
    vi.mocked(deps.listJobsForDate).mockResolvedValue([job("github", "complete"), job("bitbucket", "complete")]);
    await maybeIssue("octocat", "2026-09-23", "2026-09-23T10:00:00.000Z", deps);
    expect(deps.issue).toHaveBeenCalledOnce();
    expect(deps.issue).toHaveBeenCalledWith("octocat", { referenceTime: "2026-09-23T10:00:00.000Z" });
    expect(deps.recordAttempt).toHaveBeenCalledWith("octocat", "2026-09-23", { status: "issued" });
    expect(deps.scheduleEvent).toHaveBeenCalledWith("scoring_issuance_outcome", {
      handle: "octocat",
      referenceDate: "2026-09-23",
      outcome: "issued",
    });
    expect(deps.captureError).not.toHaveBeenCalled();
    expect(deps.alertFailure).not.toHaveBeenCalled();
  });

  it("issues nothing for a day with no jobs at all", async () => {
    const deps = harness();
    vi.mocked(deps.listJobsForDate).mockResolvedValue([]);
    await maybeIssue("octocat", "2026-09-23", "2026-09-23T10:00:00.000Z", deps);
    expect(deps.issue).not.toHaveBeenCalled();
  });

  it("records, captures, and alerts on a failed issuance outcome — never silently", async () => {
    const deps = harness();
    vi.mocked(deps.listJobsForDate).mockResolvedValue([job("github", "complete")]);
    vi.mocked(deps.issue).mockResolvedValue({ status: "failed", reason: "source_error" });
    await maybeIssue("octocat", "2026-09-23", "2026-09-23T10:00:00.000Z", deps);
    expect(deps.recordAttempt).toHaveBeenCalledWith("octocat", "2026-09-23", { status: "failed", reason: "source_error" });
    expect(deps.scheduleEvent).toHaveBeenCalledWith("scoring_issuance_outcome", {
      handle: "octocat",
      referenceDate: "2026-09-23",
      outcome: "failed",
      reason: "source_error",
    });
    expect(deps.captureError).toHaveBeenCalledOnce();
    expect(deps.alertFailure).toHaveBeenCalledWith("octocat", "2026-09-23", "source_error");
  });

  it("does not alert or capture on an unchanged outcome", async () => {
    const deps = harness();
    vi.mocked(deps.listJobsForDate).mockResolvedValue([job("github", "complete")]);
    vi.mocked(deps.issue).mockResolvedValue({ status: "unchanged" });
    await maybeIssue("octocat", "2026-09-23", "2026-09-23T10:00:00.000Z", deps);
    expect(deps.captureError).not.toHaveBeenCalled();
    expect(deps.alertFailure).not.toHaveBeenCalled();
  });
});

describe("maybeIssue — score-change notification (#1335 phase 5.7: keep notifyObservedScoreChange)", () => {
  it("notifies of a score change when issuance publishes a new revision", async () => {
    const deps = harness();
    vi.mocked(deps.listJobsForDate).mockResolvedValue([job("github", "complete")]);
    vi.mocked(deps.issue).mockResolvedValue({ status: "issued" });
    const before = await scoringConsistencyFixture({ boundary: true }); // composite 69.99
    const after = await scoringConsistencyFixture({}); // composite 46
    vi.mocked(deps.readReceipt)
      .mockResolvedValueOnce({ receipt: before.envelope, trend: null })
      .mockResolvedValueOnce({ receipt: after.envelope, trend: null });

    await maybeIssue("alice", "2026-09-23", "2026-09-23T10:00:00.000Z", deps);

    expect(deps.readReceipt).toHaveBeenCalledTimes(2);
    expect(deps.readReceipt).toHaveBeenNthCalledWith(1, "alice");
    expect(deps.readReceipt).toHaveBeenNthCalledWith(2, "alice");
    expect(deps.notifyScoreChange).toHaveBeenCalledWith(
      "alice",
      expect.objectContaining({
        status: "comparable",
        composite: expect.objectContaining({ display: 46 - 69.99 }),
      }),
    );
  });

  it("reads the baseline before issuing, not after", async () => {
    const deps = harness();
    vi.mocked(deps.listJobsForDate).mockResolvedValue([job("github", "complete")]);
    const order: string[] = [];
    vi.mocked(deps.readReceipt).mockImplementation(async () => { order.push("read"); return null; });
    vi.mocked(deps.issue).mockImplementation(async () => { order.push("issue"); return { status: "issued" }; });

    await maybeIssue("alice", "2026-09-23", "2026-09-23T10:00:00.000Z", deps);

    expect(order[0]).toBe("read");
    expect(order[1]).toBe("issue");
  });

  it("never notifies on an unchanged outcome — only one baseline read happens", async () => {
    const deps = harness();
    vi.mocked(deps.listJobsForDate).mockResolvedValue([job("github", "complete")]);
    vi.mocked(deps.issue).mockResolvedValue({ status: "unchanged" });
    const before = await scoringConsistencyFixture({ boundary: true });
    vi.mocked(deps.readReceipt).mockResolvedValueOnce({ receipt: before.envelope, trend: null });

    await maybeIssue("alice", "2026-09-23", "2026-09-23T10:00:00.000Z", deps);

    expect(deps.readReceipt).toHaveBeenCalledTimes(1);
    expect(deps.notifyScoreChange).not.toHaveBeenCalled();
  });

  it("never notifies on a failed outcome", async () => {
    const deps = harness();
    vi.mocked(deps.listJobsForDate).mockResolvedValue([job("github", "complete")]);
    vi.mocked(deps.issue).mockResolvedValue({ status: "failed", reason: "source_error" });

    await maybeIssue("alice", "2026-09-23", "2026-09-23T10:00:00.000Z", deps);

    expect(deps.notifyScoreChange).not.toHaveBeenCalled();
  });

  it("never notifies when there is no prior receipt to compare against (first-ever issuance)", async () => {
    const deps = harness();
    vi.mocked(deps.listJobsForDate).mockResolvedValue([job("github", "complete")]);
    vi.mocked(deps.issue).mockResolvedValue({ status: "issued" });
    vi.mocked(deps.readReceipt).mockResolvedValue(null);

    await maybeIssue("alice", "2026-09-23", "2026-09-23T10:00:00.000Z", deps);

    expect(deps.notifyScoreChange).not.toHaveBeenCalled();
  });

  it("never notifies when the baseline read reports unavailable", async () => {
    const deps = harness();
    vi.mocked(deps.listJobsForDate).mockResolvedValue([job("github", "complete")]);
    vi.mocked(deps.issue).mockResolvedValue({ status: "issued" });
    vi.mocked(deps.readReceipt).mockResolvedValue({ unavailable: true });

    await maybeIssue("alice", "2026-09-23", "2026-09-23T10:00:00.000Z", deps);

    expect(deps.notifyScoreChange).not.toHaveBeenCalled();
  });

  it("never notifies when the baseline read itself throws", async () => {
    const deps = harness();
    vi.mocked(deps.listJobsForDate).mockResolvedValue([job("github", "complete")]);
    vi.mocked(deps.issue).mockResolvedValue({ status: "issued" });
    vi.mocked(deps.readReceipt).mockRejectedValue(new Error("db unavailable"));

    await expect(maybeIssue("alice", "2026-09-23", "2026-09-23T10:00:00.000Z", deps)).resolves.toBeUndefined();
    expect(deps.notifyScoreChange).not.toHaveBeenCalled();
  });

  it("never notifies when the post-issuance read fails, even with a good baseline", async () => {
    const deps = harness();
    vi.mocked(deps.listJobsForDate).mockResolvedValue([job("github", "complete")]);
    vi.mocked(deps.issue).mockResolvedValue({ status: "issued" });
    const before = await scoringConsistencyFixture({ boundary: true });
    vi.mocked(deps.readReceipt)
      .mockResolvedValueOnce({ receipt: before.envelope, trend: null })
      .mockRejectedValueOnce(new Error("db unavailable"));

    await expect(maybeIssue("alice", "2026-09-23", "2026-09-23T10:00:00.000Z", deps)).resolves.toBeUndefined();
    expect(deps.notifyScoreChange).not.toHaveBeenCalled();
  });

  it("swallows a rejection from notifyScoreChange itself without failing the fan-in", async () => {
    const deps = harness();
    vi.mocked(deps.listJobsForDate).mockResolvedValue([job("github", "complete")]);
    vi.mocked(deps.issue).mockResolvedValue({ status: "issued" });
    const before = await scoringConsistencyFixture({ boundary: true });
    const after = await scoringConsistencyFixture({});
    vi.mocked(deps.readReceipt)
      .mockResolvedValueOnce({ receipt: before.envelope, trend: null })
      .mockResolvedValueOnce({ receipt: after.envelope, trend: null });
    vi.mocked(deps.notifyScoreChange).mockRejectedValue(new Error("resend down"));

    await expect(maybeIssue("alice", "2026-09-23", "2026-09-23T10:00:00.000Z", deps)).resolves.toBeUndefined();
  });
});

describe("onJobComplete", () => {
  it("delegates to maybeIssue using the completed job's own owner/date/time", async () => {
    const deps = harness();
    vi.mocked(deps.listJobsForDate).mockResolvedValue([job("github", "complete")]);
    await onJobComplete({ ownerHandle: "octocat", referenceDate: "2026-09-23", referenceTime: "2026-09-23T10:00:00.000Z" }, deps);
    expect(deps.listJobsForDate).toHaveBeenCalledWith("octocat", "2026-09-23");
    expect(deps.issue).toHaveBeenCalledOnce();
  });
});

describe("retryPendingFanIns", () => {
  beforeEach(() => listPendingFanIns.mockReset());

  it("retries fan-in for every complete-but-unissued day it finds, bounded by the limit", async () => {
    listPendingFanIns.mockResolvedValue([
      { ownerHandle: "octocat", referenceDate: "2026-09-22", referenceTime: "2026-09-22T09:00:00.000Z" },
      { ownerHandle: "alice", referenceDate: "2026-09-21", referenceTime: "2026-09-21T09:00:00.000Z" },
    ]);
    const deps = harness();
    vi.mocked(deps.listJobsForDate).mockResolvedValue([job("github", "complete")]);
    await retryPendingFanIns(50, deps);
    expect(listPendingFanIns).toHaveBeenCalledWith(50);
    expect(deps.issue).toHaveBeenCalledTimes(2);
    expect(deps.issue).toHaveBeenCalledWith("octocat", { referenceTime: "2026-09-22T09:00:00.000Z" });
    expect(deps.issue).toHaveBeenCalledWith("alice", { referenceTime: "2026-09-21T09:00:00.000Z" });
  });

  it("does nothing when there is no pending fan-in", async () => {
    listPendingFanIns.mockResolvedValue([]);
    const deps = harness();
    await retryPendingFanIns(50, deps);
    expect(deps.issue).not.toHaveBeenCalled();
  });
});
