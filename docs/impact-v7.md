# Impact v7 — observed engineering activity and practices

Status: implemented, pending the empirical pilot in
`docs/plans/2026-09-05-scoring-relaunch-phases/phase-14.md`. The policy this
document describes is frozen in
`docs/plans/2026-09-05-scoring-relaunch-phases/policy.md`, which is the
authority whenever the two disagree.

v6 remains documented in [`impact-v6.md`](impact-v6.md). Its records keep their
own semantics and their non-replayable legacy status; nothing here rewrites a
v6 score or presents v6 arithmetic as v7.

## What the number is, and what it is not

Chapa reports an **observed engineering activity and practices index** across
four dimensions, plus a separate optional Craft practice portfolio and
attributable outcome evidence.

It does not certify ability, causal business impact, scalable architecture,
reliability or security. Every constant below — each cap, each tier boundary —
is a published product choice. No percentile interpretation, calibrated
confidence percentage or externally validated mastery threshold is claimed.

"Complete" means complete **for the declared scope**: the connected, consented
sources, the repositories that were accessible, the discovery strategy used and
the registered evidence ledger, over the reference window named in the receipt.
It never means all work a person has done. Unobserved private work stays
unknown; current source visibility cannot prove the absence of work.

## One clock

A reference time is captured once, at the orchestrator boundary
(`apps/web/lib/profile/score-receipt-v7.ts`). The window is the reference UTC
date and the preceding 364 UTC dates: `startInclusive = midnight(referenceDate
− 364)`, `endExclusive = midnight(referenceDate + 1)`. Only events with
`startInclusive <= occurredAt <= referenceTime` qualify, so a future same-day
event is rejected.

These are 365 calendar dates including a partial current day — not a trailing
8760-hour interval. Every API response, receipt, snapshot, verification record
and trend key receives that same context.

## The core

Let `N(x, c) = ln(1 + min(x, c)) / ln(1 + c)`, for bounded finite non-negative
counts. Arithmetic runs in full precision; only displayed points are rounded.

| Dimension | Formula | Cap |
| --- | --- | --- |
| Delivery | `D = 100 · N(deliveryUnits, 120)` | 120 |
| Quality practices | `Q = 25 · Σ N(criterion, 12)` over four criteria | 12 each |
| Consistency | `C = 100 · N(activeIsoWeeks, 40)` | 40 |
| Breadth | `B = 50 · N(eligibleProjects, 4) + 50 · N(eligibleCategories, 4)` | 4 each |

For complete evidence, `core = (D + Q + C + B) / 4`. The four weights are fixed
at 0.25. No optional Craft, solo switch, confidence deduction or recency
multiplier enters that formula.

**Delivery** counts distinct `(canonicalProjectId, UTC date)` buckets holding at
least one attributable accepted change. Changed lines and files, the number of
PRs within the same project and day, tool usage and merge latency all have zero
effect on D. This bounds same-project, same-day splitting; it does not claim
immunity to distributing work across dates or projects, and the validation
report measures that remaining incentive rather than asserting it away.

**Quality practices** counts demonstrated practices, not software correctness
rates. Each of rationale, verification, review-or-correction and outcome
follow-up can be satisfied once per work item. Duplicate comments, approval
clicks, reruns and reuploads add nothing. Absence of inspectable evidence is
*unknown*, not zero.

**Consistency** counts active ISO weeks in UTC. There is no weekend, burst or
response-speed penalty, and no tenure normalization: identical evidence with
only the account creation date changed scores identically.

**Breadth** requires attributable work on at least three distinct dates for a
project or a category to be eligible. Stars, forks, watchers, inverse
repository concentration, changed-line magnitude and nominal language counts
carry zero weight.

## Incomplete evidence produces a range, not a lower score

Where coverage is incomplete, each monotone count carries a lower bound from
known qualifying observations and an upper bound from the completions the
recorded coverage allows. Bounds are derived per component and pushed through
the same monotone formula, so the published interval contains every admissible
completion.

