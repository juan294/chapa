# Scoring v7: GitLab evidence validation

Date: 2026-09-05. S03 (#1298) verified. Includes a discovered S02 acceptance-coverage correction.

## Implemented and reviewed

`fetchGitlabEvidence` returns dated provider observations, declared coverage and private pagination checkpoints. Authored commits use actual default-branch history and confirmed-email linkage after authenticated subject matching. MR candidates are selected using update bounds, then filtered by the actual merge timestamp. Dated notes on all-state MRs remain submission diagnostics; assignments/current approver lists do not supply reviews. Issue state events retain their actual actor and timestamp without automatically crediting that actor with the accepted work of another person.

Diff metadata is tied to the MR revision and declared change count. Complete paths include both sides of renames. Missing, failed, collapsed, oversized, overflowing or malformed diff hunks remain unknown; they never become zero-line measurements or documentation-only proof. More than ten review candidates are processed within one bounded request/deadline budget. Failed pages retain prior observations and the incoming replay page.

An independent GPT-6 Astra compliance review approved the adapter after one correction: an old-authored commit may first reach the default branch inside the scoring window. No surviving authored-date diagnostics therefore cannot prove complete acceptance coverage. Both GitLab and GitHub now retain `acceptance_time_unknown` and partial acceptance coverage independently of authored-date filtering. Matching regression fixtures first failed and then passed. The dedicated simplify review found no necessary structural refactor.

Source limitations remain visible: private/historical discovery, missing email aliases/deleted notes, unassessed review and closure actions, and unsupported first-reachability timestamps. S09 computes eligibility and bounds; S15 still must route live consumers through these v7 APIs. V6 adapters remain explicitly legacy.

Primary API references: [GitLab commits](https://docs.gitlab.com/api/commits/), [user email addresses](https://docs.gitlab.com/api/user_email_addresses/), [merge requests](https://docs.gitlab.com/api/merge_requests/), [notes](https://docs.gitlab.com/api/notes/), and [resource state events](https://docs.gitlab.com/api/resource_state_events/).

## Sequential local gates

- GitLab scoped: `evidence.test.ts`, `queries.test.ts`, `stats.test.ts`, `stats-aggregation.test.ts`, `client.test.ts`: 93 tests passed, including 21 new adapter tests.
- GitHub acceptance follow-up scoped: `evidence.test.ts`, `queries.test.ts`, `stats.test.ts`: 59 tests passed.
- `pnpm run typecheck`: passed.
- `pnpm run lint`: passed.
- `pnpm run test`: 518 files / 8,584 tests passed.
- `pnpm exec vitest run --coverage --maxWorkers=4`: passed unchanged thresholds; statements 95.63%, branches 91.36%, functions 95.18%, lines 97.43%.
- `pnpm run test:coverage:scripts`: passed.
- `pnpm run check:circular`: passed.
- `pnpm run build`: passed.

Logs: `logs/scoring-v7/s03-*.log`. No schema changes, remote CI, push, PR, hosted deployment or production data operation. Independent worker source came from the isolated `feature/scoring-v7-gitlab` worktree. The separate SEO/redesign work was preserved.
