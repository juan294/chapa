import { describe, expect, it } from "vitest";
import { deriveScoringStatus, type ReceiptSummary } from "./status";
import type { CollectionJob, CollectionJobState } from "@/lib/db/collection-queue";
import { EMPTY_CHECKPOINT } from "./plan";

/** Minimal fixture builder for a job in a given state, with just the fields
 * `deriveScoringStatus` reads. */
function job(overrides: Partial<CollectionJob> & { state: CollectionJobState }): CollectionJob {
  return {
    id: "job-1",
    ownerHandle: "octocat",
    provider: "github",
    referenceDate: "2026-09-23",
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
    ...overrides,
  };
}

const current: ReceiptSummary = { date: "2026-09-22", current: true };
const stale: ReceiptSummary = { date: "2026-09-21", current: false };

describe("deriveScoringStatus", () => {
  it("reports unregistered before anything else, regardless of jobs or receipt", () => {
    expect(deriveScoringStatus([job({ state: "queued" })], current, false)).toEqual({ kind: "unregistered" });
    expect(deriveScoringStatus([], null, false)).toEqual({ kind: "unregistered" });
  });

  it("reports ready with updating:false when a current receipt exists and nothing is in progress", () => {
    expect(deriveScoringStatus([job({ state: "complete" })], current, true)).toEqual({
      kind: "ready",
      receiptDate: "2026-09-22",
      updating: false,
    });
    expect(deriveScoringStatus([], current, true)).toEqual({
      kind: "ready",
      receiptDate: "2026-09-22",
      updating: false,
    });
  });

  it.each<CollectionJobState>(["queued", "running", "waiting_rate_limit", "retrying"])(
    "reports ready with updating:true when a current receipt exists and a job is %s",
    (state) => {
      expect(deriveScoringStatus([job({ state })], current, true)).toMatchObject({
        kind: "ready",
        receiptDate: "2026-09-22",
        updating: true,
      });
    },
  );

  it("reports ready with updating:false when a current receipt exists and the only job for today is complete", () => {
    expect(deriveScoringStatus([job({ state: "complete" })], current, true)).toMatchObject({ updating: false });
  });

  it("treats a non-current (superseded/retracted) receipt as no receipt for the ready/collecting split", () => {
    const status = deriveScoringStatus([], stale, true);
    expect(status.kind).not.toBe("ready");
  });

  it("reports action_needed when no current receipt exists and a job has failed terminally", () => {
    const failed = job({
      provider: "bitbucket",
      state: "failed",
      progress: { operationsDone: 0, operationsKnown: 0, events: 0, requests: 0, discovering: false },
      lastStop: { provider: "bitbucket", operation: "profile", stopKind: "not_accessible", httpStatus: 401, retryAfterSeconds: null },
    });
    expect(deriveScoringStatus([failed], null, true)).toEqual({
      kind: "action_needed",
      hasPriorReceipt: false,
      sources: [{ provider: "bitbucket", state: "failed", percent: 0, reason: "reconnect", stop: failed.lastStop }],
    });
  });

  it("sets hasPriorReceipt:true in action_needed when a non-current receipt exists", () => {
    const failed = job({
      state: "failed",
      lastStop: { provider: "github", operation: "profile", stopKind: "not_accessible", httpStatus: 401, retryAfterSeconds: null },
    });
    expect(deriveScoringStatus([failed], stale, true)).toMatchObject({ kind: "action_needed", hasPriorReceipt: true });
  });

  it("labels a failed not_accessible job as reconnect and any other failed job as failed", () => {
    const notAccessible = job({
      provider: "bitbucket",
      state: "failed",
      lastStop: { provider: "bitbucket", operation: "profile", stopKind: "not_accessible", httpStatus: 403, retryAfterSeconds: null },
    });
    const structural = job({
      provider: "gitlab",
      state: "failed",
      lastStop: { provider: "gitlab", operation: "merged", stopKind: "protocol", httpStatus: null, retryAfterSeconds: null },
    });
    const status = deriveScoringStatus([notAccessible, structural], null, true);
    expect(status.kind).toBe("action_needed");
    if (status.kind !== "action_needed") throw new Error("unreachable");
    expect(status.sources.find((s) => s.provider === "bitbucket")?.reason).toBe("reconnect");
    expect(status.sources.find((s) => s.provider === "gitlab")?.reason).toBe("failed");
  });

  it("reports collecting with progress when jobs are in flight and no current receipt exists", () => {
    const running = job({
      provider: "github",
      state: "running",
      progress: { operationsDone: 30, operationsKnown: 120, events: 10, requests: 30, discovering: false },
    });
    expect(deriveScoringStatus([running], null, true)).toEqual({
      kind: "collecting",
      percent: 25,
      hasPriorReceipt: false,
      sources: [{ provider: "github", state: "running", percent: 25 }],
    });
  });

  it("sets hasPriorReceipt:true in collecting when a non-current receipt exists", () => {
    const running = job({ state: "running" });
    expect(deriveScoringStatus([running], stale, true)).toMatchObject({ kind: "collecting", hasPriorReceipt: true });
  });

  it("caps collecting percent at 99 even when the aggregate would round to 100", () => {
    const running = job({
      provider: "github",
      state: "running",
      progress: { operationsDone: 999, operationsKnown: 1000, events: 0, requests: 0, discovering: false },
    });
    const status = deriveScoringStatus([running], null, true);
    expect(status).toMatchObject({ kind: "collecting", percent: 99 });
  });

  it("reports collecting at 99% when every job is complete but no receipt has been issued yet (fan-in pending)", () => {
    const done = job({ state: "complete", progress: { operationsDone: 40, operationsKnown: 40, events: 5, requests: 40 } });
    expect(deriveScoringStatus([done], null, true)).toEqual({
      kind: "collecting",
      percent: 99,
      hasPriorReceipt: false,
      sources: [{ provider: "github", state: "complete", percent: 100 }],
    });
  });

  it("reports collecting at 0% with an empty source list when nothing has been enqueued yet", () => {
    expect(deriveScoringStatus([], null, true)).toEqual({
      kind: "collecting",
      percent: 0,
      hasPriorReceipt: false,
      sources: [],
    });
  });

  it("annotates a waiting_rate_limit job with resumesAt and a rate_limited reason", () => {
    const waiting = job({ state: "waiting_rate_limit", nextRunAt: "2026-09-23T12:00:00.000Z" });
    const status = deriveScoringStatus([waiting], null, true);
    expect(status).toMatchObject({
      kind: "collecting",
      sources: [{ provider: "github", state: "waiting_rate_limit", resumesAt: "2026-09-23T12:00:00.000Z", reason: "rate_limited" }],
    });
  });

  it("annotates a retrying job with resumesAt, attempt, and a temporary reason", () => {
    const retrying = job({ state: "retrying", attempt: 2, nextRunAt: "2026-09-23T11:00:00.000Z" });
    const status = deriveScoringStatus([retrying], null, true);
    expect(status).toMatchObject({
      kind: "collecting",
      sources: [{ provider: "github", state: "retrying", resumesAt: "2026-09-23T11:00:00.000Z", attempt: 2, reason: "temporary" }],
    });
  });

  // #1342 -- discovery-aware progress: while a job's operation count can
  // still grow, no percentage is shown at all (never a number that could
  // move backwards).
  describe("discovering (#1342)", () => {
    it("a job still discovering has percent null", () => {
      const running = job({
        provider: "github",
        state: "running",
        progress: { operationsDone: 5, operationsKnown: 10, events: 0, requests: 5, discovering: true },
      });
      const status = deriveScoringStatus([running], null, true);
      expect(status).toMatchObject({ kind: "collecting", percent: null, sources: [{ provider: "github", percent: null }] });
    });

    it("collecting percent is null while any in-progress job is discovering, even when another job has a real percent", () => {
      const discoveringJob = job({
        id: "job-github", provider: "github", state: "running",
        progress: { operationsDone: 5, operationsKnown: 10, events: 0, requests: 5, discovering: true },
      });
      const doneDiscovering = job({
        id: "job-bitbucket", provider: "bitbucket", state: "running",
        progress: { operationsDone: 50, operationsKnown: 100, events: 0, requests: 50, discovering: false },
      });
      const status = deriveScoringStatus([discoveringJob, doneDiscovering], null, true);
      expect(status).toMatchObject({
        kind: "collecting",
        percent: null,
        sources: [
          { provider: "github", percent: null },
          { provider: "bitbucket", percent: 50 },
        ],
      });
    });

    it("shows percent once every job has discovered", () => {
      const a = job({
        id: "job-a", provider: "github", state: "running",
        progress: { operationsDone: 10, operationsKnown: 20, events: 0, requests: 10, discovering: false },
      });
      const b = job({
        id: "job-b", provider: "bitbucket", state: "running",
        progress: { operationsDone: 30, operationsKnown: 30, events: 0, requests: 30, discovering: false },
      });
      const status = deriveScoringStatus([a, b], null, true);
      // (10 + 30) / (20 + 30) = 80%
      expect(status).toMatchObject({ kind: "collecting", percent: 80 });
    });

    it("a complete job counts as discovered, regardless of its stored progress.discovering", () => {
      const done = job({
        state: "complete",
        progress: { operationsDone: 40, operationsKnown: 40, events: 5, requests: 40, discovering: true },
      });
      const status = deriveScoringStatus([done], null, true);
      expect(status).toMatchObject({ kind: "collecting", percent: 99, sources: [{ provider: "github", percent: 100 }] });
    });

    it("legacy progress without the discovering key is treated as discovering, unless the job is complete", () => {
      const legacyRunning = job({
        provider: "github",
        state: "running",
        progress: { operationsDone: 5, operationsKnown: 10, events: 0, requests: 5 },
      });
      const legacyComplete = job({
        provider: "bitbucket",
        state: "complete",
        progress: { operationsDone: 10, operationsKnown: 10, events: 0, requests: 10 },
      });
      expect(deriveScoringStatus([legacyRunning], null, true)).toMatchObject({ kind: "collecting", percent: null, sources: [{ percent: null }] });
      expect(deriveScoringStatus([legacyComplete], null, true)).toMatchObject({ kind: "collecting", sources: [{ percent: 100 }] });
    });

    it("percent never decreases across a discovery-to-completion sequence", () => {
      // A representative sequence a real job's progress rows could take:
      // discovering while operationsKnown still grows, then a fixed known
      // count once discovery finishes, then done.
      const sequence = [
        { operationsDone: 0, operationsKnown: 0, events: 0, requests: 0, discovering: true },
        { operationsDone: 2, operationsKnown: 8, events: 0, requests: 2, discovering: true },
        { operationsDone: 5, operationsKnown: 20, events: 0, requests: 5, discovering: true },
        { operationsDone: 8, operationsKnown: 20, events: 0, requests: 8, discovering: false },
        { operationsDone: 15, operationsKnown: 20, events: 0, requests: 15, discovering: false },
        { operationsDone: 20, operationsKnown: 20, events: 0, requests: 20, discovering: false },
      ];
      let lastPercent: number | null = null;
      for (const progress of sequence) {
        const running = job({ provider: "github", state: "running", progress });
        const status = deriveScoringStatus([running], null, true);
        if (status.kind !== "collecting") throw new Error("unreachable");
        if (status.percent !== null) {
          if (lastPercent !== null) expect(status.percent).toBeGreaterThanOrEqual(lastPercent);
          lastPercent = status.percent;
        }
      }
      expect(lastPercent).toBe(99);
    });
  });
});
