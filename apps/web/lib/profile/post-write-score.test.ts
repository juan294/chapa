import { beforeEach, describe, expect, it, vi } from "vitest";

const mockReadScoringStatus = vi.hoisted(() => vi.fn());
vi.mock("@/lib/collection/read-scoring-status", () => ({ readScoringStatus: mockReadScoringStatus }));

import { postWriteScore } from "./post-write-score";

const enabledSelection = { enabled: true, machinePolicy: "v7.2" as const, cacheable: true, capturedAt: Date.parse("2026-09-08T10:00:00Z") };
const disabledSelection = { enabled: false, machinePolicy: "v6" as const, cacheable: true, capturedAt: Date.parse("2026-09-08T10:00:00Z") };

beforeEach(() => mockReadScoringStatus.mockReset());

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
