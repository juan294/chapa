# Research: Chapa release pipeline and Coach recovery case study comparison

**Date:** 2026-08-29
**Branch researched:** `develop`
**Research question:** Which current Chapa release controls correspond to the pre-recovery patterns in the Coach release-pipeline case study?

## Executive summary

Chapa and pre-recovery Coach share five current structural patterns: broad local verification before remote CI, release authority over five full CI job results and their artifacts, mandatory exploratory charters, a multi-step evidence producer and consumer graph, and analyzer execution before promotion and again after production deployment. Coach later removed those categories from its default critical path while retaining direct candidate, deployment, recovery, and publication proof. (`docs/release/release-playbook.md:31-40`, `scripts/quality/release-artifact-contract.json:3-38`, `.claude/commands/explore-release.md:65-112`, `.github/workflows/release-verification.yml:659-803`, `docs/release/release-playbook.md:140-167`, `/Users/juan/code/coach/docs/release/release-pipeline-hardening-recovery-case-study.md:266-284`)

Chapa does not currently contain Coach's deterministic Vercel ignored-build race. Chapa waits for a `develop` preview before it creates the release PR, but the current Vercel configuration has no `ignoreCommand` and therefore does not suppress that branch deployment in repository configuration. (`docs/release/release-playbook.md:45-59`, `docs/release/release-playbook.md:84-87`, `apps/web/vercel.json:1-34`, `/Users/juan/code/coach/docs/release/release-pipeline-hardening-recovery-case-study.md:357-405`)

Chapa also keeps monitoring freshness outside deployed core-health authority. The release-required health result covers Redis, Supabase, and GitHub. Cron freshness stays visible as an operational signal, and real OAuth plus authenticated badge generation are non-required. (`docs/runbooks/deployment-smoke.md:51-66`, `docs/runbooks/release-checklist.md:20-29`, `quality/release-required.json:159-171`)

The current production evidence declarations differ in one place. The required catalog contains six production scenarios, the production Playwright run selects all six, the following collector command names four, and final evidence merging requires all required production scenarios to be present. (`quality/release-required.json:16-57`, `quality/release-required.json:137-156`, `apps/web/e2e/helpers/release-required-environments.ts:1-24`, `docs/release/release-playbook.md:121-134`, `scripts/quality/collect-playwright-evidence.ts:78-91`, `scripts/quality/merge-release-evidence.ts:131-151`)

This document stops at the current-state comparison. It does not select changes or implement them because the repository `/research` workflow is documentarian-only and each RPI phase is a separate conversation. (`.claude/commands/research.md:1-22`, `.claude/rules/rpi-details.md:7-27`)

## 1. Coach comparison lens

The Coach case study describes a release transaction in which broad local CI, full GitHub CI, Preview journeys, exploratory charters, evidence manifests, pre-production analysis, production journeys, monitoring, and final analysis all had synchronous veto power. (`/Users/juan/code/coach/docs/release/release-pipeline-hardening-recovery-case-study.md:8-20`, `/Users/juan/code/coach/docs/release/release-pipeline-hardening-recovery-case-study.md:43-74`)

Coach's recovered path separates product quality, candidate admission, deployment safety, and publication integrity. It kept exact candidate and deployment identity, readiness, migration proof, rollback preparation, safe promotion, a small production proof, tag-last publication, and public identity readback. (`/Users/juan/code/coach/docs/release/release-pipeline-hardening-recovery-case-study.md:67-74`, `/Users/juan/code/coach/docs/release/release-pipeline-hardening-recovery-case-study.md:621-671`)

The case study classifies broad browser, security, performance, exploration, monitoring-freshness, and advisory CI checks as engineering signals outside the default production critical path. (`/Users/juan/code/coach/docs/release/release-pipeline-hardening-recovery-case-study.md:673-693`)

## 2. Current Chapa release authority

`docs/release/release-playbook.md` is Chapa's single production release procedure. `/release` must read and execute it without shortening or reordering its gates. (`.claude/commands/release.md:5-17`, `docs/release/release-playbook.md:1-9`)

Chapa uses a `develop` to `main` squash PR. The release binds the Preview to `developCommit`, binds content to `candidateTreeDigest`, requires the squash-produced `mainCommit` to have the same tree, and requires production to report `mainCommit`. (`docs/playbooks/e2e-pro-release-verification.md:339-366`, `docs/release/release-playbook.md:111-138`)

The release has two human stops. Gate 1 approves the version and full diff. Gate 2 authorizes PR creation, externally billed verification, squash merge, tag, and publication. Analyzer overrides, production data changes, migrations, cron calls, messages, environment changes, and rollback retain separate authority. (`docs/release/release-playbook.md:5-9`, `docs/release/release-playbook.md:42-47`, `docs/runbooks/rollback.md:1-6`)

