# Phase 2 — Deterministic gates `[batch-eligible]`

Goal: the same gates CI would run, executed sequentially in the worktree so
the user's dev server and `.next` are untouched. Independent of Phase 3.

Run from `/Users/juan/code/chapa-e2e` (Phase 1.3), one after another, never
in parallel, capturing each log under `logs/local-e2e/`:

```bash
mkdir -p logs/local-e2e
pnpm run typecheck                 2>&1 | tee logs/local-e2e/typecheck.log
pnpm run lint                      2>&1 | tee logs/local-e2e/lint.log
pnpm run test                      2>&1 | tee logs/local-e2e/test.log
pnpm run test:contract:local       2>&1 | tee logs/local-e2e/contract.log   # supabase status must show the chapa stack
pnpm run check:circular            2>&1 | tee logs/local-e2e/circular.log
pnpm run validate:migrations       2>&1 | tee logs/local-e2e/migrations.log
pnpm run check:write-registration  2>&1 | tee logs/local-e2e/write-registration.log
pnpm run check:vercel-config       2>&1 | tee logs/local-e2e/vercel-config.log
pnpm run check:licenses            2>&1 | tee logs/local-e2e/licenses.log
pnpm run release:validate-docs     2>&1 | tee logs/local-e2e/release-docs.log
pnpm run check:pending-migrations  2>&1 | tee logs/local-e2e/pending-migrations.log   # expected: exactly 049 pending
bash scripts/check-bundle-size.sh  2>&1 | tee logs/local-e2e/bundle.log    # against the Phase 1.3 build
```

Notes:
- The contract suite reads the local stack through `scripts/test-contract-local.ts`
  (`supabase status -o env`), never `.env.local`. The most recent recorded
  baseline (`docs/research/2026-09-06-v7-site-cutover-handoff.md` §12) was 3
  pre-existing failures in `platform-token-refresh.contract.test.ts` and
  `source-context.contract.test.ts`; a first run straight after a `db reset`
  can also fail on cached-vs-durable comparisons because Redis still holds
  the previous generation. Re-run once before recording a failure as new.
- `pnpm run test` writes coverage floors for `lib/impact/**` (95/90/95/95)
  and `stats-integrity.ts` (90/85/90/90); a floor breach is a finding.
- The bundle script must report the insights parser as the single exempted
  chunk (e755b07c); any second chunk over 350 KB is a finding, not a new
  exemption.
- `check:pending-migrations` needs `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_REF`
  in the shell; it reads the linked project. Its only acceptable diff is
  `049_seed_scoring_v7_rendering_flag`; anything else is a finding.
- `pnpm run check:vulnerabilities` is skipped: it needs network and the
  lockfile is unchanged since the last green run.

## Exit criteria

Every command exits 0, except `check:pending-migrations`, which must name
only 049 (contract suite: 0 failures beyond the recorded
pre-existing ones, each named in the report). Record test counts, coverage
percentages, largest chunk bytes and wall-clock per gate in the report table.
