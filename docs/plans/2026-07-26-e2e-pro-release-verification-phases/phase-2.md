# Phase 2 — Build the Fail-Closed Evidence Contract

**Status:** Complete
**Depends on:** Phase 1
**Batch:** no; later phases consume these schemas, stable IDs, and analyzer semantics.
**Goal:** make a release decision mechanically impossible when evidence is empty, incomplete, mismatched, skipped, failed, or unclean.

## Files

### Create

- `quality/release-required.json`
- `quality/schemas/release-required.schema.json`
- `quality/schemas/release-run.schema.json`
- `quality/schemas/evidence-manifest.schema.json`
- `quality/schemas/exploratory-charter.schema.json`
- `quality/fixtures/passing-release-run.json`
- `quality/fixtures/blocked-zero-pass.json`
- `quality/fixtures/blocked-required-skip.json`
- `quality/fixtures/blocked-candidate-mismatch.json`
- `quality/fixtures/blocked-missing-cleanup.json`
- `quality/fixtures/blocked-incomplete-charter.json`
- `quality/evidence/README.md`
- `scripts/quality/contracts.ts`
- `scripts/quality/validate-release-required.ts`
- `scripts/quality/validate-release-required.test.ts`
- `scripts/quality/prepare-release-run.ts`
- `scripts/quality/prepare-release-run.test.ts`
- `scripts/quality/analyze-release-run.ts`
- `scripts/quality/analyze-release-run.test.ts`
- `scripts/quality/render-release-report.ts`
- `scripts/quality/render-release-report.test.ts`

### Modify

- `package.json`
- `.gitignore`

Chapa already uses colocated Vitest tests for TypeScript repository scripts and exposes them through `tsx` package scripts. (`package.json:11-25`, `scripts/check-pending-migrations.test.ts:1-34`)

## TDD sequence

### 1. Define red analyzer cases first

Before analyzer implementation, add tests for:

1. valid required passes;
2. empty result list;
3. all results skipped;
4. required result absent;
5. required result skipped;
6. required result failed;
7. required result failed with quarantine or exception;
8. optional failure without exception;
9. optional failure with an active authorized exception;
10. expired optional exception;
11. preview identity mismatch;
12. candidate/main tree mismatch;
13. production identity mismatch;
14. missing expected oracle evidence;
15. fixture without `removed` cleanup status;
16. fixture without zero-residue evidence;
17. duplicate or unknown scenario ID;
18. malformed schema or unsupported schema version;
19. exploratory charter missing any maneuver from 1 through 8;
20. failed maneuver;
21. `not-applicable` maneuver without a reason;
22. skipped high-risk charter area;
23. report stability and complete authorization/rollback sections.

The blueprint defines non-empty passes and required-miss enforcement as immediate regression cases and extends final failure to candidate mismatch, missing evidence, failed cleanup, overdue obligations, and incomplete exploration. (`/Users/juan/code/cc-rpi/templates/e2e-pro-playbook-template.md:288-320`, `/Users/juan/code/cc-rpi/templates/e2e-pro-playbook-template.md:1063-1080`)

### 2. Define the required catalog

`quality/release-required.json` uses stable entries:

```json
{
  "schemaVersion": 1,
  "scenarios": [
    {
      "id": "deployment.preview-identity",
      "owner": "release-operator",
      "runner": "playwright",
      "selector": "@release-required deployment.preview-identity",
      "environment": "preview",
      "safetyClass": "read-only",
      "required": true,
      "expectedOracles": ["http", "deployment-identity"]
    }
  ]
}
```

Populate every initial scenario listed in the main plan. Validate unique IDs, named owners, supported environments, non-empty selectors, supported safety classes, and at least one expected oracle.

### 3. Implement pure contracts and validators

`contracts.ts` exports explicit TypeScript types and pure parsing/validation functions. Do not make direct environment, filesystem, network, Git, GitHub, or Vercel calls from analyzer logic.

