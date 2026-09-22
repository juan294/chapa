# Impact v7.2 — observed engineering activity and practices

The current machine policy is `v7.2`, governed by the frozen
[September8 policy](plans/2026-09-08-v7-single-score-consistency-phases/policy.md)
and its [decision record](decisions/2026-09-08-scoring-v7-observed-point-policy.md).
The earlier machine `v7` / algorithm `v7.1` retains its original immutable
receipts, range arithmetic and replay. [Legacy v6](impact-v6.md) remains the
rollout-off policy and an explicitly labelled fallback when no current receipt
exists. An unavailable authoritative read is not genuine absence.

This index describes recorded evidence in a declared source scope. It does not
certify developer ability, causal impact, architecture, reliability or security.
Constants are product choices, not percentiles or externally validated mastery
thresholds. The historical empirical pilot remains unperformed under the
existing owner decision; local conformance tests do not constitute that pilot.

## One context and four core dimensions

Capture one reference time. The window includes its UTC date and the preceding
364 UTC dates, from midnight(referenceDate − 364) to midnight(referenceDate + 1),
end exclusive. Evidence later than referenceTime is rejected even on the same
date. This is 365 calendar dates including a partial current day, not 8760 hours.

Let `N(x,c) = ln(1 + min(x,c)) / ln(1+c)` for the known qualifying count `x`.

| Dimension | Exact formula |
|---|---|
| Delivery | `D = 100 × N(deliveryUnits,120)` |
| Quality practices | `Q = 25 × Σ N(criterion,12)` over rationale, verification, review/correction and outcome follow-up |
| Consistency | `C = 100 × N(activeIsoWeeks,40)` |
| Breadth | `B = 50 × N(eligibleProjects,4) + 50 × N(eligibleCategories,4)` |

For every coverage state, `core = (D + Q + C + B) / 4`. Each weight is 0.25.
Craft, confidence, recency and solo/collaborative switches never enter this
average. Never average rounded dimension displays to recompute the core.

Delivery counts distinct canonical-project/UTC-day buckets containing
attributable accepted work. Repeated same-day changes do not add buckets.
Each Quality criterion counts once per qualifying work item; duplicate
comments, approvals and reruns do not add credit. Consistency counts active ISO
weeks, with no weekend, speed, burst or account-age adjustment. A project or
category needs attributable work on three distinct dates for Breadth.
Stars, forks, watchers, line magnitude and tool usage have zero scoring weight.

## Points, coverage and canonical display

Current points use known qualifying observations. Missing or inaccessible
evidence does not receive estimated credit and is not a judgment of ability.
Original bounds, source coverage and exclusions remain receipt metadata;
they do not turn the current headline into a range or a confidence deduction.

Tier uses the unrounded core: Emerging below 30, Solid from 30 to below 70,
High from 70 to below 85, Elite from 85 through 100. Ordinary display rounds to the
nearest integer. If that would cross the exact core's tier boundary, use the
registered canonical two-decimal display. For example, exact
`69.99723619005769` displays `69.99`, Solid; it never becomes70/High.
Keep exact and display fields separate and never round the display again.

Archetype eligibility is unchanged: the pinned historical normalization of the
original count bounds must yield point dimensions. Saturated bounds can agree;
otherwise the archetype is null. Existing names remain, with no new report
mastery labels or fabricated archetype-specific coaching.

## Optional report-derived Craft

`Craft = 100 × (fully + 0.7 × mostly + 0.3 × partially) / totalSessions`.

The first valid scored Claude Code insights report unlocks the fifth visible
axis/card. A positive total and at least one recognized outcome are needed.
A recognized failed outcome contributes zero and is a legitimate scored result;
a report of ten recognized failures yields Craft 0 and still unlocks the axis.
Unknown labels and unclassified sessions remain in the denominator with zero
credit, but are not described as proven failures. Classified coverage and the
report period are shown separately.

Example: total 10, fully 4, mostly 2, partially 1, failed 1, unknown 1, unclassified 1
produces credited 5.7, Craft 57, with 8/10 classified. Craft never changes core 46
into another core score. No report shows four axes; valid 57 and valid 0 show
five. Expired/unavailable Craft preserves its unlocked labelled spoke and update
guidance, without a numeric vertex or fake 0.

Selection uses the newest eligible effective report period, then deterministic
capture/identity ties. It never pools reports or chooses the highest score.
Same-period replacement requires explicit correction. Older or insufficient
uploads cannot displace a still-valid scored report. Canonical aggregate
inputs survive raw-body expiry for replay; raw report labels, hashes and HTML
stay private. Report Craft does not assign Artificer or assess personal ability.

## Receipt and consumer agreement

Current strict parsing/sealing lives in `packages/shared/src/score-receipt-observed.ts`;
registered replay dispatches exact policy/algorithm pairs. Unknown fields,
unknown pairs, mismatched hashes or inconsistent arithmetic fail closed.
Receipts contain public numeric aggregates, coverage, constants and trace, not
private names, locators, tokens or raw report material. Arithmetic replay does
not establish source truth or issuance authentication; verification reports
those dimensions separately and preserves superseded/revoked/not-found states.

The shared `ScoreViewModel` supplies badge, OG, share, Studio, API, tools,
leaderboard, history and email. Canonical values and receipt revision/content
hash must agree. Current simulations are explicitly hypothetical under the
same fixed baseline/window; they publish nothing. Mixed policy or annual-window
comparisons do not claim an improvement. Current history preserves durable
policy-segmented EMA independently of displayed points.

Current source modules: `lib/impact/observed-v7.ts`,
`lib/insights/report-craft.ts`, `lib/profile/score-receipt-observed.ts`,
`lib/profile/score-view-model.ts`. See [reproduction](scoring-reproduction.md),
[consumer inventory](scoring-consumer-inventory.md),
[flag rollback](runbooks/scoring-v7-transition.md) and
[local release proof](release/release-playbook.md).

## Archived generated v7 / v7.1 figures

The following generated table is retained byte-for-byte as historical evidence.
It describes the archived range policy, not current v7.2. Its generator and
frozen engines remain unchanged. The observed owner fixture separately replays
exact 46.40250879691149/display 46 while its archived envelope replays46–100.

<!-- worked-figures:begin -->
Generated from `calculateCoreV7` at reference time `2026-09-01T12:00:00.000Z`.

| Case | Delivery | Quality | Consistency | Breadth | Core | Tier | Archetype |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Complete evidence | 61 | 54 | 73 | 68 | 64 | Solid | Balanced |
| One source incomplete | 61–80 | 54 | 72–81 | 68–78 | 64–73 | none | none |
| No observed evidence | 0 | 0 | 0 | 0 | 0 | Emerging | Emerging |
<!-- worked-figures:end -->
