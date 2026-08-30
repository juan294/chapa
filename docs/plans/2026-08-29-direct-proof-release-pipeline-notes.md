# Deviations — `2026-08-29-direct-proof-release-pipeline`

## Phase 2

Plan said: modify `scripts/quality/release-result.ts` and
`scripts/quality/release-result.test.ts` in Phase 2.
Found: the Phase 1 module (builders, validators, `writeResult`, and the
`--stage/--input/--output` CLI) was already generic enough for the new
`release-verification.yml` job to consume via a `jq`-constructed input file.
Chose: made no further changes to `release-result.ts`/`.test.ts` in Phase 2.
Why: no gap existed between what Phase 1 built and what the workflow needed;
changing it anyway would have been unmotivated churn.

## Phase 3

Plan said (pseudocode): watch required PR checks and dispatch/watch/download
the Preview proof "in one wave," without specifying shell mechanics.
Found: the natural literal reading (`&` + `wait "$pid"`) is exactly the
"shell backgrounding that hides exit codes" the same phase explicitly
forbids ("Do not prescribe a shell backgrounding implementation that hides
exit codes").
Chose: `docs/release/release-playbook.md` describes the two observations as
concurrent-but-separate (separate terminal sessions or a CI watcher) rather
than prescribing a single backgrounded shell snippet.
Why: follows the phase's own explicit constraint; a background job's exit
status is exactly the kind of hidden-status pattern the direct-proof design
is meant to eliminate.

Plan said: keep the maneuver set's "all eight maneuvers" character list.
Found: Phase 3 §4 explore-release direction says to "Remove mandatory
eight-row completeness." Chose: `explore-release.md` still names all eight
maneuver ideas inline (double-submit, error recovery, interruption, second
session/role, locale/viewport, copy-vs-behavior, downstream readback,
"should this exist?") but no longer requires every charter to attempt and
report all eight as a fixed table row set — a charter now sizes its
maneuver set to its own risk hypothesis. Why: matches "size the maneuver
set to risk," the phase's stated replacement for the old fixed form.

`scripts/quality/validate-release-docs.ts`'s order-check markers deviate
from the wording implied by the master-plan pseudocode section names:
- "required checks + migrations + Preview proof < squash merge" is checked
  via the literal strings `"gh run download"` and
  `"pending migrations check (release"`, not a generic `"release-result.json"`
  marker. Found: `release-result.json` is also named once, earlier, in the
  playbook's own "Scope and authorization" prose (explaining that it's the
  proof format) — using it as an order marker would false-positive against
  that unrelated, earlier mention. Chose the two literal command/check-name
  markers instead, which only appear at their real usage points.

## Phase 5

Completed locally, in this worktree, without external authorization:
- **Local timing rehearsal** (§1): `git diff --check` + `release:validate-docs`
  + `validate:migrations` + `test:contract:local` + `build`, warm dependency
  cache, sequential — **~30 seconds total** (0s / 0s / 1s / 5s / 24s), well
  under the 5-minute target.
- **Mocked failure rehearsal** (§2): every listed failure mode (wrong Preview
  SHA, wrong Preview environment, wrong candidate tree, a failed probe
  writing `status: failed`, a passed result rejecting an embedded failed
  check, a source-mismatch rejection) is already covered by
  `scripts/quality/release-result.test.ts` and
  `scripts/quality/verify-deployment-identity.test.ts` from Phases 1-2 — no
  new tests were needed; both suites were re-run to confirm still green.
  "Publication-only recovery does not invoke deployment logic" is a
  structural property of `release-result.ts` (it performs no network or
  process-spawning calls, only `fs` reads/writes and pure validation),
  verified by inspection rather than a new test.

**Not performed — require separate explicit authorization not given in this
session:**
- §3 Authorized immutable Preview canary (push a candidate, dispatch
  `release-verification.yml` remotely, watch/download/verify the result).
- §4 Authorized branch-protection alignment (`gh api` mutation of `main`'s
  required status checks + readback).
- §5's "exact candidate SHA" full repository verification presumes a PR/SHA
  that only exists after those two authorized steps run; not attempted.

These remain open per the plan's own Authority and stop conditions (section
16): "Preview dispatch, branch-protection mutation, push, merge, deployment,
tag, publication, production probe, and rollback still need their own
explicit authority."

## Pre-existing, unrelated to this plan

`actionlint .github/workflows/*.yml` reports findings in `bundle-size.yml`,
`claude-review.yml`, and `coverage.yml`, plus two shellcheck style warnings
(SC2129, SC2086) inside `ci.yml`'s `test` and `test-shard` jobs. Confirmed via
`git stash` that all of these exist identically on the pre-plan baseline —
none were introduced by this work. `release-verification.yml` (fully
rewritten in Phase 2) has zero actionlint findings.
