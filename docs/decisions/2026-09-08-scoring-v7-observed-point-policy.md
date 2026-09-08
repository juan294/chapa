# Impact v7.2 observed point and report-derived Craft

Date: 2026-09-08. Status: accepted for local implementation of the approved single-score consistency plan. This records numerical defaults, not a production rollout or empirical calibration claim.

The owner requires one reproducible 0–100 score, the familiar Delivery, Quality, Consistency, Breadth and optional Craft names, and Craft as a fifth radar axis after a valid report. The owner accepts changed scores, including the archived example changing from historical v6 80 to observed v7.2 46. The [implementation policy](../plans/2026-09-08-v7-single-score-consistency-phases/policy.md) is the complete behavioral specification.

## Version boundary

The public product remains Impact v7. Machine policy and algorithm revision are both `v7.2`. The historical policy `v7` / algorithm `v7.1` parser, policy bytes, engine bytes, fixtures and receipts remain unchanged and independently replayable. Phase 1 adds contracts and canonical display behavior only; the running scorer and publication parser remain historical. New artifact digests and independent strict replay belong to phase 4, once the new engine bytes exist. A revision name alone never establishes receipt integrity.

## Core and display

Four fixed weights are 0.25 each. With N(x,c)=ln(1+min(x,c))/ln(1+c), Delivery is 100N(delivery units,120); Quality is 25 times the sum of four criterion normalizations capped at12; Consistency is 100N(active ISO weeks,40); Breadth is 50N(projects,4)+50N(categories,4). Counts use recorded qualifying observations within the existing 365 UTC-date window, eligibility and deduplication rules. Each scalar trace retains its original completion bounds and selected lower observed count. Coverage never becomes invented credit or a claim of no real work.

The archived aggregate example has dimensions 87.36108681546068 / 0 / 48.24894837218527 / 50, exact core46.40250879691149 and display46. Quality0 means no credited practice evidence. Its untouched historical envelope still displays46–100. Craft, confidence, recency and tool usage have zero core weight.

Exact arithmetic remains full precision. Dimension/Craft displays round to the nearest integer. Core does too unless rounding crosses an unrounded tier boundary30/70/85; then truncate to two decimals and remove trailing zeroes. Thus69.999 displays69.99/Solid, while70 displays70/High. The canonical constructor additionally caps a crossing result at boundary−0.01 because binary64 multiplication by100 can round a predecessor onto the boundary. This implements the intended finite truncation semantics for adjacent representable values. Phases2 onward must reuse this display constructor; independent replay must reproduce the same rule.

Archetypes remain exactly as the historical calculator classifies the original bounded inputs. A non-point normalized dimension set remains ineligible; saturated bounds whose normalized endpoints coincide stay eligible. Complete zero stays Emerging. A report cannot change core archetype or create an Artificer rule.

## Report Craft and visual state

The versioned classifier trims ASCII whitespace, lowercases ASCII letters, and collapses ASCII spaces/hyphens/underscores. Only fully_achieved, mostly_achieved, partially_achieved, not_achieved and failed are recognized; failed maps to not_achieved. Duplicate mapped categories reject before map construction. Counts are finite safe nonnegative integers and their checked sum cannot exceed total sessions. Unknown labels stay private; public calculation inputs contain only their aggregate count.

Outcome credits are1/0.7/0.3/0 over all report sessions. Positive total and positive recognized count are required. T10 with fully4, mostly2, partially1, failed1, unknown1 and unclassified1 yields Craft57 and recognized coverage8/10. Failed10 yields a valid scored0. Unknown-only or empty outcomes yield insufficient_report_data, never a fabricated0. Unknown/unclassified sessions are not proven failures. Craft is `report_derived` / `model_estimate`, not independently verified mastery. Tool names, tokens, lines, files, speed and satisfaction are descriptive only.

Reports must be wholly within the annual window and not future-dated. Choose the latest period end then start, never highest score or upload time. Identical digest is idempotent; same-period replacement requires explicit correction lineage. Never sum overlapping aggregate reports. Invalid/insufficient uploads do not erase a previously published valid result.

A successful published scored result, including0, unlocks the fifth Craft axis/card. No report leaves four axes. Expiry retains the fifth labelled slot with an update invitation and historical last-report details, but its current point is null and there is no numeric radar vertex. Removal/withdrawal follows consent. The axis list is presentation metadata and never becomes the arithmetic weight list.

Raw input contracts preserve label/count entries until collision checks. Public canonical report inputs omit labels, raw contents and private identifiers. Persist those numerical replay inputs past raw-body30-day retention until withdrawal. Publication consent, private raw storage, privacy-safe report identity and period/reference-family rules remain required by later phases.

## Checkable foundation and limits

`packages/shared/src/scoring-observed.ts` defines the immutable policy constants, point display, scalar/core contracts, private/public report inputs, explicit scored/insufficient/expired/unavailable states, selection context, radar metadata and exact receipt identity. The machine-readable `packages/shared/src/__fixtures__/scoring-observed-policy.json` pins policy values, canonical scalar examples and the initial C01–C24 acceptance inventory. Inventory status `specified` is not a claim of passing later phases. Existing archived envelopes are referenced as immutable inputs, not rewritten into new receipts.

Foundation tests check the four weights, strict TypeScript discriminants, nullable archetype, no numeric expired point, canonical display examples and binary64 boundary neighbors. Runtime parser rejection of tampering/extra fields and independent replay remain phase4 acceptance. No runtime switch, calculator, migration, deployment or population-fairness claim is introduced by this phase.
