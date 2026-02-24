# Phase 1: Foundation — Types, DB Migration, Feature Flag

## Goal

Establish the data layer for multi-platform support: shared types for platform linking, a `user_platforms` Supabase table for persistent token storage, a feature flag to gate the feature, and a DB access module for platform CRUD operations.

## New Files

### 1. `supabase/migrations/009_add_user_platforms.sql`

```sql
-- Platform connections for linked accounts (Bitbucket, future: GitLab, etc.)
CREATE TABLE IF NOT EXISTS user_platforms (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handle         text NOT NULL,                    -- GitHub handle (lowercase, FK to users conceptually)
  platform       text NOT NULL,                    -- 'bitbucket' (future: 'gitlab', 'gitea')
  remote_login   text NOT NULL,                    -- username on linked platform
  access_token   text NOT NULL,                    -- encrypted OAuth access token
  refresh_token  text,                             -- encrypted OAuth refresh token (Bitbucket tokens expire)
  token_expires_at timestamptz,                    -- when access_token expires (null = never)
  connected_at   timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(handle, platform)                         -- one link per platform per user
);

-- Index for quick lookups by handle
CREATE INDEX IF NOT EXISTS idx_user_platforms_handle ON user_platforms (handle);

-- Enable RLS (service role bypasses, deny anon)
ALTER TABLE user_platforms ENABLE ROW LEVEL SECURITY;
CREATE POLICY deny_anon_user_platforms ON user_platforms FOR ALL TO anon USING (false);
```

### 2. `packages/shared/src/platforms.ts`

```typescript
/** Supported platform identifiers */
export type Platform = "github" | "bitbucket";

/** Linked platform record (returned from DB, tokens excluded) */
export interface LinkedPlatform {
  platform: Platform;
  remoteLogin: string;
  connectedAt: string; // ISO timestamp
}
```

### 3. `apps/web/lib/db/user-platforms.ts`

DB access functions for the `user_platforms` table:

```typescript
import { getSupabase } from "./supabase";
import { encryptToken, decryptToken } from "@/lib/auth/github";

interface StoredPlatform {
  handle: string;
  platform: string;
  remote_login: string;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  connected_at: string;
  updated_at: string;
}

interface PlatformTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
}

/** Get linked platform for a user (returns null if not linked or DB unavailable) */
export async function dbGetLinkedPlatform(
  handle: string,
  platform: string,
): Promise<{ remoteLogin: string; tokens: PlatformTokens } | null>
// Implementation: SELECT from user_platforms WHERE handle=lower(handle) AND platform
// Decrypt tokens using NEXTAUTH_SECRET

/** Store/update a linked platform (upsert on handle+platform) */
export async function dbUpsertLinkedPlatform(
  handle: string,
  platform: string,
  remoteLogin: string,
  accessToken: string,
  refreshToken: string | null,
  expiresAt: Date | null,
): Promise<boolean>
// Implementation: UPSERT into user_platforms
// Encrypt tokens using NEXTAUTH_SECRET before storing

/** Remove a linked platform */
export async function dbDeleteLinkedPlatform(
  handle: string,
  platform: string,
): Promise<boolean>
// Implementation: DELETE FROM user_platforms WHERE handle=lower(handle) AND platform

/** Update tokens after refresh (updates access_token, refresh_token, token_expires_at, updated_at) */
export async function dbUpdatePlatformTokens(
  handle: string,
  platform: string,
  accessToken: string,
  refreshToken: string | null,
  expiresAt: Date | null,
): Promise<boolean>

/** Check if a user has a linked platform (lightweight — no token decryption) */
export async function dbHasLinkedPlatform(
  handle: string,
  platform: string,
): Promise<boolean>
// Implementation: SELECT 1 FROM user_platforms WHERE handle AND platform LIMIT 1

/** Get all linked platforms for a user (no tokens, just metadata) */
export async function dbGetLinkedPlatforms(
  handle: string,
): Promise<LinkedPlatform[]>
// Implementation: SELECT platform, remote_login, connected_at
// Returns [] when DB unavailable (graceful degradation)
```

