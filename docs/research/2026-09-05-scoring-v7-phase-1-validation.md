# Scoring v7 phase 1 verification

Date: 2026-09-05. Scope: S01 foundation, plus required administrative database deletion integration. Baseline: `c1ce31cbf5969ee400c4cf232d67cf7dc1b1de0d`. All work and checks ran in the isolated scoring worktree; no push, preview, hosted CI, production operation or external outreach ran.

## Evidence

- Shared contracts: 27 scoped fixtures cover the 365-date UTC window, inclusive cutoff, leap/DST dates, fixed core inputs, numeric bounds, known zero/unknown, private projection and required receipt identity/trace fields. The complete suite includes these fixtures.
- Local database: 35 contract files / 79 tests pass, including seven v7 cases against actual Postgres/PostgREST. These exercise service-only grants and forced RLS across all 12 v7 tables, owner/reviewer distinctions, shared private claim/assessment persistence, artifact locators, unknown source timestamps, retention bounds, immutable revisions, invalid receipt chains, revoked-ID reuse, stable prior trend anchors and atomic owner/reviewer cleanup.
- Administrative script: 20 isolated tests cover strict migration-column inventory, read-only dry runs, exactly one atomic cleanup RPC, failure ordering and no per-table v7 deletion. Configuration/network calls are mocked; the production deletion script was never executed.
- Independent GPT-6 Astra compliance review approved the corrected foundation. A separate reuse/quality review found and resolved cross-test state coupling. Delta review approved the deletion/locator addition after its exact inventory fixture was updated.

## Sequential local gates

| Gate | Result |
|---|---|
| `pnpm run typecheck` | pass |
| `pnpm run lint` | pass |
| `pnpm run test --maxWorkers=4` | 515 files / 8,503 tests pass |
| `pnpm run validate:migrations` | migrations 001–039 valid |
| `pnpm run check:write-registration` | pass |
| `pnpm run test:contract:local` | 35 files / 79 tests pass |
| `pnpm exec vitest run --coverage --maxWorkers=4` | pass; 96.16% statements, 92.26% branches, 95.09% functions, 97.42% lines |
| `pnpm run test:coverage:scripts` | pass |
| `pnpm run check:circular` | pass |
| `pnpm run build` | pass |

The two coverage commands execute the repository coverage gate sequentially with a bounded worker count. Coverage now measures shared source files rather than duplicate build output and includes the new runtime input validator. Thresholds are unchanged. Full local logs reside under `logs/scoring-v7/` in the implementation workspace and are preserved with local integration records before worktree cleanup.

Migration rehearsal used disposable project `chapa-scoring-v7` at `127.0.0.1:54531` / Postgres `54532`. Existing Chapa and other project databases were not reset. The temporary worktree Supabase configuration is restored before commits and is never part of the change.

## Boundary of this result

This proves the foundation and its storage boundaries. It does not prove the v7 scoring engine, provider collection, public route authorization, replay calculator, retention scheduler, badge/UI or empirical pilot, which remain required later phases. In particular, AI neutrality is tested at the core input projection here; S09 and S15 must prove numerical and consumer-level invariance. F01–F53 remain tracked to their complete implementation owners; none is waived by this report.

See `2026-09-05-scoring-relaunch-notes` for the deletion dependency and coverage adjustments. The current software changes remain subject to the local code freeze and eventual localhost review.
