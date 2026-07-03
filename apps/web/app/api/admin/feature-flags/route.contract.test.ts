import { describe, expect, it, vi } from "vitest";
import { bodyAsRecord, invokeJson } from "@/test/contract/invoke";

const { mockAdminAuth, mockDbUpdateFeatureFlag, mockInvalidateFeatureFlagCache } =
  vi.hoisted(() => ({
    mockAdminAuth: vi.fn(async () => null),
    mockDbUpdateFeatureFlag: vi.fn(async () => true),
    mockInvalidateFeatureFlagCache: vi.fn(),
  }));

vi.mock("@/lib/auth/admin-route", () => ({
  adminAuth: mockAdminAuth,
}));

vi.mock("@/lib/db/feature-flags", () => ({
  dbUpdateFeatureFlag: mockDbUpdateFeatureFlag,
}));

vi.mock("@/lib/feature-flags", () => ({
  invalidateFeatureFlagCache: mockInvalidateFeatureFlagCache,
}));

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

import { PATCH } from "./route";

describe("PATCH /api/admin/feature-flags contract", () => {
  it("updates a feature flag and invalidates same-instance cache", async () => {
    const response = await invokeJson(PATCH, {
      method: "PATCH",
      path: "/api/admin/feature-flags",
      body: { key: "studio", enabled: true, config: { rollout: "all" } },
    });

    expect(response.status).toBe(200);
    expect(bodyAsRecord(response).success).toBe(true);
    expect(mockDbUpdateFeatureFlag).toHaveBeenCalledWith("studio", {
      enabled: true,
      config: { rollout: "all" },
    });
    expect(mockInvalidateFeatureFlagCache).toHaveBeenCalledWith("studio");
  });

  it("rejects an empty update without a 5xx", async () => {
    const response = await invokeJson(PATCH, {
      method: "PATCH",
      path: "/api/admin/feature-flags",
      body: { key: "studio" },
    });

    expect(response.status).toBe(400);
  });

  it("fails closed when the durable feature flag write fails", async () => {
    mockDbUpdateFeatureFlag.mockResolvedValueOnce(false);

    const response = await invokeJson(PATCH, {
      method: "PATCH",
      path: "/api/admin/feature-flags",
      body: { key: "studio", enabled: false },
    });

    expect(response.status).toBe(500);
    expect(bodyAsRecord(response).error).toBe("Failed to update feature flag");
  });
});
