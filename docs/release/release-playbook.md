# Chapa Production Release Playbook

This is Chapa's single production-release procedure. `/release` executes it. Capability detail lives in the linked runbooks; evidence semantics live in `docs/playbooks/e2e-pro-release-verification.md`.

## Scope and authorization

- Release topology: `develop` to `main`, squash merge, then tag `mainCommit`.
- Analyzer PASS is evidence, not authorization: a non-PASS decision always blocks and is reported honestly, and only a fresh, explicit override may proceed past it.
- Two stops. **Gate 1 — approve the release**: version choice and full diff approval, together. **Gate 2 — authorize production**: merge authorization and tag authorization, together, granted once up front — folding in what were previously three separate stops (release PR authorization, **STOP — external CI/preview authorization**, and merge authorization). Everything after Gate 2 — PR creation, the billed verification dispatch, the squash merge, the tag/publish — runs as an already-authorized step, not a fresh stop. Gate 2 authorizes release mechanics only: never production data mutation, migrations, crons, messages, environment changes, or an analyzer override, each of which needs its own explicit authorization.

## 1. Prepare, verify, and approve

1. Read `CLAUDE.md`, this playbook, and the linked runbooks.
2. Use an isolated clean release worktree based on current `develop`.
3. Fetch origin. Bind `baselineTag` to the exact deployed production `main` identity, not `develop` ancestry:

   ```bash
   productionUrl="${productionUrl:-https://chapa.thecreativetoken.com}"
   productionVersion="$(curl -fsS "$productionUrl/api/version")"
   productionCommit="$(printf '%s' "$productionVersion" | jq -er 'select(.environment == "production") | .commitSha')"
   mainCommit="$(git rev-parse origin/main)"
   test "$productionCommit" = "$mainCommit"
   baselineTag="$(git for-each-ref --points-at "$mainCommit" --sort=-version:refname --count=1 --format='%(refname:short)' 'refs/tags/v[0-9]*')"
   test "$(git cat-file -t "$baselineTag")" = tag
   test "$(git rev-parse "${baselineTag}^{commit}")" = "$mainCommit"
   ```

   An empty tag or any identity mismatch blocks. Then identify the current version, commits, paths, migrations, version-bearing files, exact remote refs, and exact-SHA CI from `baselineTag..develop`.
4. Present release type, changes, topology, known risks, and retirement review.
5. Update version, changelog, and every current version reference.
6. Run sequentially:

   ```bash
   pnpm run quality:validate
   pnpm run typecheck
   pnpm run lint
   pnpm run test
   pnpm run test:contract:local
   pnpm run build
   ```

7. Present the version choice and the complete diff and results together.
8. **STOP — Gate 1: approve the release.** Version choice and full diff together; approving only one does not satisfy this gate.

## 2. Authorize production and prepare inputs

1. **STOP — Gate 2: authorize production.** Merge authorization and tag authorization together, before anything below runs: the release PR, the verification dispatch and its billed preview probes, the eventual squash merge, and the eventual tag/publish. Not authorized here: production data mutation, migrations, crons, messages, environment changes, or a non-PASS analyzer override.
2. Commit and push only the approved release preparation.
3. Resolve the immutable Vercel preview for this exact commit, then record:

   ```bash
   developCommit="$(git rev-parse HEAD)"
   candidateTreeDigest="$(git rev-parse 'HEAD^{tree}')"
   runId="release-${developCommit:0:12}"
   runDir="quality/evidence/runs/$runId"
   rollbackReference="$baselineTag"
   ```

4. Wait for exact-`developCommit` push CI and preview `/api/version`. Protected previews require `VERCEL_AUTOMATION_BYPASS_SECRET`; missing blocks verification.
5. Prepare the run and candidate record:

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

6. Run `/explore-release $runDir/candidate.json`, then complete applicable manual arcs in `docs/runbooks/release-checklist.md`.
7. Create `$runDir/pre-merge-evidence.json`:

   ```json
   {"exploratoryCharters":[],"manualObligations":[],"manualResult":{"scenarioId":"release.manual-arcs","environment":"preview"}}
   ```

   Replace the placeholders with complete schema-valid charters, one passed candidate-bound record per catalog `manualObligationIds`, and the manual `ScenarioResult` with `ui` and `http` evidence.

## 3. Release PR and pre-merge evidence

1. Create or reuse the `develop` to `main` PR (Gate 2); never enable auto-merge yet.
2. Wait for exact release-PR CI. Record its numeric workflow run ID and attempt; a missing, skipped, or failed pending-migration result blocks and must be resolved, never waived.
3. Dispatch, watch, and download the exact attempt of the release-verification workflow (Gate 2):

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

4. Confirm the workflow did run the pre-merge analyzer; report its decision honestly. Missing/failed/skipped requirements, identity defects, missing oracles, cleanup defects, incomplete charters, skipped high-risk areas, and untriaged findings block. A non-PASS decision blocks per Scope above.

## 4. Promote and assemble final evidence

1. Reconfirm PR head and evidence still identify `developCommit`, then merge (Gate 2):

   ```bash
   gh pr merge --squash --auto
   ```

   Never delete permanent `develop`.
2. Resolve `mainCommit`; require `git rev-parse "${mainCommit}^{tree}" == candidateTreeDigest`. Record this as the `mainTreeDigest` check.
3. Wait for production `/api/version` to report `mainCommit` and environment `production`; this is the production identity check. Run only the production-safe read-only scenarios:

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

4. Assemble the final run and comprehensive manifest. This preserves charters, manual evidence, cleanup, preview observations, and rollback reference:

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

5. Confirm the final analyzer decision, honestly stating PASS or non-PASS, and present the report with exact source/tree/deployment, deterministic, exploratory, manual, cleanup, production, and rollback evidence. A non-PASS decision blocks per Scope above.

## 5. Tag, observe, or roll back

1. Only after the final analyzer PASS (or an explicit override), tag and publish (Gate 2):

   ```bash
   git tag -a "$releaseTag" "$mainCommit" -m "$releaseTag"
   git push origin "$releaseTag"
   gh release create "$releaseTag" --notes-file "$releaseNotesPath"
   gh release upload "$releaseTag" "$runDir/evidence-manifest.json" \
     "$runDir/release-report.md"
   ```

   Verify the remote tag resolves to `mainCommit`.
2. Perform read-only post-release checks. For incidents use the incident and observability runbooks. Roll back to the previous evidence-approved deployment using the rollback runbook; database recovery remains separately authorized.

## Linked operational detail

- Manual arcs: `docs/runbooks/release-checklist.md`
- Deployed probes: `docs/runbooks/deployment-smoke.md`
- Migrations: `docs/runbooks/migrations.md`
- Rollback: `docs/runbooks/rollback.md`
- Incidents and monitoring: `docs/runbooks/incident-response.md`, `docs/runbooks/observability.md`
