import { beforeEach, describe, expect, it, vi } from "vitest";
import { declareField, generatePayloads, runMatrix } from "@/test/contract/payload-matrix";
import { bodyAsRecord, invokeJson } from "@/test/contract/invoke";

const { mockCaptureServerEvent, mockDbInsertTelemetry } = vi.hoisted(() => ({
  mockCaptureServerEvent: vi.fn(),
  mockDbInsertTelemetry: vi.fn(async () => true),
}));

vi.mock("@/lib/analytics/server-errors", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/analytics/server-errors")>();
  return {
    ...actual,
    captureServerEvent: mockCaptureServerEvent,
  };
});

vi.mock("@/lib/db/telemetry", () => ({
  dbInsertTelemetry: mockDbInsertTelemetry,
}));

import { POST } from "./route";

describe("POST /api/telemetry contract", () => {
  beforeEach(() => {
    mockCaptureServerEvent.mockClear();
    mockDbInsertTelemetry.mockClear();
  });

  it("runs the telemetry payload matrix with zero 5xx", async () => {
    const fields = [
      declareField("operationId", {
        candidates: ["1feae8e3-6bc0-47da-84aa-0e24e2510454", "not-a-uuid"],
        includeAbsent: true,
        includeNull: true,
        typical: "1feae8e3-6bc0-47da-84aa-0e24e2510454",
      }),
      declareField("targetHandle", {
        candidates: ["octocat", "-bad"],
        includeAbsent: true,
        includeNull: true,
        typical: "octocat",
      }),
      declareField("sourceHandle", {
        candidates: ["octocat_emu", "_bad"],
        includeAbsent: true,
        includeNull: true,
        typical: "octocat_emu",
      }),
      declareField("success", {
        candidates: [true, false, "true"],
        includeAbsent: true,
        includeNull: true,
        typical: true,
      }),
      declareField("errorCategory", {
        candidates: ["network", "not-valid"],
        includeAbsent: true,
        includeNull: true,
        typical: "network",
      }),
      declareField("stats.commitsTotal", {
        candidates: [12, 0, -1],
        includeAbsent: true,
        includeNull: true,
        typical: 12,
      }),
      declareField("stats.reposContributed", {
        candidates: [3, 0, -1],
        includeAbsent: true,
        includeNull: true,
        typical: 3,
      }),
      declareField("stats.prsMergedCount", {
        candidates: [4, 0, -1],
        includeAbsent: true,
        includeNull: true,
        typical: 4,
      }),
      declareField("stats.activeDays", {
        candidates: [5, 0, -1],
        includeAbsent: true,
        includeNull: true,
        typical: 5,
      }),
      declareField("stats.reviewsSubmittedCount", {
        candidates: [6, 0, -1],
        includeAbsent: true,
        includeNull: true,
        typical: 6,
      }),
      declareField("timing.fetchMs", {
        candidates: [10, 0, -1],
        includeAbsent: true,
        includeNull: true,
        typical: 10,
      }),
      declareField("timing.uploadMs", {
        candidates: [20, 0, -1],
        includeAbsent: true,
        includeNull: true,
        typical: 20,
      }),
      declareField("timing.totalMs", {
        candidates: [30, 0, -1],
        includeAbsent: true,
        includeNull: true,
        typical: 30,
      }),
      declareField("cliVersion", {
        candidates: ["1.2.3", "", "x".repeat(21)],
        includeAbsent: true,
        includeNull: true,
        typical: "1.2.3",
      }),
    ];

    const payloads = generatePayloads({ fields, seed: 0x711, randomCount: 80 });

    await runMatrix(
      payloads,
      (payload) =>
        invokeJson(POST, {
          method: "POST",
          path: "/api/telemetry",
          body: payload,
        }),
      { allowedStatuses: [400] },
    );
  });

  it("accepts client error telemetry without DB persistence", async () => {
    const response = await invokeJson(POST, {
      method: "POST",
      path: "/api/telemetry",
      body: {
        event: "client_error",
        category: "render",
        message: "Client render failed",
        path: "/u/octocat",
      },
    });

    expect(response.status).toBe(200);
    expect(bodyAsRecord(response).ok).toBe(true);
    expect(mockCaptureServerEvent).toHaveBeenCalledWith(
      "client_error",
      expect.objectContaining({ category: "render", source: undefined }),
    );
    expect(mockDbInsertTelemetry).not.toHaveBeenCalled();
  });
});
