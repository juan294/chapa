# Phase 5 — Establish the Single Operational Release Authority

**Status:** Complete
**Depends on:** Phase 4
**Batch:** no; this phase reconciles every release instruction onto one executable order.
**Goal:** make the short playbook the single procedure, make `/release` gate tagging on final evidence, and make `/explore-release` emit schema-valid charter results.

## Files

### Create

- `docs/release/release-playbook.md`

### Modify

- `.claude/commands/release.md`
- `.claude/commands/explore-release.md`
- `docs/runbooks/release-checklist.md`
- `docs/runbooks/deployment-smoke.md`
- `docs/runbooks/migrations.md`
- `docs/runbooks/rollback.md`
- `docs/runbooks/incident-response.md`
- `docs/runbooks/observability.md`
- `CLAUDE.md`
- `CLAUDE.local.md` locally, if its merge command still conflicts with the repository's squash-only release strategy

The current `/release` retains version selection and full-diff human gates and then performs the develop-to-main squash/tag flow. (`.claude/commands/release.md:61-81`, `.claude/commands/release.md:83-148`, `.claude/commands/release.md:238-292`)

## Implementation

### 1. Write the short procedural source

`docs/release/release-playbook.md` stays at 200 lines or fewer and contains only:

- scope and authorization;
- preflight;
- version/diff preparation;
- candidate fixation;
- exact-SHA CI and preview verification;
- deterministic, exploratory, and manual obligations;
- pre-merge analyzer;
- authorized squash promotion;
- main tree and production identity verification;
- production-safe read-only probes;
- final analyzer;
- explicit tag authorization;
- tag and GitHub release;
- evidence attachment;
- monitoring and rollback links.

Feature-level instructions remain in runbooks.

### 2. Make `/release` a dispatcher

At startup, `/release` reads the short playbook completely and follows it rather than maintaining a divergent procedure.

The adapted execution order:

```text
orient and choose version
prepare version/changelog and obtain full-diff approval
commit and push develop release candidate after authorization
fix developCommit and candidateTreeDigest
wait for exact-SHA CI and preview
prepare release run
run/import required deterministic and preview evidence
run /explore-release against the same candidate
complete authorized manual obligations
analyze pre-merge evidence
obtain merge authorization
create or reuse develop -> main PR and squash merge
resolve mainCommit and verify main tree == candidate tree
wait for production /api/version == mainCommit
run production-safe read-only probes
analyze final evidence
present report and obtain explicit tag authorization
tag mainCommit and create GitHub release
attach evidence manifest and report
perform post-release reads or roll back
```

This places evidence and authorization before tag creation as required by the blueprint. (`/Users/juan/code/cc-rpi/templates/e2e-pro-playbook-template.md:352-367`, `/Users/juan/code/cc-rpi/templates/e2e-pro-playbook-template.md:997-1105`)

### 3. Integrate `/explore-release`

Preserve its current immutable refs, fresh contexts, eight maneuvers, safety contract, findings handoff, and no-fix/no-tag boundary. (`.claude/commands/explore-release.md:22-125`)

Change its inputs and outputs:

```text
input:
  quality/evidence/runs/runId/candidate.json
  authorization classes
  diff

output per charter:
  charterId
  candidateTreeDigest
  executorContext
  timeboxMinutes
  riskHypothesis
  maneuvers 1..8
  findings
  skippedHighRiskAreas
  fixtures
  cleanupEvidence
  decision
```

Validate each charter against `exploratory-charter.schema.json` before it can enter the final manifest.

### 4. Reconcile subordinate runbooks

- `release-checklist.md` retains detailed OAuth, badge, share, locale, migration, cron-readiness, and post-release arcs but points to the short playbook for ordering.
- `deployment-smoke.md` describes identity plus current core-dependency semantics; it no longer says overall cron-driven health is a deployment gate when the executable test intentionally separates those signals. (`apps/web/e2e/smoke.spec.ts:19-41`, `docs/runbooks/deployment-smoke.md:34-46`)
- `migrations.md` remains the database operation authority.
- `rollback.md` adds the evidence-approved previous deployment identity and preserves separate database rollback. (`docs/runbooks/rollback.md:11-64`)
- incident and observability runbooks link release evidence IDs when escalation or rollback occurs.
- `CLAUDE.md` points release work to the short playbook.

### 5. Reconcile merge strategy

The canonical tracked command uses squash auto-merge for `develop → main`. (`.claude/commands/release.md:238-287`)

Align any local instruction that still demonstrates `gh pr merge --merge` with the repository's squash-only behavior. Do not commit `CLAUDE.local.md`; it is local and gitignored. (`.gitignore:57-60`)

### 6. Preserve authorization pauses

The command stops for:

1. version choice;
2. full diff approval;
3. external CI/preview verification when it creates cost;
4. release PR and merge approval;
5. production verification operations beyond read-only probes;
6. final tag and release authorization.

No approval is inferred from an analyzer pass.

## Automated success criteria

```text
test "$(wc -l < docs/release/release-playbook.md | tr -d ' ')" -le 200
pnpm run quality:validate
pnpm vitest run scripts/quality/analyze-release-run.test.ts
pnpm vitest run scripts/quality/render-release-report.test.ts
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run build
git diff --check
```

Add a documentation contract test or repository script that fails when:

- `/release` does not link the short playbook;
- the short playbook omits candidate, analyzer, authorization, tag, or rollback stages;
- another tracked file claims a conflicting merge strategy or tag order;
- the short playbook exceeds 200 lines.

## Manual success criteria

- Follow the playbook as a dry walkthrough and confirm no ordering decision requires a second document.
- Confirm runbooks provide detail without restating the top-level sequence.
- Confirm `/explore-release` produces all eight maneuver rows and a schema-valid charter fixture.
- Confirm tag creation is unreachable until final analyzer pass and explicit approval.
- Confirm rollback identifies the last evidence-approved deployment.

## Authorization and containment

This phase edits local/tracked procedure and command files and runs local checks. It does not push, open or merge a PR, deploy, mutate production, invoke crons, apply migrations, tag, or publish.

## Stop condition

Stop after all tracked release instructions delegate to one short procedure and a dry walkthrough proves the tag-last gate.