### 4. `apps/web/lib/db/user-platforms.test.ts`

Tests for the DB access layer:

```
describe("dbGetLinkedPlatform")
  - returns null when DB unavailable (getSupabase returns null)
  - returns null when platform not linked
  - returns decrypted tokens when platform is linked
  - lowercases handle for lookup

describe("dbUpsertLinkedPlatform")
  - encrypts tokens before storage
  - returns true on success
  - returns false when DB unavailable

describe("dbDeleteLinkedPlatform")
  - returns true on successful delete
  - returns false when DB unavailable

describe("dbHasLinkedPlatform")
  - returns true when platform linked
  - returns false when not linked
  - returns false when DB unavailable

describe("dbGetLinkedPlatforms")
  - returns empty array when DB unavailable
  - returns platform metadata without tokens
```

### 5. `apps/web/lib/feature-flags.ts` (modification)

Add Bitbucket feature flag functions following the Studio pattern:

```typescript
// New — Sync (client components)
export function isBitbucketEnabledSync(): boolean {
  return process.env.NEXT_PUBLIC_BITBUCKET_ENABLED?.trim() === "true";
}

// New — Async (server components / API routes)
export async function isBitbucketEnabled(): Promise<boolean> {
  // Check DB flag first, fall back to env var (same pattern as isStudioEnabled)
  const flag = await getFlag("bitbucket_integration");
  if (flag !== null) return flag;
  return isBitbucketEnabledSync();
}
```

### 6. `apps/web/lib/feature-flags.test.ts` (modification)

Add tests for Bitbucket flags:

```
describe("isBitbucketEnabledSync")
  - returns false when env var not set
  - returns true when env var is "true"
  - returns false when env var is "false"

describe("isBitbucketEnabled")
  - returns DB flag value when available
  - falls back to env var when DB unavailable
```

## Modified Files

### 1. `packages/shared/src/types.ts`

Add `platform_linked` to `ConfidenceFlag` union:

```typescript
// Line 34 — add to ConfidenceFlag union:
export type ConfidenceFlag =
  | "burst_activity"
  | "micro_commit_pattern"
  | "generated_change_pattern"
  | "low_collaboration_signal"
  | "single_repo_concentration"
  | "supplemental_unverified"
  | "low_activity_signal"
  | "review_volume_imbalance"
  | "platform_linked";       // NEW — informational, 0 penalty
```

Add optional `linkedPlatforms` field to `StatsData`:

```typescript
// After hasSupplementalData (line 30):
  linkedPlatforms?: Platform[];  // platforms whose data was merged (informational)
```

### 2. `packages/shared/src/index.ts`

Export new platform types:

```typescript
export * from "./platforms";
```

### 3. `apps/web/lib/impact/utils.ts`

Add `platform_linked` to `CONFIDENCE_REASONS`:

```typescript
// Line 48 — add:
platform_linked:
  "Includes verified data from a linked platform account.",
```

### 4. `.env.example`

Add new env vars:

```
BITBUCKET_CLIENT_ID=           # Bitbucket OAuth consumer key (optional — Bitbucket feature)
BITBUCKET_CLIENT_SECRET=       # Bitbucket OAuth consumer secret (optional — Bitbucket feature)
NEXT_PUBLIC_BITBUCKET_ENABLED= # Set to "true" to enable Bitbucket linking (optional)
```

## Automated Verification

```bash
pnpm run typecheck 2>&1; pnpm run test -- --run apps/web/lib/db/user-platforms.test.ts apps/web/lib/feature-flags.test.ts 2>&1; pnpm run lint 2>&1
```

## Success Criteria

- [ ] `user_platforms` migration runs without errors
- [ ] `dbGetLinkedPlatform()` returns null when DB unavailable (graceful degradation)
- [ ] `dbUpsertLinkedPlatform()` encrypts tokens before storage
- [ ] `isBitbucketEnabledSync()` returns false by default
- [ ] `platform_linked` flag exists in shared types
- [ ] All tests pass, typecheck clean
