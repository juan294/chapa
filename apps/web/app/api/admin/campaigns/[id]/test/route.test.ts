// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/auth/github", () => ({
  readSessionCookie: vi.fn(),
}));
vi.mock("@/lib/auth/admin", () => ({
  isAdminHandle: vi.fn(),
}));
vi.mock("@/lib/cache/redis", () => ({
  rateLimit: vi.fn().mockResolvedValue({ allowed: true, current: 1, limit: 10 }),
}));
vi.mock("@/lib/http/client-ip", () => ({
  getClientIp: () => "127.0.0.1",
}));
vi.mock("@/lib/auth/require-session", () => ({
  requireSession: vi.fn(),
}));
vi.mock("@/lib/db/campaigns", () => ({
  dbGetCampaign: vi.fn(),
}));
vi.mock("@/lib/email/resend", () => ({
  getResend: vi.fn(),
}));
vi.mock("@/lib/email/campaigns", () => ({
  buildEmailContent: vi.fn(),
  EMAIL_FROM: "Chapa <notifications@chapa.thecreativetoken.com>",
}));
vi.mock("@/lib/email/templates/announcement", () => ({
  buildAnnouncementHtml: vi.fn().mockReturnValue("<html>test</html>"),
  buildAnnouncementText: vi.fn().mockReturnValue("test"),
}));

import { readSessionCookie } from "@/lib/auth/github";
import { isAdminHandle } from "@/lib/auth/admin";
import { rateLimit } from "@/lib/cache/redis";
import { requireSession } from "@/lib/auth/require-session";
import { dbGetCampaign } from "@/lib/db/campaigns";
import { getResend } from "@/lib/email/resend";
import { buildEmailContent } from "@/lib/email/campaigns";
import { POST } from "./route";

const mockParams = Promise.resolve({ id: "c-1" });