```text
parseCatalog(raw) -> RequiredCatalog | ValidationError[]
parseReleaseRun(raw) -> ReleaseRun | ValidationError[]
analyze(catalog, run, now) -> {
  decision: "pass" | "blocked",
  counts,
  blockingReasons
}
renderReport(catalog, run, analysis) -> markdown
```

The CLI files handle filesystem input and exit codes; the pure functions remain directly testable.

### 4. Implement release-run preparation

`prepare-release-run.ts` receives concrete CLI arguments:

```text
--baseline-tag
--develop-commit
--candidate-tree
--preview-url
--run-id
--output
```

It copies the required catalog into a pending obligation list and records candidate identity without running tests or mutating external state.

Reject:

- missing or mutable-looking Git refs;
- malformed 40-character commit IDs;
- malformed tree digests;
- non-HTTPS preview URLs outside localhost test fixtures;
- output paths outside `quality/evidence/runs/`;
- an existing run directory unless `--resume` identifies the same candidate.

### 5. Implement the analyzer

```text
passedCount = results where status == "passed"
requiredMisses = required obligations where result is absent or status != "passed"
blockingOptionalFailures =
  optional failed results without an active authorized exception

block when:
  passedCount == 0
  or requiredMisses is non-empty
  or blockingOptionalFailures is non-empty
  or identity chain is inconsistent
  or expected oracle evidence is missing
  or cleanup/residue proof is incomplete
  or exploratory evidence is incomplete or failing
```

Required misses are never excepted. Optional exceptions require scenario ID, concrete reason, risk, approver, creation time, expiry time, and follow-up.

### 6. Implement deterministic reporting

The Markdown report contains:

- baseline, develop commit, candidate tree, preview identity;
- main commit/tree and production identity when available;
- `PASS` or `BLOCKED`;
- result counts and blocking reasons;
- required results and evidence references;
- exploratory charters;
- fixtures and cleanup;
- optional exceptions;
- rollback reference;
- tag authorization as `pending` until explicitly granted.

The blueprint defines the same report areas. (`/Users/juan/code/cc-rpi/templates/e2e-pro-playbook-template.md:1109-1163`)

### 7. Wire scripts and evidence isolation

Add package scripts:

```json
"quality:validate": "tsx scripts/quality/validate-release-required.ts",
"release:prepare-run": "tsx scripts/quality/prepare-release-run.ts",
"release:analyze": "tsx scripts/quality/analyze-release-run.ts",
"release:render-report": "tsx scripts/quality/render-release-report.ts"
```

Add only `quality/evidence/runs/` to `.gitignore`; keep contracts, schemas, fixtures, and `quality/evidence/README.md` tracked.

## Automated success criteria

Run sequentially:

```text
pnpm vitest run scripts/quality/validate-release-required.test.ts
pnpm vitest run scripts/quality/prepare-release-run.test.ts
pnpm vitest run scripts/quality/analyze-release-run.test.ts
pnpm vitest run scripts/quality/render-release-report.test.ts
pnpm run quality:validate
pnpm run release:analyze -- --run quality/fixtures/passing-release-run.json
pnpm run typecheck
pnpm run lint
pnpm run test
git diff --check
```

For every blocked fixture, assert a nonzero exit and the exact stable blocking reason. Mutation-check at least zero-pass, required skip, candidate mismatch, missing cleanup, and incomplete charter by temporarily removing the corresponding analyzer branch and confirming its regression test turns red.

## Manual success criteria

- Inspect the catalog and confirm every initial scenario has one owner, environment, safety class, selector, requiredness value, and oracle set.
- Inspect the passing report and confirm it is independently understandable without raw source code.
- Confirm fixtures contain synthetic identifiers only and no secrets or personal data.

## Authorization and containment

This phase performs local filesystem and test operations only. Analyzer fixtures never contact GitHub, Vercel, Supabase, Redis, Resend, or production.

## Stop condition

Stop when all adversarial cases are mechanically blocked and the valid fixture produces a deterministic `PASS` report.
