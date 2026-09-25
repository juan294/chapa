import { beforeEach, describe, expect, it, vi } from "vitest";

const mockReadScoringStatus = vi.hoisted(() => vi.fn());
vi.mock("@/lib/collection/read-scoring-status", () => ({ readScoringStatus: mockReadScoringStatus }));

const mockEnqueueCollection = vi.hoisted(() => vi.fn());
const mockScheduleCollectionAdvance = vi.hoisted(() => vi.fn());
vi.mock("@/lib/collection/enqueue", () => ({
  enqueueCollection: mockEnqueueCollection,
  scheduleCollectionAdvance: mockScheduleCollectionAdvance,
}));

import { postWriteScore, enqueueAndReportScoringStatus } from "./post-write-score";

beforeEach(() => {
  mockReadScoringStatus.mockReset();
  mockEnqueueCollection.mockReset().mockResolvedValue([]);
  mockScheduleCollectionAdvance.mockReset();
});

describe("postWriteScore (#1335 phase 5: v7.2 is the one rendered policy)", () => {
  it("returns the owner's current ScoringStatus once collection has issued a receipt", async () => {
    mockReadScoringStatus.mockResolvedValue({ kind: "ready", receiptDate: "2026-09-08", updating: false });
    expect(await postWriteScore("alice")).toEqual({ kind: "ready", receiptDate: "2026-09-08", updating: false });
    expect(mockReadScoringStatus).toHaveBeenCalledWith("alice");
  });

  it("passes through a collecting status while the write's enqueued job is still in flight", async () => {
    mockReadScoringStatus.mockResolvedValue({ kind: "collecting", percent: 40, sources: [], hasPriorReceipt: false });
    expect(await postWriteScore("alice")).toMatchObject({ kind: "collecting", percent: 40 });
  });

  it("passes through null when the status authority read itself fails", async () => {
    mockReadScoringStatus.mockResolvedValue(null);
    expect(await postWriteScore("alice")).toBeNull();
  });

  // #1342 -- a still-discovering job reports percent: null, not a number.
  it("passes through a null percent when collection is still discovering", async () => {
    mockReadScoringStatus.mockResolvedValue({ kind: "collecting", percent: null, sources: [], hasPriorReceipt: false });
    expect(await postWriteScore("alice")).toMatchObject({ kind: "collecting", percent: null });
  });
});

describe("enqueueAndReportScoringStatus (#1335 phase 4/5: the enqueue-then-report shape shared by refresh/recalculate/generate)", () => {
  it("enqueues for the given reason, schedules a background slice, and reports the resulting ScoringStatus", async () => {
    mockReadScoringStatus.mockResolvedValue({ kind: "collecting", percent: 40, sources: [], hasPriorReceipt: false });
    const result = await enqueueAndReportScoringStatus("alice", "refresh");
    expect(mockEnqueueCollection).toHaveBeenCalledWith("alice", "refresh");
    expect(mockScheduleCollectionAdvance).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ kind: "collecting", percent: 40 });
  });

  // #1342 -- a still-discovering job reports percent: null, not a number.
  it("passes through a null percent when collection is still discovering", async () => {
    mockReadScoringStatus.mockResolvedValue({ kind: "collecting", percent: null, sources: [], hasPriorReceipt: false });
    const result = await enqueueAndReportScoringStatus("alice", "refresh");
    expect(result).toMatchObject({ kind: "collecting", percent: null });
  });

  it("passes the reason through unchanged (e.g. generate's signup vs refresh's refresh)", async () => {
    mockReadScoringStatus.mockResolvedValue({ kind: "unregistered" });
    await enqueueAndReportScoringStatus("alice", "signup");
    expect(mockEnqueueCollection).toHaveBeenCalledWith("alice", "signup");
  });
});
