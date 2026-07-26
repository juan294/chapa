# Chapa Production Release Playbook

This is Chapa's single production-release procedure. `/release` executes it.
Capability detail lives in the linked runbooks; evidence semantics live in
`docs/playbooks/e2e-pro-release-verification.md`.

## Scope and authorization

- Release topology: `develop` to `main`, squash merge, then tag `mainCommit`.
- Analyzer PASS is evidence, not authorization.
- STOP separately for version choice, full diff approval, external CI/preview,
  release PR, merge, production operations beyond the read-only probes below,
  and tag/publication.
- Never mutate production data, apply migrations, invoke crons, send messages,
  change environment configuration, merge, tag, or publish without its explicit
  authorization.

## 1. Prepare and verify

1. Read `CLAUDE.md`, this playbook, and the linked runbooks.
2. Use an isolated clean release worktree based on current `develop`.
3. Fetch origin; identify `baselineTag`, current version, commits, paths,
   migrations, version-bearing files, exact remote refs, and exact-SHA CI.
4. Present release type, changes, topology, known risks, and retirement review.
5. **STOP — version choice.**
6. Update version, changelog, and every current version reference.
7. Run sequentially:

   ```bash
   pnpm run quality:validate
   pnpm run typecheck
   pnpm run lint
   pnpm run test
   pnpm run test:contract:local
   pnpm run build
   ```

8. Present the complete diff and results.
9. **STOP — full diff approval.**

## 2. Fix the candidate and prepare inputs

1. Commit and push only the approved release preparation.
2. Resolve the immutable Vercel preview for this exact commit, then record:

   ```bash
   developCommit="$(git rev-parse HEAD)"
   candidateTreeDigest="$(git rev-parse 'HEAD^{tree}')"
   runId="release-${developCommit:0:12}"
   runDir="quality/evidence/runs/$runId"
   rollbackReference="$baselineTag"
   ```

3. Wait for push CI whose `headSha` is exactly `developCommit`. Verify preview
   `/api/version` reports that commit and environment `preview`.
4. Prepare the run and candidate record:

   ```bash
   pnpm release:prepare-run -- \
     --baseline-tag "$baselineTag" --develop-commit "$developCommit" \
     --candidate-tree "$candidateTreeDigest" --preview-url "$previewUrl" \
     --run-id "$runId" --output "$runDir/release-run.json"
   jq --arg baselineTag "$baselineTag" --arg runId "$runId" \
     '.candidate + {baselineTag:$baselineTag,runId:$runId,
       authorization:{environments:["local-contract","ci-build","preview"],
       operations:["read-only","synthetic-local-write",
       "authorized-preview-interaction"]}}' \
     "$runDir/release-run.json" > "$runDir/candidate.json"
   ```

5. Run `/explore-release $runDir/candidate.json`, then complete applicable
   manual arcs in `docs/runbooks/release-checklist.md`.
6. Create `$runDir/pre-merge-evidence.json`:

   ```json
   {"exploratoryCharters":[],"manualObligations":[],"manualResult":{"scenarioId":"release.manual-arcs","environment":"preview"}}
   ```

   Replace the placeholders with complete schema-valid charters, one passed
   candidate-bound record per catalog `manualObligationIds`, and the manual
   `ScenarioResult` with `ui` and `http` evidence.

## 3. Release PR and pre-merge evidence

1. **STOP — release PR authorization.**
2. Create or reuse the `develop` to `main` PR; never enable auto-merge yet.
3. Wait for exact release-PR CI. Record its numeric workflow run ID and attempt.
   A missing, skipped, or failed pending-migration result blocks.
4. **STOP — external CI/preview authorization.** This authorizes only the
   read-only release-verification dispatch and its externally billed preview
   probes.
5. Dispatch, watch, and download the exact attempt:

   ```bash
   gh workflow run release-verification.yml \
     --ref develop \
     -f baselineTag="$baselineTag" -f developCommit="$developCommit" \
     -f candidateTreeDigest="$candidateTreeDigest" -f previewUrl="$previewUrl" \
     -f runId="$runId" -f releasePrRunId="$releasePrRunId" \
     -f releasePrRunAttempt="$releasePrRunAttempt" \
     -f preMergeEvidence="$(jq -c . "$runDir/pre-merge-evidence.json")"
   verificationRunId="$(gh run list --workflow release-verification.yml \
     --event workflow_dispatch --json databaseId,headSha,displayTitle \
     --jq "map(select(.headSha==\"$developCommit\" and .displayTitle==\"Release evidence for $developCommit ($runId)\"))[0].databaseId")"
   gh run watch "$verificationRunId" --exit-status
   verificationRunAttempt="$(gh api \
     "repos/{owner}/{repo}/actions/runs/$verificationRunId" --jq .run_attempt)"
   gh run download "$verificationRunId" \
     --name "release-evidence-$runId-$verificationRunAttempt" \
     --dir "$runDir/pre-merge"
   ```

