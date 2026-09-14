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

## Local qualification vs. production verification

| Context | Required meaning |
|---|---|
| Local-candidate | Exact clean source/tree, allowlisted production build, loopback probes and full applicable local gates. Zero required skips. No hosted deployment or workflow dispatch. |
| Authorized production default | Actual production identity, core dependencies, public badge/share; real migration admission before promotion and publication readback afterward. |
| Explicit deep production | Default production observations plus share verification, EN/ES and risk-selected charters. |
| Result | Schema2 local-candidate and final proofs outside the tracked candidate; a separate deep report for an explicit deep invocation. |

No local result is presented as production proof. No Vercel Preview deployment
is required or permitted. An Ignored Build Step that skips computation after
creating one does not satisfy the pre-push prevention requirement.

## Historical note

Earlier release procedures and schema1 proofs remain historical evidence. Their
retired architecture is documented in
`docs/plans/2026-08-29-direct-proof-release-pipeline.md`; it is not an active
qualification path. Current ordering is exclusively the release playbook.
