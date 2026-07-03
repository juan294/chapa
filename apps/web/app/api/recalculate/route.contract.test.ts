import { describe, expect, it, vi } from "vitest";
import { bodyAsRecord, invokeJson } from "@/test/contract/invoke";

const {
  mockInvalidateProfileReadModels,
  mockMaterializeOrchestratedProfile,
  mockPersistOrchestratedSnapshot,
  mockResolveRequestAuth,
} = vi.hoisted(() => ({
  mockInvalidateProfileReadModels: vi.fn(async () => undefined),
  mockMaterializeOrchestratedProfile: vi.fn(async () => ({
    craftResult: null,
    displayImpact: {
      adjustedComposite: 72,
      compositeScore: 75,
      dimensions: { delivery: 80, quality: 70, consistency: 75, breadth: 65 },
      archetype: "Builder",
      tier: "High",
      profileType: "collaborative",
    },
    rawImpact: {
      adjustedComposite: 74,
      compositeScore: 75,
    },
    snapshot: { date: "2026-07-03", adjustedComposite: 72, tier: "High" },
    stats: { handle: "octocat" },
  })),
  mockPersistOrchestratedSnapshot: vi.fn(async () => true),
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
  persistOrchestratedSnapshot: mockPersistOrchestratedSnapshot,
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
  it("returns a recalculated profile only after durable snapshot persistence", async () => {
    const response = await invokeJson(POST, {
      method: "POST",
      path: "/api/recalculate",
      body: {},
    });

    expect(response.status).toBe(200);
    expect(bodyAsRecord(response).success).toBe(true);
    expect(mockMaterializeOrchestratedProfile).toHaveBeenCalledWith("octocat", {
      token: "contract-token",
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

  it("fails closed when the recalculated snapshot cannot be persisted", async () => {
    mockPersistOrchestratedSnapshot.mockResolvedValueOnce(false);

    const response = await invokeJson(POST, {
      method: "POST",
      path: "/api/recalculate",
      body: {},
    });

    expect(response.status).toBe(500);
    expect(bodyAsRecord(response).error).toMatch(/save recalculated profile/i);
  });
});
