import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ scan: vi.fn(), del: vi.fn() }));
vi.mock("@upstash/redis", () => ({ Redis: class { scan = mocks.scan; del = mocks.del; } }));
vi.mock("@/lib/env", () => ({ getUpstashRedisRestUrl: () => "https://example.test", getUpstashRedisRestToken: () => "test" }));
import { purgeRetiredSupplementalV7CacheBatch } from "./redis";
beforeEach(() => { vi.resetAllMocks(); mocks.del.mockResolvedValue(1); });
it("deletes only validated retired keys and retains the cursor after a foreign result", async () => {
  mocks.scan.mockResolvedValue(["42", ["supplemental:v7:ann", "supplemental:ann", "snapshot:v7:receipt:other"]]);
  expect(await purgeRetiredSupplementalV7CacheBatch("0")).toEqual({ attempted: 3, deleted: 1, failed: 2, nextCursor: "0" });
  expect(mocks.del).toHaveBeenCalledExactlyOnceWith("supplemental:v7:ann");
  expect(mocks.scan).toHaveBeenCalledWith("0", { match: "supplemental:v7:*", count: 100 });
});
it("retries failed deletions and rejects oversized scan batches", async () => {
  mocks.scan.mockResolvedValue(["99", ["supplemental:v7:ann"]]); mocks.del.mockRejectedValue(new Error("private key"));
  expect(await purgeRetiredSupplementalV7CacheBatch("42")).toMatchObject({ failed: 1, nextCursor: "42" });
  mocks.scan.mockResolvedValue(["99", Array(1001).fill("supplemental:v7:ann")]);
  await expect(purgeRetiredSupplementalV7CacheBatch("42")).rejects.toThrow("Retired supplemental cache sweep unavailable");
});
