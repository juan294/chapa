# Chapa Production Release Playbook

This is the active release procedure executed by `/release`. Implementation
and local qualification authorize no production operation. Deep verification
via `/prodplaybook` remains explicit and risk-selected.

## Scope and authorization

Development stays in isolated local branches/worktrees until complete. Run the
full applicable verification locally and merge completed work locally into
`develop`. Never push feature branches or use remote PRs, Actions, or hosted
builds as an implementation loop. Never create a Vercel Preview deployment.

Two release gates remain: **Gate 1 — approve the release** covers the concrete
version choice and complete diff; **Gate 2 — authorize production** covers the
release PR, merge authorization, tag authorization and publication together.
Existing explicit authorization persists; do not ask again for an authorized
step. Neither gate implicitly authorizes migrations, production recompute,
crons, messages, environment changes or rollback. Those operations require their
own explicit authorization.

The release topology remains `develop` to `main`, using a **merge commit**;
never squash a release PR or delete permanent `develop`. Local-candidate proof
is schema2. Schema1 results are historical artifacts, not current admission.

## 1. Prepare and freeze the local candidate

Read `CLAUDE.md`, this playbook, the scoring release packet and relevant
runbooks. Identify the version, changelog, release diff, migrations, retirement
review and risk. Finish all tracked changes before qualification, including
version and documentation changes. Present the reviewable diff and completed
local qualification results together at Gate 1 after section2.

Use the locally available annotated baseline/rollback reference for candidate
bookkeeping; production matching remains explicitly pending until authorized
readback. Freeze the exact commit and full source tree in a clean isolated worktree:

```bash
developCommit="$(git rev-parse HEAD)"
candidateTreeDigest="$(git rev-parse 'HEAD^{tree}')"
runId="release-${developCommit:0:12}"
runDir="quality/evidence/runs/$runId"
```

The worktree must contain no tracked changes. Store proof, reports and the
allowlisted build manifest outside the tracked candidate, in gitignored
`quality/evidence/runs/` or an external evidence directory. There must be
**no tracked commits** after qualification. Any later tracked commit,
including documentation or evidence, invalidates proof: bind and qualify the
new exact commit and full tree. Application artifact hashes supplement source
identity; they never replace it.

## 2. Qualify locally

Run gates sequentially against that exact candidate. A failed, absent or
skipped required gate blocks qualification; fix locally, freeze the resulting
candidate and rerun affected/full required gates. Do not use remote compute to
discover whether these checks pass.

```bash
git diff --check
pnpm run typecheck
pnpm run lint
pnpm run test:contract:local
pnpm run test:coverage
pnpm run release:validate-docs
pnpm run check:vercel-config
pnpm run check:circular
pnpm run validate:migrations
pnpm run check:write-registration
pnpm run check:licenses
pnpm run check:vulnerabilities
pnpm exec tsx scripts/quality/candidate-artifact-manifest.ts --root "$candidateRoot" --output "$manifestPath"
bash scripts/check-bundle-size.sh
pnpm exec tsx --tsconfig tsconfig.scripts.json scripts/scoring/reference-calculator.ts packages/shared/src/__fixtures__/observed-owner-envelope.json
```

`test:coverage` supplies both `unitTests` and `coverage` evidence: it runs the
full unit suite and operational-script coverage, so do not duplicate a plain
unit run unless hooks independently require it. The manifest helper performs
`pnpm run build` once and emits its actual commit/tree/artifact identity; do not
precede it with a redundant build. The Craft propagation guard and every other
applicable workflow selection must also pass. Vulnerability tooling may read a
public advisory feed, but must not upload private source or trigger hosted
compute; use its supported local database where available.

Use synthetic local fixtures, local Supabase/Redis and explicitly isolated
credentials. Never populate this proof with real-user reports or secrets.
Run the required browser scenarios against the production-mode local build in
explicit `local-candidate` mode; a development server is not build proof.
Record discovered, executed, skipped and failed counts; every discovered applicable test executes with zero skips or failures.
`apps/web/e2e/helpers/release-required-environments.ts` is the scenario authority;
`scripts/quality/release-result.ts` is the strict result authority.

Schema2 requires these named local checks: `sourceIdentity`, `typecheck`,
`lint`, `unitTests`, `contractTests`, `coverage`, `build`, `localProbes`,
`releaseDocs`, `vercelConfig`, `circularDependencies`, `migrationValidation`,
`writeRegistration`, `licenses`, `vulnerabilities`, `bundleBudget`, and
`offlineReplay`. Each must actually pass. Build identity binds allowlisted
artifacts and their digests, excluding env files, raw reports, secret-bearing
logs and mutable caches. Use a loopback local URL and `environment=local`;
never invent a Preview environment or label localhost as Preview.

Build/probe command details are in [deployment-smoke.md](../runbooks/deployment-smoke.md).
The local input uses `schemaVersion:2`, `mode:"local-candidate"`,
`environment:"local"`, candidate commit/tree/loopback URL and baseline/rollback
references; the emitted build manifest; all named `checks`; actual `localProbes`
`discovered`/`executed`/`skipped`/`failed` counts and scenario results (executed equals discovered; zero failures/skips); `generatedAt`; and `pendingProduction` with
`migrationAdmission`, `productionIdentity`, `productionProbes`,
`publicationReadback`, `rollbackReadiness` all `pending`.

Write the local result using real gate/probe observations:

```bash
pnpm run release:write-result -- --stage local-candidate \
  --input "$runDir/local-input.json" --output "$runDir/local-candidate.json"
```

Production deployment identity, production migration admission, production
probes and tag/publication readback remain explicitly pending. Local success
cannot satisfy them. Do not fabricate GitHub run IDs or downloaded artifacts.