The repository also defines an outer pre-release sequence: `/pre-launch` to `/remediate` to `/update-docs` to `/release`. The pre-launch audit uses eight specialists, and Wave 1 findings are recorded as needing to pass before release. (`.claude/rules/rpi-details.md:49-60`, `.claude/commands/pre-launch.md:1-4`, `.claude/commands/pre-launch.md:38-120`, `.claude/commands/pre-launch.md:267-282`)

## 3. Current serial critical path

```text
pre-launch/remediate/update-docs
  -> release worktree and production-baseline identity
  -> version and diff preparation
  -> six-command local verification
  -> Gate 1
  -> Gate 2
  -> push immutable develop candidate
  -> wait for completed exact-SHA push CI and immutable Preview
  -> prepare candidate and evidence run
  -> mandatory exploratory charters
  -> create release PR
  -> wait for exact release-PR CI
  -> dispatch release-verification
       -> import five push-CI jobs and artifacts
       -> import pending-migration PR evidence
       -> run Preview release-required probes
       -> merge evidence
       -> pre-merge analyzer and report
  -> squash merge
  -> tree equality and production identity
  -> production release-required probes
  -> final evidence merge, analyzer, and report
  -> tag and GitHub Release
  -> post-release read-only checks
```

This order comes directly from the outer RPI rule, the release playbook, and the release-verification workflow. (`.claude/rules/rpi-details.md:49-60`, `docs/release/release-playbook.md:11-171`, `.github/workflows/release-verification.yml:84-946`)

### 3.1 Local admission

Before Gate 1, the playbook runs `quality:validate`, typecheck, lint, the unit and script suites, the real local-Supabase contract suite, and a production build. (`docs/release/release-playbook.md:31-40`)

Push CI separately runs typecheck, lint, configuration checks, sharded unit coverage, script coverage, contract tests, local journey E2E, a production build, bundle checks, and sharded built-artifact E2E. (`.github/workflows/ci.yml:28-86`, `.github/workflows/ci.yml:99-325`, `.github/workflows/ci.yml:329-444`, `.github/workflows/ci.yml:448-668`)

The release-verification workflow runs `quality:validate` again before it prepares the candidate-bound run. (`.github/workflows/release-verification.yml:145-181`)

### 3.2 Exact push-CI authority

Release verification selects a completed push CI run for the exact `developCommit`. (`.github/workflows/release-verification.yml:212-255`)

The release artifact contract marks `Lint & Typecheck`, `Test`, `Contract (real DB)`, `Build`, and `E2E Tests` as required. It also requires their exact-attempt artifacts and the exact build artifact. `Deployment Smoke` is listed as non-required. (`scripts/quality/release-artifact-contract.json:3-55`, `scripts/quality/import-ci-evidence.ts:104-121`, `scripts/quality/import-ci-evidence.ts:123-214`)

The release PR contributes a separate required pending-migration job and artifact. A missing, skipped, failed, expired, or candidate-mismatched result does not pass the importer. (`docs/release/release-playbook.md:84-109`, `.github/workflows/release-verification.yml:413-507`)

### 3.3 Preview authority

The required Preview catalog contains exact deployment identity, core dependency health, public badge and share reads, GitHub login redirect, denied unauthenticated write, rollback readiness, share verification, and English and Spanish locale behavior. (`quality/release-required.json:5-79`, `quality/release-required.json:126-156`)

The Preview job separately runs the deployment identity verifier, the Playwright release-required suite, evidence normalization, and read-only cleanup proof. It blocks when the identity producer or Playwright evidence producer does not succeed. (`.github/workflows/release-verification.yml:521-657`)

General CI deployment smoke and the nightly production probe remain separate signals. The deployment-smoke runbook says the general conditional job is not candidate-bound release evidence, and the nightly evidence records `authorizationEligible: false`. (`docs/runbooks/deployment-smoke.md:6-17`, `.github/workflows/nightly-prod-probe.yml:119-140`)

### 3.4 Exploratory authority

`/explore-release` creates one charter for a tiny diff and two to four for a normal release. Each charter uses a fresh agent context, has a default 30-minute timebox, and reports all eight maneuvers. (`.claude/commands/explore-release.md:65-112`)

The analyzer blocks an empty charter set. It also blocks a non-passing charter, candidate mismatch, missing maneuver, failed maneuver, passed maneuver without evidence, not-applicable maneuver without a reason, skipped high-risk area, untriaged finding, or fixture cleanup defect. (`scripts/quality/contracts.ts:1330-1372`)

