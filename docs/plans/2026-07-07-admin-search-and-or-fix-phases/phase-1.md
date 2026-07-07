# Phase 1: Add failing real-Postgres contract test (RED)

**Batch-eligible:** No (first phase; establishes the failing test the fix must turn green).

## Goal

Prove the AND/OR combinator bug with a test that exercises the real `admin_users` Postgres view — not a mock — so the regression cannot silently reappear the way it did in commit `8b882cd8`.

## File to create

`apps/web/lib/db/admin-users.contract.test.ts`

## Pattern to follow

Mirror the seed/cleanup/service-client pattern already used in `apps/web/app/api/insights/route.contract.test.ts` (`seedUser`/`cleanupUser`/`getServiceClient` from `apps/web/test/contract/invoke.ts`), but seed directly via the service client since we need control over `display_name` (the existing `seedUser(handle)` helper only sets `handle`).

## Pseudocode

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getServiceClient } from "@/test/contract/invoke";
import { dbGetAdminUsers } from "./admin-users";

const HANDLE_ONLY = "contract-search-handle-only";   // matches search by handle; display_name left NULL
const NAME_ONLY_HANDLE = "contract-search-name-only"; // handle does NOT contain the search term
const NAME_ONLY_DISPLAY_NAME = "Zzyxq Distinctive Name"; // matches search by display_name only
const SEARCH_TERM_FOR_NAME = "Zzyxq";
const NO_MATCH_TERM = "no-such-user-xyz123";

describe("dbGetAdminUsers search filter (contract)", () => {
  beforeAll(async () => {
    const db = getServiceClient();
    const { error: e1 } = await db.from("users")
      .upsert({ handle: HANDLE_ONLY, display_name: null }, { onConflict: "handle" });
    expect(e1).toBeNull();

    const { error: e2 } = await db.from("users")
      .upsert({ handle: NAME_ONLY_HANDLE, display_name: NAME_ONLY_DISPLAY_NAME }, { onConflict: "handle" });
    expect(e2).toBeNull();
  });

  afterAll(async () => {
    const db = getServiceClient();
    await db.from("users").delete().in("handle", [HANDLE_ONLY, NAME_ONLY_HANDLE]);
  });

  it("finds a user by handle even when display_name does not match (the reported bug)", async () => {
    const result = await dbGetAdminUsers({
      page: 1, limit: 25, sort: "handle", dir: "asc",
      search: HANDLE_ONLY,
    });
    expect(result.users.map(u => u.handle)).toContain(HANDLE_ONLY);
  });

  it("finds a user by display_name even when handle does not match (proves true OR, not just handle-first)", async () => {
    const result = await dbGetAdminUsers({
      page: 1, limit: 25, sort: "handle", dir: "asc",
      search: SEARCH_TERM_FOR_NAME,
    });
    expect(result.users.map(u => u.handle)).toContain(NAME_ONLY_HANDLE);
  });

  it("returns no results when the search term matches neither handle nor display_name", async () => {
    const result = await dbGetAdminUsers({
      page: 1, limit: 25, sort: "handle", dir: "asc",
      search: NO_MATCH_TERM,
    });
    expect(result.users.map(u => u.handle)).not.toContain(HANDLE_ONLY);
    expect(result.users.map(u => u.handle)).not.toContain(NAME_ONLY_HANDLE);
  });
});
```

Notes:
- `dbGetAdminUsers` is imported directly (not via the HTTP route) — the bug is entirely in query construction, and the route layer (`apps/web/app/api/admin/users/route.ts`) adds only auth/rate-limit/parsing that isn't relevant here.
- Use distinctive, namespaced handles/strings (`contract-search-*`, `Zzyxq...`) so this test can never collide with real seeded data or other contract tests' fixtures (per the repo's documented "seed-count coupling" gotcha in the reliability playbook).
- No `metrics_snapshots` row is needed — `admin_users` is a `LEFT JOIN`, so a user with no snapshot still appears with null metric columns.

## Automated success criteria

- `pnpm run test:contract -- admin-users.contract` run locally against `supabase start` fails on the first two `it` blocks (RED) against the current buggy `.ilike().ilike()` code — confirming the test actually reproduces the bug before any fix is applied.
- The third `it` block (no-match case) passes even on current buggy code (sanity check that the harness/seed/cleanup itself works).

## Manual success criteria

None — this phase only adds a test; no user-facing behavior changes yet.
