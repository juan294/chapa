# Migrations Runbook

## Overview

Supabase migrations live in `supabase/migrations/`. They are plain SQL files applied manually via the Supabase dashboard or CLI. There is no automatic migration runner — migrations are applied deliberately, not on every deploy.

`docs/release/release-playbook.md` is the sole release-ordering authority. This
runbook owns migration creation, validation, application, evidence, and schema
recovery detail. Reading migration state is not authorization to apply a
production migration.

## Naming Convention

All migration files must follow this pattern:

```
NNN_description.sql
```

- `NNN` — three-digit zero-padded sequential number (001, 002, ..., 020, 021...)
- `description` — lowercase, underscores only, no spaces
- Extension: `.sql`

**Examples:** `001_create_tables.sql`, `021_add_new_column.sql`

Validate the sequence before applying:

```bash
pnpm run validate:migrations
```

The script checks that all files follow the naming convention and that the sequence has no gaps or duplicates.

## Creating a New Migration

1. Determine the next number:
   ```bash
   ls supabase/migrations/ | tail -1
   # e.g. 020_add_partial_index_users_email.sql → next is 021
   ```
2. Create the file: `supabase/migrations/021_your_description.sql`
3. Write idempotent SQL where possible (use `IF NOT EXISTS`, `IF EXISTS`, `ON CONFLICT DO NOTHING`).
4. Run the validator: `pnpm run validate:migrations`

### Creating Indexes on Populated Tables (use `CONCURRENTLY`)

`CREATE INDEX` takes a lock that blocks writes to the table for the entire
build duration. On a table that already holds production rows (as opposed to
a brand-new table being created in the same migration), that lock can stall
every insert/update/delete against it until the index finishes building —
directly user-visible as request timeouts. `020_add_partial_index_users_email.sql`
and `021_add_merge_operations_verified.sql` are historical examples that
predate this guidance and were small enough not to cause a visible stall; they
are not being retrofitted, but **new** index-creation migrations on tables
with existing data should use:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_example ON example_table (column);
```

**Caveat: `CONCURRENTLY` cannot run inside a transaction block.** Check how
this project's migration tooling executes a `.sql` file before assuming this
just works — the Supabase CLI (`supabase db push` / `db execute`) and the
dashboard SQL Editor both run a migration file's statements together, and
Postgres will reject a `CREATE INDEX CONCURRENTLY` that appears alongside
other DDL in the same implicit transaction with `ERROR: CREATE INDEX
CONCURRENTLY cannot run inside a transaction block`. In practice this means:

- A migration file that creates a concurrent index should contain **only**
  that `CREATE INDEX CONCURRENTLY` statement (no other DDL in the same file),
  so the CLI/dashboard don't need to wrap it in a transaction with other work.
- If it fails partway through (e.g. connection drop, cancelled statement), it
  can leave behind an **`INVALID` index** — the index exists, consumes disk
  space, and is skipped by the planner, but does not report a build error
  until you look for it. Recovery:
  ```sql
  -- 1. Confirm it's invalid:
  SELECT indexrelid::regclass, indisvalid FROM pg_index WHERE indisvalid = false;
  -- 2. Drop the invalid index (also runs outside a transaction, and outside
  --    any other statement in the same file):
  DROP INDEX CONCURRENTLY IF EXISTS idx_example;
  -- 3. Re-run the original CREATE INDEX CONCURRENTLY statement.
  ```
- Don't confuse an `INVALID` index with a missing one — until it's dropped and
  recreated, it silently costs write overhead without ever being used for
  reads.

## Applying Migrations

Migrations are applied manually. There is no pre-deploy hook that runs them automatically.

### Via Supabase Dashboard

1. Open [app.supabase.com](https://app.supabase.com/) → select the Chapa project.
2. Navigate to **SQL Editor**.
3. Paste the contents of the migration file and run it.
4. Verify no errors in the output.

### Via Supabase CLI

```bash
# Requires supabase CLI installed and project linked
supabase db push
```

Or apply a specific file:

```bash
supabase db execute --file supabase/migrations/021_your_description.sql
```

## Before a Production Release

Follow this section when the release playbook calls for migration evidence.

1. Review any new migration files since the last release:
   ```bash
   git diff main..develop -- supabase/migrations/
   ```
2. Run the validator: `pnpm run validate:migrations`
3. If new migrations must be applied, stop for explicit production-operation
   authorization. Apply them before the code that depends on them goes live;
   never infer application authority from release preparation or analyzer PASS.
4. Verify with a quick health check: `curl https://chapa.thecreativetoken.com/api/health`

## Pre-Deploy Migration Check

Before merging the release PR (`develop → main`), run this check to confirm no migration has been forgotten:

```bash
# Show all migration files added since the last production release
git diff main..develop -- supabase/migrations/
```

If new `.sql` files appear in the diff:

