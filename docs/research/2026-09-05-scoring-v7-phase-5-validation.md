# Scoring v7: Codeberg evidence validation

Date: 2026-09-05. S05 (#1300) verified.

`fetchCodebergEvidence` collects real authored commits using the provider's linked author ID and Git author timestamp. Subject activity feeds supply repository discovery only; neither the feed, heatmap nor merged pull-request count becomes a commit count. Owned, authenticated-accessible and observed contributed repositories are traversed within one explicit request/deadline budget. Discovery gaps remain visible.

Merged changes use their merge timestamp and immutable merge revision. All-state pull-request reviews use their own `submitted_at` and actor ID; issue timeline closures use their state-event actor and timestamp. Review submissions and issue closure actions remain diagnostics until qualifying evidence is assessed. Current assignees/approval lists are not historical actor evidence. Unsupported default-branch first-reachability timestamps remain unknown, including when no authored-date events survive the window filter.

Forgejo file diffs can be line-limited without an explicit truncation flag. The adapter therefore requires the archived pull-request head reference, complete file pagination/count and line-count agreement against an independent shortstat before treating paths/additions/deletions as complete. A moved source head or missing reference cannot silently become the accepted artifact. Failed pages preserve earlier observations and the incoming retry page. Requests never follow arbitrary redirects.

An independent GPT-6 Astra reviewer approved the final implementation against the phase and policy and completed a dedicated simplify review with no required changes. The reviewer checked the live [Codeberg API schema](https://codeberg.org/swagger.v1.json) and [Forgejo API usage documentation](https://forgejo.org/docs/latest/user/api/usage/). The cross-provider fixture drives both actual mocked-transport GitHub and Codeberg collectors, compares equivalent normalized measurements/acceptance, preserves explicit capability differences, and verifies mirrored work deduplication through the shared aggregator.

## Sequential local gates

- Scoped worker tests: 80 passed across `evidence.test.ts`, `queries.test.ts`, `stats.test.ts`, `stats-aggregation.test.ts`, and `client.test.ts`, including 20 new adapter fixtures and actual traversal of the 51st discovered repository.
- Integration `pnpm run typecheck`: passed.
- Integration `pnpm run lint`: passed.
- Integration `pnpm run test`: 519 files / 8,604 tests passed.
- `pnpm exec vitest run --coverage --maxWorkers=4`: passed unchanged thresholds; statements 95.40%, branches 91.09%, functions 95.21%, lines 97.44%.
- `pnpm run test:coverage:scripts`: passed.
- `pnpm run check:circular`: passed.
- `pnpm run build`: passed.

Logs: `logs/scoring-v7/s05-*.log`. No schema changes, remote CI, push, PR, hosted deployment or production data operation. S09 owns scoring eligibility; S15 still must connect live consumers to the v7 collector. Existing v6 paths retain their legacy interpretation.
