# Phase 2 — Email Helper [batch-eligible]

**Goal:** Create a pure `sendChallengeEmail()` function that sends a formatted support email when a user challenges their score.

**New files:**
- `apps/web/lib/email/challenge.ts`
- `apps/web/lib/email/challenge.test.ts`

**Files read (no change):**
- `apps/web/lib/email/notifications.ts` (pattern reference)
- `apps/web/lib/email/resend.ts` (getResend, withTimeout)
- `apps/web/lib/env.ts` (getSupportForwardEmail, getBaseUrl, getVercelEnv)

---

## Red — Failing Tests

Write `challenge.test.ts` first:

```ts
// apps/web/lib/email/challenge.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
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

import { getResend } from "./resend";
import { getSupportForwardEmail } from "@/lib/env";

describe("sendChallengeEmail", () => {
  const mockSend = vi.fn();

  beforeEach(() => {
    vi.mocked(getResend).mockReturnValue({ emails: { send: mockSend } } as never);
    vi.mocked(getSupportForwardEmail).mockReturnValue("support@example.com");
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
    const call = mockSend.mock.calls[0][0];
    expect(call.text).toContain("octocat");
    expect(call.text).toContain("My delivery score seems wrong.");
  });

  it("includes the share page link in the email", async () => {
    await sendChallengeEmail("octocat", "My delivery score seems wrong.");
    const call = mockSend.mock.calls[0][0];
    expect(call.text).toContain("/u/octocat");
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
```

---

## Green — Implementation

```ts
// apps/web/lib/email/challenge.ts

import { getResend } from "./resend";
import { withTimeout, EMAIL_SEND_TIMEOUT_MS } from "@/lib/async/with-timeout";
import { getSupportForwardEmail, getBaseUrl } from "@/lib/env";

export async function sendChallengeEmail(
  handle: string,
  reason: string,
): Promise<{ success: boolean }> {
  try {
    const resend = getResend();
    if (!resend) return { success: false };

    const to = getSupportForwardEmail();
    if (!to) return { success: false };

    const baseUrl = getBaseUrl();
    const shareUrl = `${baseUrl}/u/${handle.toLowerCase()}`;
    const subject = `Score challenge: @${handle}`;

    const text = buildText(handle, reason, shareUrl);
    const html = buildHtml(handle, reason, shareUrl);

    const { error } = await withTimeout(
      resend.emails.send({
        from: "Chapa Support <support@chapa.thecreativetoken.com>",
        to: [to],
        subject,
        html,
        text,
      }),
      EMAIL_SEND_TIMEOUT_MS,
      "sendChallengeEmail",
    );

    if (error) {
      console.error("[email] sendChallengeEmail failed:", error);
      return { success: false };
    }

    return { success: true };
  } catch (err) {
    console.error("[email] sendChallengeEmail error:", (err as Error).message);
    return { success: false };
  }
}

function buildText(handle: string, reason: string, shareUrl: string): string {
  return [
    "CHAPA — Score Challenge",
    "═".repeat(40),
    "",
    `Handle:  @${handle}`,
    `Profile: ${shareUrl}`,
    "",
    "Concern from developer:",
    reason,
    "",
    "---",
    "Sent via 'Something seem off?' in the score explanation panel.",
  ].join("\n");
}

function buildHtml(handle: string, reason: string, shareUrl: string): string {
  // Escape user-controlled values
  const safeHandle = escapeHtml(handle);
  const safeReason = escapeHtml(reason).replace(/\n/g, "<br>");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0A0A0F;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0F;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#111118;border-radius:12px;border:1px solid rgba(139,92,246,0.15);overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#8B5CF6 0%,#7C3AED 100%);padding:20px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-family:'Courier New',monospace;font-size:20px;font-weight:700;color:#FFFFFF;letter-spacing:2px;">CHAPA</td>
              <td align="right" style="font-size:13px;color:rgba(255,255,255,0.8);">Score Challenge</td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:32px;">
          <div style="font-size:22px;font-weight:700;color:#E2E4E9;font-family:'Courier New',monospace;margin-bottom:4px;">@${safeHandle}</div>
          <a href="${shareUrl}" style="font-size:13px;color:#8B5CF6;">${shareUrl}</a>
          <div style="margin-top:24px;padding:16px;background:#0A0A0F;border-radius:8px;border:1px solid rgba(139,92,246,0.10);">
            <div style="font-size:11px;color:#6B6F7B;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Developer's concern</div>
            <div style="font-size:14px;color:#E2E4E9;line-height:1.6;">${safeReason}</div>
          </div>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid rgba(139,92,246,0.10);">
          <div style="font-size:11px;color:#3A3A4A;">Sent via 'Something seem off?' in the score explanation panel.</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
```

---

## Verification

```bash
pnpm run test apps/web/lib/email/challenge.test.ts
pnpm run typecheck
```

All 7 tests must pass. No type errors.

---

## Implementation Status

- [x] Phase 2 implemented in worktree `/Users/juan/code/chapa-phase-1` on branch `implement/challenge-my-score-phase-1`
- [x] Red state confirmed: email helper test failed before `apps/web/lib/email/challenge.ts` existed
- [x] `sendChallengeEmail()` added with `server-only`, Resend, `withTimeout`, support-address guard, escaped HTML, and text body
- [x] `/simplify` equivalent completed; shared challenge validation cleanup applied where plan-compatible
- [x] Verification passed: `pnpm run test apps/web/lib/email/challenge.test.ts`
- [x] Verification passed: `pnpm run typecheck`
