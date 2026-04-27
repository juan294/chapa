# Migrations Runbook

## Overview

Supabase migrations live in `supabase/migrations/`. They are plain SQL files applied manually via the Supabase dashboard or CLI. There is no automatic migration runner — migrations are applied deliberately, not on every deploy.

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

1. Review any new migration files since the last release:
   ```bash
   git diff main..develop -- supabase/migrations/
   ```
2. Run the validator: `pnpm run validate:migrations`
3. Apply new migrations to the production Supabase project **before** the code deploy goes live (or simultaneously — the application is designed to degrade gracefully if new columns don't exist yet).
4. Verify with a quick health check: `curl https://chapa.thecreativetoken.com/api/health`

## RLS Policies

All tables have Row Level Security (RLS) enabled (see `002_enable_rls.sql`). Every migration that adds a new table must also add the appropriate RLS policies.

The `scripts/rls-deny-migration.test.ts` script validates that deny policies are in place.
