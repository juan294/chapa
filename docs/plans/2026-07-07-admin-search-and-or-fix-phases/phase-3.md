# Phase 3: Full verification

**Batch-eligible:** No (depends on Phase 2's fix being in place).

## Goal

Confirm the fix is complete, doesn't regress anything else, and actually resolves the reported symptom in the running app.

## Steps

Run sequentially (per `.claude/rules/testing.md` verification sequencing — never as parallel Bash calls):

```bash
pnpm run typecheck
pnpm run lint
pnpm run test
```

Then, against a local Supabase instance:

```bash
supabase start
pnpm run test:contract
```

If a local Supabase project isn't already running, `supabase start` requires Docker Desktop (per `.claude/skills/supabase` migration-testing convention already documented in this repo) — start it, run the contract suite, and stop it afterward if it wasn't already running for other work.

## Manual verification (the actual reported bug)

1. Run `pnpm run dev` and open `/admin` locally (or use the already-running dev server if the user has one).
2. Log in as an admin handle (per `ADMIN_HANDLES`) and search the admin users table for a handle known to exist with no matching display name (e.g. reproduce with any seeded/real handle such as `ganga90` if present in the connected environment's data, or any handle visible in the unfiltered table).
3. Confirm the row now appears in the filtered results (previously: "0 results" / "No users match your search").
4. Sanity-check the OR is not overly permissive: search a term that matches neither any handle nor any display name and confirm it still correctly returns 0 results.
5. Sanity-check case-insensitivity still works (e.g. searching `GANGA90` or `Ganga90` should still match) — this was the original BE-H5 motivation and must not regress.

## Automated success criteria

- `pnpm run typecheck` — no errors.
- `pnpm run lint` — no errors.
- `pnpm run test` — full suite green, including the four retargeted tests in `admin-users.test.ts`.
- `pnpm run test:contract` — full suite green, including the three new tests in `admin-users.contract.test.ts`.

## Manual success criteria

- Admin dashboard search for an existing handle with a non-matching (or null) display name returns that user.
- Search for a genuinely non-matching term still returns 0 results (filter isn't now a no-op).
- Case-insensitive matching still works.

## Follow-up (not part of this fix, note only)

Per this repo's mandatory GitHub Issues workflow (`CLAUDE.local.md`), file/close the originating issue for this bug (`type: bug`, `area: infra` or `area: ux`, referencing this bug in the commit via `Fixes #N`) if one doesn't already exist for this session's report.
