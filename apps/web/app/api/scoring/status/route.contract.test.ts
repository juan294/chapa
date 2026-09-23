import { describe, expect, it, vi } from "vitest";
import { declareField, generatePayloads, runMatrix } from "@/test/contract/payload-matrix";
import { bodyAsRecord, invokeJson } from "@/test/contract/invoke";

const { mockRequireSession, mockReadScoringStatus, mockEnqueueCollection } = vi.hoisted(() => ({
  mockRequireSession: vi.fn(() => ({
    session: { login: "octocat", name: "Octocat", avatar_url: "" },
    error: null,
  })),
  mockReadScoringStatus: vi.fn(async () => ({ kind: "collecting", percent: 10, sources: [], hasPriorReceipt: false })),
  mockEnqueueCollection: vi.fn(async () => []),
}));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: mockRequireSession,
}));

vi.mock("@/lib/collection/read-scoring-status", () => ({
  readScoringStatus: mockReadScoringStatus,
}));

vi.mock("@/lib/collection/enqueue", () => ({
  enqueueCollection: mockEnqueueCollection,
  scheduleCollectionAdvance: vi.fn(),
}));

import { GET, POST } from "./route";

describe("GET /api/scoring/status contract", () => {
  it("returns the authenticated owner's scoring status", async () => {
    const response = await invokeJson(GET, { method: "GET", path: "/api/scoring/status" });
    expect(response.status).toBe(200);
    expect(bodyAsRecord(response).scoringStatus).toEqual({ kind: "collecting", percent: 10, sources: [], hasPriorReceipt: false });
  });
});

describe("POST /api/scoring/status contract", () => {
  it("runs every payload variant with zero 5xx", async () => {
    const payloads = generatePayloads({
      fields: [
        declareField("action", { candidates: ["retry", "consent", 1, {}], includeAbsent: true, includeNull: true, typical: "retry" }),
        declareField("provider", { candidates: ["github", "bitbucket", "gitlab", "codeberg", "notaprovider", 1], includeAbsent: true, includeNull: true, typical: "bitbucket" }),
      ],
      seed: 0x53,
      randomCount: 16,
    });

    // 400 is a legitimate, validated outcome here (an unsupported action or
    // an invalid/missing provider) -- the matrix asserts no 5xx and no
    // *unexpected* 4xx, not universal success.
    await runMatrix(
      payloads,
      (payload) => invokeJson(POST, { method: "POST", path: "/api/scoring/status", body: payload }),
      { allowedStatuses: [400] },
    );
  });

  it("enqueues a retry job and returns the resulting scoring status", async () => {
    const response = await invokeJson(POST, {
      method: "POST",
      path: "/api/scoring/status",
      body: { action: "retry", provider: "bitbucket" },
    });
    expect(response.status).toBe(200);
    expect(mockEnqueueCollection).toHaveBeenCalledWith("octocat", "retry", "bitbucket");
    expect(bodyAsRecord(response).scoringStatus).toEqual({ kind: "collecting", percent: 10, sources: [], hasPriorReceipt: false });
  });
});
