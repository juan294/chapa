# Phase 9 — Plausibles: Resend `emailId` guard + CLI device-auth poll rate-limit

**Source findings:** B16, B17 (§4B)
**Depends on:** none
**Batch:** [batch-eligible]

## Goal

Two defense-in-depth hardenings for observations that depend on runtime behavior we can't statically verify. Apply them unconditionally — they're cheap and the failure mode if the assumption holds is zero.

## Files touched

- `apps/web/app/api/webhooks/resend/route.ts` (B16)
- `apps/web/app/api/cli/auth/poll/route.ts` (B17)
- Tests: `webhooks/resend/route.test.ts`, `cli/auth/poll/route.test.ts`

## TDD — Red tests first

```ts
// webhooks/resend/route.test.ts
describe("POST /api/webhooks/resend — emailId format guard (B16)", () => {
  const EMAIL_ID_RE = /^[a-f0-9-]{8,64}$/i;
  it("rejects payload whose emailId fails the format guard", async () => {
    const body = validWebhookBody({emailId: "../../etc/passwd"});
    const res = await POST(mockReqWithSig(body));
    expect(res.status).toBe(400);
  });
  it("passes valid emailIds through to the fetch-by-id helper", async () => {
    const body = validWebhookBody({emailId: "12345678-abcd-4ef0-1234-567890abcdef"});
    const spy = vi.spyOn(resend.emails, "get");
    await POST(mockReqWithSig(body));
    expect(spy).toHaveBeenCalledWith("12345678-abcd-4ef0-1234-567890abcdef");
  });
});

// cli/auth/poll/route.test.ts
describe("GET /api/cli/auth/poll — brute-force rate limit (B17)", () => {
  it("rate-limits to 120 polls per sessionId per 5 minutes", async () => {
    const sid = "uuid-v4-value";
    for (let i=0; i<120; i++) await GET(mockReq({sessionId: sid}));
    const res = await GET(mockReq({sessionId: sid}));
    expect(res.status).toBe(429);
  });
  it("rate-limits per IP to 600/IP/5min (blanket cap)", async () => {
    for (let i=0; i<600; i++) await GET(mockReq({sessionId: `sid-${i}`}, {ip: "1.2.3.4"}));
    const res = await GET(mockReq({sessionId: "sid-fresh"}, {ip: "1.2.3.4"}));
    expect(res.status).toBe(429);
  });
});
```

## Green — implementation pseudocode

```ts
// webhooks/resend/route.ts
const EMAIL_ID_RE = /^[a-f0-9-]{8,64}$/i;
// ... existing HMAC verification ...
const emailId = event.data.email_id;
if (typeof emailId !== "string" || !EMAIL_ID_RE.test(emailId)) {
  return NextResponse.json({ error: "Invalid email_id format" }, { status: 400 });
}
// ... existing fetch-by-id + downstream processing ...
```

```ts
// cli/auth/poll/route.ts
// Two-tier rate limit: per-sessionId (1 poll every 2.5s avg) + per-IP blanket
const sessionRl = await rateLimit(`ratelimit:cli-poll-session:${sessionId}`, 120, 300);
if (!sessionRl.allowed) return NextResponse.json({error:"poll_rate_exceeded"}, {status:429, headers:{"Retry-After":"30"}});

const ip = getClientIp(request);
const ipRl = await rateLimit(`ratelimit:cli-poll-ip:${ip}`, 600, 300);
if (!ipRl.allowed) return NextResponse.json({error:"poll_rate_exceeded"}, {status:429, headers:{"Retry-After":"60"}});

// ... existing poll logic ...
```

## Automated success criteria

- New tests green.
- Existing webhook HMAC signature tests and poll happy-path tests still green.
- `pnpm run typecheck` clean.

## Manual success criteria

- Send a Resend webhook with a malformed `email_id` (e.g., via `curl` with a valid HMAC over a crafted body) — returns 400.
- Run `chapa login` CLI flow → poll rate fits within the limit; legitimate usage unaffected.

## Notes

- The per-sessionId rate of 120/5min = 1 poll every 2.5 s average, well above the CLI's typical 2-s polling cadence.
- The per-IP blanket protects against an attacker issuing fresh `sessionId`s to evade the per-session limit.
- If runtime telemetry later shows the IP tier being hit by legitimate shared-network users (office, CI), bump the cap — this is a reversible decision.
