import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendChallengeEmail } from "./challenge";

vi.mock("./resend", () => ({
  getResend: vi.fn(),
}));
vi.mock("@/lib/env", () => ({
  getSupportForwardEmail: vi.fn(),
  getBaseUrl: vi.fn(() => "https://chapa.thecreativetoken.com"),
}));
vi.mock("@/lib/async/with-timeout", () => ({
  withTimeout: vi.fn(async (p) => p),
  EMAIL_SEND_TIMEOUT_MS: 8000,
}));

import { getSupportForwardEmail } from "@/lib/env";
import { getResend } from "./resend";

describe("sendChallengeEmail", () => {
  const mockSend = vi.fn();

  beforeEach(() => {
    vi.mocked(getResend).mockReturnValue({ emails: { send: mockSend } } as never);
    vi.mocked(getSupportForwardEmail).mockReturnValue("support@example.com");
    mockSend.mockReset();
    mockSend.mockResolvedValue({ data: { id: "test-id" }, error: null });
  });

  it("returns { success: false } when Resend client is unavailable", async () => {
    vi.mocked(getResend).mockReturnValue(null);

    const result = await sendChallengeEmail("octocat", "My delivery score seems wrong.");

    expect(result).toEqual({ success: false });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("returns { success: false } when SUPPORT_FORWARD_EMAIL is not set", async () => {
    vi.mocked(getSupportForwardEmail).mockReturnValue(undefined);

    const result = await sendChallengeEmail("octocat", "My delivery score seems wrong.");

    expect(result).toEqual({ success: false });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("sends email with correct from/to/subject on success", async () => {
    const result = await sendChallengeEmail("octocat", "My delivery score seems wrong.");

    expect(result).toEqual({ success: true });
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: expect.stringContaining("support@chapa.thecreativetoken.com"),
        to: ["support@example.com"],
        subject: expect.stringContaining("octocat"),
      }),
    );
  });

  it("includes handle and reason in the email text body", async () => {
    await sendChallengeEmail("octocat", "My delivery score seems wrong.");

    const firstCall = mockSend.mock.calls[0];
    expect(firstCall).toBeDefined();
    const payload = firstCall![0];
    expect(payload.text).toContain("octocat");
    expect(payload.text).toContain("My delivery score seems wrong.");
  });

  it("includes the share page link in the email", async () => {
    await sendChallengeEmail("octocat", "My delivery score seems wrong.");

    const firstCall = mockSend.mock.calls[0];
    expect(firstCall).toBeDefined();
    const payload = firstCall![0];
    expect(payload.text).toContain("/u/octocat");
  });

  it("returns { success: false } when Resend returns an error", async () => {
    mockSend.mockResolvedValue({ data: null, error: { message: "API error" } });

    const result = await sendChallengeEmail("octocat", "My delivery score seems wrong.");

    expect(result).toEqual({ success: false });
  });

  it("returns { success: false } when send throws", async () => {
    mockSend.mockRejectedValue(new Error("network failure"));

    const result = await sendChallengeEmail("octocat", "My delivery score seems wrong.");

    expect(result).toEqual({ success: false });
  });
});
