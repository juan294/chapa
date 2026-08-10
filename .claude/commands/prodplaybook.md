# Production E2E Pro Verification

Model tier: **opus** — use the strongest available reasoning tier. Fresh-context
exploratory charters may use independent background agents, but the orchestrator
owns evidence reconciliation and the final decision.

Run Chapa's complete E2E Pro verification cycle against an immutable production
release. This is a verification and coverage-maintenance workflow, not a release
workflow.

It MUST NOT change versions, prepare or create a release PR, merge branches,
create or push tags, publish a GitHub release, deploy, apply migrations, invoke
production jobs, or mutate production data. Those operations remain owned by
`/release` and their explicit authorization gates.

## Inputs

Optional `$ARGUMENTS`: an immutable release tag or 40-character commit SHA.

- With no argument, target the commit currently reported by
  `https://chapa.thecreativetoken.com/api/version`.
- With an argument, require the tag/SHA, `main`, the attached release evidence,
  and production `/api/version` to identify the same released tree.
- Never infer success from a mutable branch, familiar URL, or latest workflow.

## Authorities

Read these files completely before acting:

- `CLAUDE.md` and applicable `.claude/rules/`;
- `docs/playbooks/e2e-pro-release-verification.md`;
- `quality/release-required.json` and every referenced schema;
- `.claude/commands/explore-release.md`;
- `docs/runbooks/release-checklist.md`;
- `docs/runbooks/deployment-smoke.md`;
- `docs/runbooks/migrations.md`;
- `docs/runbooks/observability.md`; and
- the evidence manifest and report attached to the targeted release.

The E2E Pro blueprint defines evidence semantics.
`quality/release-required.json` is the requiredness authority. Test names,
historical results, and this command never override the catalog.

## Authorization and safety

This invocation authorizes:

- read-only repository, GitHub, CI, deployment, and production inspection;
- deterministic local verification in an isolated worktree;
- synthetic local writes using run-scoped fixtures; and
- repository-only maintenance of the currently adopted Wave A/B quality
  contracts when the freshness audit finds a mechanical coverage gap.

It does not authorize production writes, real-user access, migration
application, cron or job invocation, live charges, email or messages, vendor
side effects, environment changes, destructive operations, deployment, or
release actions. Stop for explicit authorization before any such operation.

Use identifiers prefixed `chapa-e2e-{runId}-`. Clean up only fixtures created by
this run and prove zero unexpected residue.

## Step 1: Fix the production target

1. Fetch current remote refs and tags.
2. Read production `/api/version` and require:
   - a 40-character `commitSha`;
   - `environment` equal to `production`; and
   - an uncached response.
3. Resolve the target release tag, `main` commit, production commit, and GitHub
   release. Require their source and tree identities to agree.
4. Resolve the immediately previous evidence-approved release tag as
   `baselineTag`.
5. Locate the exact release evidence workflow run ID and attempt. Reject
   artifacts from another run, attempt, candidate, or tree.
6. Create an isolated clean verification worktree at the immutable target.
7. Record:
   - `baselineTag`;
   - target tag and commit;
   - target tree digest;
   - production URL and reported identity;
   - test-harness commit;
   - workflow run ID and attempt;
   - rollback reference; and
   - `runId=prodplaybook-{targetCommit:0:12}`.

Any identity ambiguity is **BLOCKED**.

## Step 2: Release Coverage Freshness Audit

Perform this audit before accepting or executing the existing obligation set.
Do not inspect commit titles alone. Review the actual history and diff from
`baselineTag` through the target commit.

Inventory every added or changed:

- user-facing route, component, API, server action, CLI, and shared contract;
- role, authorization boundary, actor, session mode, and protected operation;
- state, transition, retry, interruption, recovery, idempotency, and
  concurrency path;
- database table, migration, durable snapshot, cache, storage, queue, webhook,
  cron, and background job;
- vendor, credential, environment variable, deployment setting, and feature
  flag;
- locale, viewport, device, accessibility path, visible promise, and error
  state; and
