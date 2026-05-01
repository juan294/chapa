---
phase: 9C
release: v2.9.0
issues: ["#749"]
batch_eligible: true
effort: M
---

# Phase 9C — Typed env getters (`#749`)

## Goal

Expand `apps/web/lib/env.ts` from a single `getBaseUrl()` into a typed
module covering all env vars read at runtime. Each getter:
- trims whitespace once (per CLAUDE.md "Environment Variable Safety")
- has a typed return (`string`, `string | undefined`, `boolean`, `number`)
- documents the env var purpose
- centralizes fallbacks and validation

## Inventory (from `grep -rn process.env apps/web/lib apps/web/app`)

The current state has 20+ direct reads. Group them by purpose:

```
GitHub OAuth / API:
  GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_TOKEN
Bitbucket / Codeberg:
  BITBUCKET_CLIENT_ID, BITBUCKET_CLIENT_SECRET, NEXT_PUBLIC_BITBUCKET_ENABLED
  CODEBERG_CLIENT_ID, CODEBERG_CLIENT_SECRET, NEXT_PUBLIC_CODEBERG_ENABLED
Storage:
  UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
Analytics:
  NEXT_PUBLIC_POSTHOG_KEY, NEXT_PUBLIC_POSTHOG_HOST
Email:
  RESEND_API_KEY, RESEND_WEBHOOK_SECRET, SUPPORT_FORWARD_EMAIL
Verification:
  CHAPA_VERIFICATION_SECRET
Auth/cookies:
  NEXTAUTH_SECRET, NEXT_PUBLIC_BASE_URL, VERCEL_ENV
Feature flags:
  NEXT_PUBLIC_STUDIO_ENABLED, NEXT_PUBLIC_EXPERIMENTS_ENABLED, NEXT_PUBLIC_INSIGHTS_ENABLED
Admin:
  ADMIN_HANDLES, ADMIN_SECRET, ALLOW_AGENT_RUN
Cron:
  CRON_SECRET, WARM_CACHE_PRIORITY_HANDLES, CHAPA_ALERT_WEBHOOK_URL
```

## Pseudocode

```ts
// apps/web/lib/env.ts (expanded)

function readTrimmed(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v ? v : undefined;
}

function readRequired(name: string): string {
  const v = readTrimmed(name);
  if (!v) throw new Error(`Required env var ${name} is unset`);
  return v;
}

function readBool(name: string): boolean {
  return readTrimmed(name) === "true";
}

function readList(name: string): string[] {
  const v = readTrimmed(name);
  return v ? v.split(",").map(s => s.trim()).filter(Boolean) : [];
}

// Public getters (alphabetized, grouped by area)
export function getBaseUrl(): string {
  return readTrimmed("NEXT_PUBLIC_BASE_URL") ?? "https://chapa.thecreativetoken.com";
}

export function getAdminHandles(): string[] {
  return readList("ADMIN_HANDLES");
}

export function getAdminSecret(): string | undefined {
  return readTrimmed("ADMIN_SECRET");
}

// ... one getter per env var
```

## Migration steps

1. Define every getter in `lib/env.ts` (alphabetical for discoverability)
2. Add lint rule: `no-restricted-syntax` blocking `process.env.*` reads
   outside `lib/env.ts`
3. Sweep call sites to replace `process.env.X?.trim()` -> `getX()`
4. Update `lib/env.test.ts` to cover trim/fallback behavior

## Files

- Modified: `apps/web/lib/env.ts` (grow from 12 lines -> ~150 LOC)
- New: `apps/web/lib/env.test.ts`
- Modified: 20+ call sites across `apps/web/lib/` and `apps/web/app/api/`
- Modified: `apps/web/.eslintrc.*` or `eslint.config.*` to add the
  `no-restricted-syntax` rule

## Acceptance criteria

### Automated
- [x] `grep -rE "process\.env\.[A-Z_]+" apps/web/lib apps/web/app | grep -v "lib/env.ts"` returns no matches
- [x] `pnpm run typecheck && pnpm run test && pnpm run lint` all pass
- [x] `pnpm run lint` rejects new direct `process.env` reads outside `lib/env.ts`

### Manual
- Verify a missing required env var produces the explicit "Required env var X is unset" error path

## Closing the issue

```bash
gh issue close 749 --comment "Fixed in <sha>. All env reads now go through typed getters in apps/web/lib/env.ts; ESLint blocks new direct reads."
```