The current manual arc bundle is different. Real GitHub OAuth and authenticated badge generation are `required: false`, and the analyzer does not require their records when the bundle is non-required. (`quality/release-required.json:159-171`, `scripts/quality/contracts.ts:1252-1301`)

### 3.5 Evidence and analyzer authority

CI writes normalized JSON artifacts. Release verification selects the exact run and attempt, downloads allowlisted artifacts, validates job and artifact identity, imports pending-migration evidence, produces Preview identity and Playwright fragments, and then downloads all four producer groups into the aggregate job. (`.github/workflows/ci.yml:51-88`, `.github/workflows/ci.yml:281-325`, `.github/workflows/ci.yml:399-444`, `.github/workflows/ci.yml:487-524`, `.github/workflows/ci.yml:633-668`, `.github/workflows/release-verification.yml:304-640`, `.github/workflows/release-verification.yml:659-714`)

The aggregate job merges bootstrap, CI, PR, Preview, charter, manual, identity, and cleanup inputs. It runs the pre-merge analyzer and report renderer, stores normalized evidence for 90 days and raw evidence for 30 days, and requires every producer, download, merge, analyzer, render, and aggregate decision to succeed. (`.github/workflows/release-verification.yml:716-803`, `.github/workflows/release-verification.yml:805-946`)

After production deployment, the playbook adds the production fragment and final identity evidence, creates the final manifest, runs the analyzer and renderer again, and uploads the manifest and report as GitHub Release assets. (`docs/release/release-playbook.md:121-167`)

The analyzer has two decisions: `pass` and `blocked`. It does not define `paused`, `rolled-back`, or publication-only states. (`scripts/quality/contracts.ts:183-192`)

Release-verification retains durable blocked diagnostics and does not cancel an in-progress run for the same candidate and run ID. Rollback is a separate, explicitly authorized procedure. (`.github/workflows/release-verification.yml:80-82`, `.github/workflows/release-verification.yml:805-882`, `docs/runbooks/rollback.md:1-29`)

## 4. Correspondence with Coach's pre-recovery patterns

| Coach case-study pattern | Current Chapa behavior | Current correspondence |
|---|---|---|
| Broad local CI followed by overlapping remote CI | Chapa runs six local commands before Gate 1, then requires five full push-CI jobs and their artifacts. (`docs/release/release-playbook.md:31-40`, `scripts/quality/release-artifact-contract.json:3-38`) | Direct |
| Wait for a complete workflow rather than one exact admission check | Chapa selects a completed exact-SHA push CI run and requires five named successful jobs plus their evidence artifacts. (`.github/workflows/release-verification.yml:212-255`, `scripts/quality/import-ci-evidence.ts:104-121`, `scripts/quality/import-ci-evidence.ts:182-214`) | Direct |
| Serial Preview and PR work | Chapa waits for exact-SHA push CI and Preview before it creates the release PR, then waits for release-PR CI and dispatches release verification. (`docs/release/release-playbook.md:45-59`, `docs/release/release-playbook.md:84-109`) | Direct ordering; no current ignored-build rule |
| Broad deployed journeys on release authority | Chapa's required Preview set covers ten scenario IDs, and its production catalog covers six scenario IDs. (`quality/release-required.json:5-79`, `quality/release-required.json:126-156`) | Direct |
| Candidate-bound exploratory charters | Chapa requires at least one complete charter, all eight maneuvers, evidence, triage, and cleanup. (`.claude/commands/explore-release.md:65-179`, `scripts/quality/contracts.ts:1330-1372`) | Direct |
| Multiple evidence producers, aggregation, and proof-of-proof analysis | Chapa imports CI and PR artifacts, produces Preview fragments, merges them, analyzes and renders pre-merge evidence, then merges and analyzes again after production. (`.github/workflows/release-verification.yml:304-946`, `docs/release/release-playbook.md:140-167`) | Direct |
| Final analyzer controls publication after production deployment | Chapa runs final analysis after production reports `mainCommit`; a non-PASS result blocks tagging unless there is a fresh explicit override. (`docs/release/release-playbook.md:121-160`) | Direct |
| Monitoring freshness or alert configuration controls deployment | Chapa requires core Redis, Supabase, and GitHub health, while cron freshness remains separate and real OAuth/authenticated badge checks are non-required. (`docs/runbooks/deployment-smoke.md:51-66`, `docs/runbooks/release-checklist.md:20-29`) | No direct correspondence |
| Pull-request Preview expected before the PR exists while branch previews are suppressed | Chapa expects a Preview before the PR, but `apps/web/vercel.json` has no `ignoreCommand`. (`docs/release/release-playbook.md:45-59`, `docs/release/release-playbook.md:84-87`, `apps/web/vercel.json:1-34`) | Ordering correspondence only |
| Terminal controller state prevents same-candidate recovery | Chapa has no release controller state machine. Its analyzer returns only `pass` or `blocked`; the workflow keeps blocked diagnostics and uses attempt-bound artifacts. (`scripts/quality/contracts.ts:183-192`, `.github/workflows/release-verification.yml:805-900`) | Partial |

