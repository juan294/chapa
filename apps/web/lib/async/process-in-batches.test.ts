import { describe, it, expect, vi } from "vitest";
import { processInBatches } from "./process-in-batches";

describe("processInBatches", () => {
  it("processes all items and returns succeeded values in order", async () => {
    const items = [1, 2, 3, 4];
    const fn = vi.fn(async (n: number) => n * 10);

    const { succeeded, failed } = await processInBatches(items, 2, fn);

    expect(succeeded).toHaveLength(4);
    expect(succeeded).toEqual([10, 20, 30, 40]);
    expect(failed).toHaveLength(0);
  });

  it("handles empty input array", async () => {
    const fn = vi.fn(async () => "nope");

    const { succeeded, failed } = await processInBatches([], 3, fn);

    expect(succeeded).toEqual([]);
    expect(failed).toEqual([]);
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

    const { succeeded, failed } = await processInBatches([1, 2, 3], 3, fn);

    expect(succeeded).toEqual([1, 3]);
    expect(failed).toHaveLength(1);
    expect(failed[0]!.item).toBe(2);
    expect(failed[0]!.error).toBeInstanceOf(Error);
    expect(failed[0]!.error.message).toBe("fail");
  });

  it("collects all failures with their original items", async () => {
    const fn = async (n: number) => {
      if (n % 2 === 0) throw new Error(`err-${n}`);
      return `ok-${n}`;
    };

    const { succeeded, failed } = await processInBatches([1, 2, 3, 4], 4, fn);

    expect(succeeded).toEqual(["ok-1", "ok-3"]);
    expect(failed).toHaveLength(2);
    expect(failed[0]!.item).toBe(2);
    expect(failed[0]!.error.message).toBe("err-2");
    expect(failed[1]!.item).toBe(4);
    expect(failed[1]!.error.message).toBe("err-4");
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

    const { succeeded, failed } = await processInBatches([1, 2], 100, fn);

    expect(succeeded).toHaveLength(2);
    expect(failed).toHaveLength(0);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(succeeded).toEqual([2, 4]);
  });

  it("handles batch size of 1", async () => {
    const fn = vi.fn(async (n: number) => n);

    const { succeeded, failed } = await processInBatches([1, 2, 3], 1, fn);

    expect(succeeded).toHaveLength(3);
    expect(failed).toHaveLength(0);
    expect(fn).toHaveBeenCalledTimes(3);
    expect(succeeded).toEqual([1, 2, 3]);
  });

  it("wraps non-Error rejection reasons in an Error object", async () => {
    const fn = async (n: number) => {
      if (n === 1) throw "string rejection";
      return n;
    };

    const { failed } = await processInBatches([1, 2], 2, fn);

    expect(failed).toHaveLength(1);
    expect(failed[0]!.error).toBeInstanceOf(Error);
    expect(failed[0]!.error.message).toBe("string rejection");
  });

  it("returns items in insertion order across multiple batches", async () => {
    // 6 items in batches of 2 — verifies order is preserved across batches
    const fn = async (n: number) => n * 10;

    const { succeeded, failed } = await processInBatches([1, 2, 3, 4, 5, 6], 2, fn);

    expect(succeeded).toEqual([10, 20, 30, 40, 50, 60]);
    expect(failed).toHaveLength(0);
  });

  it("correctly separates succeeded and failed items when failures span multiple batches", async () => {
    // batch 1: [1, 2] — 2 fails; batch 2: [3, 4] — 4 fails
    const fn = async (n: number) => {
      if (n % 2 === 0) throw new Error(`fail-${n}`);
      return n;
    };

    const { succeeded, failed } = await processInBatches([1, 2, 3, 4], 2, fn);

    expect(succeeded).toEqual([1, 3]);
    expect(failed).toHaveLength(2);
    expect(failed.map((f) => f.item)).toEqual([2, 4]);
  });
});
