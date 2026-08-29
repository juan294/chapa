# Phase 5 — Validate and Align Live Controls

> **Master plan:** `docs/plans/2026-08-29-direct-proof-release-pipeline.md`
> **Depends on:** Phase 4
> **Batch:** No
> **Authority:** Local rehearsal is part of implementation. Push, workflow dispatch, and branch-protection mutation each require explicit authorization.
> **Stop:** Stop before every unauthorized external action.

## Objective

Measure the simplified local path, verify the real GitHub/Vercel provider contract with one immutable non-production candidate when authorized, and align live branch protection with the direct admission contract when separately authorized.

## 1. Local timing rehearsal

From the clean isolated implementation worktree, time the exact bounded local release sequence with a warm dependency cache:

```bash
git diff --check
pnpm run release:validate-docs
pnpm run validate:migrations
pnpm run test:contract:local
pnpm run build
```

Record each command's elapsed time and total time in the phase handoff. Target: five minutes or less. A miss is a measured follow-up, not permission to omit a direct safety check without analysis.

## 2. Mocked failure rehearsal

Use the existing identity mocks and compact-result tests to prove:

- wrong Preview SHA fails;
- wrong Preview environment fails;
- wrong candidate tree fails;
- missing rollback tag fails;
- a probe failure writes `status: failed`;
- a passed result cannot contain a failed direct check;
- a source change cannot reuse the previous result; and
- publication-only recovery does not invoke deployment logic.

No network or production access is needed.

## 3. Authorized immutable Preview canary

This section does not authorize itself. After explicit push and workflow-dispatch authorization:

1. Push one exact candidate SHA through the normal repository workflow.
2. Resolve its immutable Vercel Preview URL.
3. Dispatch the simplified release-verification workflow with that SHA, tree, baseline, URL, and run ID.
4. Watch the exact run and attempt.
5. Download the one result artifact.
6. Verify source SHA, tree, Preview URL, direct checks, and workflow run/attempt.
7. Confirm the workflow made no deployment, merge, database, tag, release, or publication mutation.

Repeat once with a safe deliberate observer failure only if separately authorized and it does not create another deployment. Confirm the failed result artifact exists and the workflow conclusion is failure.

## 4. Authorized branch-protection alignment

The read-only planning audit on 2026-08-29 found eleven required `main` contexts:

```text
Test
Lint & Typecheck
Build
E2E Tests
Gitleaks
License compliance
Deployment Smoke
Lighthouse Audit
Analyze Bundle Size
Bundle Analyzer Report
Vulnerability scan (osv-scanner)
```

After explicit authorization, update the live rule through `gh api` so the required set is exactly:

```text
Lint & Typecheck
Test
Contract (real DB)
Build
E2E Tests
Pending Migrations Check (release PR)
```

Preserve strict up-to-date branch behavior and all unrelated protection settings. Resolve the full current protection payload before mutation; do not overwrite review, dismissal, admin-enforcement, conversation, signature, linear-history, force-push, or deletion settings.

Perform immediate readback:

```bash
gh api repos/{owner}/{repo}/branches/main/protection/required_status_checks \
  --jq '{strict, contexts, checks}'
```

The action is complete only if `strict` remains correct and the returned contexts exactly match the intended six checks.

## 5. Final repository verification

Run the master plan's full sequential verification on the exact candidate SHA. Do not assemble proof across replacement SHAs.

Confirm terminal applicable CI for that exact SHA. Advisory job failures remain visible and must be reported, but only the six named admission checks and direct release proof control the default transaction.

## Automated success criteria

- All master-plan verification commands pass on one exact candidate SHA.
- The Preview canary, when authorized, returns one terminal workflow conclusion and one exact-attempt result artifact.
- The result matches source SHA, tree, Preview URL, and workflow run/attempt.
- The live required contexts, when mutation is authorized, read back as the intended six.
- No production endpoint, deployment, merge, tag, GitHub Release, migration, or rollback is invoked.

## Manual success criteria

- Report local timing by command and total.
- Report canary workflow run ID, attempt, candidate SHA, tree, and result path without secrets.
- Report required-context before and after sets if branch protection was authorized.
- Report every advisory CI failure separately from the release-admission result.
- Confirm the user-owned dirty paths were not modified or cleaned.

## Completion handoff

State separately:

- local implementation and verification completed;
- Preview provider contract completed or pending authorization;
- branch-protection alignment completed or pending authorization; and
- production release not attempted.

Do not call the whole plan complete if an authorized canary or authorized branch-rule update was requested but has not reached terminal readback.
