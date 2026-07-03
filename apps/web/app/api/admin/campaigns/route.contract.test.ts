import { describe, expect, it, vi } from "vitest";
import { bodyAsRecord, invokeJson } from "@/test/contract/invoke";

const { mockAdminAuth, mockDbCreateCampaign } = vi.hoisted(() => ({
  mockAdminAuth: vi.fn(async () => null),
  mockDbCreateCampaign: vi.fn(async () => "campaign-1"),
}));

vi.mock("@/lib/auth/admin-route", () => ({
  adminAuth: mockAdminAuth,
}));

vi.mock("@/lib/db/campaigns", () => ({
  dbCreateCampaign: mockDbCreateCampaign,
  dbGetCampaigns: vi.fn(async () => []),
}));

import { POST } from "./route";

const VALID_CAMPAIGN = {
  type: "announcement",
  name: "Contract campaign",
  subject: "Subject",
  previewText: "Preview",
  headline: "Headline",
  bodyText: "Body text",
  features: [{ text: "Feature" }],
  ctaText: "Open",
  ctaUrl: "https://example.com",
};

describe("POST /api/admin/campaigns contract", () => {
  it("creates a campaign from a valid payload", async () => {
    const response = await invokeJson(POST, {
      method: "POST",
      path: "/api/admin/campaigns",
      body: VALID_CAMPAIGN,
    });

    expect(response.status).toBe(201);
    expect(bodyAsRecord(response).id).toBe("campaign-1");
    expect(mockDbCreateCampaign).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Contract campaign" }),
    );
  });

  it("rejects malformed create payloads without a 5xx", async () => {
    const response = await invokeJson(POST, {
      method: "POST",
      path: "/api/admin/campaigns",
      body: { ...VALID_CAMPAIGN, ctaUrl: "not-a-url" },
    });

    expect(response.status).toBe(400);
  });

  it("fails closed when campaign creation does not persist", async () => {
    mockDbCreateCampaign.mockResolvedValueOnce(null as never);

    const response = await invokeJson(POST, {
      method: "POST",
      path: "/api/admin/campaigns",
      body: VALID_CAMPAIGN,
    });

    expect(response.status).toBe(500);
    expect(bodyAsRecord(response).error).toBe("Failed to create campaign");
  });
});
