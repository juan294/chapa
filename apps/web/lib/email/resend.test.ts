import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock dependencies BEFORE importing the module under test.
// ---------------------------------------------------------------------------

const mockSend = vi.fn();

vi.mock("resend", () => ({
  Resend: class MockResend {
    emails = { send: mockSend };
  },
}));

const mockWebhookVerify = vi.fn();

vi.mock("svix", () => ({
  Webhook: class MockWebhook {
    verify = mockWebhookVerify;
  },
}));

// Mock global fetch for fetchReceivedEmail
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Import after mocks are set up
import {
  getResend,
  verifyWebhookSignature,
  fetchReceivedEmail,
  forwardEmail,
  _resetClient,
} from "./resend";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  _resetClient();

  vi.stubEnv("RESEND_API_KEY", "re_test_123");
  vi.stubEnv("RESEND_WEBHOOK_SECRET", "whsec_test_secret");
  vi.stubEnv("SUPPORT_FORWARD_EMAIL", "juan@gmail.com");
});

// ---------------------------------------------------------------------------
// getResend
// ---------------------------------------------------------------------------

describe("getResend", () => {
  it("returns a Resend client when RESEND_API_KEY is set", () => {
    const client = getResend();
    expect(client).not.toBeNull();
    expect(client!.emails.send).toBeDefined();
  });

  it("returns null when RESEND_API_KEY is missing", () => {
    _resetClient();
    vi.stubEnv("RESEND_API_KEY", "");

    const client = getResend();
    expect(client).toBeNull();
  });

  it("returns the same singleton on subsequent calls", () => {
    const first = getResend();
    const second = getResend();
    expect(first).toBe(second);
  });

  it("trims whitespace from env var", () => {
    _resetClient();
    vi.stubEnv("RESEND_API_KEY", "  re_test_123  ");

    const client = getResend();
    expect(client).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// verifyWebhookSignature
// ---------------------------------------------------------------------------

describe("verifyWebhookSignature", () => {
  it("returns true when signature is valid", () => {
    mockWebhookVerify.mockReturnValueOnce({ type: "email.received" });

    const result = verifyWebhookSignature("raw-body", {
      "svix-id": "msg_123",
      "svix-timestamp": "1234567890",
      "svix-signature": "v1,sig123",
    });

    expect(result).toBe(true);
    expect(mockWebhookVerify).toHaveBeenCalledWith("raw-body", {
      "svix-id": "msg_123",
      "svix-timestamp": "1234567890",
      "svix-signature": "v1,sig123",
    });
  });

  it("returns false when signature is invalid (Webhook throws)", () => {
    mockWebhookVerify.mockImplementationOnce(() => {
      throw new Error("Invalid signature");
    });

    const result = verifyWebhookSignature("raw-body", {
      "svix-id": "msg_123",
      "svix-timestamp": "1234567890",
      "svix-signature": "v1,bad",
    });

    expect(result).toBe(false);
  });

  it("returns false when RESEND_WEBHOOK_SECRET is missing", () => {
    _resetClient();
    vi.stubEnv("RESEND_WEBHOOK_SECRET", "");

    const result = verifyWebhookSignature("raw-body", {
      "svix-id": "msg_123",
      "svix-timestamp": "1234567890",
      "svix-signature": "v1,sig123",
    });

    expect(result).toBe(false);
    expect(mockWebhookVerify).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// fetchReceivedEmail
// ---------------------------------------------------------------------------

describe("fetchReceivedEmail", () => {
  const sampleEmail = {
    id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    from: "sender@example.com",
    to: ["support@chapa.thecreativetoken.com"],
    subject: "Hello support",
    html: "<p>Need help</p>",
    text: "Need help",
    attachments: [],
  };

  it("fetches and returns email data on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => sampleEmail,
    });

    const result = await fetchReceivedEmail(
      "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    );

    expect(result).toEqual(sampleEmail);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.resend.com/emails/a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      {
        headers: {
          Authorization: "Bearer re_test_123",
        },
      },
    );
  });

  it("returns null when API responds with error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => "Not found",
    });

    const result = await fetchReceivedEmail(
      "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    );
    expect(result).toBeNull();
  });

  it("returns null when fetch throws", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await fetchReceivedEmail(
      "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    );
    expect(result).toBeNull();
  });

  it("returns null for invalid email ID (not a UUID)", async () => {
    const result = await fetchReceivedEmail("../../etc/passwd");
    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns null when RESEND_API_KEY is missing", async () => {
    _resetClient();
    vi.stubEnv("RESEND_API_KEY", "");

    const result = await fetchReceivedEmail(
      "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    );
    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// forwardEmail
// ---------------------------------------------------------------------------

describe("forwardEmail", () => {
  it("sends forwarded email with correct parameters", async () => {
    mockSend.mockResolvedValueOnce({ data: { id: "fwd_123" }, error: null });

    const result = await forwardEmail({
      from: "sender@example.com",
      subject: "Hello support",
      html: "<p>Need help</p>",
      text: "Need help",
    });

    expect(result).toEqual({ id: "fwd_123" });
    expect(mockSend).toHaveBeenCalledWith({
      from: "Chapa Support <support@chapa.thecreativetoken.com>",
      to: ["juan@gmail.com"],
      replyTo: "sender@example.com",
      subject: "Fwd: Hello support",
      html: expect.stringContaining("Forwarded message"),
      text: expect.stringContaining("--- Forwarded message ---"),
    });
  });

  it("returns null when Resend client is unavailable", async () => {
    _resetClient();
    vi.stubEnv("RESEND_API_KEY", "");

    const result = await forwardEmail({
      from: "sender@example.com",
      subject: "Test",
      html: "<p>Test</p>",
      text: "Test",
    });

    expect(result).toBeNull();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("returns null when SUPPORT_FORWARD_EMAIL is missing", async () => {
    vi.stubEnv("SUPPORT_FORWARD_EMAIL", "");

    const result = await forwardEmail({
      from: "sender@example.com",
      subject: "Test",
      html: "<p>Test</p>",
      text: "Test",
    });

    expect(result).toBeNull();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("returns null when send fails", async () => {
    mockSend.mockResolvedValueOnce({
      data: null,
      error: { message: "Rate limited" },
    });

    const result = await forwardEmail({
      from: "sender@example.com",
      subject: "Test",
      html: "<p>Test</p>",
      text: "Test",
    });

    expect(result).toBeNull();
  });

  it("returns null when send throws", async () => {
    mockSend.mockRejectedValueOnce(new Error("Network error"));

    const result = await forwardEmail({
      from: "sender@example.com",
      subject: "Test",
      html: "<p>Test</p>",
      text: "Test",
    });

    expect(result).toBeNull();
  });

  it("wraps HTML body with forwarded message header", async () => {
    mockSend.mockResolvedValueOnce({ data: { id: "fwd_456" }, error: null });

    await forwardEmail({
      from: "alice@example.com",
      subject: "Question",
      html: "<p>Original message</p>",
      text: "Original message",
    });

    const call = mockSend.mock.calls[0][0];
    expect(call.html).toContain("alice@example.com");
    expect(call.html).toContain("Question");
    expect(call.html).toContain("<p>Original message</p>");
  });
});
