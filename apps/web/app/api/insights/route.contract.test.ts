import { afterAll, describe, expect, it, vi } from "vitest";
import {
  bodyAsRecord,
  cleanupUser,
  getServiceClient,
  invokeJson,
  makeCliBearer,
  seedUser,
} from "@/test/contract/invoke";

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: (cb: () => void | Promise<void>) => {
      void cb();
    },
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache:
    <Args extends unknown[], Result>(fn: (...args: Args) => Result) =>
    (...args: Args) =>
      fn(...args),
}));

import { POST } from "./route";

describe("POST /api/insights v7 durable report contract", () => {
  const owner = "contract-insights-v7";
  afterAll(async () => {
    await getServiceClient().rpc("scoring_v7_withdraw", { p_owner: owner });
    await cleanupUser(owner);
  });
  it("persists the authenticated owner's descriptive import without rubric or core records", async () => {
    await seedUser(owner);
    const body = { schemaVersion: "v7", tool: "claude-code", reportPeriod: { start: "2026-02-20", end: "2026-03-07" }, totalSessions: 1,
      outcomes: { fully_achieved: 1 }, satisfaction: null, toolUsage: null, sessionTypes: null, friction: null, toolErrors: null, totalToolCalls: null,
      responseTime: { medianSeconds: null, averageSeconds: null }, volume: null, multiClauding: null };
    const response = await invokeJson(POST, { method: "POST", path: "/api/insights", bearer: makeCliBearer(owner), body });
    expect(response.status).toBe(200);
    const output = bodyAsRecord(response);
    expect(output).toMatchObject({ schemaVersion: "v7", success: true, persisted: true });
    expect(output).not.toHaveProperty("craftScore");
    const stored = await getServiceClient().from("scoring_v7_evidence").select("owner_handle,channel,category").eq("id", output.uploadId);
    expect(stored.data).toEqual([{ owner_handle: owner, channel: "craft", category: "craft" }]);
    expect((await getServiceClient().from("scoring_v7_raw_artifacts").select("id").eq("owner_handle", owner)).data).toHaveLength(1);
    const forged = await invokeJson(POST, { method: "POST", path: "/api/insights", bearer: makeCliBearer(owner), body: { ...body, ownerId: "stranger", episodes: [{ assessments: [{ status: "accepted" }] }] } });
    expect(forged.status).toBe(400);
    expect((await getServiceClient().from("scoring_v7_assessments").select("id").eq("owner_handle", owner)).data).toEqual([]);
  });
});

describe("POST /api/insights — retired v6 upload shape", () => {
  const owner = "contract-insights-v6-retired";
  afterAll(async () => {
    await cleanupUser(owner);
  });

  it("rejects the legacy InsightsUpload shape as invalid input, never persisting to tool_insights", async () => {
    await seedUser(owner);
    const legacyUpload = {
      tool: "claude-code",
      reportPeriod: { start: "2026-02-20", end: "2026-03-07" },
      volume: { messages: 549, linesAdded: 16843, linesDeleted: 1230, files: 290, days: 9, msgsPerDay: 61 },
      totalSessions: 66,
      totalToolCalls: 2521,
    };
    const response = await invokeJson(POST, {
      method: "POST",
      path: "/api/insights",
      bearer: makeCliBearer(owner),
      body: legacyUpload,
    });

    expect(response.status).toBe(400);
    expect(bodyAsRecord(response).error).toBe("Invalid insights data");

    const stored = await getServiceClient()
      .from("tool_insights")
      .select("handle")
      .eq("handle", owner)
      .maybeSingle();
    expect(stored.data).toBeNull();
  });
});
