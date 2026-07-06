import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { InsightsUpload } from "@chapa/shared";
import { declareField, generatePayloads, runMatrix } from "@/test/contract/payload-matrix";
import {
  bodyAsRecord,
  cleanupUser,
  getServiceClient,
  invokeJson,
  makeCliBearer,
  seedUser,
} from "@/test/contract/invoke";

const { mockCaptureServerError } = vi.hoisted(() => ({
  mockCaptureServerError: vi.fn(),
}));

vi.mock("@/lib/analytics/server-errors", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/analytics/server-errors")>();
  return {
    ...actual,
    captureServerError: mockCaptureServerError,
  };
});

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

const HANDLE = "contract-insights";
const KILLER_START = "2026-02-30";
const KILLER_END = "2026-03-01";

function validUpload(): InsightsUpload {
  return {
    tool: "claude-code",
    reportPeriod: { start: "2026-02-20", end: "2026-03-07" },
    volume: {
      messages: 549,
      linesAdded: 16843,
      linesDeleted: 1230,
      files: 290,
      days: 9,
      msgsPerDay: 61,
    },
    toolUsage: { Bash: 1213, Read: 572, Edit: 377, Write: 134 },
    sessionTypes: { "Single Task": 16, "Multi Task": 11 },
    outcomes: { fullyAchieved: 24, mostlyAchieved: 6, partiallyAchieved: 2 },
    friction: { buggyCode: 15, wrongApproach: 12, misunderstoodRequest: 4 },
    satisfaction: { dissatisfied: 5, likelySatisfied: 50, satisfied: 19 },
    multiClauding: { overlapEvents: 52, sessionsInvolved: 45, messagePercent: 31 },
    responseTime: { medianSeconds: 80.6, averageSeconds: 188.4 },
    toolErrors: { Other: 87, "Command Failed": 64 },
    totalSessions: 66,
    totalToolCalls: 2521,
  };
}

