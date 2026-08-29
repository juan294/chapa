# Phase 3 — Rewrite Release Authority and Recovery

> **Master plan:** `docs/plans/2026-08-29-direct-proof-release-pipeline.md`
> **Depends on:** Phase 2
> **Batch:** No
> **Stop:** Stop after documentation-contract verification. Do not delete old modules until every live authority no longer references them.

## Objective

Make the direct workflow the only default release authority, make broad verification explicit, and document recoverable failure outcomes without adding a controller.

## Files

Modify together because `validate-release-docs` reads them as one contract:

- `.claude/commands/release.md`
- `.claude/commands/explore-release.md`
- `.claude/commands/prodplaybook.md`
- `.claude/rules/rpi-details.md`
- `docs/release/release-playbook.md`
- `docs/playbooks/e2e-pro-release-verification.md`
- `docs/runbooks/release-checklist.md`
- `docs/runbooks/deployment-smoke.md`
- `docs/runbooks/migrations.md`
- `docs/runbooks/rollback.md`
- `docs/runbooks/incident-response.md`
- `docs/runbooks/observability.md`
- `CLAUDE.md`
- `scripts/quality/validate-release-docs.ts`
- `scripts/quality/validate-release-docs.test.ts`

## 1. Rewrite validator tests first

Replace the compliant fixture and repository assertions so they require:

- exact production baseline and annotated rollback tag;
- immutable `developCommit` and `candidateTreeDigest`;
- Gate 1 before Gate 2;
- PR creation immediately after approved push;
- exact PR-head required checks;
- fail-closed pending migrations;
- exact Preview identity and direct result;
- rollback reference before merge;
- PR-head reconfirmation before squash merge;
- `mainTreeDigest == candidateTreeDigest`;
- exact production identity and four direct production probes;
- tag only after production proof;
- named tag and GitHub Release readback;
- `PAUSED`, `BLOCKED`, `ROLLED_BACK`, and `PUBLICATION_PENDING` semantics;
- default and deep modes; and
- separate authorization for production mutation and rollback.

Add negative assertions that the default release command and playbook do not contain:

```text
quality/release-required.json
releasePrRunId
preMergeEvidence
/explore-release as an unconditional step
pre-merge analyzer
final analyzer
merge-release-evidence
evidence-manifest.json
release-report.md
```

Replace analyzer-order tests with direct-order tests:

```text
PR creation < concurrent required-check/Preview wait
required checks + migrations + Preview proof < squash merge
tree equality + production proof < tag
tag < GitHub Release readback < final receipt upload/readback
```

## 2. Rewrite the default release playbook

Keep baseline resolution and the two gates. Replace the broad local mirror with the bounded sequence from the master plan.

After Gate 2:

```text
commit and push approved preparation
capture developCommit and candidateTreeDigest
create or reuse develop -> main PR immediately
capture releasePrNumber and headRefOid
require headRefOid == developCommit

in one observation wave:
  watch exact required PR checks
  require Pending Migrations Check (release PR) == pass
  resolve immutable Preview for developCommit
  dispatch/watch/download one Preview release-result

validate result source run, attempt, SHA, tree, URL, and passed direct checks
capture/reconfirm rollbackReference
reconfirm PR head == developCommit
squash merge
verify main tree == candidate tree
verify exact production identity
run four default production scenarios
tag and publish
read back tag and GitHub Release target
write/upload final release-result
```

Do not prescribe a shell backgrounding implementation that hides exit codes. The release operator may use separate terminal sessions or a CI watcher, but must preserve exact source identity for each concurrent observation.

## 3. Document bounded recovery

Add the four procedural outcomes from the master plan. State explicitly:

- source changes invalidate the candidate and both approvals;
- observer/provider repair may resume the same unchanged candidate;
- production-changing retry needs new production authority;
- rollback ends the attempt and prevents tagging;
- publication repair does not redeploy a production-proven candidate; and
- no analyzer override exists after this change.

## 4. Convert deep verification

### `/prodplaybook`

Make it a read-only, fixed-target deep audit:

```text
resolve exact target identity
run deterministic checks relevant to the requested audit
run RELEASE_VERIFICATION_MODE=deep deployed probes
run explicit exploration only when requested or risk-selected
record exact commands, target SHA, results, findings, and limitations
write docs/agents/prodplaybook-report.md
```

Remove catalog, schema, evidence run, manifest, analyzer, and cleanup-proof requirements. Keep production safety and honest `BLOCKED` reporting.

### `/explore-release`

Accept a fixed commit/tree and authorization scope, not a mandatory candidate JSON schema. Size charters to the named risk. Return one report. Preserve synthetic data, no real-user data, no unauthorized side effects, finding triage, and task-owned cleanup. Remove mandatory eight-row completeness and analyzer handoff.

## 5. Remove the universal outer pre-release gate

In `.claude/rules/rpi-details.md`, describe `/pre-launch -> /remediate -> /update-docs` as an explicit milestone, high-risk, or requested readiness workflow. It is not an unconditional prerequisite for `/release`.

Do not weaken `/pre-launch` when it is selected. The change is only its authority over every default release.

## 6. Synchronize operational runbooks

- `release-checklist.md`: risk-selected manual arcs and monitoring observations; compact result instead of evidence bundles.
- `deployment-smoke.md`: default and deep probe tables; nightly and general smoke remain advisory.
- `migrations.md`: exact PR-head check result; missing credentials fail; manual commands are diagnostics, not a substitute pass.
- `rollback.md`: resolve `rollbackReference` from the compact result and verify restored exact identity.
- `incident-response.md` and `observability.md`: correlate candidate, Preview workflow run/attempt, deployment, tag, release, result, and rollback identities.
- `e2e-pro-release-verification.md`: replace the adoption blueprint with a concise current deep-verification playbook plus a historical note. Do not retain executable instructions for deleted tools.
- `CLAUDE.md`: list only current default and deep commands.

## Automated success criteria

```bash
pnpm vitest run scripts/quality/validate-release-docs.test.ts
pnpm run release:validate-docs
pnpm run typecheck
pnpm run lint
```

Run a live-reference search:

```bash
rg --hidden -n \
  'pre-merge analyzer|final analyzer|pre-merge-evidence.json|evidence-manifest.json|merge-release-evidence|release:analyze|release:render-report' \
  .claude docs/release docs/runbooks docs/playbooks CLAUDE.md
```

Expected: no current operational instruction requires those paths. Historical research and completed plans are excluded.

## Manual success criteria

- Read the release command and playbook from start to finish and confirm there is one default path.
- Confirm both authorization gates remain clear and production effects retain separate authority.
- Confirm deep verification can be requested without becoming a silent default gate.
- Confirm each recovery outcome says whether the candidate changed, whether production changed, and what can safely resume.

## Handoff

Stop after the documentation validator and review pass. At this point no live release authority may call the old evidence tools, so Phase 4 can delete them safely.
