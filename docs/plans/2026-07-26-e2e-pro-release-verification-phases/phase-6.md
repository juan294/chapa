# Phase 6 — Rehearse Pass and Deliberate Block Paths

**Status:** Complete; live preview evidence deferred to first authorized release
**Depends on:** Phase 5
**Batch:** no; this is the integrated acceptance gate.
**Goal:** demonstrate that the complete Chapa E2E Pro path produces one auditable pass and blocks every mandatory failure class without performing a production release.

## Files

### Create

- `docs/agents/e2e-pro-rehearsal-report.md`

### Modify only if rehearsal reveals plan-compliance defects

- Files owned by Phases 2–5, limited to fixes required for their stated contracts and matching regression tests.

Chapa tracks operational reports in `docs/agents/` because the repository is private. (`CLAUDE.md:271-281`, `docs/accepted-risks.md:159-163`)

## Rehearsal design

### 1. Preflight

Record:

- branch and exact HEAD;
- clean isolated worktree;
- schema/catalog revisions;
- analyzer version;
- test and workflow fixture versions;
- authorization scope;
- statement that no merge, deployment, production mutation, cron, migration, email, tag, or release is authorized.

### 2. Passing synthetic run

Run the full local path:

```text
prepare release run from fixture Git refs
produce deterministic fixture evidence
serve /api/version locally with explicit preview/main identities
run @release-required deployed probes against local built app
run local-Supabase journey and cleanup
validate a complete exploratory charter
collect and merge evidence
analyze
render report
```

Expected result: `PASS`, exact identity chain, all required results passed, all expected oracles present, zero fixture residue, no exceptions, tag authorization still pending.

### 3. Deliberate blocked runs

Run each tracked adversarial fixture through the CLI and record nonzero exit plus blocking reason:

| Fixture | Required decision |
|---|---|
| `blocked-zero-pass.json` | Block: zero passing checks |
| `blocked-required-skip.json` | Block: required scenario skipped |
| `blocked-candidate-mismatch.json` | Block: deployment or tree identity mismatch |
| `blocked-missing-cleanup.json` | Block: cleanup/residue proof incomplete |
| `blocked-incomplete-charter.json` | Block: maneuver table incomplete |

Also mutate the passing fixture in memory to remove one expected HTTP or datastore oracle and confirm a missing-evidence block.

### 4. Non-production identity readback

When an already-existing Chapa preview for the implementation commit is available and the phase is authorized to spend one CI run:

```text
GET preview/api/version
compare reported commit to implementation HEAD
run read-only @release-required preview probes
collect workflow artifact
```

Do not create or promote a deployment as part of the rehearsal. If no exact existing preview is available, the local identity-chain tests remain the phase acceptance evidence and the report records the live preview leg as pending first-release evidence.

### 5. Procedure dry walkthrough

Walk `/release` from orientation to the point immediately before its first external mutation and then use fixture outputs for the later stages. Confirm:

- each authorization pause is explicit;
- exact-SHA CI is selected;
- preview evidence uses the same develop commit;
- squash tree equality is required;
- production identity is required;
- final analyzer pass precedes tag authorization;
- evidence attachment and rollback references are named.

Do not execute push, PR, merge, Vercel deployment, production probe beyond authorized read-only requests, tag, or GitHub release commands.

### 6. Write the rehearsal report

The report contains:

- source SHA and tree;
- commands and exit codes;
- passing report path;
- one row per deliberate blocked case;
- raw evidence artifact references;
- fixture cleanup and residue result;
- live preview result or explicit first-release deferral;
- confirmation that no prohibited action occurred;
- final implementation decision.

## Automated success criteria

Run sequentially:

```text
pnpm run quality:validate
pnpm vitest run scripts/quality
pnpm vitest run apps/web/app/api/version/route.test.ts
pnpm run test:contract:local
pnpm --filter @chapa/web exec playwright test e2e/release-required.spec.ts
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run build
pnpm run release:analyze -- --run quality/fixtures/passing-release-run.json
git diff --check
```

Then execute every blocked fixture and assert nonzero status without masking earlier exit codes.

## Manual success criteria

- Review the rendered passing report and all blocking reasons.
- Confirm no required miss can be authorized through an exception.
- Confirm the passing report is tied to one candidate tree and contains cleanup proof.
- Confirm the short playbook remains at 200 lines or fewer and is usable as the only top-level procedure.
- Confirm the first real production release is explicitly outside this phase and requires fresh authorization.

## Authorization and containment

Local build, local Supabase, fixture analysis, and procedure walkthrough are authorized implementation verification. A GitHub Actions dispatch or read-only preview request requires confirmation within the phase because it consumes external resources. Merge, production deployment, migration application, cron execution, outbound notifications, production writes, tag, and GitHub release remain prohibited without a separate explicit request.

## Stop condition

Stop after the rehearsal report is reviewed. Do not proceed into a real production release from this implementation phase.
