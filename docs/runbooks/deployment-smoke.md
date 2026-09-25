# Local-candidate and Production Smoke Runbook

Canonical authority: `docs/release/release-playbook.md`.
[The release playbook](../release/release-playbook.md) owns ordering and
authorization. This runbook separates local build evidence from actual
production observations. It never requests a Vercel Preview deployment.

## Local qualification

Use an exact clean commit/full tree and the allowlisted build manifest emitted
by `scripts/quality/candidate-artifact-manifest.ts`. That helper performs the
production build; do not first perform a duplicate build merely for this proof.
Manifests/results belong outside the tracked candidate. Never include env files,
raw reports, secret-bearing logs or mutable caches.
The helper refuses implicit Next env files in the repository or app directory.
Its build process inherits only allowlisted process plumbing, with fixed
`NODE_ENV=production` and `NEXT_TELEMETRY_DISABLED=1`; app/provider secrets are
not inherited. Configure synthetic local services separately for the probe server.

```bash
pnpm exec tsx scripts/quality/candidate-artifact-manifest.ts \
  --root "$candidateRoot" --output "$manifestPath"
EXPECTED_DEPLOYMENT_ENV=local RELEASE_VERIFICATION_MODE=local-candidate \
EXPECTED_DEPLOYMENT_COMMIT="$developCommit" \
EXPECTED_CANDIDATE_TREE_DIGEST="$candidateTreeDigest" \
RELEASE_BUILD_MANIFEST="$manifestPath" \
PLAYWRIGHT_JSON_OUTPUT_NAME="$runDir/release-probes.json" \
  pnpm --filter @chapa/web exec playwright test \
    e2e/release-required.spec.ts --grep @release-required --project=chromium
```

Use absolute manifest/report paths. Omitting `PLAYWRIGHT_BASE_URL` starts a
fresh production-mode `next start` server on loopback port3001. An explicit
base URL must be an exact allowed loopback origin. No development-server
substitution, `VERCEL_ENV` spoofing or hosted bypass secret is involved.

The seven required local-candidate scenarios are defined by
`apps/web/e2e/helpers/release-required-environments.ts`; they include source/build
identity and read-only product behavior. Run the full applicable CI browser
selection too: seven release probes alone do not qualify the browser gate.
Record actual `discovered`, `executed`, `skipped` and `failed` counts.
Every discovered applicable test must execute, with zero skips or failures; a failure anywhere in the full
applicable browser selection fails `localProbes`, not only a named release probe.
Do not count deployment-only pending checks as local passes.

`link-crawl.spec.ts` measures each warm render as the best of 3 samples, not
one; the JSON attachment keeps every sample (`warmSamples`) and the machine's
`loadAverage` at capture time, so a slow machine stays visible without
failing the budget on its own.

## Later authorized production proof

After promotion, actual `/api/version` must report `mainCommit` and environment
`production`. Verify the real deployment ID/URL and source tree independently;
local artifact hashes are additional evidence, not a substitute. Run default
production release probes with `EXPECTED_DEPLOYMENT_ENV=production`,
`RELEASE_VERIFICATION_MODE=default`, the expected commit and actual production
URL. Deep mode is separate explicit risk-selected verification.

The executable scenario catalog is authoritative. Production default covers
identity, core dependencies, public badge and public share. Deep production
also covers share verification and EN/ES. Required probes use read-only smoke
paths; never substitute an ordinary materializing profile request just to
complete production proof.

Dependency health checks read the specific Redis/Supabase/GitHub fields.
Overall health also includes cron freshness; record that separately. A local
fixture dependency result cannot establish production credential or scheduling
readiness. Never invoke cron or change configuration to make a probe pass
without its explicit authorization.

## Failure evidence

Record expected and observed source/tree/build/deployment identities, exact
local or production URL, JSON results, screenshots/traces and failed checks.
A reachability result or familiar hostname is not identity proof. Local evidence
has no fabricated workflow run/attempt. Actual later workflow observations must
name the real run and attempt when relevant.

No secrets, bearer headers, OAuth tokens, service-role keys or private reports
belong in proof. Failed or missing required checks remain failed/missing.
Production migration admission and rollback readiness need real later authorized
observations; they remain pending in local-candidate proof.
