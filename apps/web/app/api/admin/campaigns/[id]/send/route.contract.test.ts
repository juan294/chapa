import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const {
  mockAdminAuth,
  mockDbGetCampaign,
  mockInitiateCampaign,
  mockProcessCampaignBatch,
} = vi.hoisted(() => ({
  mockAdminAuth: vi.fn(async () => null),
  mockDbGetCampaign: vi.fn(async () => ({
    id: "campaign-1",
    type: "announcement",
    status: "draft",
    subject: "Subject",
  })),
  mockInitiateCampaign: vi.fn(async () => ({ totalRecipients: 2 })),
  mockProcessCampaignBatch: vi.fn(async () => ({ sent: 2, failed: 0 })),
}));

vi.mock("@/lib/auth/admin-route", () => ({
  adminAuth: mockAdminAuth,
}));

vi.mock("@/lib/db/campaigns", () => ({
  dbGetCampaign: mockDbGetCampaign,
}));

vi.mock("@/lib/email/campaigns", () => ({
  DAILY_SEND_LIMIT: 100,
  initiateCampaign: mockInitiateCampaign,
  processCampaignBatch: mockProcessCampaignBatch,
}));

import { POST } from "./route";

const CTX = { params: Promise.resolve({ id: "campaign-1" }) };

function request(): NextRequest {
  return new NextRequest("https://contract.test/api/admin/campaigns/campaign-1/send", {
    method: "POST",
  });
}

describe("POST /api/admin/campaigns/[id]/send contract", () => {
  it("initiates a draft announcement campaign and processes the first batch", async () => {
    const response = await POST(request(), CTX);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.totalRecipients).toBe(2);
    expect(mockInitiateCampaign).toHaveBeenCalledWith(
      "campaign-1",
      expect.objectContaining({ status: "draft" }),
    );
    expect(mockProcessCampaignBatch).toHaveBeenCalledWith("campaign-1");
  });

  it("fails closed when initiation does not persist", async () => {
    mockInitiateCampaign.mockResolvedValueOnce(null as never);

    const response = await POST(request(), CTX);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe("Campaign already started or could not be claimed");
  });
});