- outward effect or production-sensitive operation.

Also inspect relevant bug fixes, incident records, regressions, prior release
findings, and recent CI failures for new escape classes.

Create a change-to-coverage matrix. For every changed capability record:

- actors and roles;
- surfaces and environments;
- states and transitions;
- external seams;
- risk and safety class;
- primary risk hypotheses;
- deterministic tests;
- required scenarios and selectors;
- UI, HTTP, datastore, storage, vendor, configuration, telemetry, and cleanup
  oracles;
- manual obligations;
- exploratory charters;
- runbook ownership; and
- evidence retention.

Compare the matrix against the catalog, schemas, unit and contract tests,
Playwright probes, local journey suite, CI producers, manual checklist,
exploratory protocol, analyzer, and runbooks.

Explicitly detect:

- an impacted capability with no required obligation;
- stale assertions, selectors, commands, providers, environments, counts, or
  runbooks;
- UI-only proof where durable downstream state is required;
- missing authorization, negative, retry, replay, interruption, recovery,
  concurrency, locale, viewport, role, and cleanup coverage;
- a new datastore, storage, queue, vendor, cron, migration, or outward effect
  without its required oracle class;
- a historical escape without permanent regression coverage;
- required work that can silently skip, use a mutable candidate, or yield zero
  passes; and
- evidence that cannot be attributed to the exact released source and tree.

Write the matrix and a `PASS` or `BLOCKED` freshness decision into
`docs/agents/prodplaybook-report.md`.

## Step 3: Repair stale Wave A/B coverage

When the freshness decision is `BLOCKED` because the adopted quality system is
stale:

1. Preserve the audit evidence and do not reinterpret the gap as not
   applicable.
2. Work from current `develop` in a separate isolated maintenance worktree.
3. Write failing regression tests first.
4. Add or adapt the minimally sufficient catalog entries, schemas, fixtures,
   selectors, environment mapping, oracles, collectors, analyzer rules,
   Playwright or contract scenarios, exploratory charter requirements, CI
   producers, checklists, and runbooks.
5. Preserve machine-readable requiredness and fail closed for zero passes,
   missing/failed/skipped required results, identity mismatch, missing oracles,
   incomplete charters, untriaged findings, and cleanup defects.
6. Run all affected verification sequentially, then the full repository gates.
7. Commit the repository-only maintenance to `develop`, push it, and verify
   exact-SHA CI.
8. Record the maintenance SHA and the release required to place it into
   production.

Never weaken a gate, lower a threshold, remove a required obligation,
quarantine a required miss, fabricate evidence, or add an exception merely to
obtain a pass.

Coverage added after the target was released does not retroactively make its
original release evidence complete. If the released target lacked a required
obligation, the current verification remains **BLOCKED** and the maintenance
must ride a follow-up release before `/prodplaybook` can return PASS.

Waves C through H remain structural work. If freshness requires a capability
registry, combination engine, per-release compiler, new environment/vendor
fidelity, state-machine system, or cadence/TTL system that is not currently
adopted, write an evidence-backed research and phased implementation proposal.
Stop at the repository's normal research and planning gates rather than
inventing an empty or partial structural system.

## Step 4: Verify deterministic and imported evidence

In the immutable target worktree run sequentially:

```bash
pnpm run quality:validate
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run test:contract:local
pnpm run build
```

Then:

1. Verify release-required test discovery for preview and production matches
   the catalog exactly.
2. Import exact-SHA CI, release-PR, preview, local-contract, build, exploratory,
   manual, identity, cleanup, and production evidence from the exact run and
   attempt.
3. Confirm every artifact and result identifies the target candidate or its
   proven tree-equivalent release commit.
4. Reject a green aggregate job when a required producer was absent, skipped,
   cancelled, stale, or failed.
5. Reject zero passes, duplicate results, missing oracles, missing manual
   obligations, incomplete charters, expired exceptions, and cleanup defects.
6. Treat absent historical pre-merge or preview evidence as missing. Never
   fabricate it after production.