## 3. Inspect triggers before any push

Inspect remote workflow and platform Git-integration triggers read-only.
**Preview prevention** means proving a push cannot create a Preview deployment.
An **Ignored Build Step** that skips computation after creating a deployment is
not that proof. Do not clear it to make a Preview build. If there is no
documented non-destructive prevention, stop before pushing and identify the
trigger; no push is authorized merely because local qualification passed.

Only after all local gates pass, Preview creation is prevented, and the remote
action is explicitly authorized may the completed integration branch be pushed
once. Do not incrementally push fixes. No workflow dispatch belongs to local
qualification.

## 4. Authorize and admit production

Gate 2 is explicit production authorization, not an inference from completion.
Read the actual deployed production identity and remote refs at this stage.
Production `/api/version` must report `production` and `origin/main`; bind the
annotated baseline tag and rollback reference to that exact commit, never to
`git describe` or `develop` ancestry. A missing tag or mismatch blocks.

Require the local proof's commit to equal `origin/develop`, and prove promotion
preserves the candidate tree:

```bash
test "$(git rev-parse origin/develop)" = "$developCommit"
developTreeDigest="$(git rev-parse 'origin/develop^{tree}')"
prospectiveMainTreeDigest="$(git merge-tree --write-tree origin/main origin/develop)"
test "$developTreeDigest" = "$candidateTreeDigest"
test "$prospectiveMainTreeDigest" = "$candidateTreeDigest"
```

Create or reuse the authorized `develop` to `main` release PR using a body file.
Do not enable auto-merge before admission. Read exact-head required checks;
remote checks corroborate the completed local gates and are not a debugging
loop. Missing, skipped or failed checks block. The production **migration
admission** check needs real authorized read credentials; a local migration
result does not substitute. Separately authorize and apply any required
production migration/recompute before promotion according to its runbook.

## 5. Promote and prove production

Reconfirm PR head and local proof identity, then execute the authorized merge:

```bash
test "$(gh pr view "$releasePrNumber" --json headRefOid --jq .headRefOid)" = "$developCommit"
gh pr merge --merge --auto
```

After the merge and a read-only ref refresh, require full tree identity:

```bash
mainCommit="$(git rev-parse origin/main)"
mainTreeDigest="$(git rev-parse "${mainCommit}^{tree}")"
test "$mainTreeDigest" = "$candidateTreeDigest"
```

Wait for actual **production identity**: the deployment ID/URL and production
`/api/version` must identify `mainCommit` in environment `production`. Execute
the four default production scenarios against that deployment, never against
the local build:

```bash
EXPECTED_DEPLOYMENT_COMMIT="$mainCommit" EXPECTED_DEPLOYMENT_ENV=production \
RELEASE_VERIFICATION_MODE=default PLAYWRIGHT_BASE_URL="$productionUrl" \
  pnpm --filter @chapa/web exec playwright test \
    e2e/release-required.spec.ts --grep @release-required --project=chromium
```

A failure now means production has changed. Record that fact; a separately
authorized rollback follows `docs/runbooks/rollback.md`. Never declare the
candidate merely blocked before deployment when it is already deployed.

## 6. Tag, publish and read back

Only after production identity, tree and required probes pass, execute the
already authorized named tag and publication:

```bash
git tag -a "$releaseTag" "$mainCommit" -m "$releaseTag"
git push origin "$releaseTag"
gh release create "$releaseTag" --notes-file "$releaseNotesPath"
test "$(git rev-parse "${releaseTag}^{commit}")" = "$mainCommit"
test "$(gh release view "$releaseTag" --json tagName --jq .tagName)" = "$releaseTag"
```

Never push all tags. Read back the remote tag target and actual GitHub Release,
not just local existence. Write schema2 final proof referencing the exact
local-candidate proof and adding actual production identity, migration
admission, probes and publication/tag readback:

```bash
pnpm run release:write-result -- --stage final \
  --input "$runDir/final-input.json" --output "$runDir/release-result.json"
```

The final input uses `schemaVersion:2`, the complete `localCandidate` proof,
`mainCommit`, `mainTreeDigest`, actual `deployment` (`environment:"production"`,
`id`, HTTPS origin `url`, `commit`, `treeDigest`), the five production `checks`,
`tag:{name,target}`, `release:{tag,target}`, `readback:{tagVerifiedAt,releaseVerifiedAt}`
and `generatedAt`. Tag target is the main commit; release target is the tag.
The writer derives status and the embedded local proof digest.

The final input must explicitly identify schema2. Preserve both proofs outside
the tracked candidate. No release is complete until final readback passes.

## Recovery outcomes

| Outcome | Meaning |
|---|---|
| `PAUSED` | Observer/provider/credential condition prevents a check; neither candidate nor production changed. Repair that condition and retry the same stage. |
| `BLOCKED` | Admission, policy, tree, migration or required proof failed before promotion. Changed source needs newly bound local qualification. |
| `ROLLED_BACK` | Production changed and failed proof, then a separately authorized rollback completed. Do not tag the failed candidate. |
| `PUBLICATION_PENDING` | Production proof passed but tag, GitHub Release or final readback is incomplete. Resume publication only; never redeploy merely to finish it. |

No outcome authorizes remote actions. Operational detail:
`docs/runbooks/release-checklist.md`, `deployment-smoke.md`, `migrations.md`,
`rollback.md`; current scoring: `docs/release/scoring-v7-release-packet.md`
(superseded in part, see `docs/decisions/2026-09-23-universal-v72-no-consent.md`)
and `docs/runbooks/scoring-collection-queue.md`.