This is an **evidence-completion range**, not a statistical confidence
interval. It does not imply that a developer's true ability lies within it.

A range receives a tier only when its entire interval sits inside one tier;
otherwise it receives none. For any non-point dimension, no definitive
archetype is assigned — the UI says insufficient evidence rather than guessing.

Point tiers use the *unrounded* core against the familiar 30 / 70 / 85
boundaries, so a core of 69.9 displays as 70 but remains Solid, and the UI
shows enough precision to distinguish the boundary rather than rounding across
it.

## Craft is separate and optional

`K = 25 · (N(framing, 8) + N(verificationDebugging, 8) + N(toolJudgment, 8) +
N(acceptedOutcome, 8))`, over deduplicated work-item episodes.

Craft is reported **beside** the core and never enters it. An absent, expired
or withdrawn portfolio changes Craft alone. Tool name, tokens, lines, files,
messages, entropy, agent count, parallel usage and reply speed receive zero
automatic credit. Choosing no AI tool, or constraining one, demonstrates
judgment the same way delegating does — a developer who uses no AI tool at all
can submit a full practice portfolio.

No eligible portfolio means `not_observed`, never zero. The optional Artificer
descriptor requires a complete Craft point of at least 60 and at least one
independently corroborated episode satisfying all four criteria including an
accepted outcome; it accompanies the core archetype rather than replacing it.

## Receipts and privacy

Each scored revision issues an immutable public receipt carrying every
aggregate, coverage bound and rubric result needed to replay the arithmetic
offline (`packages/shared/src/score-receipt.ts`). It excludes private paths,
repository names, report contents, tokens and evaluator identities; public
criterion results expose structured status, category, count and safe reason
codes only.

Public replay validates **arithmetic over the issued aggregates**. It does not
establish private-source truth, and issuance is not a claim about the accuracy
of the underlying platform data.

Retractions create new immutable revisions. Existing receipts keep their
historical arithmetic status and can expose a redacted superseded or retracted
status without leaking the private reason.

## Worked figures

Every number in the table below is produced by `calculateCoreV7`, the same
function that scores a real profile, via
`scripts/scoring/generate-impact-v7-doc.ts`. `scripts/scoring/generate-impact-v7-doc.test.ts` fails
if the committed table and a fresh generation disagree, so a published example
cannot drift from the scorer.

<!-- worked-figures:begin -->
Generated from `calculateCoreV7` at reference time `2026-09-01T12:00:00.000Z`.

| Case | Delivery | Quality | Consistency | Breadth | Core | Tier | Archetype |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Complete evidence | 61 | 54 | 73 | 68 | 64 | Solid | Balanced |
| One source incomplete | 61–80 | 54 | 72–81 | 68–78 | 64–73 | none | none |
| No observed evidence | 0 | 0 | 0 | 0 | 0 | Emerging | Emerging |
<!-- worked-figures:end -->

Read the middle row against the first. One incomplete source leaves every lower
bound exactly where it was and raises the upper bounds: missing coverage widens
the interval, it never lowers the score. That row also earns **no tier and no
archetype**, because its interval straddles the 70 boundary and the whole
interval must sit inside one tier before a label is assigned. Saying "somewhere
between Solid and High" is the honest answer there; picking one would not be.

The last row is a truthful zero — a real result with a real tier, not a failure
to compute.

## Where this lives in the code

| Concern | Module |
| --- | --- |
| Core arithmetic | `apps/web/lib/impact/v7.ts` |
| Evidence derivation and bounds | `apps/web/lib/impact/v7-evidence.ts` |
| Craft arithmetic | `apps/web/lib/insights/craft-v7.ts` |
| Receipt schema, sealing, replay | `packages/shared/src/score-receipt.ts` |
| One materializer | `apps/web/lib/profile/score-receipt-v7.ts` |
| One projection consumers render | `apps/web/lib/profile/score-view-model.ts` |
| Explanation from the receipt's trace | `apps/web/lib/dashboard/receipt-explanation.ts` |
| Registered scored consumers | `docs/scoring-consumer-inventory.md` |
