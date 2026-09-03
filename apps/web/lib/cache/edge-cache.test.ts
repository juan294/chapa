import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@vercel/functions", () => ({
  dangerouslyDeleteByTag: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  getVercelEnv: vi.fn(),
}));

vi.mock("@/lib/analytics/server-errors", () => ({
  captureServerEvent: vi.fn(),
}));

import { dangerouslyDeleteByTag } from "@vercel/functions";
import { getVercelEnv } from "@/lib/env";
import { captureServerEvent } from "@/lib/analytics/server-errors";
import {
  badgeEdgeCacheTag,
  ogImageEdgeCacheTag,
  purgeEdgeCacheTag,
  EDGE_PURGE_DEADLINE_MS,
} from "./edge-cache";

const deleteByTag = vi.mocked(dangerouslyDeleteByTag);
const vercelEnv = vi.mocked(getVercelEnv);
const serverEvent = vi.mocked(captureServerEvent);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("badgeEdgeCacheTag", () => {
  it("lowercases the handle the same way buildBadgeSvgCacheKey does", () => {
    expect(badgeEdgeCacheTag("MixedCase")).toBe("badge-mixedcase");
    expect(badgeEdgeCacheTag("octocat")).toBe("badge-octocat");
  });
});

describe("ogImageEdgeCacheTag", () => {
  it("lowercases the handle so every URL casing shares one purge tag", () => {
    expect(ogImageEdgeCacheTag("MixedCase")).toBe("og-mixedcase");
    expect(ogImageEdgeCacheTag("octocat")).toBe("og-octocat");
  });
});

describe("purgeEdgeCacheTag", () => {
  it("returns 'skipped' and never calls the SDK when there is no Vercel env", async () => {
    vercelEnv.mockReturnValue(undefined);

    const outcome = await purgeEdgeCacheTag("badge-octocat");

    expect(outcome).toBe("skipped");
    expect(deleteByTag).not.toHaveBeenCalled();
  });

  it("returns 'purged' and calls the SDK with the exact tag on success", async () => {
    vercelEnv.mockReturnValue("production");
    deleteByTag.mockResolvedValue(undefined);

    const outcome = await purgeEdgeCacheTag("badge-octocat");

    expect(outcome).toBe("purged");
    expect(deleteByTag).toHaveBeenCalledWith("badge-octocat");
  });

  it("returns 'failed' and captures an event when the SDK rejects, without throwing", async () => {
    vercelEnv.mockReturnValue("production");
    deleteByTag.mockRejectedValue(new Error("boom"));

    const outcome = await purgeEdgeCacheTag("badge-octocat");

    expect(outcome).toBe("failed");
    expect(serverEvent).toHaveBeenCalledWith(
      "badge_edge_purge_failed",
      expect.objectContaining({ tag: "badge-octocat", message: "boom" }),
    );
  });

  describe("deadline", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns 'failed' after the deadline when the SDK never resolves", async () => {
      vercelEnv.mockReturnValue("production");
      deleteByTag.mockReturnValue(new Promise(() => {}));

      const outcomePromise = purgeEdgeCacheTag("badge-octocat");
      await vi.advanceTimersByTimeAsync(EDGE_PURGE_DEADLINE_MS);

      expect(await outcomePromise).toBe("failed");
      expect(serverEvent).toHaveBeenCalledWith(
        "badge_edge_purge_failed",
        expect.objectContaining({ tag: "badge-octocat" }),
      );
    });
  });
});
