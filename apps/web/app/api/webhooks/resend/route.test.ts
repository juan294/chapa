import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mock the email module BEFORE importing the route handler.
// vi.hoisted() ensures mock fns are available when vi.mock() factory runs.
// ---------------------------------------------------------------------------

const {
  mockVerifyWebhookSignature,
  mockFetchReceivedEmail,
  mockForwardEmail,
  mockRateLimit,
  mockCacheSetNx,
  mockCacheGet,
} = vi.hoisted(() => ({
  mockVerifyWebhookSignature: vi.fn(),
  mockFetchReceivedEmail: vi.fn(),
  mockForwardEmail: vi.fn(),
  mockRateLimit: vi.fn(),
  mockCacheSetNx: vi.fn(),
  mockCacheGet: vi.fn(),
}));

vi.mock("@/lib/email/resend", () => ({
  verifyWebhookSignature: mockVerifyWebhookSignature,
  fetchReceivedEmail: mockFetchReceivedEmail,
  forwardEmail: mockForwardEmail,
}));

vi.mock("@/lib/cache/redis", () => ({
  rateLimit: mockRateLimit,
  cacheSetNx: mockCacheSetNx,
  cacheGet: mockCacheGet,
}));

vi.mock("@/lib/http/client-ip", () => ({
  getClientIp: (req: Request) =>
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown",
}));

// Import after mocks
import { POST } from "./route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(
  body: string,
  headers: Record<string, string> = {},
  ip?: string,
): NextRequest {
  const allHeaders = { ...headers };
  if (ip) allHeaders["x-forwarded-for"] = ip;
  return new NextRequest("https://chapa.thecreativetoken.com/api/webhooks/resend", {
    method: "POST",
    body,
    headers: allHeaders,
  });
}

const validHeaders = {
  "svix-id": "msg_123",
  "svix-timestamp": "1234567890",
  "svix-signature": "v1,sig123",
};

const emailReceivedPayload = JSON.stringify({
  type: "email.received",
  data: {
    email_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  },
});

const sampleEmail = {
  id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  from: "sender@example.com",
  to: ["support@chapa.thecreativetoken.com"],
  subject: "Hello support",
  html: "<p>Need help</p>",
  text: "Need help",
  attachments: [],
};

