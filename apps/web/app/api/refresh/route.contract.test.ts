import { describe, expect, it, vi } from "vitest";
import { bodyAsRecord, invokeJson } from "@/test/contract/invoke";

const {
  mockCaptureServerError,
  mockGetSessionGitHubToken,
  mockInvalidateProfileReadModels,
  mockMaterializeOrchestratedProfile,
  mockPersistOrchestratedSnapshot,
  mockRequireSession,
} = vi.hoisted(() => ({
  mockCaptureServerError: vi.fn(),
  mockGetSessionGitHubToken: vi.fn(async () => "oauth-contract-token"),
  mockInvalidateProfileReadModels: vi.fn(async () => undefined),
  mockMaterializeOrchestratedProfile: vi.fn(async () => ({
    craftResult: null,
    // #1076: persistOrchestratedSnapshot now gates on statsComplete via the
    // shared guardStatsComplete() — this fixture represents the happy path
    // (complete stats), not the incomplete-stats case, so it must be true.
    statsComplete: true,
    displayImpact: {
      adjustedComposite: 70,
      compositeScore: 72,
      dimensions: { delivery: 75, quality: 65, consistency: 70, breadth: 60 },
      archetype: "Builder",
      tier: "Solid",
      profileType: "collaborative",
    },
    rawImpact: { adjustedComposite: 73, compositeScore: 72 },
    snapshot: { date: "2026-07-03", adjustedComposite: 70, tier: "Solid" },
    stats: { handle: "octocat", commitsTotal: 12 },
  })),
  mockPersistOrchestratedSnapshot: vi.fn(async () => true),
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
  persistOrchestratedSnapshot: mockPersistOrchestratedSnapshot,
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

  it("returns refreshed stats and impact only after durable snapshot persistence", async () => {
    const response = await invokeJson(POST, {
      method: "POST",
      path: "/api/refresh?handle=octocat",
      body: {},
    });

    expect(response.status).toBe(200);
    expect(bodyAsRecord(response).stats).toMatchObject({ handle: "octocat" });
    expect(mockMaterializeOrchestratedProfile).toHaveBeenCalledWith("octocat", {
      token: "oauth-contract-token",
    });
    expect(mockPersistOrchestratedSnapshot).toHaveBeenCalledWith(
      "octocat",
      expect.any(Object),
      { mode: "replace" },
    );
    expect(mockInvalidateProfileReadModels).toHaveBeenCalledWith("octocat", {
      badgeSvg: true,
      snapshot: true,
      history: true,
    });
  });

  it("fails closed and captures when the refreshed snapshot cannot be persisted", async () => {
    mockPersistOrchestratedSnapshot.mockResolvedValueOnce(false);

    const response = await invokeJson(POST, {
      method: "POST",
      path: "/api/refresh?handle=octocat",
      body: {},
    });

    expect(response.status).toBe(500);
    expect(bodyAsRecord(response).error).toMatch(/save refreshed profile/i);
    expect(mockCaptureServerError).toHaveBeenCalledWith(
      expect.objectContaining({ route: "/api/refresh", statusCode: 500 }),
    );
  });
});
