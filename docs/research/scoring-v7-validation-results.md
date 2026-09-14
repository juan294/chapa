# Scoring v7 validation results

Date: 2026-09-06. Protocol: `scoring-v7-validation-protocol.md`.

## Status

| Part | Status |
| --- | --- |
| 1. Invariant conformance | **Complete.** 19 matched-pair invariants pass. |
| 2. Sensitivity to normative choices | **Complete.** 16 variants measured. |
| 3. Empirical pilot | **Not started. Blocks relaunch.** |

Parts 1 and 2 establish that the implementation obeys the rubric and quantify
how much the published labels depend on product choices. Neither is empirical
evidence about fairness, and neither is calibration. Only Part 3 can speak to
whether real reviewers can apply this rubric consistently to real work, and it
has not been run.

## Part 1 - invariant conformance

`apps/web/lib/impact/v7-fairness.test.ts`, 19 assertions, all passing.

Observed and confirmed:

- Identical evidence scores identically with and without recorded AI
  provenance. Tool choice, tool volume and disclosure carry no weight.
- A one-line change and a deletion-only change score exactly as a large change
  does on the same project and day.
- Forty artifacts on one project/day produce the same delivery units and active
  weeks as one.
- Nothing in the scored input can carry account age; the counts object has
  exactly five keys and none of them encodes tenure.
- All seven represented work roles score without error, including a reviewer
  profile (active weeks without delivery units) and a direct-push author whose
  acceptance is a first-reachability event.
- Redacting one source's repository discovery leaves every lower bound
  unchanged, raises upper bounds, and produces a range containing the
  complete-evidence result. The redaction is recorded as its own
  `discovery_incomplete` limitation rather than absorbed into a lower score.
- An inspected rejection closes a criterion at zero; an unassessed item stays
  open at the top. Unknown is not zero.
- A truthfully empty profile scores an exact point zero at the Emerging tier -
  a real result, not a failure to compute.
- Adding evidence never lowers a bound.

## Part 2 - sensitivity to normative choices

`scripts/scoring/validate-policy.ts`, eight profile shapes.

Sensitivity over 8 profile shapes

| Variant | Tier changes | Archetype changes | Max core delta |
| --- | --- | --- | --- |
| cap:deliveryUnits:-20% | 0/8 | 1/8 | 1.14 |
| cap:deliveryUnits:+20% | 0/8 | 0/8 | 0.85 |
| cap:quality:-20% | 0/8 | 0/8 | 1.94 |
| cap:quality:+20% | 0/8 | 1/8 | 1.45 |
| cap:activeIsoWeeks:-20% | 0/8 | 2/8 | 1.44 |
| cap:activeIsoWeeks:+20% | 0/8 | 1/8 | 1.15 |
| cap:breadth:-20% | 0/8 | 1/8 | 2.34 |
| cap:breadth:+20% | 0/8 | 1/8 | 2.11 |
| weight:delivery:-5pp | 0/8 | 0/8 | 4.31 |
| weight:delivery:+5pp | 0/8 | 0/8 | 4.31 |
| weight:quality:-5pp | 0/8 | 0/8 | 3.79 |
| weight:quality:+5pp | 0/8 | 0/8 | 3.79 |
| weight:consistency:-5pp | 0/8 | 0/8 | 2.38 |
| weight:consistency:+5pp | 0/8 | 0/8 | 2.38 |
| weight:breadth:-5pp | 0/8 | 0/8 | 1.23 |
| weight:breadth:+5pp | 0/8 | 0/8 | 1.23 |

Three observations worth publishing rather than tuning away:

- **Tier is stable across every variant tested.** No cap change of plus or minus
  20% and no weight change of plus or minus 5pp moved any of the eight shapes
  across a tier boundary.
- **Archetype is the more normative label.** A cap change moved the archetype
  for up to two of eight shapes, while no weight change moved one. Archetype
  depends on the *relative* ordering of dimensions, which a cap change can
  reorder and a proportional weight change cannot.
- **The weights matter more than the caps for core movement.** A 5pp weight
  change moves the core by up to 4.31 points; a 20% cap change by at most 2.34.
  That is the reason the four fixed 0.25 weights are the policy choice most
  worth arguing about, and it is stated here rather than buried.

No variant reversed a required invariant. `validate-policy.test.ts` checks
monotonicity and scale closure across variants; both hold.

## Part 3 - empirical pilot: not started

The protocol is frozen. Nothing has been executed, and nothing here should be
read as partial pilot evidence.

**Why it has not started:** the pilot requires reviewing real profiles and
securing at least one independent human domain reviewer. No outreach,
recruitment or contact of any person has been authorized, and this work does
not authorize it. Beginning selection or assessment without that authorization
would produce data the protocol forbids using.

**What this means for relaunch:** pilot completion is a relaunch blocker under
the frozen policy. It cannot be waived, deferred past relaunch, or satisfied by
the fixtures in Part 1 - those test this rubric against its own rules and are
explicitly not empirical calibration.

**What is needed to start:** the user's explicit authorization to (a) review the
selected public profiles read-only, (b) approach candidate participants for
consenting private evidence, and (c) engage at least one independent human
domain reviewer. Until then this section stays empty, and no agreement figure,
confusion matrix or interval-width statistic exists for this policy.

## Limits of what is reported here

Nothing above is a percentile, a calibrated confidence, or evidence about a
population. The invariants demonstrate arithmetic conformance to a published
rubric. The sensitivity table quantifies dependence on product choices over
eight synthetic shapes. Neither supports a claim about any individual
developer's ability, and neither generalizes beyond the cases listed.
