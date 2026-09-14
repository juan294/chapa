# Scoring v7 validation protocol

Date: 2026-09-06. Frozen before any comparative score was viewed.

This is the prespecified protocol for validating Impact v7 before relaunch. It
covers two separable things, and the distinction is the point of the document:

1. **Arithmetic and invariant conformance**, which code can establish and which
   is complete. It proves the implementation obeys the rubric.
2. **Empirical feasibility**, which only a human pilot can establish and which
   is **not** complete. It asks whether the rubric can be applied consistently
   by real reviewers to real work.

Passing (1) says nothing about (2). A suite of fixtures tests this rubric
against its own rules; it cannot tell you the rules are usable, and it is not
calibration.

## Part 1 — invariant conformance (complete)

Executed by `apps/web/lib/impact/v7-fairness.test.ts` over the matched-pair
fixtures in `apps/web/test/fixtures/scoring-v7/matched-pairs.ts`. A matched pair
changes exactly one thing policy says must not matter and holds everything else
identical; if the two members differ in any other way, a passing test proves
nothing.

| Invariant | What is held identical | What varies |
| --- | --- | --- |
| AI disclosure invariance | artifacts, acceptance, dates, assessments | recorded AI provenance |
| Change-size invariance | project, date, acceptance | additions/deletions, including deletion-only |
| Split resistance | work item content, date | number of artifacts on the same project/day |
| Tenure invariance | all evidence | account age (absent from the scored input by construction) |
| Role representation | window, coverage | implementation, one-line, deletion-only, docs, review, direct push, maintenance |
| Visibility redaction | all events | one source's repository discovery completeness |
| Unknown ≠ zero | events | inspected rejection vs. no assessment |
| Monotonicity | window, coverage | added evidence |

Redaction cases are **synthetic missingness interventions**. They say nothing
about real private populations; they test that the bounds behave correctly when
coverage is withheld.

## Part 2 — sensitivity to normative choices (complete)

Executed by `scripts/scoring/validate-policy.ts` over eight profile *shapes*
(saturating, sparse, lopsided, boundary-adjacent). Each normalization cap is
varied by ±20% and each core weight by ±5 percentage points with the remainder
redistributed equally; the script reports tier changes, archetype changes and
maximum core movement.

These are shapes, not people. The output quantifies how much a published label
depends on a product choice. A large movement is information to publish, not a
defect to tune away — but a variant that *reversed* a required invariant would
be a policy contradiction and would block relaunch. `validate-policy.test.ts`
checks that no variant breaks monotonicity or leaves the 0–100 scale.

## Part 3 — empirical pilot (NOT STARTED — blocks relaunch)

The pilot is specified here and deliberately not begun, because starting it
requires authorization this work does not have.

- **Sample**: a retrospective convenience pilot of 24 public or consenting
  profiles across six primary work-role groups (implementation,
  verification/review, documentation/design, maintenance, incident/reliability,
  mixed/solo), four per group. Every supported provider represented by at least
  four profiles. At least six paired visibility-redaction cases.
- **Item selection**: six work items per profile by a frozen deterministic rule
  independent of score and AI labels — four development items and two locked
  held-out items, 144 items total.
- **Assessment**: two independent rubric assessments per item, blinded to AI
  labels where feasible. Reviewer type (human or model), identity, version,
  conflicts and limitations recorded for each.
- **Human participation**: at least one independent human domain reviewer must
  take part in final assessment and adjudication. No rater agreement may be
  fabricated, and a model reviewer's verdict is not an independent human review.
- **Gates**: at least 85% pre-adjudication agreement, and at least 80%
  positive-specific and negative-specific agreement per criterion on the locked
  held-out set. Confusion matrices and positive/negative counts published. An
  all-positive or all-negative set, or a zero denominator, cannot satisfy the
  gate. Every disagreement adjudicated; after any rubric revision, a fresh
  locked held-out sample is required rather than reporting agreement on
  previously adjudicated cases.
- **Usability gate**: median core interval width at most 25 points, and at least
  18 of 24 profiles at most 40 points wide. Failure requires better collection
  or a reviewed policy revision — never hiding unknown evidence or dropping a
  source to narrow a range.

**No outreach, recruitment or contact of any person is authorized.** Public data
may be reviewed read-only. Consenting private evidence and any external contact
require the user's explicit authorization. If a provider sample, a role group or
a human reviewer cannot be secured, pilot completion remains a relaunch blocker.
Synthetic fixtures cannot substitute for empirical cases, and no pilot result
may be generalized to population percentiles or presented as proof of universal
fairness.

## Reporting

Results go to `docs/research/scoring-v7-validation-results.md`: what was
executed, what was observed, and what remains open — with the limits of
generalization stated rather than implied.
