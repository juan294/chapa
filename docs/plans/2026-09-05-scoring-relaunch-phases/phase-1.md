# Phase 1: Policy, contracts and database foundation

Prerequisites: none.
Policy authority: [policy.md](policy.md). Parent: [scoring relaunch](../2026-09-05-scoring-relaunch.md).
This phase is mandatory before relaunch. Stop after verified completion unless the user authorizes continuation. All implementation/review agents for this work must use GPT-6 Astra.

## S01: Freeze the v7 scoring policy and versioned evidence contracts

GitHub: [#1296](https://github.com/juan294/chapa/issues/1296).

Worker role: architect. Depends on: none.
Audit requirements: F27, F33, F34, F40, F50.

Problem and resulting behavior:
Encode the approved four-dimension core, independent optional Craft, explicit missing-evidence bounds, source/actor/repository identities, UTC window and score-receipt interfaces. Freeze the policy appendix and fixtures before adapter workers start. Keep v6 types for versioned legacy reads; do not mutate the meaning of stored v6 records. Create the complete additive DB foundation for dated evidence, assessments, source coverage, immutable receipts, receipt revisions, verification references and unrounded trend anchors now, with explicit privacy grants/RLS and local migration contracts, so later workers do not depend on absent tables. No placeholder migration schemas.

Exclusive implementation ownership (adjacent source tests included):
- packages/shared/src/scoring-evidence.ts (new)
- packages/shared/src/scoring-window.ts (new)
- packages/shared/src/types.ts:10
- packages/shared/src/stats-schema.ts:8
- packages/shared/src/index.ts
- docs/impact-v7.md (new)
- docs/decisions/2026-09-05-scoring-v7-policy.md (new)
- supabase/migrations/* scoring-v7 additive foundation (new; allocated at implementation)

Pseudocode contract:
```text
read frozen v7 policy and prerequisite evidence/contracts
write failing fixtures for each acceptance criterion below
implement only S01's owned behavior against the shared contract
preserve immutable input identity, coverage and reference context
review; correct every finding; simplify; verify sequentially
record exact artifacts and stop; do not push or deploy
```

Automated/checkable acceptance:
- [x] 365 calendar dates, leap day/DST, inclusive start and event-time cutoff fixtures pass.
- [x] No score input reads ambient time or contains an access token.
- [x] AI provenance, tool choice and presence/absence of a report cannot change core results for identical engineering evidence.
- [x] Each observation distinguishes observed zero, unavailable, partial, stale, self-reported and corroborated evidence.
- [x] All 53 audit findings map to an implementation owner and acceptance artifact; no later-phase deferral beyond relaunch.
- [x] All later route/DB worker tables and columns exist with tested grants, owner/reviewer access, immutable revision constraints and deletion/tombstone semantics before parallel work.

Manual/domain acceptance:
- [x] An independent reviewer reconciles this task with policy.md and the cited audit cases.
- [x] Any semantic/data-source limitation is visible in evidence coverage and public claims.
- [x] No task criterion is moved past relaunch or closed with an unimplemented placeholder.


## Sequential local verification

Run the owned adjacent tests using `pnpm exec vitest run <explicit-owned-test-paths>`; record the exact paths in the implementation report. At phase integration run sequentially: `pnpm run typecheck`, `pnpm run lint`, `pnpm run test`, and `pnpm run build`. For schema/write changes also run `pnpm run validate:migrations`, `pnpm run check:write-registration` and `pnpm run test:contract:local` against disposable local Supabase before build. Scoring changes additionally run `pnpm run test:coverage`; import changes run `pnpm run check:circular`. Do not run checks concurrently.

Final readiness also requires repository license/vulnerability and SVG/PNG/browser verification. No hosted CI or preview is a test environment. Missing prerequisites, failed checks and policy contradictions return to their owner before completion.

## Verified phase result

Foundation complete. See [phase-1 verification](../../research/2026-09-05-scoring-v7-phase-1-validation.md). The AI-neutrality criterion is established at the frozen input-contract boundary here; S09 must still prove numeric results and S15 must prove every runtime consumer. This phase does not claim those later behaviors are implemented.
