#!/usr/bin/env tsx
/**
 * Run the contract test suite (vitest.config.contract.ts) against a LOCAL
 * Supabase instance, mirroring the `contract` job in
 * `.github/workflows/ci.yml` step-for-step.
 *
 * Usage:
 *   supabase start                  # once, if not already running
 *   pnpm run test:contract:local
 *
 * SAFETY (do not change without re-reading this comment):
 * This script binds SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY EXCLUSIVELY to
 * the output of `supabase status -o env`, which only ever returns the local
 * (127.0.0.1) instance's details. Unlike scripts/delete-user.ts and
 * scripts/heal-poisoned-stats.ts, this script deliberately does NOT read
 * `.env.local` as a fallback -- .env.local carries hosted/production
 * Supabase credentials, and this script exists specifically to keep contract
 * tests off of them. If `supabase status` fails, we fail loudly and tell the
 * developer to run `supabase start` -- we never fall back to any other
 * credential source. See CLAUDE.local.md ("Never copy .env.local into a
 * worktree") and docs/agents/shared-context.md for the incident history this
 * guards against.
 */

import { spawnSync } from "node:child_process";

function fail(message: string): never {
  console.error(`\nerror: ${message}\n`);
  process.exit(1);
}

/** Parse the KEY="VALUE" lines `supabase status -o env` prints to stdout. */
export function parseSupabaseEnv(stdout: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of stdout.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)="(.*)"$/);
    const key = match?.[1];
    const value = match?.[2];
    if (key && value !== undefined) {
      env[key] = value;
    }
  }
  return env;
}

function getLocalSupabaseEnv(): Record<string, string> {
  const result = spawnSync("supabase", ["status", "-o", "env"], {
    encoding: "utf-8",
  });

  if (result.error) {
    fail(
      `Could not run "supabase status" (${result.error.message}). Is the Supabase CLI installed and on PATH?`,
    );
  }

  if (result.status !== 0 || !result.stdout?.trim()) {
    fail(
      'Local Supabase does not appear to be running (`supabase status -o env` failed or produced no output).\n' +
        "  -> Run `supabase start` first, then re-run: pnpm run test:contract:local\n" +
        "  This script never falls back to .env.local, so there is no other way to supply credentials here.",
    );
  }

  return parseSupabaseEnv(result.stdout);
}

/**
 * Non-secret placeholder values the `contract` CI job injects alongside the
 * real (local) Supabase credentials, per .github/workflows/ci.yml. Kept in
 * sync with that workflow and with the REQUIRED_ENV list in
 * vitest.contract-setup.ts.
 */
const CI_PARITY_ENV: Record<string, string> = {
  NEXTAUTH_SECRET: "contract-nextauth-secret-32-characters",
  CHAPA_VERIFICATION_SECRET: "test-verification-secret",
  CRON_SECRET: "test-cron-secret",
  ADMIN_SECRET: "test-admin-secret",
  NEXT_PUBLIC_INSIGHTS_ENABLED: "true",
  NEXT_PUBLIC_STUDIO_ENABLED: "true",
  NEXT_PUBLIC_BITBUCKET_ENABLED: "true",
  NEXT_PUBLIC_CODEBERG_ENABLED: "true",
  NEXT_PUBLIC_GITLAB_ENABLED: "true",
  NEXT_PUBLIC_BASE_URL: "http://localhost:3001",
  GITHUB_CLIENT_ID: "dummy",
  GITHUB_CLIENT_SECRET: "dummy",
  UPSTASH_REDIS_REST_URL: "https://dummy.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "dummy",
};

export function main(): never {
  const localEnv = getLocalSupabaseEnv();
  const apiUrl = localEnv.API_URL;
  const serviceRoleKey = localEnv.SERVICE_ROLE_KEY;

  if (!apiUrl || !serviceRoleKey) {
    fail(
      '`supabase status -o env` did not include API_URL / SERVICE_ROLE_KEY. Try `supabase stop` then `supabase start` and re-run.',
    );
  }

  console.log(`Running contract tests against local Supabase at ${apiUrl}\n`);

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...CI_PARITY_ENV,
    SUPABASE_URL: apiUrl,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
  };

  const result = spawnSync(
    "pnpm",
    ["exec", "vitest", "run", "-c", "vitest.config.contract.ts"],
    { stdio: "inherit", env },
  );

  if (result.error) {
    fail(`Failed to launch vitest (${result.error.message}).`);
  }

  process.exit(result.status ?? 1);
}

const isMain =
  process.argv[1] &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  main();
}