1. **Verify they have been applied to the production Supabase project.** Open [app.supabase.com](https://app.supabase.com/) → select the Chapa project → navigate to **Database → Migrations** (or use the SQL Editor to query `schema_migrations`) and confirm each file's timestamp/name appears.
2. **Alternatively, use the CLI:** `supabase db diff --linked` should return no pending migrations. If it does, apply them first:
   ```bash
   supabase db push --linked
   ```
3. **Never merge the release PR if pending migrations exist.** Code that references schema objects not yet present in the production database will silently degrade or error.

### Automated CI Gate (#1011)

The manual steps above are backstopped by an automated check:
`scripts/check-pending-migrations.ts` (run via `pnpm run check:pending-migrations`)
wraps the same `supabase db diff --linked` command and fails (non-zero exit)
if the diff is non-empty. It is wired into CI as a step that only runs on pull
requests targeting `main` (i.e. the release PR itself), not on every push to
`develop` — see `.github/workflows/ci.yml`.

This step requires read-only Supabase Management API credentials
(`SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF`) configured as GitHub
Actions secrets. **Both secrets were added on 2026-08-10** (confirmed via
`gh secret list`), and the gate has run against production on at least one
release PR since (#1063 — see the "Pending-migrations gate tolerates one
migra artifact on `admin_users` (#1064)" entry in `docs/accepted-risks.md`).
It is active today, not self-skipping. If those secrets were ever removed or
rotated out from under CI, the workflow step would log a clear skip message
and degrade to the manual checklist below rather than silently reporting
success — but that is a fail-safe for an unexpected regression, not the
documented default. See `docs/runbooks/secret-rotation.md` conventions for
how secrets are managed in this repo, and confirm with `gh secret list` if
you have any doubt about current state before relying on it as the sole
gate.

For E2E Pro, that CI skip is recorded as `skipped`, not `passed`. The required
release obligation remains blocked until the operator attaches explicit manual
drift evidence for the same candidate. PR creation therefore occurs before the
pre-merge analyzer, while merge remains separately unauthorized until that
evidence is complete.

### Release evidence handoff

Record these results for the release playbook before promotion:

- [ ] Run `git diff main..develop -- supabase/migrations/` — if any new migration files appear, confirm they have been applied to the production Supabase project before merging.
- [ ] Confirm the `check:pending-migrations` CI step on the release PR passed (or, in the unexpected case that it was skipped because a secret was missing, fall back to the manual check above and investigate why — the secrets are normally configured).
- [ ] Attach the release-PR run ID, exact head SHA, result, and manual evidence
      reference when applicable to the E2E Pro run.

## Reversing a Migration

**Migrations in this project are forward-only.** There is no auto-generated
down migration — `supabase/migrations/NNN_description.sql` only ever
describes the forward change, and there is no tooling that derives or applies
its inverse automatically.

### Destructive migrations require a paired reverse script, staged first

Before applying any **destructive** migration to production — `DROP COLUMN`,
`DROP TABLE`, a type-narrowing `ALTER COLUMN ... TYPE`, or removing a
constraint another feature depends on — author and stage the reverse SQL
**before** the forward migration ever runs against production:

1. Write the reverse statement(s) (e.g. re-add the dropped column, restore
   the wider type, recreate the constraint).
2. Store the reverse script alongside the migration or reference it directly
   in the migration's commit/PR description, so an operator mid-incident
   doesn't have to reconstruct it from memory or from a diff.
3. Only then apply the forward migration to production.

A destructive migration without a staged reverse script is a migration you
cannot safely back out of if the accompanying code deploy turns out to be
broken.

### Prefer expand-migrate-contract over destructive migrations

For any schema change that removes or narrows an existing shape (dropping a
column/table, tightening a type, removing a constraint), prefer the
expand-migrate-contract pattern instead of a single destructive migration:

1. **Expand** — add the new shape alongside the old in one migration (new
   column/table, wider type, additive constraint). Deploy application code
   that writes to both the old and new shape.
2. **Migrate** — backfill existing rows into the new shape and cut reads over
   to it. Verify the application behaves correctly reading from the new shape
   for a full deploy cycle.
3. **Contract** — only in a **later**, separate migration, once the expand
   phase has been live and verified, drop the old shape.

This turns one risky, hard-to-reverse migration into several small,
individually-reversible ones — the "contract" step is the only genuinely
destructive one, and by the time it runs the new shape is already proven in
production.

### Code rollback does not undo a schema change

`docs/runbooks/rollback.md` covers rolling back the **application code**
(Vercel promote to a previous deployment, or `git revert` on `main`). That
procedure does **not** touch the database — reverting code has no effect on
a schema change that was already applied to production. Schema and code
changes must be rolled back as a coordinated pair:

- If a destructive migration was applied to production **before** the
  associated (broken) code deploy went live, rolling back the code alone is
  not enough — the code rollback restores code that expects the *old* schema,
  which no longer exists. The paired reverse SQL script (see above) must also
  be executed against production as part of the rollback, not just the code
  promotion/revert.
- If you followed expand-migrate-contract, this scenario mostly can't happen
  during the expand/migrate phases (the old shape is still there) — it's only
  a risk once a contract migration has actually dropped the old shape, which
  is exactly why contract migrations should ship well after the expand phase
  has proven stable.

See `docs/runbooks/rollback.md` for the code-rollback procedure and
`docs/runbooks/incident-response.md` for the broader incident process; an
operator following either runbook during an incident should land here for the
schema half of a rollback.

## RLS Policies

All tables have Row Level Security (RLS) enabled (see `002_enable_rls.sql`). Every migration that adds a new table must also add the appropriate RLS policies.

The `scripts/rls-deny-migration.test.ts` script validates that deny policies are in place.
