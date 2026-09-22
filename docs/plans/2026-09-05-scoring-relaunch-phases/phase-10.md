# Phase 10: Outcome and practice evidence ledger

Prerequisites: phase 6.
Policy authority: [policy.md](policy.md). Parent: [scoring relaunch](../2026-09-05-scoring-relaunch.md).
This phase is mandatory before relaunch. Stop after verified completion unless the user authorizes continuation. All implementation/review agents for this work must use GPT-6 Astra.

## S11: Implement attributable outcome and engineering-practice evidence

GitHub: [#1306](https://github.com/juan294/chapa/issues/1306).

Worker role: backend. Depends on: S01, S06.
Audit requirements: F36, F41, F42, F51, F52.

Problem and resulting behavior:
Build the bounded evidence ledger and review rubric in the policy appendix: delivered benefit, verification/correctness, maintenance/design, collaboration/mentoring, and attributable reliability/performance/accessibility/cost outcomes. Store claims, source links, event dates, contributor role, observations, counterevidence and attestation status. Support provider-observed facts plus owner submissions and independent corroboration; no auto-messages or LLM judge that silently declares truth. Protect private artifacts and record consent for public aggregates.

Exclusive implementation ownership (adjacent source tests included):
- apps/web/lib/evidence/* (new)
- apps/web/lib/db/engineering-evidence.ts (new)
- apps/web/app/api/evidence/* (new)
- apps/web/lib/auth/assert-handle-ownership.ts (reuse)
- apps/web/lib/evidence/*.contract.test.ts (new)

Pseudocode contract:
```text
read frozen v7 policy and prerequisite evidence/contracts
write failing fixtures for each acceptance criterion below
implement only S11's owned behavior against the shared contract
preserve immutable input identity, coverage and reference context
review; correct every finding; simplify; verify sequentially
record exact artifacts and stop; do not push or deploy
```

Automated/checkable acceptance:
- [x] A merged PR alone cannot become proof of deployment, adoption, reliability or business value.
- [x] A passing CI count alone cannot become meaningful-test or security proof; rationale/artifact evidence is required.
- [x] Revert/rework/incident links include attribution and observation horizon; missing counterevidence is not proof of no defects.
- [x] Design, documentation, mentoring, maintenance and incident recovery have first-class categories without requiring more LOC.
- [x] Self-attestation cannot impersonate independent corroboration; duplicate/linking activity creates no extra points.
- [x] Evidence accepted/rejected/unknown follows the published rubric with identical treatment of AI/manual work.
- [x] Ownership, redaction, SSRF-safe bounded URL handling, RLS and durable-write contract tests pass.
- [x] A documented authenticated API/fixture CLI supports owner core/Craft evidence submission (including no-AI/no-report), independent reviewer assessment, amendment/retraction and owner withdrawal; every path has a local end-to-end contract.

Manual/domain acceptance:
- [x] An independent reviewer reconciles this task with policy.md and the cited audit cases.
- [x] Any semantic/data-source limitation is visible in evidence coverage and public claims.
- [x] No task criterion is moved past relaunch or closed with an unimplemented placeholder.


## Sequential local verification

Run the owned adjacent tests using `pnpm exec vitest run <explicit-owned-test-paths>`; record the exact paths in the implementation report. At phase integration run sequentially: `pnpm run typecheck`, `pnpm run lint`, `pnpm run test`, and `pnpm run build`. For schema/write changes also run `pnpm run validate:migrations`, `pnpm run check:write-registration` and `pnpm run test:contract:local` against disposable local Supabase before build. Scoring changes additionally run `pnpm run test:coverage`; import changes run `pnpm run check:circular`. Do not run checks concurrently.

Final readiness also requires repository license/vulnerability and SVG/PNG/browser verification. No hosted CI or preview is a test environment. Missing prerequisites, failed checks and policy contradictions return to their owner before completion.
