# Phase 3 — Telemetry hardening (keep unauth, add `verified=false`)

**Source findings:** §3.1
**Depends on:** none
**Batch:** [batch-eligible]
**Policy:** Q2a — `/api/telemetry` stays unauthenticated because `chapa-cli/src/telemetry.ts` depends on it.

## Status

- [x] Implemented on 2026-04-22
- [x] Verified with `pnpm run typecheck`, `pnpm run lint`, and `pnpm run test`

## Goal

Keep the endpoint open so the CLI keeps working, but make the trust story explicit: every row is flagged `verified=false` until the CLI presents a token, rate-limits are tightened, and the route logs the DB outcome instead of silently dropping it.

## Files touched

- `apps/web/app/api/telemetry/route.ts`
- `apps/web/lib/db/telemetry.ts`
- `supabase/migrations/YYYYMMDDHHMMSS_merge_operations_verified.sql` (new)
- Tests: `telemetry/route.test.ts`, `db/telemetry.test.ts`

## TDD — Red tests first

```ts
// telemetry/route.test.ts
describe("POST /api/telemetry", () => {
  it("accepts valid CLI payload without auth and returns { ok: true }", async () => {
    const res = await POST(mockReq(validPayload));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
  it("enforces a new daily IP ceiling (600/IP/day)", async () => {
    // Hit 601 times from same IP; 601st returns 429
    for (let i=0; i<600; i++) await POST(mockReq(validPayload, {ip: "1.2.3.4"}));
    const res = await POST(mockReq(validPayload, {ip: "1.2.3.4"}));
    expect(res.status).toBe(429);
  });
  it("passes verified=false to dbInsertTelemetry", async () => {
    const spy = vi.spyOn(db, "dbInsertTelemetry");
    await POST(mockReq(validPayload));
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ verified: false }));
  });
  it("logs db insert failure but still returns 200", async () => {
    vi.spyOn(db, "dbInsertTelemetry").mockResolvedValue(false);
    const logSpy = vi.spyOn(console, "error");
    const res = await POST(mockReq(validPayload));
    expect(res.status).toBe(200);
    expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/telemetry insert/));
  });
});

// db/telemetry.test.ts
describe("dbInsertTelemetry", () => {
  it("persists verified column when provided", async () => {
    const spy = vi.spyOn(supabase.from("merge_operations"), "insert");
    await dbInsertTelemetry({...payload, verified: false});
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ verified: false }));
  });
});
```

## Green — implementation pseudocode

```sql
-- migration
ALTER TABLE merge_operations
  ADD COLUMN verified boolean NOT NULL DEFAULT false;
CREATE INDEX idx_merge_operations_verified
  ON merge_operations(target_handle, verified, created_at DESC);
```

```ts
// lib/db/telemetry.ts
export interface TelemetryPayload {
  // ...existing fields...
  verified: boolean;   // NEW — required
}

export async function dbInsertTelemetry(payload: TelemetryPayload): Promise<boolean> {
  // insert also sets `verified: payload.verified`
}
```

```ts
// app/api/telemetry/route.ts — add third rate-limit tier + track DB outcome
const ipDailyRl = await rateLimit(`ratelimit:telemetry-ip-day:${clientIp}`, 600, 86400);
if (!ipDailyRl.allowed) return NextResponse.json({error:"Too many requests"}, {status:429, headers:{"Retry-After":"3600"}});

// ... existing per-60s limits stay ...

const verified = false;  // Future: flip true when CLI bearer is presented
void dbInsertTelemetry({...payload, verified}).then(ok => {
  if (!ok) console.error("[telemetry] insert failed", { handle: payload.targetHandle });
});

return NextResponse.json({ ok: true });
```

## Automated success criteria

- New route tests green (4 tests).
- New DB tests green (1 test).
- `pnpm run typecheck` clean with `verified: boolean` required on `TelemetryPayload`.
- Migration file valid (runs in CI against a throwaway Supabase instance if available; else `supabase migration up` dry-run).

## Manual success criteria

- Run `chapa` CLI locally → POST succeeds → new row in `merge_operations` has `verified=false`.
- Re-run 601 times from a single IP (loop) — confirm 429 on the 601st.
- Confirm `docs/accepted-risks.md` is *not* modified (the trust model of this endpoint is now documented in the route comment header instead).

## Notes

- The 600/day IP ceiling is a reasoned cap: CLI is expected to emit ~1 telemetry/merge, and even a heavy user merges < 600/day. Tune if CLI telemetry logs show real users being limited.
- A follow-up (out of this plan) can flip `verified=true` when the CLI starts passing its existing bearer token. For this phase we only prepare the column.
