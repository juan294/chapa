# Research: `@supabase/supabase-js` Bundle Weight and Client/Server Boundary

**Date:** 2026-06-20
**Refs:** Refs #775 (PE-L1)
**Status:** Investigation complete — recommendation: **keep as-is** (server-only, not in any client bundle)

## Question

`@supabase/supabase-js` is the Postgres access library used throughout
`apps/web/lib/db/*`. It is a relatively heavy dependency (the client bundles
PostgREST, GoTrue/auth, Realtime, Storage, and Functions sub-clients). The concern
(#775): **does it leak into any client bundle, inflating First Load JS?**

## Method

Evidence-based grep of the actual repo, not assumptions:

1. Find every file importing `@supabase/supabase-js`.
2. Find every `"use client"` component that imports anything from `lib/db`.
3. Check whether those imports are runtime imports (pull the client into the
   bundle) or type-only imports (erased at compile time).
4. Confirm the client module's server-only guard.

## Findings

### 1. Only three files import `@supabase/supabase-js`

```
apps/web/lib/db/supabase.ts            ← the singleton client factory
apps/web/lib/db/supabase.test.ts       ← test (not shipped)
apps/web/scripts/backfill-craft-scores.ts  ← standalone script (not in the app bundle)
```

The runtime import is centralized in exactly **one** module:
`apps/web/lib/db/supabase.ts`.

### 2. That module is hard-guarded `server-only`

`apps/web/lib/db/supabase.ts` begins with:

```ts
import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
```

The `server-only` package throws a build-time error if the module is ever pulled
into a client bundle. So even an accidental client import would **fail the build**
rather than silently ship `supabase-js` to the browser. It also reads only
server-side env (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` via `lib/env`), which
are never `NEXT_PUBLIC_*`.

### 3. The `"use client"` components that touch `lib/db` import **types only**

Three client-side files reference `lib/db`:

```
apps/web/app/admin/engagement/engagement-dashboard.tsx   "use client"
apps/web/app/admin/campaigns/campaigns-dashboard.tsx     "use client"
apps/web/lib/agents/agent-config.ts                      (config, not a component)
```

Both client dashboards import the same thing:

```ts
import type { Campaign } from "@/lib/db/campaigns";
```

This is a **type-only import** (`import type`). TypeScript erases it during
compilation, so it adds **zero** runtime code and pulls in **nothing** from
`@supabase/supabase-js`. No `"use client"` component imports `getSupabase`,
`createClient`, or any runtime value from the db layer.

### 4. Conclusion: it does not ship to the client

`@supabase/supabase-js` is imported in exactly one server-only module, behind a
`server-only` guard, and every client-side reference to the db layer is type-only.
The library is tree-shaken out of every client bundle. This is consistent with the
accepted-risk note that no per-route "First Load JS" regression has appeared (the
largest client chunk is well under the 500 KB budget).

## Approximate Weight (for context)

`@supabase/supabase-js` (`^2.108.1`) is a meta-package that re-exports several
sub-clients (postgrest-js, gotrue-js, realtime-js, storage-js, functions-js). Its
full client footprint is on the order of ~100 KB+ minified before tree-shaking —
which is precisely why keeping it off the client bundle matters. On the **server**
(serverless function) side this weight is irrelevant to user-perceived
performance: it is part of the function bundle, not First Load JS, and Chapa only
uses the PostgREST query path (`.from(...).select/insert/...`), so the auth,
realtime, storage, and functions sub-clients are never exercised at runtime.

## Recommendation

**Keep `@supabase/supabase-js` as-is.** It is correctly isolated:

- One server-only import site (`lib/db/supabase.ts`), guarded by `server-only`.
- No client component imports the runtime client — only the `Campaign` type, via
  `import type`, which is erased.
- It does **not** appear in any client bundle and does not affect First Load JS.

No action required. There is no client-side leak to fix.

### If a future leak ever appears

If a refactor ever pulls the runtime client into a client component (the
`server-only` guard would catch this at build time), the remediation options, in
order of preference, would be:

1. **Move the data access back to a server component / route handler** and pass
   plain serializable data to the client — the standard App Router pattern. This
   is almost always the right fix and requires no dependency change.
2. **Swap to a lighter sub-client.** Chapa only uses the PostgREST query surface,
   so `@supabase/postgrest-js` alone (without the auth/realtime/storage/functions
   wrappers) would cover current usage at a fraction of the weight — but this is
   only worth doing if the meta-package ever needed to run client-side, which it
   does not today.
3. **Direct REST to the PostgREST endpoint** (hand-rolled `fetch`) — maximum
   weight savings, but loses typing/ergonomics; not justified given (1) keeps it
   off the client entirely.

These are contingency options only — none are needed under the current,
correctly-isolated architecture.
