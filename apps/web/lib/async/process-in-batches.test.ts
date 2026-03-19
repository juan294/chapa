import { describe, it, expect, vi } from "vitest";
import { processInBatches } from "./process-in-batches";

describe("processInBatches", () => {
  it("processes all items and returns results in order", async () => {
    const items = [1, 2, 3, 4];
    const fn = vi.fn(async (n: number) => n * 10);

    const results = await processInBatches(items, 2, fn);

    expect(results).toHaveLength(4);
    expect(results.map((r) => (r as PromiseFulfilledResult<number>).value)).toEqual([10, 20, 30, 40]);
  });

  it("handles empty input array", async () => {
    const fn = vi.fn(async () => "nope");

    const results = await processInBatches([], 3, fn);

    expect(results).toEqual([]);
    expect(fn).not.toHaveBeenCalled();
  });

  it("processes items in correct batch sizes (5 items, batch size 2 = 3 batches)", async () => {
    const fn = vi.fn(async (n: number) => n);

    await processInBatches([1, 2, 3, 4, 5], 2, fn);

    // All 5 items processed in order
    expect(fn).toHaveBeenCalledTimes(5);
    expect(fn.mock.calls.map((c) => c[0])).toEqual([1, 2, 3, 4, 5]);
  });

  it("isolates failures — one rejected promise does not affect others", async () => {
    const fn = async (n: number) => {
      if (n === 2) throw new Error("fail");
      return n;
    };

    const results = await processInBatches([1, 2, 3], 3, fn);

    expect(results[0]).toEqual({ status: "fulfilled", value: 1 });
    expect(results[1]).toEqual({ status: "rejected", reason: new Error("fail") });
    expect(results[2]).toEqual({ status: "fulfilled", value: 3 });
  });

  it("returns PromiseSettledResult with correct statuses", async () => {
    const fn = async (n: number) => {
      if (n % 2 === 0) throw new Error(`err-${n}`);
      return `ok-${n}`;
    };

    const results = await processInBatches([1, 2, 3, 4], 4, fn);

    expect(results[0]).toEqual({ status: "fulfilled", value: "ok-1" });
    expect(results[1]).toEqual({ status: "rejected", reason: new Error("err-2") });
    expect(results[2]).toEqual({ status: "fulfilled", value: "ok-3" });
    expect(results[3]).toEqual({ status: "rejected", reason: new Error("err-4") });
  });

  it("processes batches sequentially — batch 2 starts after batch 1 completes", async () => {
    const events: string[] = [];

    const fn = async (n: number) => {
      events.push(`start-${n}`);
      await new Promise((r) => setTimeout(r, 10));
      events.push(`end-${n}`);
      return n;
    };

    await processInBatches([1, 2, 3, 4], 2, fn);

    // Batch 1 items (1,2) must both end before batch 2 items (3,4) start
    const endBatch1 = Math.max(events.indexOf("end-1"), events.indexOf("end-2"));
    const startBatch2 = Math.min(events.indexOf("start-3"), events.indexOf("start-4"));
    expect(endBatch1).toBeLessThan(startBatch2);
  });

  it("handles batch size larger than items array", async () => {
    const fn = vi.fn(async (n: number) => n * 2);

    const results = await processInBatches([1, 2], 100, fn);

    expect(results).toHaveLength(2);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
  });

  it("handles batch size of 1", async () => {
    const fn = vi.fn(async (n: number) => n);

    const results = await processInBatches([1, 2, 3], 1, fn);

    expect(results).toHaveLength(3);
    expect(fn).toHaveBeenCalledTimes(3);
    expect(results.map((r) => (r as PromiseFulfilledResult<number>).value)).toEqual([1, 2, 3]);
  });
});
