import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchContributionData } from "./queries";
import { fetchWithRetry } from "@/lib/utils/fetch-retry";
import { getGithubToken } from "@/lib/env";
vi.mock("@/lib/utils/fetch-retry", () => ({ fetchWithRetry: vi.fn() }));
vi.mock("@/lib/env", () => ({ getGithubToken: vi.fn(() => "rotated-server") }));
afterEach(() => vi.clearAllMocks());
describe("legacy captured credential seam", () => {
 it.each([null, "captured-pat"])("does not re-read fallback for resolved credential %s", async token => {
  vi.mocked(fetchWithRetry).mockResolvedValue({ ok: true, json: async () => ({ data: { user: null } }) } as Response);
  await fetchContributionData("alice", undefined, { resolvedCredential: { token }, referenceTime: "2026-09-05T12:00:00.000Z" });
  expect(getGithubToken).not.toHaveBeenCalled();
  const options = vi.mocked(fetchWithRetry).mock.calls[0]![1]!;
  expect(options.headers).toEqual({ "Content-Type": "application/json", Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) });
  expect(JSON.parse(options.body as string).variables.until).toBe("2026-09-05T12:00:00.000Z");
 });
});
