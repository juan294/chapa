# Phase 4 — Delete Obsolete Evidence Machinery

> **Master plan:** `docs/plans/2026-08-29-direct-proof-release-pipeline.md`
> **Depends on:** Phase 3
> **Batch:** No
> **Stop:** Stop after deletion audit and full local verification.

## Objective

Remove the old proof-of-proof implementation after the direct path and all live operational documentation no longer depend on it. Leave one apparent release contract.

## Preconditions

- Phase 2 direct Preview workflow tests pass.
- Phase 3 documentation tests pass.
- A reference search confirms no live command or runbook calls the old machinery.
- Historical plans, research, and completed release reports are identified and excluded from deletion.

## 1. Remove package authority

Delete these scripts from `package.json`:

```text
quality:validate
release:prepare-run
release:analyze
release:render-report
release:collect-evidence
release:merge-evidence
```

Keep:

```text
release:write-result
release:verify-identity
release:validate-docs
test:release-required
```

## 2. Delete quality source and tests

Delete exactly the source, test, contract, fixture, schema, and README paths in the master plan's deletion inventory.

`scripts/quality/contracts.ts` can be deleted only after this command returns no remaining imports:

```bash
rg -n 'from "\./contracts"|from '\''\./contracts'\''' scripts/quality --glob '*.ts'
```

Expected before deletion: only files in the deletion inventory. Expected after deletion: no matches.

Do not delete retained direct identity, workflow contract, documentation contract, or auto-backmerge tests.

## 3. Remove stale workflow and documentation references

Search all live operational surfaces after deletion:

```bash
rg --hidden -n \
  'release-required.json|release-artifact-contract|prepare-release-run|import-ci-evidence|collect-playwright-evidence|merge-release-evidence|merge-scenario-results|analyze-release-run|render-release-report|quality/evidence/README.md' \
  .github .claude docs/release docs/runbooks docs/playbooks scripts quality package.json CLAUDE.md
```

Expected: no matches.

Do not treat matches in `docs/research/`, this plan, or completed historical plans as live dependencies. Do not rewrite those historical records.

## 4. Preserve the untracked receipt location

The existing ignored `quality/evidence/runs/` path can remain as the local destination for `release-result.json`. Do not edit `.gitignore` in this task because the working tree already contains user-owned state there.

The tracked `quality/evidence/README.md` is deleted because the current run topology it describes no longer exists. Current compact-result instructions live in the release playbook.

## Automated success criteria

```bash
pnpm vitest run \
  apps/web/e2e/helpers/release-required-environments.test.ts \
  scripts/quality/release-result.test.ts \
  scripts/quality/release-verification-workflow.test.ts \
  scripts/quality/validate-release-docs.test.ts \
  scripts/quality/verify-deployment-identity.test.ts \
  scripts/quality/auto-backmerge-workflow.test.ts
pnpm run release:validate-docs
actionlint .github/workflows/*.yml
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run test:contract:local
pnpm run build
```

Run `pnpm install --lockfile-only` only if removing package dependencies or scripts requires a lockfile change. Do not rewrite the lockfile without a demonstrated dependency change.

## Manual success criteria

- Review the deletion diff and confirm no normal CI, nightly probe, deployed probe, rollback, or auto-backmerge capability was removed.
- Confirm there is no alternate analyzer or catalog that appears authoritative.
- Confirm historical release reports remain intact.
- Confirm `git status` contains only task-owned changes plus the known unrelated user work.

## Handoff

Stop with the local implementation complete and fully verified. Remote dispatch and GitHub settings are Phase 5 and require separate authorization.
