# Phase 7: Optional Craft evidence

Prerequisites: phase 1.
**[batch-eligible]** after phase 1; exclusive files below may not overlap other batch workers.
Policy authority: [policy.md](policy.md). Parent: [scoring relaunch](../2026-09-05-scoring-relaunch.md).
This phase is mandatory before relaunch. Stop after verified completion unless the user authorizes continuation. All implementation/review agents for this work must use GPT-6 Astra.

## S10: Make Craft an optional evidence-based AI engineering profile

GitHub: [#1305](https://github.com/juan294/chapa/issues/1305).

Worker role: backend. Depends on: S01.
Audit requirements: F17, F24, F25, F37, F38, F39, F41, F42, F43, F53.

Problem and resulting behavior:
Separate model-estimated report outcomes from corroborated engineering-practice evidence. Remove LOC/files/messages/response speed/agent-count/parallelism/entropy rewards from the Craft rating; retain truthful descriptive usage statistics. Implement policy rubric, provenance, coverage, report-date eligibility, unknown-category retention and bounded finite validation. An absent report is not observed and never changes core. A Claude report alone cannot certify mastery or scalable/reliable systems.

Exclusive implementation ownership (adjacent source tests included):
- apps/web/lib/insights/parser.ts:177
- apps/web/lib/insights/validation.ts:17
- apps/web/lib/insights/scoring.ts:157
- apps/web/lib/db/tool-insights.ts:125
- apps/web/lib/cache/craft-cache.ts:33
- apps/web/app/api/insights/route.ts:58
- apps/web/lib/insights/*.test.ts

Pseudocode contract:
```text
read frozen v7 policy and prerequisite evidence/contracts
write failing fixtures for each acceptance criterion below
implement only S10's owned behavior against the shared contract
preserve immutable input identity, coverage and reference context
review; correct every finding; simplify; verify sequentially
record exact artifacts and stop; do not push or deploy
```

Automated/checkable acceptance:
- [x] Missing response-time fields remain unknown; deleting a report section earns no credit.
- [x] 1e309, overflowing finite counts, NaN, inconsistent count totals and invalid/future dates fail safely.
- [x] Rare-tool addition and more parallelism/lines without new engineering evidence cannot alter Craft rating.
- [x] Zero observed effectiveness cannot earn Artificer or an excellence claim.
- [x] One positive classification versus 1000 displays different sample evidence; no false probability claim.
- [x] Unknown outcome categories and unclassified sessions remain in coverage, including potential failure categories; no silent denominator exclusion.
- [x] Old or straddling aggregate reports are historical/partial rather than prorated or rejuvenated by reupload.

Manual/domain acceptance:
- [x] An independent reviewer reconciles this task with policy.md and the cited audit cases.
- [x] Any semantic/data-source limitation is visible in evidence coverage and public claims.
- [x] No task criterion is moved past relaunch or closed with an unimplemented placeholder.


## Sequential local verification

Run the owned adjacent tests using `pnpm exec vitest run <explicit-owned-test-paths>`; record the exact paths in the implementation report. At phase integration run sequentially: `pnpm run typecheck`, `pnpm run lint`, `pnpm run test`, and `pnpm run build`. For schema/write changes also run `pnpm run validate:migrations`, `pnpm run check:write-registration` and `pnpm run test:contract:local` against disposable local Supabase before build. Scoring changes additionally run `pnpm run test:coverage`; import changes run `pnpm run check:circular`. Do not run checks concurrently.

Final readiness also requires repository license/vulnerability and SVG/PNG/browser verification. No hosted CI or preview is a test environment. Missing prerequisites, failed checks and policy contradictions return to their owner before completion.
