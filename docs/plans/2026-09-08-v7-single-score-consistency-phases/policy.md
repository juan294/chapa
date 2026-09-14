# Proposed v7.2 numerical and presentation policy

Status: proposed by the 2026-09-08 plan. User-facing product remains Impact v7. Owner requirements: a point score, familiar dimensions, report-derived optional Craft, fifth-axis unlock, consistent consumers. Exact rules below are implementation specifications for plan review, not an empirical validity claim.

## Identity and replay

Machine policy `v7.2`; algorithm revision `v7.2`; public schema envelope remains in the v7 family with strict policy-discriminated payloads. Preserve the historical `(policy v7, algorithm v7.1)` parser, exact digests, rules and fixtures. Unknown revision/digest pairs fail closed. A public projection may use `displayVersion: v7`, but API/receipt/history/cache identity must retain `v7.2`.

Do not edit the exact bytes of the September 5 policy or the historical `impact/v7.ts` / `insights/craft-v7.ts` inputs to its digest. New policy and ordered new algorithm source bytes get their own digests. Version the report classifier map, scoring weights, date rules, selected-report rule and display rule as part of the new artifact. Freeze canonical UTF-8 bytes and independent replay before publication.

## Core: observed evidence

Owner clarification: preserving v6 numbers is not a goal; a defensible change from 80 to 46 is acceptable. Apply the same versioned weights, caps, eligibility, time-window and rounding rules to everyone. Equivalent normalized evidence in the same reference context must yield identical results irrespective of account identity or prior score. Comparisons must identify incompatible policy versions rather than imply a common scale. Reproducibility and uniform rules alone do not establish empirical fairness: review sensitivity to missing sources and report classification coverage, explain those limitations, and do not present recorded-evidence scores as complete measures of personal ability.

Reuse the 365 UTC-date window and existing eligibility/identity/deduplication rules. Each evidence count retains its original observed lower and possible-completion upper values internally and in the receipt's evidence metadata. Select the **observed qualifying count**, not an estimated midpoint. Do not set metadata bounds equal merely to make an old parser produce points.

Let N(x,c)=ln(1+min(x,c))/ln(1+c).

- D = 100 N(observed delivery project/date units,120).
- Q = 25 sum N(observed accepted criterion counts,12), over rationale, verification, review-or-correction and outcome follow-up.
- C = 100 N(observed active ISO weeks,40).
- B = 50 N(observed eligible projects,4) + 50 N(observed eligible categories,4).
- CoreExact = (D+Q+C+B)/4. Craft, tool choice/volume, confidence, recency multipliers and solo exclusions do not enter this arithmetic.

Every current scored output is a point. Metadata can still record missing sources/unknown coverage. A missing contribution earns no observed credit; it does not prove no work occurred. Missing Quality assessments must be explained as no credited practice evidence, not bad code. A provider failure must not overwrite a known-good receipt with fabricated empty observations; reuse the existing receipt with truthful freshness or return unavailable, according to the materializer's declared read status.

Example from the archived receipt: D87.36108681546068, Q0, C48.24894837218527, B50, exact core46.40250879691149, display46. The archived v7.1 envelope still replays its original range46–100.

## Precision, tiers and archetypes

Compute all math in full precision. Publish exact numeric points plus one canonical display value/label. Dimension and Craft displays use nearest integer. Core display uses nearest integer unless that would cross an unrounded tier boundary; in that case truncate to two decimals and trim trailing zeroes. Display labels use locale-independent digits in machine contracts; localized formatting must preserve the same numeric value.

Pseudocode: rounded=round(x); if tier(rounded)==tier(x), display=rounded; otherwise display=floor(x*100)/100. Label is canonical finite decimal spelling of display. Tests include values immediately around30/70/85 and binary64 neighbors. Never output '<70', an interval, or Infinity. For instance69.999 displays69.99/Solid;70 displays70/High. The public API's displayScore equals that displayed number; exactScore remains separately available.

