import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { StatsData, SupplementalStats } from "@chapa/shared";
import { declareField, generatePayloads, runMatrix } from "@/test/contract/payload-matrix";
import {
  cleanupUser,
  getServiceClient,
  invokeJson,
  makeCliBearer,
  seedUser,
} from "@/test/contract/invoke";

import { POST } from "./route";

const HANDLE = "contract-supplemental";
const SOURCE_HANDLE = "contract-supplemental_emu";

function validStats(): StatsData {
  return {
    handle: SOURCE_HANDLE,
    commitsTotal: 42,
    activeDays: 12,
    prsMergedCount: 7,
    prsMergedWeight: 7,
    reviewsSubmittedCount: 4,
    issuesClosedCount: 3,
    linesAdded: 1200,
    linesDeleted: 200,
    reposContributed: 5,
    topRepoShare: 0.4,
    maxCommitsIn10Min: 2,
    microCommitRatio: 0.1,
    docsOnlyPrRatio: 0.2,
    totalStars: 10,
    totalForks: 2,
    totalWatchers: 3,
    heatmapData: [{ date: "2026-07-01", count: 3 }],
    fetchedAt: "2026-07-03T00:00:00.000Z",
  };
}

describe("POST /api/supplemental contract", () => {
  let bearer: string;

  beforeAll(async () => {
    bearer = makeCliBearer(HANDLE);
    await seedUser(HANDLE);
  });

  afterAll(async () => {
    await cleanupUser(HANDLE);
  });

  it("runs the supplemental payload matrix with zero 5xx and persistence re-read", async () => {
    const stats = validStats();
    const fields = [
      declareField("targetHandle", {
        candidates: [HANDLE, "other-user", "-bad"],
        includeAbsent: true,
        includeNull: true,
        typical: HANDLE,
      }),
      declareField("sourceHandle", {
        candidates: [SOURCE_HANDLE, "emu-1", "_bad"],
        includeAbsent: true,
        includeNull: true,
        typical: SOURCE_HANDLE,
      }),
      declareField("stats.handle", {
        candidates: [SOURCE_HANDLE, HANDLE],
        includeAbsent: true,
        includeNull: true,
        typical: SOURCE_HANDLE,
      }),
      declareField("stats.fetchedAt", {
        candidates: [stats.fetchedAt, "not-a-date"],
        includeAbsent: true,
        includeNull: true,
        typical: stats.fetchedAt,
      }),
      declareField("stats.commitsTotal", {
        candidates: [42, 0, 100000, 100001, -1],
        includeAbsent: true,
        includeNull: true,
        typical: 42,
      }),
      declareField("stats.activeDays", {
        candidates: [12, 0, 365, 366],
        includeAbsent: true,
        includeNull: true,
        typical: 12,
      }),
      declareField("stats.prsMergedCount", {
        candidates: [7, 0, 10000, 10001],
        includeAbsent: true,
        includeNull: true,
        typical: 7,
      }),
      declareField("stats.prsMergedWeight", {
        candidates: [7, 0, 10000, 10001],
        includeAbsent: true,
        includeNull: true,
        typical: 7,
      }),
      declareField("stats.reviewsSubmittedCount", {
        candidates: [4, 0, 50000, 50001],
        includeAbsent: true,
        includeNull: true,
        typical: 4,
      }),
      declareField("stats.issuesClosedCount", {
        candidates: [3, 0, 10000, 10001],
        includeAbsent: true,
        includeNull: true,
        typical: 3,
      }),
      declareField("stats.linesAdded", {
        candidates: [1200, 0, 500000, 500001],
        includeAbsent: true,
        includeNull: true,
        typical: 1200,
      }),
      declareField("stats.linesDeleted", {
        candidates: [200, 0, 500000, 500001],
        includeAbsent: true,
        includeNull: true,
        typical: 200,
      }),
      declareField("stats.reposContributed", {
        candidates: [5, 0, 5000, 5001],
        includeAbsent: true,
        includeNull: true,
        typical: 5,
      }),
      declareField("stats.topRepoShare", {
        candidates: [0.4, 0, 1, 1.1],
        includeAbsent: true,
        includeNull: true,
        typical: 0.4,
      }),
      declareField("stats.maxCommitsIn10Min", {
        candidates: [2, 0, 1000, 1001],
        includeAbsent: true,
        includeNull: true,
        typical: 2,
      }),
      declareField("stats.totalStars", {
        candidates: [10, 0, 10000000, 10000001],
        includeAbsent: true,
        includeNull: true,
        typical: 10,
      }),
      declareField("stats.totalForks", {
        candidates: [2, 0, 1000000, 1000001],
        includeAbsent: true,
        includeNull: true,
        typical: 2,
      }),
      declareField("stats.totalWatchers", {
        candidates: [3, 0, 1000000, 1000001],
        includeAbsent: true,
        includeNull: true,
        typical: 3,
      }),
      declareField("stats.microCommitRatio", {
        candidates: [0.1, 0, 1, 1.1],
        includeAbsent: true,
        includeNull: true,
        typical: 0.1,
      }),
      declareField("stats.docsOnlyPrRatio", {
        candidates: [0.2, 0, 1, 1.1],
        includeAbsent: true,
        includeNull: true,
        typical: 0.2,
      }),
      declareField("stats.heatmapData", {
        candidates: [
          stats.heatmapData,
          [],
          [{ date: "2026-07-02", count: 0 }],
          [{ date: "bad", count: 1 }],
        ],
        includeAbsent: true,
        includeNull: true,
        typical: stats.heatmapData,
      }),
    ];

    const payloads = generatePayloads({ fields, seed: 0x5150, randomCount: 120 });

    await runMatrix(
      payloads,
      (payload) =>
        invokeJson(POST, {
          method: "POST",
          path: "/api/supplemental",
          bearer,
          body: payload,
        }),
      {
        allowedStatuses: [400, 401, 403, 413, 429],
        assertPersisted: async (payload) => {
          if (payload.targetHandle !== HANDLE) return;

          const acceptedStats = (payload as { stats?: unknown }).stats as
            | SupplementalStats["stats"]
            | undefined;
          if (!acceptedStats || typeof acceptedStats !== "object") return;

          const db = getServiceClient();
          const { data, error } = await db
            .from("supplemental_stats")
            .select("target_handle, source_handle, stats")
            .eq("target_handle", HANDLE.toLowerCase())
            .maybeSingle();

          expect(error).toBeNull();
          expect(data).not.toBeNull();
          expect(data).toMatchObject({
            target_handle: HANDLE,
            source_handle: payload.sourceHandle,
          });
          expect(data?.stats).toMatchObject({
            handle: acceptedStats.handle,
            commitsTotal: acceptedStats.commitsTotal,
            prsMergedCount: acceptedStats.prsMergedCount,
            heatmapData: acceptedStats.heatmapData,
          });
        },
      },
    );
  });
});
