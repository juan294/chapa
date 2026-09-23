import { describe, expect, it, vi } from "vitest";
import { bodyAsRecord, invokeJson } from "@/test/contract/invoke";

const {
  mockInvalidateProfileReadModels,
  mockMaterializeOrchestratedProfile,
  mockEnqueueAndReportScoringStatus,
  mockResolveRequestAuth,
} = vi.hoisted(() => ({
  mockInvalidateProfileReadModels: vi.fn(async () => undefined),
  mockMaterializeOrchestratedProfile: vi.fn(async () => ({
    craftResult: null,
    // #1076: the route gates on statsComplete before enqueueing — this
    // fixture represents the happy path (complete stats), not the
    // incomplete-stats case, so it must be true.
    statsComplete: true,
    stats: { handle: "octocat" },
  })),
  mockEnqueueAndReportScoringStatus: vi.fn(async (): Promise<{ kind: string; receiptDate: string; updating: boolean } | null> => ({ kind: "ready", receiptDate: "2026-07-03", updating: false })),
  mockResolveRequestAuth: vi.fn(async () => ({
    handle: "Octocat",
    token: "contract-token",
  })),
}));

vi.mock("@/lib/auth/resolve-request-auth", () => ({
  resolveRequestAuth: mockResolveRequestAuth,
}));

vi.mock("@/lib/profile/orchestrated-profile", () => ({
  materializeOrchestratedProfile: mockMaterializeOrchestratedProfile,
}));

vi.mock("@/lib/profile/post-write-score", () => ({
  enqueueAndReportScoringStatus: mockEnqueueAndReportScoringStatus,
}));

vi.mock("@/lib/profile/post-write-invalidation", () => ({
  invalidateProfileReadModels: mockInvalidateProfileReadModels,
}));

vi.mock("@/lib/cache/craft-cache", () => ({
  updateCraftCache: vi.fn(async () => undefined),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { POST } from "./route";

describe("POST /api/recalculate contract", () => {
  it("returns the resulting scoring status after enqueueing collection", async () => {
    const response = await invokeJson(POST, {
      method: "POST",
      path: "/api/recalculate",
      body: {},
    });

    expect(response.status).toBe(200);
    expect(bodyAsRecord(response).success).toBe(true);
    expect(mockMaterializeOrchestratedProfile).toHaveBeenCalledWith("octocat", {
      token: "contract-token",
      ignoreSnapshot: true,
      scoringSelection: expect.objectContaining({ enabled: true, machinePolicy: "v7.2" }),
    });
    expect(mockInvalidateProfileReadModels).toHaveBeenCalledWith("octocat", { badgeSvg: true });
    expect(mockEnqueueAndReportScoringStatus).toHaveBeenCalledWith(
      "octocat",
      "refresh",
      expect.any(Object),
    );
  });

  it("fails closed when the scoring status authority read itself fails", async () => {
    mockEnqueueAndReportScoringStatus.mockResolvedValueOnce(null);

    const response = await invokeJson(POST, {
      method: "POST",
      path: "/api/recalculate",
      body: {},
    });

    expect(response.status).toBe(503);
  });
});
