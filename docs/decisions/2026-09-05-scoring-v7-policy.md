# Scoring v7: fixed core and independently disclosed evidence

Date: 2026-09-05. Status: accepted for implementation; empirical validation pending.

The user approved the complete scoring relaunch plan, including four equally weighted core dimensions, optional Craft outside the core, explicit evidence-completion ranges and attributable engineering outcome evidence. AI use, tool choice and optional report disclosure cannot change the core when engineering evidence is identical. The constants and thresholds are product choices; they are not population percentiles or proven measures of individual ability.

The normative formulas, rubric, clock, missingness bounds, retention and validation gates are in [Impact v7](../impact-v7.md). The legacy v6 interfaces and stored semantics remain readable. The v7 schema is additive and does not reinterpret legacy snapshots as replayable receipts.

## Data and access boundary

> **Superseded in part by 2026-09-23** (`docs/decisions/2026-09-23-universal-v72-no-consent.md`):
> `scoring_v7_subjects`'s public-evidence consent column and the "public
> consent" gate on the receipts API mentioned below are removed. Every
> signed-up subject is scored and published with no opt-in step. Reviewer
> consent (`scoring_v7_reviewer_grants`, a distinct concept from publication
> consent) is unaffected.

`scoring_v7_subjects` records the owner and explicit public-evidence consent. `scoring_v7_sources` identifies each connected subject and private access-context reference; `scoring_v7_source_observations` stores dated normalized events and field/discovery coverage. An access-context reference contains no credential and carries no completeness ranking.

`scoring_v7_evidence` stores immutable claim revisions, separating core submissions from Craft. Its JSON payload retains the full typed claim or normalized evidence; indexed columns preserve ownership, identity, date, category and revision linkage. `scoring_v7_assessments` stores immutable criterion verdicts, accountable evaluators, private rationale, rubric version and evidence references. Database statuses map directly to the shared accepted/rejected/unassessed/retracted contract. Owner consent to a named reviewer lives in `scoring_v7_reviewer_grants`; no invitation message is sent automatically.

The application authenticates GitHub sessions itself and uses Supabase's server service client. A GitHub handle is not a Supabase `auth.uid()`. Accordingly, all new tables have forced RLS and explicitly deny direct anonymous/authenticated database access. Only the service role has database grants. APIs must derive the acting handle from verified authentication before applying owner/reviewer predicates; accepting an actor handle from request JSON would violate this boundary. An owner can assess their own evidence but cannot mark it independently corroborated. Corroboration requires a distinct authorized human reviewer and still represents a recorded assessment, not a guarantee of source truth.

`scoring_v7_evidence_references` preserves private artifact locators/revisions independently of raw bodies. `scoring_v7_raw_artifacts` holds imported report/fetched bodies for at most 30 days. `scoring_v7_receipts` stores the exact canonical public receipt text and its matching JSON, immutable revision and reference time. `scoring_v7_verification` binds a signature/key version to that durable receipt. `scoring_v7_trend_anchors` retains double-precision state and the previous-day anchor, separately from immutable raw receipts. The public API must use an allowlist projection, public consent and issuance verification; it cannot expose arbitrary private JSON or evaluator rationale.

Withdrawal is one database transaction: record receipt-ID/time-only `scoring_v7_revocations`, then remove the subject's receipt and private backing records. S01 also connects the existing administrative database deletion command to an atomic cleanup RPC, including this person’s reviewer grants/assessments on other owners’ evidence. S14 adds cache invalidation and verification presentation. A published receipt's arithmetic history cannot be silently edited; a correction appends a revision. Previously downloaded artifacts cannot be recalled.

## Verification and release boundary

S01 tests clock/calendar boundaries, numeric input projection, evidence states, grants/RLS, reviewer access, immutable revisions, retention and withdrawal against disposable local Supabase. Later phases prove the actual core arithmetic, independent replay, route authorization, cache deletion and rendering. S01 success is not evidence that those later behaviors already work.

All phases remain mandatory before relaunch, including the independently reviewed empirical pilot. Implementation proceeds in isolated worktrees and integrates into local `develop`; no GitHub push, preview or production migration/recompute/deployment is authorized during the freeze.
