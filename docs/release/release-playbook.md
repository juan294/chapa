# Chapa Production Release Playbook

This is Chapa's single production-release procedure. `/release` executes it.
Deep/exhaustive verification lives in `docs/playbooks/e2e-pro-release-verification.md`
and runs via `/prodplaybook` on request — it never controls this default
path. Capability detail lives in the linked runbooks.

## Scope and authorization

- Release topology: `develop` to `main`, **merge commit**, then tag `mainCommit`.
  Squashing discarded ancestry and cost 40 hand-made back-merges (#1228).
- Direct commands are authoritative: a required CI check conclusion, a
  `release-result.json` direct-check status, and a plain identity comparison are
  the proof. No analyzer decision is layered on top of them.
- Two stops. **Gate 1 — approve the release**: version choice and full diff
  approval, together. **Gate 2 — authorize production**: merge authorization
  and tag authorization, together, granted once up front. Everything after
  Gate 2 — PR creation, the Preview proof dispatch, the squash merge, the
  tag/publish — runs as an already-authorized step, not a fresh stop. Gate 2
  authorizes release mechanics only: never production data mutation,
  migrations, crons, messages, environment changes, or a rollback, each of
  which needs its own explicit authorization.

## 1. Prepare, verify, and approve

1. Read `CLAUDE.md`, this playbook, and the linked runbooks.
2. Use an isolated clean release worktree based on current `develop`.
3. Confirm ancestry is intact: `git merge-base --is-ancestor origin/main
   origin/develop`. With merge-commit promotion this holds by construction; a
   failure means someone squashed a release PR and reintroduced the drift
   #1228 removed.
4. Fetch origin. Bind `baselineTag` to the exact deployed production `main`
   identity, not `develop` ancestry:

   ```bash
   productionUrl="${productionUrl:-https://chapa.thecreativetoken.com}"
   productionVersion="$(curl -fsS "$productionUrl/api/version")"
   productionCommit="$(printf '%s' "$productionVersion" | jq -er 'select(.environment == "production") | .commitSha')"
   mainCommit="$(git rev-parse origin/main)"
   test "$productionCommit" = "$mainCommit"
   baselineTag="$(git for-each-ref --points-at "$mainCommit" --sort=-version:refname --count=1 --format='%(refname:short)' 'refs/tags/v[0-9]*')"
   test "$(git cat-file -t "$baselineTag")" = tag
   test "$(git rev-parse "${baselineTag}^{commit}")" = "$mainCommit"
   rollbackReference="$baselineTag"
   ```

   An empty tag or any identity mismatch blocks (`BLOCKED`). Then identify
   the current version, commits, paths, migrations, version-bearing files,
   and exact remote refs from `baselineTag..develop`.
5. Present release type, changes, topology, known risks, and retirement
   review.
6. Update version, changelog, and every current version reference.
7. Run the bounded local release checks sequentially — deliberately smaller
   than full CI, which runs as exact-head remote admission checks next:
   ```bash
   git diff --check
   pnpm run release:validate-docs
   pnpm run validate:migrations
   pnpm run test:contract:local
   pnpm run build
   ```
8. Present the version choice and the complete diff and results together.
9. **STOP — Gate 1: approve the release.** Version choice and full diff
   together; approving only one does not satisfy this gate.

## 2. Authorize production and push the candidate

1. **STOP — Gate 2: authorize production.** Merge authorization and tag
   authorization together, before anything below runs.
2. Commit and push the approved preparation, then fix candidate identity:
   ```bash
   developCommit="$(git rev-parse HEAD)"
   candidateTreeDigest="$(git rev-parse 'HEAD^{tree}')"
   runId="release-${developCommit:0:12}"
   runDir="quality/evidence/runs/$runId"
   ```
3. Create or reuse the `develop` to `main` release PR immediately after the
   push; never enable auto-merge yet:
   ```bash
   releasePrNumber="$(gh pr create --base main --head develop \
     --title "Release $releaseTag" --body "$releaseNotes" 2>/dev/null \
     || gh pr view --json number --jq .number)"
   headRefOid="$(gh pr view "$releasePrNumber" --json headRefOid --jq .headRefOid)"
   test "$headRefOid" = "$developCommit"
   ```

## 3. One concurrent observation wave

Resolve the immutable Vercel Preview for `developCommit` before this step;
protected Previews require `VERCEL_AUTOMATION_BYPASS_SECRET`, missing which
blocks verification (`BLOCKED`). Then observe two things concurrently — in
separate terminal sessions or a CI watcher, never by backgrounding a shell
command in a way that hides its exit status:

- **Required PR checks**, which include `Pending Migrations Check (release
  PR)`: `gh pr checks "$releasePrNumber" --required --watch --fail-fast`. A
  missing, skipped, or failed migration result blocks and must be resolved,
  never waived — the check fails closed when its production read
  credentials are absent.
- **Preview proof**, dispatched against the exact candidate:
  ```bash
  gh workflow run release-verification.yml \
    --ref develop \
    -f baselineTag="$baselineTag" -f developCommit="$developCommit" \
    -f candidateTreeDigest="$candidateTreeDigest" -f previewUrl="$previewUrl" \
    -f runId="$runId"
  verificationRunId="$(gh run list --workflow release-verification.yml \
    --event workflow_dispatch --json databaseId,headSha,displayTitle \
    --jq "map(select(.headSha==\"$developCommit\" and .displayTitle==\"Release proof for $developCommit ($runId)\"))[0].databaseId")"
  gh run watch "$verificationRunId" --exit-status
  verificationRunAttempt="$(gh api \
    "repos/{owner}/{repo}/actions/runs/$verificationRunId" --jq .run_attempt)"
  gh run download "$verificationRunId" \
    --name "release-result-$runId-$verificationRunAttempt" \
    --dir "$runDir"
  ```

Both must finish successfully before step 4. Validate
`$runDir/release-result.json`: `status == "passed"`, every entry in `checks`
is `passed`, `candidate.developCommit == source.headSha == developCommit`,
`source.workflowRunId`/`source.workflowRunAttempt` match the watched run and
attempt, and `candidate.rollbackReference == baselineTag`. Any mismatch or
non-passed status is `BLOCKED`.

## 4. Promote

1. Reconfirm PR head still identifies `developCommit`, then merge:
   ```bash
   test "$(gh pr view "$releasePrNumber" --json headRefOid --jq .headRefOid)" = "$developCommit"
   gh pr merge --merge --auto
   ```
   Never delete permanent `develop`.
2. Resolve `mainCommit`; require the promoted tree to equal the candidate
   tree — the `mainTreeDigest` check:
   ```bash
   mainCommit="$(git rev-parse origin/main)"
   mainTreeDigest="$(git rev-parse "${mainCommit}^{tree}")"
   test "$mainTreeDigest" = "$candidateTreeDigest"
   ```
3. Wait for production `/api/version` to report `mainCommit` and environment
   `production` — the production identity check. Then run the four default
   production scenarios directly:
   ```bash
   EXPECTED_DEPLOYMENT_COMMIT="$mainCommit" EXPECTED_DEPLOYMENT_ENV=production \
   RELEASE_VERIFICATION_MODE=default PLAYWRIGHT_BASE_URL="$productionUrl" \
     pnpm --filter @chapa/web exec playwright test \
       e2e/release-required.spec.ts --grep @release-required --project=chromium
   ```
   A failed or missing production identity or probe means production has
   already changed: `ROLLED_BACK`-eligible, not `BLOCKED` (see below).

## 5. Tag, publish, and read back

1. Only after production identity and all four production scenarios pass,
   tag and publish:
   ```bash
   git tag -a "$releaseTag" "$mainCommit" -m "$releaseTag"
   git push origin "$releaseTag"
   gh release create "$releaseTag" --notes-file "$releaseNotesPath"
   ```
2. Read back the tag and release before reporting done:
   ```bash
   test "$(git rev-parse "${releaseTag}^{commit}")" = "$mainCommit"
   test "$(gh release view "$releaseTag" --json tagName --jq .tagName)" = "$releaseTag"
   ```
3. Write and upload the final `release-result.json` — it adds `mainCommit`,
   `mainTreeDigest`, the production identity/probe checks, `tag`, `release`,
   and `readback` to the Preview result:
   ```bash
   pnpm run release:write-result -- --stage final \
     --input "$runDir/final-input.json" --output "$runDir/release-result.json"
   ```
   A failure after the tag exists but before this receipt is written and
   read back is `PUBLICATION_PENDING`, not `BLOCKED`.
4. Perform read-only post-release checks per `docs/runbooks/release-checklist.md`.

## Recovery outcomes

Procedural report outcomes only. None authorizes anything on its own.

| Outcome | Meaning | Allowed continuation |
|---|---|---|
| `PAUSED` | Candidate and production are unchanged; the failure is in observation, provider state, credentials, or a temporary environment condition. | Repair the observer/provider condition and rerun only the failed stage for the same `developCommit`. |
| `BLOCKED` | Candidate admission, policy, identity, tree, migration, or direct product proof failed before promotion. | Stop. A source change requires new Gate 1 and Gate 2 approval. |
| `ROLLED_BACK` | Production changed, post-promotion proof failed, and a separately authorized rollback (`docs/runbooks/rollback.md`) completed. | End the attempt. Do not tag. A new attempt needs new authorization. |
| `PUBLICATION_PENDING` | Production proof passed, but the tag, GitHub Release, or readback is incomplete. | Inspect remote state and resume publication only; never redeploy a production-proven candidate. |

No automatic redeployment or override exists; each is separately authorized.

## Linked operational detail

- Manual arcs: `docs/runbooks/release-checklist.md`
- Deployed probes: `docs/runbooks/deployment-smoke.md`
- Migrations: `docs/runbooks/migrations.md`
- Rollback: `docs/runbooks/rollback.md`
- Incidents: `docs/runbooks/incident-response.md`, `docs/runbooks/observability.md`
- Deep verification (explicit, risk-selected, never a default gate): `docs/playbooks/e2e-pro-release-verification.md` via `/prodplaybook`; `/explore-release` for fresh-context exploration