Tier thresholds remain unrounded30/70/85. Archetype names/tie order and existing evidence eligibility stay unchanged. Preserve eligibility exactly as calculateCoreV7(originalBoundedInputs).core.archetype, or its independently tested equivalent: all four normalized score endpoints must coincide, not all raw bounds or all source coverage. Saturated dimensions can be points despite incomplete sources; they retain the old eligible classification. Choosing an observed point alone does not make an originally non-point dimension set eligible for a definitive archetype. Missing archetype yields neutral/absent prose everywhere, never a fallback v6 Builder. Complete zero keeps Emerging; incomplete-source saturation with all score endpoints equal keeps the existing definitive archetype. No new Artificer assignment rule in this plan; report upload unlocks Craft, not an unearned independent-corroboration claim. Later archetype review is outside this plan.

## Report-derived Craft

Visible name **Craft**. Basis: CC report outcome classifications; provenance `report_derived` / `model_estimate`, not human verification. No reviewer or dated-work-item form is required to obtain a score from a supported report.

Validate report period, finite safe counts and total consistency. Let T be totalSessions. Use this closed versioned mapping: trim surrounding ASCII whitespace, lowercase ASCII letters, and replace runs of ASCII spaces/hyphens/underscores with one underscore; fully_achieved→fully_achieved (credit1), mostly_achieved→mostly_achieved (0.7), partially_achieved→partially_achieved (0.3), not_achieved→not_achieved (0), failed→not_achieved (0). No camel-case, translated, fuzzy or additional failure aliases are inferred. Retain every unmapped label/count as unknown. Reject two raw labels that normalize/map to the same category, before object construction or overwriting; do not sum possibly duplicate chart bars. Preserve unknown labels privately, but expose only their aggregate count in public receipts. Define unclassified=T−sum(all supplied outcome counts), using checked integer addition; reject negative/unsafe totals or totals exceeding T. A later alias extension requires a new report-classifier identity/replay rule, not silent interpretation of an old receipt. Do not silently drop failure categories.

If T>0 and the sum of recognized outcome COUNTS is greater than0 (recognized keys with zero counts do not qualify):

`CraftExact = 100 * (fully + 0.7*mostly + 0.3*partially) / T`.

Sessions with failed, unknown or no outcome contribute no earned outcome credit; preserve separate counts, so an unknown session is never called a demonstrated failure. Disclose classified/T coverage and the report period. With no recognized outcomes or T=0, result is insufficient_report_data, not zero. Recognized failures only produce a legitimate scored0.

Example T10, fully4, mostly2, partially1, failed1, unknown1, unclassified1: Craft57; recognized coverage8/10. Doubling every session/outcome count leaves57. Changing tool names, tokens, lines, files, response times or message volume leaves57. Satisfaction including likely_satisfied remains descriptive only.

This deliberately makes coverage affect **credited report outcomes per session**. It does not estimate latent success or individual ability. Do not label it independently verified mastery or invent subdimension scores for proficiency/sophistication. Legacy detailed panels remain historical; current Craft explanation shows the actual numerator/denominator and classification counts.

## Report selection and visible unlock

A correct scoring report has a valid supported schema/period and usable recognized outcome data. Its successful persisted/publication result unlocks the fifth radar axis and fifth breakdown card; score0 is included by status, never by truthiness. No report leaves four axes and an upload invitation. Invalid/insufficient uploads show a specific recovery state and do not invent a fifth numeric value or hide a previously published valid Craft result.

The supported report declares inclusive UTC calendar start/end dates. Reject a declared end later than the first server-capture UTC date. Convert start to midnight and end to the earlier of next midnight after the declared end or first server capture; persist this immutable cutoff as `declared_dates_first_capture_v7.2`. Canonical report content is digested independently of capture time, so identical retries retain the original cutoff and never rejuvenate old evidence. Rank using these effective observation instants. Different content for the same declared date pair requires explicit correction even when capture cutoffs differ.