6. Confirm the workflow did run the pre-merge analyzer and its decision is PASS.
   Missing/failed/skipped requirements,
   identity defects, missing oracles, cleanup defects, incomplete charters,
   skipped high-risk areas, and untriaged findings block.
7. **STOP — merge authorization.**

## 4. Promote and assemble final evidence

1. Reconfirm PR head and evidence still identify `developCommit`, then:

   ```bash
   gh pr merge --squash --auto
   ```

   Never delete permanent `develop`.
2. Resolve `mainCommit`; require
   `git rev-parse "${mainCommit}^{tree}" == candidateTreeDigest`. Record this as
   the `mainTreeDigest` check.
3. Wait for production `/api/version` to report `mainCommit` and environment
   `production`; this is the production identity check. Run only the
   production-safe read-only scenarios:

   ```bash
   EXPECTED_DEPLOYMENT_COMMIT="$mainCommit" \
   EXPECTED_DEPLOYMENT_ENV=production PLAYWRIGHT_BASE_URL="$productionUrl" \
   PLAYWRIGHT_JSON_OUTPUT_NAME="$runDir/production-results.json" \
     pnpm --filter @chapa/web exec playwright test \
       e2e/release-required.spec.ts --grep @release-required --project=chromium
   pnpm exec tsx scripts/quality/collect-playwright-evidence.ts \
     --results "$runDir/production-results.json" \
     --catalog quality/release-required.json --environment production \
     --scenario-ids deployment.production-identity,health.core-dependencies,profile.public-badge-read,profile.public-share-read \
     --run-id "$runId" --candidate-identity "$mainCommit" \
     --output "$runDir/production-fragment.json"
   pnpm exec tsx scripts/quality/verify-deployment-identity.ts \
     --candidate "$runDir/candidate.json" --main-commit "$mainCommit" \
     --production-url "$productionUrl" --output "$runDir/final-identity.json"
   ```

4. Assemble the final run and comprehensive manifest. This preserves charters,
   manual evidence, cleanup, preview observations, and rollback reference:

   ```bash
   pnpm exec tsx scripts/quality/merge-release-evidence.ts \
     --stage final --run "$runDir/pre-merge/release-run.json" \
     --fragment "$runDir/production-fragment.json" \
     --identity-evidence "$runDir/final-identity.json" \
     --production-url "$productionUrl" \
     --rollback-reference "$rollbackReference" \
     --output "$runDir/release-run.json" \
     --manifest-output "$runDir/evidence-manifest.json"
   pnpm release:analyze -- --run "$runDir/release-run.json" --stage final
   pnpm release:render-report -- --run "$runDir/release-run.json" \
     --stage final --output "$runDir/release-report.md"
   ```

## 5. Tag last, observe, or roll back

1. Confirm the final analyzer PASS, then present the report with exact
   source/tree/deployment, deterministic,
   exploratory, manual, cleanup, production, and rollback evidence.
2. **STOP — tag authorization and GitHub release authorization.**
3. Only after fresh authorization, create/push the named tag, create the GitHub
   release, and attach evidence:

   ```bash
   git tag -a "$releaseTag" "$mainCommit" -m "$releaseTag"
   git push origin "$releaseTag"
   gh release create "$releaseTag" --notes-file "$releaseNotesPath"
   gh release upload "$releaseTag" "$runDir/evidence-manifest.json" \
     "$runDir/release-report.md"
   ```

   Verify the remote tag resolves to `mainCommit`.
4. Perform read-only post-release checks. For incidents use the incident and
   observability runbooks. Roll back to the previous evidence-approved
   deployment using the rollback runbook; database recovery remains separately
   authorized.

## Linked operational detail

- Manual arcs: `docs/runbooks/release-checklist.md`
- Deployed probes: `docs/runbooks/deployment-smoke.md`
- Migrations: `docs/runbooks/migrations.md`
- Rollback: `docs/runbooks/rollback.md`
- Incidents and monitoring: `docs/runbooks/incident-response.md`,
  `docs/runbooks/observability.md`