## 5. Controls already separated or consolidated in Chapa

Chapa has two release approval stops, not six separate operator round trips. Gate 2 covers the release PR, billed verification, merge, tag, and publication while leaving other production effects separately authorized. (`docs/release/release-playbook.md:5-9`, `.claude/commands/release.md:55-87`)

The manual migration-review obligation was removed because the required pending-migration scenario imports the actual release-PR result. The documented manual process remains a fallback if CI cannot run. (`docs/runbooks/release-checklist.md:57-72`)

Real GitHub OAuth and authenticated badge generation are non-required. The checklist associates them with auth-sensitive or badge-generation-sensitive changes instead of every release. (`docs/runbooks/release-checklist.md:20-34`, `quality/release-required.json:159-171`)

General deployment smoke is explicitly advisory for release evidence, and overall health does not become a release failure solely because cron heartbeat freshness is degraded. (`docs/runbooks/deployment-smoke.md:6-17`, `docs/runbooks/deployment-smoke.md:51-66`)

Exact candidate identity, squash-tree equality, exact production identity, named-tag publication, and rollback-target identity remain direct release controls. (`docs/playbooks/e2e-pro-release-verification.md:339-366`, `docs/release/release-playbook.md:111-170`, `docs/runbooks/rollback.md:16-29`)

## 6. Current production evidence declaration

The catalog requires these production scenario results:

1. `deployment.production-identity`
2. `health.core-dependencies`
3. `profile.public-badge-read`
4. `profile.public-share-read`
5. `profile.share-verification`
6. `locales.en-es`

The catalog declarations are at `quality/release-required.json:16-57` and `quality/release-required.json:137-156`.

The production Playwright environment mapping selects the production identity scenario and the five shared production scenarios. (`apps/web/e2e/helpers/release-required-environments.ts:1-24`, `apps/web/e2e/release-required.spec.ts:26-97`)

The playbook's collector command names only `deployment.production-identity`, `health.core-dependencies`, `profile.public-badge-read`, and `profile.public-share-read`. (`docs/release/release-playbook.md:129-134`)

The collector filters output to the supplied `--scenario-ids`, while final evidence merging enumerates all required production catalog rows and throws when any is absent. (`scripts/quality/collect-playwright-evidence.ts:78-91`, `scripts/quality/collect-playwright-evidence.ts:210-240`, `scripts/quality/merge-release-evidence.ts:131-151`)

## 7. Historical and current evidence shape

The Chapa E2E Pro adoption selected Wave A plus mandatory Wave B exploration. Its tracked topology includes the catalog, five JSON schemas, adversarial fixtures, evidence preparation, collection, analysis, rendering, identity verification, Playwright probes, and the release-verification workflow. (`docs/playbooks/e2e-pro-release-verification.md:1-24`, `docs/playbooks/e2e-pro-release-verification.md:305-336`, `docs/playbooks/e2e-pro-release-verification.md:368-410`)

Two locally preserved completed release reports from 2026-08-19 and 2026-08-23 each contain 15 passed scenario executions, full candidate and production identity, a final analyzer PASS, at least one 30-minute exploratory charter, fixture cleanup, rollback reference, and pending tag-authorization fields. These reports predate the current manual-arc demotion. (`quality/evidence/runs/release-8ed8237550bb/release-report.md:1-95`, `quality/evidence/runs/release-4e532e22c7ae/release-report.md:1-90`, `quality/release-required.json:159-171`)

The current evidence workflow stores the normalized final set for 90 days and the allowlisted raw set for 30 days. It creates fallback blocked artifacts when merge or analysis does not complete. (`.github/workflows/release-verification.yml:805-900`)

## 8. Research boundary

This research records the present authority graph and its correspondence with the Coach case study. It makes no change to release commands, workflows, tests, schemas, catalogs, runbooks, Vercel configuration, or production state. The repository workflow requires a separate `/plan` phase before any implementation phase. (`.claude/commands/research.md:14-22`, `.claude/rules/rpi-details.md:7-18`)
