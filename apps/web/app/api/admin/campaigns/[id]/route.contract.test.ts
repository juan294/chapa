import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const {
  mockAdminAuth,
  mockDbDeleteCampaign,
  mockDbGetCampaign,
  mockDbUpdateCampaign,
} = vi.hoisted(() => ({
  mockAdminAuth: vi.fn(async () => null),
  mockDbDeleteCampaign: vi.fn(async () => true),
  mockDbGetCampaign: vi.fn(async () => ({
    id: "campaign-1",
    type: "announcement",
    name: "Contract campaign",
    subject: "Subject",
    previewText: "Preview",
    headline: "Headline",
    bodyText: "Body text",
    features: [{ text: "Feature" }],
    ctaText: "Open",
    ctaUrl: "https://example.com",
    status: "draft",
  })),
  mockDbUpdateCampaign: vi.fn(async () => true),
}));

vi.mock("@/lib/auth/admin-route", () => ({
  adminAuth: mockAdminAuth,
}));

vi.mock("@/lib/db/campaigns", () => ({
  dbDeleteCampaign: mockDbDeleteCampaign,
  dbGetCampaign: mockDbGetCampaign,
  dbUpdateCampaign: mockDbUpdateCampaign,
}));

import { DELETE, PATCH } from "./route";

const CTX = { params: Promise.resolve({ id: "campaign-1" }) };

function request(method: string, body?: unknown): NextRequest {
  return new NextRequest("https://contract.test/api/admin/campaigns/campaign-1", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("PATCH /api/admin/campaigns/[id] contract", () => {
  it("updates draft campaign content", async () => {
    const response = await PATCH(request("PATCH", { subject: "Updated" }), CTX);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockDbUpdateCampaign).toHaveBeenCalledWith("campaign-1", {
      subject: "Updated",
    });
  });

  it("rejects malformed patch payloads without a 5xx", async () => {
    const response = await PATCH(request("PATCH", { ctaUrl: "bad" }), CTX);

    expect(response.status).toBe(400);
  });
});

describe("DELETE /api/admin/campaigns/[id] contract", () => {
  it("deletes a draft campaign", async () => {
    const response = await DELETE(request("DELETE"), CTX);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockDbDeleteCampaign).toHaveBeenCalledWith("campaign-1");
  });
});
