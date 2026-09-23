import { describe, expect, it, vi } from "vitest";
import { bodyAsRecord, invokeJson } from "@/test/contract/invoke";

const {
  mockCaptureServerError,
  mockGetSessionGitHubToken,
  mockInvalidateProfileReadModels,
  mockMaterializeOrchestratedProfile,
  mockEnqueueAndReportScoringStatus,
  mockRequireSession,
} = vi.hoisted(() => ({
  mockCaptureServerError: vi.fn(),
  mockGetSessionGitHubToken: vi.fn(async () => "oauth-contract-token"),
  mockInvalidateProfileReadModels: vi.fn(async () => undefined),
  mockMaterializeOrchestratedProfile: vi.fn(async () => ({
    craftResult: null,
    // #1076: the route gates on statsComplete before enqueueing — this
    // fixture represents the happy path (complete stats), not the
    // incomplete-stats case, so it must be true.
    statsComplete: true,
    stats: { handle: "octocat", commitsTotal: 12 },
  })),
  mockEnqueueAndReportScoringStatus: vi.fn(async (): Promise<{ kind: string; receiptDate: string; updating: boolean } | null> => ({ kind: "ready", receiptDate: "2026-07-03", updating: false })),
  mockRequireSession: vi.fn(() => ({
    session: { login: "octocat", name: "Octocat", avatar_url: "" },
    error: null,
  })),
}));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: mockRequireSession,
}));

vi.mock("@/lib/auth/github-session-token", () => ({
  getSessionGitHubToken: mockGetSessionGitHubToken,
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

vi.mock("@/lib/analytics/server-errors", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/analytics/server-errors")>();
  return {
    ...actual,
    captureServerError: mockCaptureServerError,
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { POST } from "./route";

describe("POST /api/refresh contract", () => {
  it("rejects missing, invalid, and mismatched handles without 5xx", async () => {
    for (const [path, expected] of [
      ["/api/refresh", 400],
      ["/api/refresh?handle=-bad", 400],
      ["/api/refresh?handle=someone-else", 403],
    ] as const) {
      const response = await invokeJson(POST, {
        method: "POST",
        path,
        body: {},
      });
      expect(response.status).toBe(expected);
    }
  });

  it("returns the resulting scoring status after enqueueing collection", async () => {
    const response = await invokeJson(POST, {
      method: "POST",
      path: "/api/refresh?handle=octocat",
      body: {},
    });

    expect(response.status).toBe(200);
    expect(bodyAsRecord(response).success).toBe(true);
    expect(mockMaterializeOrchestratedProfile).toHaveBeenCalledWith("octocat", {
      token: "oauth-contract-token",
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
      path: "/api/refresh?handle=octocat",
      body: {},
    });

    expect(response.status).toBe(503);
  });
});
