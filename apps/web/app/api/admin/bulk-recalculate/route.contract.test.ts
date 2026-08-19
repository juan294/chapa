import { describe, expect, it, vi } from "vitest";
import { bodyAsRecord, invokeJson } from "@/test/contract/invoke";

const {
  mockInvalidateProfileReadModels,
  mockMaterializeOrchestratedProfile,
  mockPersistOrchestratedSnapshot,
} = vi.hoisted(() => ({
  mockInvalidateProfileReadModels: vi.fn(async () => undefined),
  mockMaterializeOrchestratedProfile: vi.fn(async (handle: string) => ({
    craftResult: null,
    // #1076: persistOrchestratedSnapshot now gates on statsComplete via the
    // shared guardStatsComplete() — this fixture represents the happy path
    // (complete stats), not the incomplete-stats case, so it must be true.
    statsComplete: true,
    displayImpact: { adjustedComposite: 70 },
    rawImpact: { adjustedComposite: 72 },
    snapshot: { date: "2026-07-03", adjustedComposite: 70, tier: "Solid" },
    stats: { handle },
  })),
  mockPersistOrchestratedSnapshot: vi.fn(async () => true),
}));

vi.mock("@/lib/profile/orchestrated-profile", () => ({
  materializeOrchestratedProfile: mockMaterializeOrchestratedProfile,
  persistOrchestratedSnapshot: mockPersistOrchestratedSnapshot,
}));

vi.mock("@/lib/profile/post-write-invalidation", () => ({
  invalidateProfileReadModels: mockInvalidateProfileReadModels,
}));

vi.mock("@/lib/db/users", () => ({
  dbGetUserHandlePage: vi.fn(async () => ({
    handles: ["octocat"],
    total: 1,
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { POST } from "./route";

describe("POST /api/admin/bulk-recalculate contract", () => {
  it("recalculates requested handles with the admin bearer token", async () => {
    const response = await invokeJson(POST, {
      method: "POST",
      path: "/api/admin/bulk-recalculate",
      headers: { Authorization: `Bearer ${process.env.ADMIN_SECRET}` },
      body: { handles: ["octocat", "-bad"] },
    });

    expect(response.status).toBe(200);
    expect(bodyAsRecord(response)).toMatchObject({
      partial: false,
      recalculated: 1,
      failed: 0,
      total: 1,
    });
    expect(mockMaterializeOrchestratedProfile).toHaveBeenCalledWith("octocat", {
      token: undefined,
      ignoreSnapshot: true,
    });
    expect(mockPersistOrchestratedSnapshot).toHaveBeenCalledWith(
      "octocat",
      expect.any(Object),
      { mode: "replace" },
    );
  });

  it("records persistence failures without claiming recalculation success", async () => {
    mockPersistOrchestratedSnapshot.mockResolvedValueOnce(false);

    const response = await invokeJson(POST, {
      method: "POST",
      path: "/api/admin/bulk-recalculate",
      headers: { Authorization: `Bearer ${process.env.ADMIN_SECRET}` },
      body: { handles: ["octocat"] },
    });

    expect(response.status).toBe(200);
    expect(bodyAsRecord(response)).toMatchObject({
      recalculated: 0,
      failed: 1,
      total: 1,
    });
  });
});