function makeEmailReceivedPayload(emailId: string): string {
  return JSON.stringify({
    type: "email.received",
    data: { email_id: emailId },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 20 });
  mockCacheSetNx.mockResolvedValue(true);
  mockCacheGet.mockResolvedValue(null);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/webhooks/resend", () => {
  it("returns 400 when svix headers are missing", async () => {
    const req = makeRequest(emailReceivedPayload, {});

    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Missing");
  });

  it("returns 400 when only some svix headers are present", async () => {
    const req = makeRequest(emailReceivedPayload, {
      "svix-id": "msg_123",
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 401 when signature verification fails", async () => {
    mockVerifyWebhookSignature.mockReturnValueOnce(false);

    const req = makeRequest(emailReceivedPayload, validHeaders);

    const res = await POST(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain("signature");
  });

  it("returns 400 when body is malformed JSON", async () => {
    mockVerifyWebhookSignature.mockReturnValueOnce(true);

    const req = makeRequest("not valid json {{{", validHeaders);

    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid JSON payload");
  });

  it("returns 200 and ignores non email.received events", async () => {
    mockVerifyWebhookSignature.mockReturnValueOnce(true);

    const payload = JSON.stringify({ type: "email.sent", data: {} });
    const req = makeRequest(payload, validHeaders);

    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ignored");
    expect(mockFetchReceivedEmail).not.toHaveBeenCalled();
  });

  it("returns 502 when fetchReceivedEmail fails", async () => {
    mockVerifyWebhookSignature.mockReturnValueOnce(true);
    mockFetchReceivedEmail.mockResolvedValueOnce(null);

    const req = makeRequest(emailReceivedPayload, validHeaders);

    const res = await POST(req);

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toContain("fetch");
  });

  it("returns 400 when email_id fails the format guard", async () => {
    mockVerifyWebhookSignature.mockReturnValueOnce(true);

    const req = makeRequest(
      makeEmailReceivedPayload("../../etc/passwd"),
      validHeaders,
    );

    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("email_id");
    expect(mockFetchReceivedEmail).not.toHaveBeenCalled();
  });

  it("returns 502 when forwardEmail fails", async () => {
    mockVerifyWebhookSignature.mockReturnValueOnce(true);
    mockFetchReceivedEmail.mockResolvedValueOnce(sampleEmail);
    mockForwardEmail.mockResolvedValueOnce(null);

    const req = makeRequest(emailReceivedPayload, validHeaders);

    const res = await POST(req);

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toContain("forward");
  });

  it("returns 200 with forwarded status on success", async () => {
    mockVerifyWebhookSignature.mockReturnValueOnce(true);
    mockFetchReceivedEmail.mockResolvedValueOnce(sampleEmail);
    mockForwardEmail.mockResolvedValueOnce({ id: "fwd_123" });

    const req = makeRequest(emailReceivedPayload, validHeaders);

    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("forwarded");
    expect(body.id).toBe("fwd_123");
  });

  it("returns 200 and skips forwarding when the svix event was already processed", async () => {
    mockVerifyWebhookSignature.mockReturnValueOnce(true);
    mockCacheSetNx.mockResolvedValueOnce(false);
    mockCacheGet.mockResolvedValueOnce(1);

    const req = makeRequest(emailReceivedPayload, validHeaders);

    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("already_processed");
    expect(body.id).toBe("msg_123");
    expect(mockFetchReceivedEmail).not.toHaveBeenCalled();
    expect(mockForwardEmail).not.toHaveBeenCalled();
  });

  it("fails open when dedupe storage is unavailable", async () => {
    mockVerifyWebhookSignature.mockReturnValueOnce(true);
    mockCacheSetNx.mockResolvedValueOnce(false);
    mockCacheGet.mockResolvedValueOnce(null);
    mockFetchReceivedEmail.mockResolvedValueOnce(sampleEmail);
    mockForwardEmail.mockResolvedValueOnce({ id: "fwd_123" });

    const req = makeRequest(emailReceivedPayload, validHeaders);

    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("forwarded");
    expect(mockFetchReceivedEmail).toHaveBeenCalledOnce();
    expect(mockForwardEmail).toHaveBeenCalledOnce();
  });

  it("passes correct params to forwardEmail", async () => {
    mockVerifyWebhookSignature.mockReturnValueOnce(true);
    mockFetchReceivedEmail.mockResolvedValueOnce(sampleEmail);
    mockForwardEmail.mockResolvedValueOnce({ id: "fwd_456" });

    const req = makeRequest(emailReceivedPayload, validHeaders);
    await POST(req);

    expect(mockForwardEmail).toHaveBeenCalledWith({
      from: "sender@example.com",
      subject: "Hello support",
      html: "<p>Need help</p>",
      text: "Need help",
    });
  });

  it("passes a valid email_id through to fetchReceivedEmail", async () => {
    mockVerifyWebhookSignature.mockReturnValueOnce(true);
    mockFetchReceivedEmail.mockResolvedValueOnce(sampleEmail);
    mockForwardEmail.mockResolvedValueOnce({ id: "fwd_456" });

    const req = makeRequest(
      makeEmailReceivedPayload("12345678-abcd-4ef0-1234-567890abcdef"),
      validHeaders,
    );

    await POST(req);

    expect(mockFetchReceivedEmail).toHaveBeenCalledWith(
      "12345678-abcd-4ef0-1234-567890abcdef",
    );
  });

  it("passes svix headers to verifyWebhookSignature", async () => {
    mockVerifyWebhookSignature.mockReturnValueOnce(true);
    mockFetchReceivedEmail.mockResolvedValueOnce(sampleEmail);
    mockForwardEmail.mockResolvedValueOnce({ id: "fwd_789" });

    const req = makeRequest(emailReceivedPayload, validHeaders);
    await POST(req);

    expect(mockVerifyWebhookSignature).toHaveBeenCalledWith(
      emailReceivedPayload,
      {
        "svix-id": "msg_123",
        "svix-timestamp": "1234567890",
        "svix-signature": "v1,sig123",
      },
    );
  });

  it("logs warning when email has attachments", async () => {
    const emailWithAttachments = {
      ...sampleEmail,
      attachments: [{ filename: "doc.pdf" }],
    };
    mockVerifyWebhookSignature.mockReturnValueOnce(true);
    mockFetchReceivedEmail.mockResolvedValueOnce(emailWithAttachments);
    mockForwardEmail.mockResolvedValueOnce({ id: "fwd_att" });

    // log("warn") routes to console.error (structured JSON), not console.warn
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const req = makeRequest(emailReceivedPayload, validHeaders);
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(errorSpy).toHaveBeenCalledOnce();
    const entry = JSON.parse((errorSpy.mock.calls[0] as [string])[0]) as Record<string, unknown>;
    expect(entry.level).toBe("warn");
    expect(entry.msg).toContain("attachment");
    expect(entry.count).toBe(1);

    errorSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

describe("POST /api/webhooks/resend — rate limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 20 });
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, current: 21, limit: 20 });

    const req = makeRequest(emailReceivedPayload, validHeaders, "1.2.3.4");
    const res = await POST(req);

    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toMatch(/too many/i);
  });

  it("rate limits by IP with correct key and window (20 req / 60s)", async () => {
    mockVerifyWebhookSignature.mockReturnValueOnce(true);
    mockFetchReceivedEmail.mockResolvedValueOnce(sampleEmail);
    mockForwardEmail.mockResolvedValueOnce({ id: "fwd_rl" });

    const req = makeRequest(emailReceivedPayload, validHeaders, "10.0.0.1");
    await POST(req);

    expect(mockRateLimit).toHaveBeenCalledWith("ratelimit:webhook:10.0.0.1", 20, 60);
  });

  it("uses 'unknown' when x-forwarded-for is absent", async () => {
    mockVerifyWebhookSignature.mockReturnValueOnce(true);
    mockFetchReceivedEmail.mockResolvedValueOnce(sampleEmail);
    mockForwardEmail.mockResolvedValueOnce({ id: "fwd_rl2" });

    const req = makeRequest(emailReceivedPayload, validHeaders);
    await POST(req);

    expect(mockRateLimit).toHaveBeenCalledWith("ratelimit:webhook:unknown", 20, 60);
  });

  it("includes Retry-After header when rate limited", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, current: 21, limit: 20 });

    const req = makeRequest(emailReceivedPayload, validHeaders, "1.2.3.4");
    const res = await POST(req);

    expect(res.headers.get("Retry-After")).toBe("60");
  });

  it("rate limit check runs before body parsing", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, current: 21, limit: 20 });

    const req = makeRequest(emailReceivedPayload, validHeaders, "1.2.3.4");
    const res = await POST(req);

    expect(res.status).toBe(429);
    // Signature verification should NOT have been called
    expect(mockVerifyWebhookSignature).not.toHaveBeenCalled();
  });
});
