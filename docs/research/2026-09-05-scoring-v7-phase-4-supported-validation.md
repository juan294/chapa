# Scoring v7: supported Bitbucket adapter validation

Scope: supported portion of S04 / #1299. The adapter implementation previously passed independent GPT-6 Astra review and dedicated simplify review. Its five reviewed files were unchanged when brought forward from the worker baseline, then passed the integration checks below. **S04 and phase 4 remain open:** the proposed replacement for the retired native issue API is still pending user approval in [the transport amendment](../decisions/2026-09-05-bitbucket-issue-api-retirement.md). This report does not mark the original closure-collection acceptance criteria complete.

The new v7 adapter verifies the credential's stable account identity and attributes observations using UUID/account IDs rather than usernames. It collects authored commits and dated merge/review activity, including reviews of still-open changes. Later `updated_on` values cannot rejuvenate an old merge. Incomplete or malformed activity history cannot establish a later convenient acceptance date. Authored commit dates do not establish first reachability on the default branch.

Repository discovery and nested activity/diff pagination share an explicit request/time budget. Missing pages retain progress and unknown coverage. Credential-bearing requests reject redirects and foreign or scope-changing pagination links; the supported diff comparison uses the authoritative redirect target without following it with credentials. Rename paths and complete diff populations remain distinct from unknown measurements. Empty approvals earn no semantic quality credit.

Native issue work is explicitly unavailable with `not_supported`, never observed zero. Missing discovery, first-reachability and inaccessible history remain visible as unknown bounds. Supported provider parity is tested through actual GitHub and Bitbucket adapters with verified project/work mappings. The existing scalar reader is labeled legacy; S15 still owns adopting the v7 adapter across consumers.

## Sequential local verification

- Scoped suites below: 4 files / 71 tests passed.
- Full typecheck and lint: passed.
- Full suite: 547 files / 9,001 tests passed, including the adjacent Bitbucket client tests.
- Coverage with unchanged thresholds: statements 94.61%, branches 89.73%, functions 95.07%, lines 97.10%.
- Scripts coverage, circular dependency check and production build: passed locally.

No schema/write change belongs to this adapter. S07/S11 database integration was already verified separately. Logs reside under `logs/scoring-v7/s04-*.log`; `s04-import-manifest.json` records the exact five imported source/test files. No push, PR, hosted CI, deployment or production action was performed.

```text
apps/web/lib/bitbucket/evidence.test.ts
apps/web/lib/bitbucket/queries.test.ts
apps/web/lib/bitbucket/stats.test.ts
apps/web/lib/bitbucket/stats-aggregation.test.ts
```

The issue-API amendment, historical closure attribution/acceptance regressions, provider-capability copy and cross-provider pilot remain mandatory before S04 closure and relaunch. Supported-code integration does not approve that amendment or defer its requirements.
