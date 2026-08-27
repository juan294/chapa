import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendAlertEmail, type AlertEmailPayload } from "./alerts";

vi.mock("./resend", () => ({
  getResend: vi.fn(),
  escapeHtml: (s: string) => s.replace(/[<>&]/g, (c) => `&#${c.charCodeAt(0)};`),
}));
vi.mock("@/lib/utils/escape", () => ({
  escapeHtml: (s: string) => s.replace(/[<>&]/g, (c) => `&#${c.charCodeAt(0)};`),
}));
vi.mock("@/lib/env", () => ({
  getSupportForwardEmail: vi.fn(),
}));
vi.mock("@/lib/async/with-timeout", () => ({
  withTimeout: vi.fn(async (p) => p),
  EMAIL_SEND_TIMEOUT_MS: 8000,
}));

import { getSupportForwardEmail } from "@/lib/env";
import { getResend } from "./resend";

const basePayload: AlertEmailPayload = {
  source: "chapa",
  timestamp: "2026-08-27T00:00:00.000Z",
  signal: "health_degraded",
  severity: "P1",
  summary: "Health check is degraded",
  route: "/api/health",
  properties: { dependencies: { redis: "error" } },
};

describe("sendAlertEmail", () => {
  const mockSend = vi.fn();

  beforeEach(() => {
    vi.mocked(getResend).mockReturnValue({ emails: { send: mockSend } } as never);
    vi.mocked(getSupportForwardEmail).mockReturnValue("support@example.com");
    mockSend.mockReset();
    mockSend.mockResolvedValue({ data: { id: "test-id" }, error: null });
  });

  it("returns false when the Resend client is unavailable (RESEND_API_KEY unset)", async () => {
    vi.mocked(getResend).mockReturnValue(null);

    const result = await sendAlertEmail(basePayload);

    expect(result).toBe(false);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("returns false when SUPPORT_FORWARD_EMAIL is not set", async () => {
    vi.mocked(getSupportForwardEmail).mockReturnValue(undefined);

    const result = await sendAlertEmail(basePayload);

    expect(result).toBe(false);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("sends to SUPPORT_FORWARD_EMAIL with a severity/signal subject", async () => {
    const result = await sendAlertEmail(basePayload);

    expect(result).toBe(true);
    expect(mockSend).toHaveBeenCalledTimes(1);
    const call = mockSend.mock.calls[0]![0];
    expect(call.to).toEqual(["support@example.com"]);
    expect(call.subject).toBe("[Chapa P1] health_degraded");
    expect(call.from).toContain("chapa.thecreativetoken.com");
  });

  it("includes the signal, summary, route, and properties in both html and text bodies", async () => {
    await sendAlertEmail(basePayload);

    const call = mockSend.mock.calls[0]![0];
    expect(call.text).toContain("health_degraded");
    expect(call.text).toContain("Health check is degraded");
    expect(call.text).toContain("/api/health");
    expect(call.text).toContain("redis");
    expect(call.html).toContain("health_degraded");
    expect(call.html).toContain("Health check is degraded");
  });

  it("omits the route line when route is not provided", async () => {
    const withoutRoute = { ...basePayload };
    delete withoutRoute.route;
    await sendAlertEmail(withoutRoute);

    const call = mockSend.mock.calls[0]![0];
    expect(call.text).not.toContain("Route:");
  });

  it("does not throw and returns false when Resend returns an error", async () => {
    mockSend.mockResolvedValue({ data: null, error: { message: "send failed" } });

    const result = await sendAlertEmail(basePayload);

    expect(result).toBe(false);
  });

  it("does not throw and returns false when send rejects", async () => {
    mockSend.mockRejectedValue(new Error("network down"));

    const result = await sendAlertEmail(basePayload);

    expect(result).toBe(false);
  });

  it("escapes HTML in signal, summary, and route to avoid injection into the email body", async () => {
    await sendAlertEmail({
      ...basePayload,
      signal: "<script>alert(1)</script>",
      summary: "bad <b>summary</b>",
    });

    const call = mockSend.mock.calls[0]![0];
    expect(call.html).not.toContain("<script>alert(1)</script>");
  });
});
