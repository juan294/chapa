# Phase 4 local evidence

The code candidate is local commit `bac03bfd` on
`fix/high-volume-badge-collection`. The
disposable `chapa-volume-20260926` Supabase stack used ports 55431/55432.
No production data, push, migration, release, or badge repair occurred.

## Parity and bounded resource measurements

- New default tests compare 1, 999, and 1,001 events with the pinned scorer;
  duplicate and conflicting file facts, mirrored acceptance, aliases, quality
  support, canonical byte ordering, and digest fault handling are covered.
- Eighty deterministic original-versus-compact parity cases, each across page
  sizes 1, 7, and 31, vary provider/event order, complete/partial/unknown
  file lists, same- and cross-key conflicts, duplicates, and unclear
  attribution. They match selected work, diagnostics, exclusions,
  limitations, calendar, bounds, exact score, and trace.
- A 17,572-event mixed-provider fixture matched the legacy core, trace, public
  projection, and private semantic digest. The full observed materializer
  also matched a 17,572-event Phase 1-shaped reference fixture.
- `SCORING_RUN_SCALE_CONTRACT=1 /usr/bin/time -l pnpm exec vitest run
  apps/web/lib/profile/score-receipt-observed.scale.test.ts -t
  '100,000-event' --maxWorkers=1` passed after the pinned-file refactor.
  The full materializer drained 200 lazy pages, rechecked source authority,
  and reached mocked publication in 33.61 seconds. OS maximum RSS was
  1,332,740,096 bytes, 62.1% of the configured 2 GiB function allocation
  and below the 70% gate of 1,503,238,554 bytes. This is a local Node process
  with mocked storage, not production function or DB latency.
- The 100,000-event mixed-provider spool, scorer, core, and digest fixture
  with 10% unclear attribution passed in 57.90 seconds and used
  1,369,178,112 bytes OS maximum RSS, 63.8% of 2 GiB. This fixture has
  smaller event bodies than the Phase 1-shaped full materializer fixture.
  Neither synthetic distribution is claimed to match production.
- The private spool's 100,000-distinct-event fixture measured 150,989,562
  bytes peak scratch. It has a 384 MiB hard cap and 32 MiB free-space reserve;
  exhaustion fails before publication.

The implementation retains one **compact scoring projection** per distinct
event after replacing the original changed-file list with an equality-
preserving representative. It does not retain original whole-source event
bodies in the reducer; the exact canonical evidence is held in bounded,
private disk runs until the digest is complete. This is O(event count) compact
memory, not a constant-memory reducer. The measured 100,000-event cap and
70% RSS gate constrain this choice. The legacy scorer remains the policy
oracle, and its pinned algorithm files are byte-for-byte unchanged, so the
public algorithm digest and private semantic identity remain stable.
The compacting adapter is intentionally outside the pinned scorer artifact
list, as are source normalization and storage reads. That boundary means the
artifact digest binds the pure scoring policy, while adapter correctness is
enforced by original-versus-compact parity tests and the local memory gate.
It does not prove equivalence for every possible future event schema; changing
the file-list semantics or schema requires renewing those tests and the
algorithm-artifact decision.

## Sequential repository gates

- `pnpm run typecheck`: passed.
- `pnpm run lint`: passed with ten existing warnings outside changed files.
- `pnpm run test:coverage`: passed; 9,361 app/shared tests and 296 script
  tests passed. App/shared coverage: 92.87% statements, 87.02% branches,
  94.48% functions, 95.86% lines. Script coverage: 60.51% statements,
  63.52% branches, 71.00% functions, 62.29% lines.
- `pnpm run test:contract:local`: passed; 57 files and 258 tests, two files
  and seven tests skipped under the default scale split. The four first-run
  failures came from two contract mocks exposing only the old selector;
  both were updated for the new manifest selector. Those four tests passed
  alone, then the full suite passed.
- `git diff --check`: passed. PostgreSQL `pg_postmaster_start_time()` remained
  `2026-09-26 12:03:57 UTC`; the last 30-minute database log search found no
  statement timeout, signal-9 backend exit, out-of-memory, panic, fatal, or
  recovery match.
- The `bac03bfd` pre-commit gate repeated typecheck, lint, and the complete
  unit suite: 634 files and 9,363 tests passed, with seven skipped. It
  includes the added deterministic parity cases.

The writer still enforces 50,000 events. Phase 5 must prove the full 100,000
database collection, receipt, and rendered badge before the cap can rise.
