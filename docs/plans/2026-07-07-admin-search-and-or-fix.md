# Plan: Fix admin dashboard search returning 0 results (AND/OR combinator bug)

**Date:** 2026-07-07
**Research doc:** `docs/research/2026-07-07-admin-search-returns-zero-results.md`
**Branch:** `fix/admin-search-and-or-bug` (worktree: `../chapa-admin-search-fix`, per `CLAUDE.local.md` worktree-first rule)

## Problem

Searching the admin users table (`/admin`) for an existing handle (e.g. `ganga90`) returns "0 results" even though the user is present in the unfiltered table.

## Root cause

`apps/web/lib/db/admin-users.ts:212-215`:

```ts
if (query.search?.trim()) {
  const term = escapeIlike(query.search.trim());
  q = q.ilike("handle", `%${term}%`).ilike("display_name", `%${term}%`);
}
```

Chaining two `.ilike()` calls on the same Supabase/PostgREST query builder combines them with **AND**. The intent (and the code comment directly above it) was OR — match handle *or* display name. Since `display_name` is a separate nullable column (a person's real name, not their GitHub handle), a search for a handle almost never also matches `display_name`, so the AND-combined row is excluded entirely.

This regressed in commit `8b882cd8` ("fix: [remediate] admin user search uses ILIKE for case-insensitive filtering (BE-H5)"), which replaced a working `.or("handle.ilike.%term%,display_name.ilike.%term%")` raw-string filter with the chained `.ilike()` calls, specifically to close a PostgREST predicate-injection risk in the old code (unescaped `,`/`.`/`(`/`)`/`%`/`_` interpolated into the `.or()` string). The security fix was necessary; the OR→AND side effect was not intended.

## Fix

Restore OR semantics via `.or()`, reusing the `escapeIlike()` sanitizer already written for this exact purpose (its doc comment literally says "interpolated into a PostgREST filter expression" — it was built for `.or()` and just never wired back into it):

```ts
if (query.search?.trim()) {
  const term = escapeIlike(query.search.trim());
  q = q.or(`handle.ilike.%${term}%,display_name.ilike.%${term}%`);
}
```

`escapeIlike` already strips PostgREST delimiter characters (`, . ( )` and whitespace) and escapes SQL wildcards (`\`, `%`, `_`) before this interpolation, so the injection protection from BE-H5 is fully preserved — only the combinator changes.

## Why a unit-mock fix alone is not enough (repo-specific)

`apps/web/lib/db/admin-users.test.ts` mocks the Supabase query builder so every `.ilike()`/`.or()` call just records its arguments (`chainBuilder()`, `admin-users.test.ts:14-40`) and returns the same chain — it has no notion of AND vs. OR. That's exactly how this bug shipped invisibly: the BE-H5 commit changed the combinator while keeping individual call arguments plausible, and the existing tests (`admin-users.test.ts:179,188,198,207`) only assert call arguments.

Per this repo's documented Seam-Bug Standard (`.claude/rules/testing.md`, `docs/playbooks/reliability-hardening-playbook.md:84-87`): "a unit-mock reproduction of a seam bug is not a valid regression test — it passes whether or not the bug is fixed." The repo already has real-Postgres contract-test infrastructure for exactly this class of bug (`pnpm run test:contract`, CI job `contract` in `.github/workflows/ci.yml`, running against `supabase start`). There is currently no contract test for `admin_users`/`dbGetAdminUsers`. This plan adds one.

`check:write-registration` does not apply here — it's a static linter that only requires contract-test registration for *write* endpoints (`POST`/`PUT`/`PATCH`/`DELETE` and mutating `GET`s); `GET /api/admin/users` is a pure read endpoint, so it's out of scope for that gate. The new contract test is added on its own merit (seam-bug regression coverage), not because the registration gate requires it.

## Design decisions

1. **Test target: `dbGetAdminUsers()` directly, not the full `/api/admin/users` route.** The bug lives entirely in query construction inside `apps/web/lib/db/admin-users.ts`; the route (`apps/web/app/api/admin/users/route.ts`) only does auth/rate-limit/param-parsing pass-through with no logic relevant to this bug. Testing the DB function directly avoids unrelated auth/rate-limit setup noise in the contract test while still hitting the real `admin_users` Postgres view — same principle as the existing `insights`/`supplemental` contract tests, which use `getServiceClient()` for the persistence re-read, just applied to the function under test rather than only the assertion.
2. **Two seeded fixture rows, not one.** One row matches only on `handle` (no `display_name` set — reproduces the reported bug exactly), one matches only on `display_name` (unrelated handle) — this proves true OR semantics, not just "the handle branch happens to work." A third case (search term matching neither) confirms the filter still filters and doesn't regress into "return everything."
3. **Retarget, don't duplicate, the existing BE-H5 escaping unit tests.** `admin-users.test.ts:179,188,198,207` currently assert against `mockIlike`. After the fix, the code calls `.or()` once instead of `.ilike()` twice, so these assertions must be updated to assert against `mockOr` with the fully-interpolated, escaped filter string. This keeps the existing (valuable, cheap) coverage of `escapeIlike()`'s call-shape without deleting it — the mock is fine for "was the sanitizer applied correctly to the string," just not for "does the combinator behave as OR," which is now the contract test's job.
4. **No production-facing scope creep.** The pre-existing behavior of `escapeIlike` stripping all whitespace from the search term (so a multi-word display-name search like "Juan Gonzalez" is searched as "JuanGonzalez") is unrelated to this bug and is left untouched.

## Phases

| Phase | Summary | Batch-eligible? |
|---|---|---|
| [1](2026-07-07-admin-search-and-or-fix-phases/phase-1.md) | Add failing real-Postgres contract test reproducing the bug (RED) | No — first phase |
| [2](2026-07-07-admin-search-and-or-fix-phases/phase-2.md) | Apply the `.or()` fix; retarget existing mock unit tests to the new call shape (GREEN) | No — depends on Phase 1's test existing |
| [3](2026-07-07-admin-search-and-or-fix-phases/phase-3.md) | Full verification: typecheck/lint/unit/contract tests + manual admin UI confirmation | No — depends on Phase 2's fix |

All three phases touch the same two files (`admin-users.ts`, `admin-users.test.ts`) plus one new file, and each depends on the previous phase's output (TDD red→green→verify), so none are parallelizable — this is a small, strictly sequential bug fix, not a candidate for `/batch`.

## Out of scope

- Fixing `escapeIlike`'s whitespace-stripping behavior for multi-word display-name searches (pre-existing, unrelated to this bug).
- Building a shared PG-error classifier or any other reliability-playbook Phase 2+ work — not relevant to this specific fix.
- Any change to `/api/admin/users/route.ts` — it has no bug; it passes `search` through unchanged.