CI green is not production proof. Imported evidence is not current production
proof.

## Step 5: Run current production-safe verification

Against the exact production URL:

1. Reconfirm `/api/version` immediately before probing.
2. Run only the production scenarios registered as read-only and safe in
   `quality/release-required.json`.
3. Collect schema-valid Playwright evidence bound to the production commit,
   run ID, environment, and expected oracles.
4. Inspect core dependency health, cron freshness, public badge behavior,
   public share behavior, response shape, headers, and telemetry only as allowed
   by the current catalog and runbooks.
5. Do not convert preview, local, manual, or historical evidence into a
   production observation.

An absent URL, wrong identity, degraded required dependency, unexpected write,
missing oracle, or stale response is **BLOCKED**.

## Step 6: Execute fresh-context exploratory charters

Generate charters from the actual `baselineTag..targetCommit` diff. Use one
charter for a tiny isolated release and two to four for a normal release; add
more only for distinct high-risk capability groups.

Each charter must run in a fresh context that did not implement the release or
the quality-maintenance changes. Give it only the immutable target, charter,
safety boundary, and report schema—not implementer assumptions.

Each charter records all eight maneuvers exactly once:

1. Try the action twice.
2. Edit after every error.
3. Interrupt mid-flow.
4. Use a second session or role.
5. Switch locale and viewport/device.
6. Compare copy with outcome.
7. Read back downstream state.
8. Ask whether the resulting behavior should exist.

Record each maneuver as passed with evidence, failed with reproduction and
evidence, or not applicable with a concrete reason. A missing row, expired
timebox with an untested high-risk area, skipped high-risk area, untriaged
finding, candidate mismatch, or absent cleanup proof is **BLOCKED**.

Production charter activity remains read-only. Use local synthetic fixtures for
authorized mutation, recovery, multi-session, and downstream-readback
maneuvers. Do not opportunistically fix code or production during a charter.

## Step 7: Manual obligations and final analysis

1. Reconcile every catalog `manualObligationId`.
2. Reuse only candidate-bound, schema-valid release evidence that remains
   applicable and attributable.
3. Execute safe read-only obligations directly. Stop for authorization when an
   obligation requires a device, OAuth completion, vendor side effect,
   production mutation, migration, message, or other outward action.
4. Record UI and HTTP evidence where required; add datastore or vendor readback
   only within authorization.
5. Assemble the current verification evidence without rewriting the historical
   release record.
6. Run the analyzer and render the report. The decision must remain BLOCKED
   unless every required result and oracle is present and passed with at least
   one real pass.

## Execution ledger

Maintain a visible ledger containing every numbered step, catalog obligation,
charter, maneuver, manual obligation, identity check, artifact source, oracle,
fixture, and cleanup result.

Allowed states are:

- `pending`;
- `passed`;
- `failed`;
- `blocked`; and
- `not-applicable` with a concrete evidence-backed reason.

An omitted item is not a pass. Do not combine commands in a way that masks an
earlier exit status.

## Completion contract

Do not report `/prodplaybook` complete or PASS unless:

- production target, tag, source, tree, and evidence identities agree;
- the Release Coverage Freshness Audit passed;
- every changed capability maps to current coverage;
- all deterministic and exact-SHA checks passed;
- all required scenarios have nonzero, candidate-bound evidence;
- current production-safe probes passed;
- all fresh context charters include all eight maneuvers and passed;
- all manual obligations are complete;
- every finding is triaged;
- fixtures and zero unexpected residue are proven;
- the analyzer returns PASS;
- `docs/agents/prodplaybook-report.md` contains exact SHAs, tree digests,
  workflow run IDs and attempts, scenario totals, charter decisions, manual
  results, cleanup evidence, findings, rollback reference, and evidence paths;
  and
- task-created worktrees, local services, and temporary branches are cleaned up
  safely after verification.

If blocked, lead with `BLOCKED`, name the exact failed or missing obligation,
preserve all evidence, and state the minimum safe next action. Never describe a
partial run as exhaustive or production-verified.
