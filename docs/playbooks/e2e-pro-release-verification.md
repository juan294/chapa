# Chapa Deep Verification Playbook (E2E Pro)

**Daily release procedure:** `docs/release/release-playbook.md` (via
`/release`). This document covers **deep, explicit, risk-selected**
verification only — it is never a required step of a default release.

## Scope

Deep verification exists to answer a question the default release path
deliberately does not spend on every release: has this deployed candidate's
*behavior* — not just its identity and required CI — been exercised broadly
enough, including interaction and recovery paths deterministic suites miss?

It is invoked two ways:

- **`/prodplaybook [tag-or-sha]`** — a read-only, exhaustive audit of a fixed
  production target. Runs deterministic checks plus
  `RELEASE_VERIFICATION_MODE=deep` deployed probes, and fresh-context
  exploratory charters when requested or risk-selected. Writes
  `docs/agents/prodplaybook-report.md`. Never versions, releases, merges,
  tags, publishes, deploys, or mutates production.
- **`/explore-release <commit-or-tag> [risk-scope]`** — fresh-context
  exploratory charters against a fixed candidate. Sized to the actual risk
  (1 charter for a tiny diff, more for distinct high-risk capability groups).
  Returns one concise report. Never tags or gates a release by itself.

Both tools are explicit and opt-in. Neither maintains a separate
requiredness catalog, schema set, evidence importer, merger, or analyzer —
`apps/web/e2e/helpers/release-required-environments.ts` is the single
executable authority for which deployed scenarios exist at which mode, and
`scripts/quality/release-result.ts` is the single compact-result contract
both the default release path and deep verification write results through.

## Default vs. deep

| | Default (`/release`) | Deep (`/prodplaybook`, `RELEASE_VERIFICATION_MODE=deep`) |
|---|---|---|
| Preview scenarios | identity, core dependencies, public badge, public share, rollback readiness | + login redirect, protected-write-denied, share verification, `en`/`es` locale |
| Production scenarios | identity, core dependencies, public badge, public share | + share verification, `en`/`es` locale |
| Exploratory charters | not run | run when requested or risk-selected |
| Result | one `release-result.json` per stage (Preview, final) | one `docs/agents/prodplaybook-report.md` per invocation |
| Controls release mechanics | yes | no — advisory only |

## Historical note

This document previously described a much larger evidence-graph
architecture: a JSON requiredness catalog (`quality/release-required.json`),
five JSON schemas, CI evidence producers/importers/mergers, a pre-merge and a
final analyzer, and a rendered `release-report.md` — plus mandatory
eight-maneuver exploratory charters feeding that analyzer as blocking input.
That machinery duplicated the plain facts it was reconstructing (an exact CI
check conclusion, a deployed identity match) through several serial import
and aggregation stages, and was retired in favor of the direct-proof design
above (`docs/plans/2026-08-29-direct-proof-release-pipeline.md`). Completed
release reports and research from before that date remain historically
accurate for the release they describe; they are not upgraded retroactively
and are not a live specification.
