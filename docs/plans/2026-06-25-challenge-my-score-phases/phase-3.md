# Phase 3 — API Route

**Depends on:** Phase 2 (imports `sendChallengeEmail`)

**Goal:** Create `POST /api/challenge` — authenticated, rate-limited, validates the submitted concern, sends a support email.

**New files:**
- `apps/web/app/api/challenge/route.ts`
- `apps/web/app/api/challenge/route.test.ts`

**Files read (no change):**
- `apps/web/app/api/supplemental/route.ts` (convention reference)
- `apps/web/lib/cache/redis.ts` (`rateLimit`, `RateLimitResult`)
- `apps/web/lib/http/client-ip.ts` (`getClientIp`, `NO_TRUSTED_IP`)
- `apps/web/lib/auth/require-session.ts` (`requireSession`)
- `apps/web/lib/analytics/server-errors.ts` (`withErrorCapture`)
- `apps/web/lib/validation.ts` (`isValidHandle`)

---

## Rate Limit Design

Two-tier, same pattern as `/api/supplemental`:

| Tier | Key | Limit | Window | When |
|------|-----|-------|--------|------|
| IP | `ratelimit:challenge-ip:<ip>` | 5 | 1h (3600s) | Before auth |
| Per-handle | `ratelimit:challenge:<handle>` | 3 | 24h (86400s) | After auth + ownership |

The per-handle limit (3/24h) is intentionally low — this is a support contact form, not a high-frequency API. Fail-open behavior for Redis-down is inherited from `rateLimit()`.

---

## Body Shape

```ts
interface ChallengeBody {
  handle: string;   // GitHub handle being challenged
  reason: string;   // Free-text concern (20–1000 chars)
}

const MAX_CHALLENGE_BYTES = 4 * 1024; // 4 KB
const MIN_REASON_LENGTH = 20;
const MAX_REASON_LENGTH = 1000;
```

---

## Red — Failing Tests

Write `route.test.ts` first:

```ts
// apps/web/app/api/challenge/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: vi.fn(),
}));
vi.mock("@/lib/cache/redis", () => ({
  rateLimit: vi.fn(async () => ({ allowed: true, current: 1, limit: 10 })),
}));
vi.mock("@/lib/http/client-ip", () => ({
  getClientIp: vi.fn(() => "1.2.3.4"),
  NO_TRUSTED_IP: "no-ip",
}));
vi.mock("@/lib/email/challenge", () => ({
  sendChallengeEmail: vi.fn(async () => ({ success: true })),
}));
vi.mock("@/lib/validation", () => ({
  isValidHandle: vi.fn(() => true),
}));

import { requireSession } from "@/lib/auth/require-session";
import { rateLimit } from "@/lib/cache/redis";
import { sendChallengeEmail } from "@/lib/email/challenge";

function makeRequest(body: unknown, sessionLogin = "octocat") {
  vi.mocked(requireSession).mockResolvedValue({
    session: { login: sessionLogin, name: "Octocat", avatar_url: "" },
    error: null,
  } as never);
  return new NextRequest("http://localhost/api/challenge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/challenge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rateLimit).mockResolvedValue({ allowed: true, current: 1, limit: 10 });
    vi.mocked(sendChallengeEmail).mockResolvedValue({ success: true });
  });

  it("returns 401 when no session", async () => {
    vi.mocked(requireSession).mockResolvedValue({
      session: null,
      error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    } as never);
    const req = new NextRequest("http://localhost/api/challenge", {
      method: "POST",
      body: JSON.stringify({ handle: "octocat", reason: "My score seems off." }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 429 when IP rate limit exceeded", async () => {
    vi.mocked(requireSession).mockResolvedValue({
      session: { login: "octocat", name: "Octocat", avatar_url: "" },
      error: null,
    } as never);
    vi.mocked(rateLimit).mockResolvedValue({ allowed: false, current: 6, limit: 5 });
    const req = makeRequest({ handle: "octocat", reason: "My score seems off." });
    const res = await POST(req);
    expect(res.status).toBe(429);
  });

  it("returns 400 when handle is missing", async () => {
    const req = makeRequest({ reason: "My score seems off to me and I want to know why." });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/handle/i);
  });

  it("returns 400 when reason is too short", async () => {
    const req = makeRequest({ handle: "octocat", reason: "Too short" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/reason/i);
  });

  it("returns 400 when reason exceeds 1000 chars", async () => {
    const req = makeRequest({ handle: "octocat", reason: "a".repeat(1001) });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 403 when session handle does not match body handle", async () => {
    const req = makeRequest({ handle: "someone-else", reason: "My score seems off and I cannot understand why it is this low." }, "octocat");
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 429 when per-handle limit exceeded", async () => {
    vi.mocked(rateLimit)
      .mockResolvedValueOnce({ allowed: true, current: 1, limit: 5 })  // IP limit passes
      .mockResolvedValueOnce({ allowed: false, current: 4, limit: 3 }); // handle limit hit
    const req = makeRequest({
      handle: "octocat",
      reason: "My delivery score seems off because all my PRs were merged in March.",
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
  });

  it("returns 200 { success: true } on valid submission", async () => {
    const req = makeRequest({
      handle: "octocat",
      reason: "My delivery score seems off because all my PRs were merged in March.",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });
    expect(sendChallengeEmail).toHaveBeenCalledWith(
      "octocat",
      "My delivery score seems off because all my PRs were merged in March.",
    );
  });

  it("returns 200 { success: true } even when email send fails (graceful degrade)", async () => {
    vi.mocked(sendChallengeEmail).mockResolvedValue({ success: false });
    const req = makeRequest({
      handle: "octocat",
      reason: "My delivery score seems off because all my PRs were merged in March.",
    });
    const res = await POST(req);
    // Email failure is silently logged — don't surface as an error to the user
    // (same pattern as notifyFirstBadge — fire and forget for non-critical notifications)
    expect(res.status).toBe(200);
  });
});
```

