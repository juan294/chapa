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

const enabledSelection = { enabled: true, machinePolicy: "v7.2" as const, cacheable: true, capturedAt: Date.parse("2026-09-08T10:00:00Z") };
const disabledSelection = { enabled: false, machinePolicy: "v6" as const, cacheable: true, capturedAt: Date.parse("2026-09-08T10:00:00Z") };

beforeEach(() => {
  mockReadScoringStatus.mockReset();
  mockEnqueueCollection.mockReset().mockResolvedValue([]);
  mockScheduleCollectionAdvance.mockReset();
});

describe("postWriteScore (#1335 phase 4: returns ScoringStatus, not legacy/pending)", () => {
  it("returns null without reading status while the render flag is off — the caller's v6 fallback governs", async () => {
    expect(await postWriteScore("alice", disabledSelection)).toBeNull();
    expect(mockReadScoringStatus).not.toHaveBeenCalled();
  });

  it("returns the owner's current ScoringStatus once collection has issued a receipt", async () => {
    mockReadScoringStatus.mockResolvedValue({ kind: "ready", receiptDate: "2026-09-08", updating: false });
    expect(await postWriteScore("alice", enabledSelection)).toEqual({ kind: "ready", receiptDate: "2026-09-08", updating: false });
    expect(mockReadScoringStatus).toHaveBeenCalledWith("alice");
  });

  it("passes through a collecting status while the write's enqueued job is still in flight", async () => {
    mockReadScoringStatus.mockResolvedValue({ kind: "collecting", percent: 40, sources: [], hasPriorReceipt: false });
    expect(await postWriteScore("alice", enabledSelection)).toMatchObject({ kind: "collecting", percent: 40 });
  });

  it("passes through null when the status authority read itself fails", async () => {
    mockReadScoringStatus.mockResolvedValue(null);
    expect(await postWriteScore("alice", enabledSelection)).toBeNull();
  });
});

describe("enqueueAndReportScoringStatus (#1335 phase 4: the enqueue-then-report shape shared by refresh/recalculate/generate)", () => {
  it("enqueues for the given reason, schedules a background slice, and reports the resulting ScoringStatus", async () => {
    mockReadScoringStatus.mockResolvedValue({ kind: "collecting", percent: 40, sources: [], hasPriorReceipt: false });
    const result = await enqueueAndReportScoringStatus("alice", "refresh", enabledSelection);
    expect(mockEnqueueCollection).toHaveBeenCalledWith("alice", "refresh");
    expect(mockScheduleCollectionAdvance).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ kind: "collecting", percent: 40 });
  });

  it("passes the reason through unchanged (e.g. generate's signup vs refresh's refresh)", async () => {
    mockReadScoringStatus.mockResolvedValue({ kind: "unregistered" });
    await enqueueAndReportScoringStatus("alice", "signup", enabledSelection);
    expect(mockEnqueueCollection).toHaveBeenCalledWith("alice", "signup");
  });

  it("never enqueues or schedules while the render flag is off, and reports null", async () => {
    const result = await enqueueAndReportScoringStatus("alice", "refresh", disabledSelection);
    expect(mockEnqueueCollection).not.toHaveBeenCalled();
    expect(mockScheduleCollectionAdvance).not.toHaveBeenCalled();
    expect(mockReadScoringStatus).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });
});