Select one currently eligible report, never sum overlapping aggregate reports. Eligibility: report wholly within the current annual evidence window and not future-dated. Historical/straddling reports remain viewable with their period/limitation but do not manufacture a prorated current score. Rank eligible valid reports by observation-period end, then start. For the same period, a different upload is an explicit replacement/correction linked to the prior report; exact digest duplicate is idempotent. Do not choose highest score. Older uploads cannot replace a newer current report.

After the first successful unlock, expiry alone does not erase the capability: keep a visible Craft slot with 'Update insights' and historical last-report details, but no stale point masquerading as a current dimension. The radar must retain its fifth labelled spoke with unavailable state and no plotted numeric Craft vertex; it must not turn missing into zero. Explicit report removal/withdrawal removes public Craft according to consent. No new expiry or deletion UI is introduced solely by this plan; honor existing flows and test the state contract.

Report upload changes only Craft and its receipt context. For fixed core evidence/reference context, core inputs, exact score, display, tier and archetype stay byte-identical; receipt hash can change because Craft changed. If the accepted report extends beyond the baseline referenceTime, or the UTC reference date has advanced, capture a new observation context/family and re-evaluate retained normalized core evidence against that window before attaching the report. Reproject retained dated core observations into the new window. If only old aggregates are available, refresh through the normal bounded authorized source path or retain the old receipt explicitly as stale/unavailable; never stamp old aggregates with a new window. Reuse a frozen context only when it contains the report period/evidence. Natural window expiry can change the core and is recorded as a time-window change, never credited to Craft. Do not insert a future report into an old frozen receipt merely to keep the headline unchanged. A retry repairs publication/invalidation without reupload, extra score credit or a second cooldown.

## Consent and privacy

Keep the familiar import flow with a clear action label/disclosure that the derived score and numerical calculation receipt are public, while report contents stay private. Existing valid public-receipt consent is reused. If missing, collect the existing required publication acknowledgment inline before the same import/publish action; do not silently grant unrelated reviewer/private-evidence access or require a separate settings journey. Authenticated API callers must supply the same explicit acknowledgment before first public publication; importing privately without acknowledgment cannot claim a publicly unlocked badge.

Persist the minimal canonical calculation inputs/trace and report period independently of raw report retention. Raw contents expire under the existing30-day rule; arithmetic must still replay until publication withdrawal/deletion. Public receipts expose allowlisted aggregate counts only, no raw HTML, paths, private URLs, tool transcripts or evaluator identities. Withdrawal revokes all supported revisions and clears rendered copies; historical independent downloads cannot be recalled.

## Receipt semantics

A semantic digest covers current policy/algorithm/rules, observed inputs and underlying coverage, core/Craft results/traces, selected report period/content identity in a privacy-safe form, criteria/provenance, exclusions and limitations. Canonicalize unordered collections before assigning receipt-local ordinals. Omit only newly allocated receipt IDs, publisher timestamp and incidental caller referenceTime copies; do not omit genuine dataThrough or changed periods.

Unchanged same-day evidence returns the exact prior envelope and repairs missing verification. New captured observations, a new date or a new machine policy start a new receipt family. Explicit corrections target a frozen referenceTime and preserve family with incremented revision/supersedes link. Never chain a new current-time observation onto a predecessor that the SQL lineage contract forbids. Trend segmentation includes machine policy; same-day changes derive from the preceding-day anchor, not today's already-smoothed value.

## All-consumer contract

One point view model carries machine policy, revision/hash, exact and display scores, four core dimensions, optional Craft status/point, tier, nullable archetype, coverage/freshness and receipt explanation. Rendered radar axes are a presentation list: four core axes plus Craft when unlocked; this list must never become the composite-weight input. All numeric content derives from the model, including coach text, API, tools and leaderboard. Histories and hypothetical simulations carry explicit different context and must not impersonate the current receipt.