describe("POST /api/insights contract", () => {
  let bearer: string;

  beforeAll(async () => {
    bearer = makeCliBearer(HANDLE);
    await seedUser(HANDLE);
  });

  afterAll(async () => {
    await cleanupUser(HANDLE);
  });

  it("runs the upload payload matrix with zero 5xx and observable null persistence", async () => {
    const typical = validUpload();
    const fields = [
      declareField("tool", {
        candidates: ["claude-code", "unknown-tool"],
        includeAbsent: true,
        includeNull: true,
        typical: "claude-code",
      }),
      declareField("reportPeriod.start", {
        candidates: [typical.reportPeriod.start, KILLER_START, "not-a-date"],
        includeAbsent: true,
        includeNull: true,
        typical: typical.reportPeriod.start,
      }),
      declareField("reportPeriod.end", {
        candidates: [typical.reportPeriod.end, KILLER_END, "2026-01-01"],
        includeAbsent: true,
        includeNull: true,
        typical: typical.reportPeriod.end,
      }),
      declareField("volume.messages", {
        candidates: [typical.volume.messages, 0, -1],
        includeAbsent: true,
        includeNull: true,
        typical: typical.volume.messages,
      }),
      declareField("volume.linesAdded", {
        candidates: [typical.volume.linesAdded, 0, 999999],
        includeAbsent: true,
        includeNull: true,
        typical: typical.volume.linesAdded,
      }),
      declareField("volume.linesDeleted", {
        candidates: [typical.volume.linesDeleted, 0],
        includeAbsent: true,
        includeNull: true,
        typical: typical.volume.linesDeleted,
      }),
      declareField("volume.files", {
        candidates: [typical.volume.files, 0],
        includeAbsent: true,
        includeNull: true,
        typical: typical.volume.files,
      }),
      declareField("volume.days", {
        candidates: [typical.volume.days, 0],
        includeAbsent: true,
        includeNull: true,
        typical: typical.volume.days,
      }),
      declareField("volume.msgsPerDay", {
        candidates: [typical.volume.msgsPerDay, 0],
        includeAbsent: true,
        includeNull: true,
        typical: typical.volume.msgsPerDay,
      }),
      declareField("toolUsage", {
        candidates: [typical.toolUsage, {}, { Bash: -1 }],
        includeAbsent: true,
        includeNull: true,
        typical: typical.toolUsage,
      }),
      declareField("sessionTypes", {
        candidates: [typical.sessionTypes, {}, { "Single Task": -1 }],
        includeAbsent: true,
        includeNull: true,
        typical: typical.sessionTypes,
      }),
      declareField("outcomes.fullyAchieved", {
        candidates: [24, 0, -1],
        includeAbsent: true,
        includeNull: true,
        typical: 24,
      }),
      declareField("outcomes.mostlyAchieved", {
        candidates: [6, 0, -1],
        includeAbsent: true,
        includeNull: true,
        typical: 6,
      }),
      declareField("outcomes.partiallyAchieved", {
        candidates: [2, 0, -1],
        includeAbsent: true,
        includeNull: true,
        typical: 2,
      }),
      declareField("friction.buggyCode", {
        candidates: [15, 0, -1],
        includeAbsent: true,
        includeNull: true,
        typical: 15,
      }),
      declareField("friction.wrongApproach", {
        candidates: [12, 0, -1],
        includeAbsent: true,
        includeNull: true,
        typical: 12,
      }),
      declareField("friction.misunderstoodRequest", {
        candidates: [4, 0, -1],
        includeAbsent: true,
        includeNull: true,
        typical: 4,
      }),
      declareField("satisfaction.dissatisfied", {
        candidates: [5, 0, -1],
        includeAbsent: true,
        includeNull: true,
        typical: 5,
      }),
      declareField("satisfaction.likelySatisfied", {
        candidates: [50, 0, -1],
        includeAbsent: true,
        includeNull: true,
        typical: 50,
      }),
      declareField("satisfaction.satisfied", {
        candidates: [19, 0, -1],
        includeAbsent: true,
        includeNull: true,
        typical: 19,
      }),
      declareField("multiClauding.overlapEvents", {
        candidates: [52, 0, -1],
        includeAbsent: true,
        includeNull: true,
        typical: 52,
      }),
      declareField("multiClauding.sessionsInvolved", {
        candidates: [45, 0, -1],
        includeAbsent: true,
        includeNull: true,
        typical: 45,
      }),
      declareField("multiClauding.messagePercent", {
        candidates: [31, 0, 100, 101],
        includeAbsent: true,
        includeNull: true,
        typical: 31,
      }),
      declareField("responseTime.medianSeconds", {
        candidates: [80.6, 0, -1],
        includeAbsent: true,
        includeNull: true,
        typical: 80.6,
      }),
      declareField("responseTime.averageSeconds", {
        candidates: [188.4, 0, -1],
        includeAbsent: true,
        includeNull: true,
        typical: 188.4,
      }),
      declareField("toolErrors", {
        candidates: [typical.toolErrors, {}, { Other: -1 }],
        includeAbsent: true,
        includeNull: true,
        typical: typical.toolErrors,
      }),
      declareField("totalSessions", {
        candidates: [66, 1, 0],
        includeAbsent: true,
        includeNull: true,
        typical: 66,
      }),
      declareField("totalToolCalls", {
        candidates: [2521, 0, -1],
        includeAbsent: true,
        includeNull: true,
        typical: 2521,
      }),
    ];

    const payloads = generatePayloads({ fields, seed: 0xc0ffee, randomCount: 120 });
    payloads.push(typical as unknown as Record<string, unknown>);
    payloads.push({
      ...typical,
      reportPeriod: { start: KILLER_START, end: KILLER_END },
    });
    expect(
      payloads.some(
        (payload) =>
          (payload.reportPeriod as { start?: unknown; end?: unknown } | undefined)?.start ===
            KILLER_START &&
          (payload.reportPeriod as { start?: unknown; end?: unknown } | undefined)?.end ===
            KILLER_END,
      ),
    ).toBe(true);

    await runMatrix(
      payloads,
      (payload) =>
        invokeJson(POST, {
          method: "POST",
          path: "/api/insights",
          bearer,
          body: payload,
        }),
      {
        allowedStatuses: [400, 401, 403, 413, 429],
        assertObservable: async (payload, response) => {
          const reportPeriod = payload.reportPeriod as
            | { start?: unknown; end?: unknown }
            | undefined;
          const isKiller =
            reportPeriod?.start === KILLER_START && reportPeriod?.end === KILLER_END;
          if (!isKiller) return;

          const body = bodyAsRecord(response);
          expect(body.persisted).toBe(false);
          expect(mockCaptureServerError).toHaveBeenCalledWith(
            expect.objectContaining({
              route: "/api/insights",
              statusCode: 200,
            }),
          );
        },
      },
    );

    const db = getServiceClient();
    const { data, error } = await db
      .from("tool_insights")
      .select("handle, tool")
      .eq("handle", HANDLE)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data).toMatchObject({ handle: HANDLE, tool: "claude-code" });
  });
});
