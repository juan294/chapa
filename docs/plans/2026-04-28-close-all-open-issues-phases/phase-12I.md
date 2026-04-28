---
phase: 12I
release: v2.12.0
issues: ["#775", "#776"]
batch_eligible: true
depends_on: ["12A"]
effort: M
---

# Phase 12I — Strategic perf (`#775`, `#776`)

Two performance issues from the wave-3 strategic bucket. Implement `#775`,
write an ADR for `#776`.

## #775 — Supabase client 180KB

**File:** referenced in pre-launch report §14.

`@supabase/supabase-js` adds ~180KB to the bundle. It's currently imported
at the top of multiple route files. Most routes only need a small subset
of the client (e.g., `auth.getSession()` or `from("table").select()`).

Two options, prefer the first:

### Option A — Server-only Supabase

If Supabase is only used server-side (which it should be — `SUPABASE_SERVICE_ROLE_KEY`
is server-only), import it dynamically in every route handler so the client
bundle never ships it:

```ts
// apps/web/lib/db/supabase.ts
let cachedClient: SupabaseClient | null = null;

export async function getSupabase() {
  if (cachedClient) return cachedClient;
  const { createClient } = await import("@supabase/supabase-js");
  cachedClient = createClient(getSupabaseUrl(), getSupabaseServiceKey());
  return cachedClient;
}
```

Audit every `from "@supabase/supabase-js"` import. If any are in a
`"use client"` file or in a path that compiles to client output, move
the call to a server boundary (server action, route handler, or
Server Component prop drilling).

### Option B — Tree-shake-friendly import

Some Supabase entry points (`@supabase/auth-js`, `@supabase/postgrest-js`)
are smaller. If we genuinely need a client-side bit, import only the
exact submodule:

```ts
import { createClient } from "@supabase/postgrest-js";
```

But this loses RLS auth integration; only safe for read-only public data.

## #776 — Badge SVG string rendering is monolithic — ADR

**File:** `apps/web/lib/render/svg.ts` and the `BadgeContent` JSX template.

The badge SVG is currently rendered by stringifying a JSX tree once per
request. The result: every render re-runs the full template even though
~80% is structural and would cache.

Per user direction (option b for strategic deferred), write an ADR
documenting why we keep this approach for now.

### File: `docs/decisions/0004-badge-svg-monolithic-render.md`

```markdown
# ADR 0004 — Keep monolithic badge SVG rendering

Date: 2026-04-28
Status: Accepted
Issue: #776

## Context

`apps/web/lib/render/svg.ts` renders the entire badge as a single JSX-to-string
pipeline. There is no template caching, partial rendering, or precomputed
structural skeleton.

## Decision

We keep the monolithic approach. We do not introduce a template-caching
layer or a "shell + values" split.

## Rationale

- The SVG output is already cached at the route level (`Cache-Control:
  public, s-maxage=21600`). Most requests hit the CDN, not the server.
- The render itself is fast: O(tens of ms) per cold render. The cache
  layer absorbs the rest.
- Splitting the template would introduce subtle invalidation bugs —
  if a structural element depends on a value (e.g., archetype color
  depends on archetype) we'd need to invalidate the cached shell on
  archetype change.
- The current implementation is straightforward and has no observed
  perf complaints in production (Vercel function durations are well
  within budget).

## Triggers for revisiting

Reopen when ANY of:
- p95 cold-render time exceeds 500ms (current: ~50ms)
- Vercel function CPU costs become a measurable line item
- A new badge variant (e.g., 3D animated) genuinely requires the split
- We add user-customizable badge structure that re-renders frequently
  (today the structure is fixed)

## Alternatives considered

1. Template caching with value substitution — rejected: invalidation
   complexity outweighs the saved CPU
2. SSR streaming the SVG — rejected: SVG is small enough that streaming
   provides no perceptible improvement
3. WebAssembly badge renderer — rejected: huge complexity for a 50ms saving

## References

- Issue #776
- ADR 0001 (defer lib extraction)
```

## Files

- Modified: `apps/web/lib/db/supabase.ts` (#775)
- Modified: every `from "@supabase/supabase-js"` import that compiles
  to client output (#775)
- New: `docs/decisions/0004-badge-svg-monolithic-render.md` (#776)

## Acceptance criteria

### Automated
- [ ] `bundle-stats.json` shows route bundles drop by ~150KB on routes
      previously importing Supabase top-level (#775)
- [ ] `pnpm run test`, `pnpm run typecheck`, `pnpm run lint` pass
- [ ] ADR 0004 exists and is linked from #776

### Manual
- Vercel preview: open `/admin` (uses Supabase server-side) — still works
- Any client-side feature that previously assumed `@supabase/supabase-js`
  is in scope still functions

## Closing the issues

```bash
gh issue close 775 --comment "Fixed in <sha>. Supabase client moved to server-only dynamic import; client bundles drop by ~150KB on affected routes."
gh issue close 776 --comment "Resolved by docs/decisions/0004-badge-svg-monolithic-render.md. Fixed in <sha>."
```
