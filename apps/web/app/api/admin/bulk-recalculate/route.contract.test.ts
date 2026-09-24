import { describe, expect, it, vi } from "vitest";
import { bodyAsRecord, invokeJson } from "@/test/contract/invoke";

const {
  mockInvalidateProfileReadModels,
  mockMaterializeOrchestratedProfile,
} = vi.hoisted(() => ({
  mockInvalidateProfileReadModels: vi.fn(async () => undefined),
  mockMaterializeOrchestratedProfile: vi.fn(async (handle: string) => ({
    craftResult: null,
    // #1335 phase 5 — there is no snapshot-replace step left; a materialize
    // with complete stats always counts as recalculated. This fixture
    // represents the happy path (complete stats), not the incomplete-stats
    // case tested below.
    statsComplete: true,
    stats: { handle },
  })),
}));

vi.mock("@/lib/profile/orchestrated-profile", () => ({
  materializeOrchestratedProfile: mockMaterializeOrchestratedProfile,
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
      ignoreSnapshot: true,
    });
  });

  it("records incomplete-stats skips without claiming recalculation success", async () => {
    mockMaterializeOrchestratedProfile.mockResolvedValueOnce({
      craftResult: null,
      statsComplete: false,
      stats: { handle: "octocat" },
    });

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
