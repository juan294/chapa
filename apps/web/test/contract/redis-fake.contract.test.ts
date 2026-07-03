import { describe, expect, it, beforeEach } from "vitest";
import { redisFake } from "./redis-fake";

describe("contract Redis fake", () => {
  beforeEach(() => {
    redisFake.__reset();
  });

  it("returns acquired then exists for SET NX status", async () => {
    await expect(redisFake.cacheSetNxStatus("once", 60)).resolves.toBe("acquired");
    await expect(redisFake.cacheSetNxStatus("once", 60)).resolves.toBe("exists");
  });

  it("round-trips numbers as numbers", async () => {
    await redisFake.cacheSet("numeric", 1, 60);
    await expect(redisFake.cacheGet("numeric")).resolves.toBe(1);
  });

  it("increments counters and returns numbers", async () => {
    await expect(redisFake.cacheIncr("counter")).resolves.toBe(1);
    await expect(redisFake.cacheIncr("counter", 2)).resolves.toBe(3);
  });

  it("expires values by TTL", async () => {
    await redisFake.cacheSet("short", "value", 1);
    await expect(redisFake.cacheGet("short")).resolves.toBe("value");

    const originalNow = Date.now;
    Date.now = () => originalNow() + 1100;
    try {
      await expect(redisFake.cacheGet("short")).resolves.toBeNull();
    } finally {
      Date.now = originalNow;
    }
  });
});
