import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const {
  mockAdminAuth,
  mockDbGetCampaign,
  mockEmailSend,
  mockRequireSession,
} = vi.hoisted(() => ({
  mockAdminAuth: vi.fn(async () => null),
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
  mockEmailSend: vi.fn(async () => ({ data: { id: "email-1" }, error: null })),
  mockRequireSession: vi.fn(() => ({
    session: { login: "admin", name: "Admin", avatar_url: "" },
    error: null,
  })),
}));

vi.mock("@/lib/auth/admin-route", () => ({
  adminAuth: mockAdminAuth,
}));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: mockRequireSession,
}));

vi.mock("@/lib/db/campaigns", () => ({
  dbGetCampaign: mockDbGetCampaign,
}));

vi.mock("@/lib/email/resend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/email/resend")>();
  return {
    ...actual,
    getResend: vi.fn(() => ({ emails: { send: mockEmailSend } })),
  };
});

import { POST } from "./route";

const CTX = { params: Promise.resolve({ id: "campaign-1" }) };

function request(body: unknown): NextRequest {
  return new NextRequest("https://contract.test/api/admin/campaigns/campaign-1/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/campaigns/[id]/test contract", () => {
  it("sends a test email for a valid recipient", async () => {
    const response = await POST(request({ email: "test@example.com" }), CTX);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.emailId).toBe("email-1");
    expect(mockEmailSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: "test@example.com" }),
    );
  });

  it("rejects invalid recipient payloads without a 5xx", async () => {
    const response = await POST(request({ email: "not-an-email" }), CTX);

    expect(response.status).toBe(400);
  });
});