const CAMPAIGN = {
  id: "c-1",
  type: "announcement" as const,
  name: "Test Campaign",
  subject: "Test Subject",
  headline: "Test Headline",
  bodyText: "Test body",
  features: [{ text: "Feature 1" }],
  ctaText: "Click here",
  ctaUrl: "https://example.com",
  previewText: "Preview",
  status: "draft" as const,
  totalRecipients: 0,
  sentCount: 0,
  failedCount: 0,
  createdAt: "2026-01-01T00:00:00Z",
  startedAt: null,
  completedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXTAUTH_SECRET = "test-secret";
  vi.mocked(readSessionCookie).mockReturnValue({
    token: "t", login: "admin", name: "Admin", avatar_url: "",
  });
  vi.mocked(isAdminHandle).mockReturnValue(true);
  vi.mocked(requireSession).mockReturnValue({
    session: { token: "t", login: "admin", name: "Admin", avatar_url: "" },
  });
  vi.mocked(buildEmailContent).mockReturnValue({
    handle: "admin",
    headline: "Test Headline",
    bodyText: "Test body",
    features: [{ text: "Feature 1" }],
    ctaText: "Click here",
    ctaUrl: "https://example.com",
  });
});

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("https://example.com/api/admin/campaigns/c-1/test", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: "session=x" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/campaigns/[id]/test", () => {
  it("returns 401 without session", async () => {
    vi.mocked(readSessionCookie).mockReturnValue(null);
    vi.mocked(requireSession).mockReturnValue({
      error: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    const res = await POST(makeRequest({ email: "test@test.com" }), { params: mockParams });
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    vi.mocked(isAdminHandle).mockReturnValue(false);
    const res = await POST(makeRequest({ email: "test@test.com" }), { params: mockParams });
    expect(res.status).toBe(403);
  });

  it("returns 429 when rate limited", async () => {
    vi.mocked(rateLimit).mockResolvedValueOnce({ allowed: false, current: 11, limit: 10 });
    const res = await POST(makeRequest({ email: "test@test.com" }), { params: mockParams });
    expect(res.status).toBe(429);
  });

  it("returns 400 when email is missing", async () => {
    const res = await POST(makeRequest({}), { params: mockParams });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Missing required field: email");
  });

  it("returns 400 when email is empty string", async () => {
    const res = await POST(makeRequest({ email: "" }), { params: mockParams });
    expect(res.status).toBe(400);
  });

  it("returns 400 when email is not a valid email", async () => {
    const res = await POST(makeRequest({ email: "not-an-email" }), { params: mockParams });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid email address");
  });

  it("returns 404 for non-existent campaign", async () => {
    vi.mocked(dbGetCampaign).mockResolvedValue(null);
    const res = await POST(makeRequest({ email: "test@test.com" }), { params: mockParams });
    expect(res.status).toBe(404);
  });

  it("returns 500 when Resend is unavailable", async () => {
    vi.mocked(dbGetCampaign).mockResolvedValue(CAMPAIGN);
    vi.mocked(getResend).mockReturnValue(null);
    const res = await POST(makeRequest({ email: "test@test.com" }), { params: mockParams });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Email service unavailable");
  });

  it("sends test email and returns success", async () => {
    const mockSend = vi.fn().mockResolvedValue({ data: { id: "email-1" }, error: null });
    vi.mocked(dbGetCampaign).mockResolvedValue(CAMPAIGN);
    vi.mocked(getResend).mockReturnValue({ emails: { send: mockSend } } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    const res = await POST(makeRequest({ email: "test@test.com" }), { params: mockParams });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.message).toContain("test@test.com");
    expect(mockSend).toHaveBeenCalledOnce();
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
      to: "test@test.com",
      subject: "[TEST] Test Subject",
    }));
  });

  it("prefixes subject with [TEST]", async () => {
    const mockSend = vi.fn().mockResolvedValue({ data: { id: "email-1" }, error: null });
    vi.mocked(dbGetCampaign).mockResolvedValue(CAMPAIGN);
    vi.mocked(getResend).mockReturnValue({ emails: { send: mockSend } } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    await POST(makeRequest({ email: "test@test.com" }), { params: mockParams });

    const sentEmail = mockSend.mock.calls[0]![0];
    expect(sentEmail.subject).toBe("[TEST] Test Subject");
  });

  it("uses provided handle or defaults to session login", async () => {
    const mockSend = vi.fn().mockResolvedValue({ data: { id: "email-1" }, error: null });
    vi.mocked(dbGetCampaign).mockResolvedValue(CAMPAIGN);
    vi.mocked(getResend).mockReturnValue({ emails: { send: mockSend } } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    await POST(makeRequest({ email: "test@test.com" }), { params: mockParams });
    expect(buildEmailContent).toHaveBeenCalledWith(CAMPAIGN, "admin");

    vi.clearAllMocks();
    vi.mocked(readSessionCookie).mockReturnValue({
      token: "t", login: "admin", name: "Admin", avatar_url: "",
    });
    vi.mocked(isAdminHandle).mockReturnValue(true);
    vi.mocked(dbGetCampaign).mockResolvedValue(CAMPAIGN);
    vi.mocked(getResend).mockReturnValue({ emails: { send: mockSend } } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    await POST(makeRequest({ email: "test@test.com", handle: "testuser" }), { params: mockParams });
    expect(buildEmailContent).toHaveBeenCalledWith(CAMPAIGN, "testuser");
  });

  it("returns 500 when Resend send fails", async () => {
    const mockSend = vi.fn().mockResolvedValue({ data: null, error: { message: "send failed" } });
    vi.mocked(dbGetCampaign).mockResolvedValue(CAMPAIGN);
    vi.mocked(getResend).mockReturnValue({ emails: { send: mockSend } } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    const res = await POST(makeRequest({ email: "test@test.com" }), { params: mockParams });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("send failed");
  });

  it("does NOT modify campaign status or create campaign_sends", async () => {
    const mockSend = vi.fn().mockResolvedValue({ data: { id: "email-1" }, error: null });
    vi.mocked(dbGetCampaign).mockResolvedValue(CAMPAIGN);
    vi.mocked(getResend).mockReturnValue({ emails: { send: mockSend } } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    await POST(makeRequest({ email: "test@test.com" }), { params: mockParams });

    // dbGetCampaign is the only DB call — no update, no create sends
    expect(dbGetCampaign).toHaveBeenCalledOnce();
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest("https://example.com/api/admin/campaigns/c-1/test", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: "session=x" },
      body: "not valid json{{{",
    });
    const res = await POST(req, { params: mockParams });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid JSON");
  });

  it("interpolates placeholders for engagement campaigns", async () => {
    const engagementCampaign = {
      ...CAMPAIGN,
      type: "engagement" as const,
      subject: "Hey {{handle}}!",
      headline: "Score went up {{delta}} points",
      bodyText: "From {{tier_from}} to {{tier_to}}",
      ctaUrl: "https://example.com/u/{{handle}}",
      ctaText: "Check {{handle}}'s badge",
      features: [{ text: "{{archetype_from}} → {{archetype_to}}" }],
    };
    const mockSend = vi.fn().mockResolvedValue({ data: { id: "email-1" }, error: null });
    vi.mocked(dbGetCampaign).mockResolvedValue(engagementCampaign);
    vi.mocked(getResend).mockReturnValue({ emails: { send: mockSend } } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    const res = await POST(makeRequest({ email: "test@test.com" }), { params: mockParams });
    expect(res.status).toBe(200);

    // buildEmailContent should receive the interpolated campaign
    expect(buildEmailContent).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Hey admin!",
        headline: "Score went up +12 points",
        bodyText: "From Solid to High",
        ctaUrl: "https://example.com/u/admin",
        ctaText: "Check admin's badge",
        features: [{ text: "Balanced → Builder" }],
      }),
      "admin",
    );
  });

  it("returns 500 when resend.emails.send throws", async () => {
    vi.mocked(dbGetCampaign).mockResolvedValue(CAMPAIGN);
    vi.mocked(getResend).mockReturnValue({
      emails: { send: vi.fn().mockRejectedValue(new Error("network failure")) },
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    const res = await POST(makeRequest({ email: "test@test.com" }), { params: mockParams });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("network failure");
  });

  it("allows test send for any campaign status", async () => {
    const mockSend = vi.fn().mockResolvedValue({ data: { id: "email-1" }, error: null });
    vi.mocked(getResend).mockReturnValue({ emails: { send: mockSend } } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    // Test with sent campaign
    vi.mocked(dbGetCampaign).mockResolvedValue({ ...CAMPAIGN, status: "sent" as const });
    const res = await POST(makeRequest({ email: "test@test.com" }), { params: mockParams });
    expect(res.status).toBe(200);
  });
});
