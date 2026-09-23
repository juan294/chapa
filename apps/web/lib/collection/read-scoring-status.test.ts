import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockDbIsScoringSubject, mockListCollectionJobsForDate, mockDbReadObservedReceipt, mockCaptureServerError } = vi.hoisted(() => ({
  mockDbIsScoringSubject: vi.fn(),
  mockListCollectionJobsForDate: vi.fn(),
  mockDbReadObservedReceipt: vi.fn(),
  mockCaptureServerError: vi.fn(),
}));

vi.mock("@/lib/db/scoring-subjects", () => ({ dbIsScoringSubject: mockDbIsScoringSubject }));
vi.mock("@/lib/db/collection-queue", () => ({ listCollectionJobsForDate: mockListCollectionJobsForDate }));
vi.mock("@/lib/db/score-receipts-observed", () => ({ dbReadObservedReceipt: mockDbReadObservedReceipt }));
vi.mock("@/lib/analytics/server-errors", () => ({ captureServerError: mockCaptureServerError }));

import { readScoringStatus } from "./read-scoring-status";

beforeEach(() => {
  mockDbIsScoringSubject.mockReset();
  mockListCollectionJobsForDate.mockReset().mockResolvedValue([]);
  mockDbReadObservedReceipt.mockReset().mockResolvedValue({ status: "missing" });
  mockCaptureServerError.mockReset().mockResolvedValue(undefined);
});

describe("readScoringStatus", () => {
  it("returns unregistered without reading jobs or the receipt", async () => {
    mockDbIsScoringSubject.mockResolvedValue("unregistered");
    expect(await readScoringStatus("nobody")).toEqual({ kind: "unregistered" });
    expect(mockListCollectionJobsForDate).not.toHaveBeenCalled();
    expect(mockDbReadObservedReceipt).not.toHaveBeenCalled();
  });

  it("returns null when the registration authority read itself fails", async () => {
    mockDbIsScoringSubject.mockResolvedValue("unavailable");
    expect(await readScoringStatus("octocat")).toBeNull();
  });

  it("returns null when the receipt authority read itself fails, even though registration succeeded", async () => {
    mockDbIsScoringSubject.mockResolvedValue("registered");
    mockDbReadObservedReceipt.mockResolvedValue({ status: "unavailable" });
    expect(await readScoringStatus("octocat")).toBeNull();
  });

  it("returns collecting for a registered subject with no receipt and jobs in flight", async () => {
    mockDbIsScoringSubject.mockResolvedValue("registered");
    mockListCollectionJobsForDate.mockResolvedValue([
      { id: "1", ownerHandle: "octocat", provider: "github", referenceDate: "2026-09-23", referenceTime: "2026-09-23T10:00:00.000Z",
        state: "running", checkpoint: { version: 1, operations: [], discovered: { repositoryIds: [] } },
        progress: { operationsDone: 10, operationsKnown: 40, events: 2, requests: 10 }, attempt: 0,
        nextRunAt: "2026-09-23T10:00:00.000Z", leaseToken: null, leaseExpiresAt: null, lastStop: null,
        enqueueReason: "signup", observationId: null },
    ]);
    const status = await readScoringStatus("octocat");
    expect(status).toMatchObject({ kind: "collecting", percent: 25 });
  });

  it("returns ready when a current, non-retracted receipt exists", async () => {
    mockDbIsScoringSubject.mockResolvedValue("registered");
    mockDbReadObservedReceipt.mockResolvedValue({
      status: "found",
      isCurrent: true,
      envelope: { receipt: { action: "publish", window: { referenceDate: "2026-09-22" } } },
    });
    const status = await readScoringStatus("octocat");
    expect(status).toEqual({ kind: "ready", receiptDate: "2026-09-22", updating: false });
  });

  it("treats a retracted receipt as not current, but still hasPriorReceipt when collecting resumes", async () => {
    mockDbIsScoringSubject.mockResolvedValue("registered");
    mockDbReadObservedReceipt.mockResolvedValue({
      status: "found",
      isCurrent: true,
      envelope: { receipt: { action: "retract", window: { referenceDate: "2026-09-20" } } },
    });
    const status = await readScoringStatus("octocat");
    expect(status).toMatchObject({ kind: "collecting", hasPriorReceipt: true });
  });

  it("lowercases the handle before every read", async () => {
    mockDbIsScoringSubject.mockResolvedValue("registered");
    await readScoringStatus("OctoCat");
    expect(mockDbIsScoringSubject).toHaveBeenCalledWith("octocat");
    expect(mockListCollectionJobsForDate).toHaveBeenCalledWith("octocat", expect.any(String));
    expect(mockDbReadObservedReceipt).toHaveBeenCalledWith("octocat");
  });

  it("captures the error and returns null, rather than failing silently, when an unexpected error escapes", async () => {
    mockDbIsScoringSubject.mockRejectedValue(new Error("boom"));
    expect(await readScoringStatus("octocat")).toBeNull();
    expect(mockCaptureServerError).toHaveBeenCalledOnce();
    const [captured] = mockCaptureServerError.mock.calls[0]!;
    expect(captured.route).toBe("lib/collection/read-scoring-status");
    expect(captured.error).toBeInstanceOf(Error);
    expect((captured.error as Error).message).toContain("boom");
  });

  it("captures the handle (lowercased) alongside the route, with no other structured context", async () => {
    mockDbIsScoringSubject.mockRejectedValue(new Error("db unavailable"));
    await readScoringStatus("OctoCat");
    const [captured] = mockCaptureServerError.mock.calls[0]!;
    expect(captured.route).toBe("lib/collection/read-scoring-status");
    expect((captured.error as Error).message).toContain("octocat");
    expect(Object.keys(captured).sort()).toEqual(["error", "route", "statusCode"]);
  });
});
