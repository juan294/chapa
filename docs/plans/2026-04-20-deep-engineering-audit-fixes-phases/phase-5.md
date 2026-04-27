# Phase 5 — Admin hardening

**Source findings:** §3.5, B14, B15
**Depends on:** none
**Batch:** [batch-eligible]

## Goal

Reduce blast radius on three admin/cron endpoints whose current shapes are large, unbounded, or leak internals, without changing their auth model (admin session + `ADMIN_SECRET` bearer are both preserved).

## Files touched

- `apps/web/app/api/admin/bulk-recalculate/route.ts`
- `apps/web/app/api/admin/campaigns/[id]/test/route.ts`
- `apps/web/app/api/admin/agents/run/route.ts`
- `apps/web/app/api/cron/warm-cache/route.ts`
- `apps/web/app/api/health/route.ts`
- Tests: one `.test.ts` per route

## TDD — Red tests first

```ts
// bulk-recalculate/route.test.ts
describe("POST /api/admin/bulk-recalculate", () => {
  const MAX_INLINE = 100;
  it("rejects payloads with handles.length > 100 (413)", async () => {
    const res = await POST(mockReq({handles: Array(101).fill("x")}, {admin: true}));
    expect(res.status).toBe(413);
  });
  it("processes up to 100 handles inline and returns completed list", async () => { /* ... */ });
  it("aborts cleanly at 250s elapsed (returns 202 + partial)", async () => {
    vi.useFakeTimers();
    // simulate long per-handle work
    const promise = POST(mockReq({handles: Array(100).fill("x")}, {admin: true}));
    vi.advanceTimersByTime(251_000);
    const res = await promise;
    expect(res.status).toBe(202);
    expect(await res.json()).toMatchObject({ partial: true });
  });
});

// campaigns/[id]/test/route.test.ts
describe("POST /api/admin/campaigns/:id/test", () => {
  it("rate-limits test emails to 5/admin/60s", async () => {
    for (let i=0; i<5; i++) await POST(mockReq(body, {admin: true}));
    const res = await POST(mockReq(body, {admin: true}));
    expect(res.status).toBe(429);
  });
  it("rate-limits duplicate recipient to 1/recipient/300s", async () => {
    await POST(mockReq({to: "a@b.c"}, {admin: true}));
    const res = await POST(mockReq({to: "a@b.c"}, {admin: true}));
    expect(res.status).toBe(429);
  });
});

// agents/run/route.test.ts
describe("POST /api/admin/agents/run", () => {
  it("rejects agentKey not in the closed AGENTS allowlist", async () => {
    const res = await POST(mockReq({agentKey: "../../etc/passwd"}, {admin: true}));
    expect(res.status).toBe(400);
  });
  it("asserts AGENTS keys match /^[a-z0-9-]+$/ at module load (defense-in-depth)", () => {
    for (const key of Object.keys(AGENTS)) expect(key).toMatch(/^[a-z0-9-]+$/);
  });
});

// cron/warm-cache/route.test.ts
describe("GET /api/cron/warm-cache response shape", () => {
  it("returns { count, sample: string[<=10] } instead of full processedHandles list", async () => {
    const res = await GET(mockReq({cronSecret: ok}));
    const body = await res.json();
    expect(body).toHaveProperty("processedCount");
    expect(body.processedSample).toHaveLength(Math.min(body.processedCount, 10));
    expect(body).not.toHaveProperty("processedHandles");
  });
});

// health/route.test.ts
describe("GET /api/health", () => {
  it("redacts githubRateLimit details for unauthenticated callers", async () => {
    const res = await GET(mockReq());
    const body = await res.json();
    expect(body).not.toHaveProperty("githubRateLimit");
  });
  it("includes githubRateLimit details for admin session", async () => {
    const res = await GET(mockReq({admin: true}));
    const body = await res.json();
    expect(body.githubRateLimit).toBeDefined();
  });
});
```

## Green — implementation pseudocode

```ts
// bulk-recalculate: cap + timeout
const MAX_INLINE_HANDLES = 100;
const INLINE_DEADLINE_MS = 250_000;

if (handles.length > MAX_INLINE_HANDLES) {
  return NextResponse.json(
    { error: `Payload too large. Max ${MAX_INLINE_HANDLES} handles per call.` },
    { status: 413 }
  );
}
const deadline = Date.now() + INLINE_DEADLINE_MS;
const completed: string[] = [];
for (const batch of chunk(handles, 5)) {
  if (Date.now() >= deadline) {
    return NextResponse.json({ partial: true, completed, pending: handles.slice(completed.length) }, { status: 202 });
  }
  await Promise.all(batch.map(h => recalculateHandle(h)));
  completed.push(...batch);
}
return NextResponse.json({ partial: false, completed });
```

```ts
// campaigns test: two rate-limit tiers
const adminKey = session.login;
const adminRl = await rateLimit(`ratelimit:campaign-test:${adminKey}`, 5, 60);
if (!adminRl.allowed) return /* 429 */;
const recipientRl = await rateLimit(`ratelimit:campaign-test-recipient:${to}`, 1, 300);
if (!recipientRl.allowed) return /* 429 */;
```

```ts
// agents/run: module-load invariant
const AGENT_KEY_RE = /^[a-z0-9-]+$/;
for (const key of Object.keys(AGENTS)) {
  if (!AGENT_KEY_RE.test(key)) throw new Error(`Invalid AGENTS key at module load: ${key}`);
}
// handler also rejects unknown keys (existing) — this is defense-in-depth
```

```ts
// warm-cache response trim
return NextResponse.json({
  processedCount: processed.length,
  processedSample: processed.slice(0, 10),
  // processedHandles: processed,  ← REMOVED
  skipped: skipped.length,
  errors: errors.length,
});
```

```ts
// health route — gate GH rate-limit on admin
const isAdmin = await isAdminRequest(request);  // reuse lib/auth/admin.ts
const body = { status, services: {...} };
if (isAdmin) body.githubRateLimit = githubRateLimit;
return NextResponse.json(body);
```

## Automated success criteria

- All new tests (5 route test files) green.
- Existing admin tests still green.
- `pnpm run typecheck` clean.

## Manual success criteria

- `/api/cron/warm-cache` still runs on schedule (Vercel logs confirm) — response is now small.
- `/admin` dashboard still loads and its "Bulk recalculate" UI still works for ≤ 100 handles.
- Unauth `curl /api/health` returns status info but NO `githubRateLimit` block.

## Notes

- We do not switch `bulk-recalculate` to a queue in this plan (per research §9 Q5). Capping at 100 + timeout-guard is the minimum viable hardening; a queue-backed mode is tracked as a follow-up.
- The `agents/run` invariant is a belt-and-braces check; the actual exploit requires `ALLOW_AGENT_RUN=true` (already off by default).

## Status

- [x] Implemented on 2026-04-22
- [x] Verified with `pnpm run typecheck`, `pnpm run lint`, and `pnpm run test`
- [x] Applied with the agreed option-1 interpretation: `agents/run` validates the existing underscore-based `AGENTS` allowlist shape rather than introducing a broader agent-key migration