**Note on the last test:** Whether email failure returns 200 or 500 is a product decision. The plan treats it as 200 (same fire-and-forget philosophy as `notifyFirstBadge`) so users are not left confused when Resend is temporarily down. The email failure is logged server-side. This keeps UX predictable: once validation passes, the user sees success.

---

## Green — Implementation

```ts
// apps/web/app/api/challenge/route.ts

import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { rateLimit } from "@/lib/cache/redis";
import { getClientIp, NO_TRUSTED_IP } from "@/lib/http/client-ip";
import { isValidHandle } from "@/lib/validation";
import { sendChallengeEmail } from "@/lib/email/challenge";
import { withErrorCapture } from "@/lib/analytics/server-errors";

const MAX_CHALLENGE_BYTES = 4 * 1024;
const MIN_REASON_LENGTH = 20;
const MAX_REASON_LENGTH = 1000;

export const POST = withErrorCapture("/api/challenge", async (request: NextRequest) => {
  // 1. Auth first — require session cookie
  const { session, error } = await requireSession(request);
  if (error) return error;

  // 2. IP rate limit — before body parse
  const ip = getClientIp(request);
  const ipKey = ip === NO_TRUSTED_IP
    ? "ratelimit:challenge-ip:no-ip"
    : `ratelimit:challenge-ip:${ip}`;
  const ipRl = await rateLimit(ipKey, 5, 3600);
  if (!ipRl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  }

  // 3. Parse body with size cap
  let body: { handle?: unknown; reason?: unknown };
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).length > MAX_CHALLENGE_BYTES) {
      return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
    }
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { handle, reason } = body;

  // 4. Field presence
  if (!handle || typeof handle !== "string") {
    return NextResponse.json({ error: "Missing required field: handle" }, { status: 400 });
  }
  if (!reason || typeof reason !== "string") {
    return NextResponse.json({ error: "Missing required field: reason" }, { status: 400 });
  }

  // 5. Field validation
  if (!isValidHandle(handle)) {
    return NextResponse.json({ error: "Invalid handle" }, { status: 400 });
  }
  const trimmedReason = reason.trim();
  if (trimmedReason.length < MIN_REASON_LENGTH) {
    return NextResponse.json(
      { error: `reason must be at least ${MIN_REASON_LENGTH} characters` },
      { status: 400 },
    );
  }
  if (trimmedReason.length > MAX_REASON_LENGTH) {
    return NextResponse.json(
      { error: `reason must be under ${MAX_REASON_LENGTH} characters` },
      { status: 400 },
    );
  }

  // 6. Ownership check — session must match the challenged handle
  if (session.login.toLowerCase() !== handle.toLowerCase()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // 7. Per-handle rate limit (after ownership verified — key is on authenticated handle)
  const handleRl = await rateLimit(`ratelimit:challenge:${handle.toLowerCase()}`, 3, 86400);
  if (!handleRl.allowed) {
    return NextResponse.json(
      { error: "Too many challenges submitted. Please try again tomorrow." },
      { status: 429, headers: { "Retry-After": "86400" } },
    );
  }

  // 8. Send email (fire-and-forget semantics: failures are logged, not surfaced)
  const { success } = await sendChallengeEmail(handle, trimmedReason);
  if (!success) {
    console.error(`[challenge] email send failed for handle=${handle}`);
  }

  return NextResponse.json({ success: true });
});
```

---

## Verification

```bash
pnpm run test apps/web/app/api/challenge/route.test.ts
pnpm run typecheck
pnpm run lint
```

All 9 tests must pass. No type errors. No lint violations (especially no `process.env` direct access).

---

## Implementation Status

- [x] Phase 3 implemented in worktree `/Users/juan/code/chapa-phase-1` on branch `implement/challenge-my-score-phase-1`
- [x] Red state confirmed: route test failed before `apps/web/app/api/challenge/route.ts` existed
- [x] `POST /api/challenge` added with session auth, IP and handle rate limits, 4 KB payload cap, handle validation, owner check, reason validation, and support email send
- [x] Additional cleanup coverage added for invalid handles, oversized payloads, and non-object JSON bodies
- [x] Plan-compliance review approved the full implementation
- [x] `/simplify` equivalent completed; object-body guard and shared validation constants applied
- [x] Verification passed: `pnpm run test apps/web/app/api/challenge/route.test.ts`
- [x] Verification passed: `pnpm run typecheck`
- [x] Verification passed: `pnpm run lint`
