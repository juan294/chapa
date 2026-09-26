# Phase 5 local evidence

The Phase 5 implementation commit is `a9a556cb`. Its pre-commit hook passed
typecheck, lint, and 9,390 app/shared unit tests. The task-only Supabase port
override was excluded from that commit.

The candidate uses synthetic owners on the isolated `chapa-volume-20260926`
Supabase stack (API 55431, database 55432). The existing scoring policy remains
v7.2. No production migration, recompute, release, or badge repair has occurred.

## Database and receipt gates

- After a local reset from zero through migration 063, the default collection
  queue contract file passed 34 tests. It covers storage diagnostics, preserved
  checkpoint/generation on Retry, terminal `event_limit` behavior, stale lease
  fencing, and cascade cleanup after withdrawal and user deletion.
- The new row path staged, read, and issued a receipt at 17,572 and 50,000
  events. Fixture bodies measured 29,609,502 and 84,247,856 bytes;
  issuance took 5.61 and 16.01 seconds. The 50,000-event run's slowest
  checkpoint was 6.64 seconds, below the configured 8-second limit. OS peak
  RSS was 681 MB and 1.009 GB. See `db-17572-single.json` and
  `db-50000-single.json`.
- The 100,000-event single GitHub source staged and published, then issued one
  v7.2 receipt with both semantic digests and an authenticated badge
  verification. A same-day refresh rejected event 100,001 without changing the
  published observation. The final 168,512,364-byte fixture run took 69.03
  seconds overall; isolated issuance took 31.51 seconds with 1,258,405,888
  bytes OS peak RSS, below the 1,503,238,554-byte gate. Finish took 175 ms,
  the slowest checkpoint 259 ms, and its response was 90 bytes. See
  `db-100k-single.json`. An earlier combined-process test peaked at
  1,530,986,496 bytes because it held the 100,001-event fixture and performed
  issuance in the same process. The isolated issuance uses a fresh process
  after publication and measures the production-like read/score path.
- One owner with 50,000 GitHub and 50,000 GitLab events passed authorized
  paged reads, receipt issuance, badge verification, and owner status/read-model
  checks. The final 168,506,674-byte mixed fixture run took 64.21 seconds
  overall; paged reads took 9.52 seconds, issuance 35.32 seconds, and OS
  peak RSS was 1,447,084,032 bytes, below the 1,503,238,554-byte gate.
  See `db-100k-mixed.json`.
- Both scale runs cleaned synthetic rows and links. PostgreSQL start time
  remained unchanged; the recent database log had no statement timeout,
  backend exit, OOM, panic, or fatal match.

## Repository checks before candidate merge

- `pnpm run test:contract:local`: 263 passed across 57 files; 12 opt-in or
  historical cases skipped under the default split. The four scale tests above
  ran separately and passed.
- `pnpm run typecheck`, `pnpm run lint`, and `pnpm run test` passed. Lint reported
  ten existing warnings outside the changed files. The unit run passed 9,390
  tests, with seven skipped.
- `pnpm run test:coverage` passed 9,390 app/shared and 301 script tests. The
  app/shared statement/branch/function/line coverage was
  92.86/87.03/94.50/95.85%; scripts were 61.82/64.51/72.89/63.92%.
- `pnpm run check:circular`, `pnpm run validate:migrations`,
  `pnpm run release:validate-docs`, `pnpm run check:vercel-config`,
  `pnpm run check:write-registration`, `pnpm run check:licenses`, and
  `pnpm run check:vulnerabilities` passed.

## Pending candidate gates

The production-mode local build and browser checks, bundle/offline-replay
checks, and final exact commit binding are in progress. This document must
be updated before Phase 5 is accepted.
