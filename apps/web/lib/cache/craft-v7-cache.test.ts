import { describe, expect, it, vi } from "vitest";
import { createScoringWindow } from "@chapa/shared";
const mocks = vi.hoisted(() => ({ read: vi.fn(), get: vi.fn(), set: vi.fn() }));
vi.mock("@/lib/db/craft-v7", () => ({ dbReadCraftV7: mocks.read }));
vi.mock("./redis", () => ({ cacheGet: mocks.get, cacheSet: mocks.set }));
import { getFreshCraftV7 } from "./craft-v7-cache";
const window = createScoringWindow("2026-09-05T12:00:00Z");
it("reauthorizes and reads current revisions without a redundant Redis round trip; private data never leaves projection", async () => {
  mocks.get.mockResolvedValue(null);
  mocks.read.mockResolvedValue({ inputs: { policyVersion: "v7", window, eligibleEpisodes: 0 }, result: { status: "not_observed" }, trace: {}, reports: [{ private: "report" }], undatedClaimCount: 0 });
  const result = await getFreshCraftV7("owner", "reviewer", window);
  expect(result).not.toHaveProperty("reports");
  expect(mocks.get).not.toHaveBeenCalled();
  expect(mocks.set).not.toHaveBeenCalled();
  expect(JSON.stringify(mocks.set.mock.calls)).not.toContain("private");
  mocks.read.mockRejectedValue(new Error("Access revoked"));
  await expect(getFreshCraftV7("owner", "reviewer", window)).rejects.toThrow("Access revoked");
});
describe("failure isolation", () => {
  it("Redis failure still returns the newly authorized durable result", async () => {
    mocks.read.mockResolvedValue({ inputs: {}, result: { status: "not_observed" }, trace: {}, reports: [] });
    mocks.get.mockRejectedValue(new Error("Redis unavailable"));
    expect(await getFreshCraftV7("owner", "owner", window)).toMatchObject({ result: { status: "not_observed" } });
  });
});
