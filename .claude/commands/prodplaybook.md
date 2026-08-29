# Production E2E Pro Verification

Model tier: **opus** — use the strongest available reasoning tier. Fresh-context
exploratory charters (via `/explore-release`) may run as independent
background agents when requested, but this orchestrator owns the final
report.

Run Chapa's read-only, exhaustive deep verification against a fixed
production target. This is a verification tool, not a release workflow, and
it is explicit and risk-selected — it is never a required step of a default
`/release`.

It MUST NOT change versions, prepare or create a release PR, merge branches,
create or push tags, publish a GitHub release, deploy, apply migrations, invoke
production jobs, or mutate production data. Those operations remain owned by
`/release` and their explicit authorization gates.

## Inputs

Optional `$ARGUMENTS`: an immutable release tag or 40-character commit SHA.

- With no argument, target the commit currently reported by
  `https://chapa.thecreativetoken.com/api/version`.
- With an argument, require the tag/SHA, `main`, and production `/api/version`
  to identify the same released tree.
- Never infer success from a mutable branch, familiar URL, or latest workflow.

## Authorities

Read `docs/playbooks/e2e-pro-release-verification.md` completely before
acting — it defines current deep-verification scope and evidence semantics.
`apps/web/e2e/helpers/release-required-environments.ts` is the single
executable authority for which scenarios exist at which mode; this command
does not maintain a separate catalog.

## Authorization and safety

This invocation authorizes:

- read-only repository, GitHub, CI, deployment, and production inspection;
- deterministic local verification in an isolated worktree;
- synthetic local writes using run-scoped fixtures; and
- `RELEASE_VERIFICATION_MODE=deep` deployed probes against the fixed target.

It does not authorize production writes, real-user access, migration
application, cron or job invocation, live charges, email or messages, vendor
side effects, environment changes, destructive operations, deployment, or
release actions. Stop for explicit authorization before any such operation.

Use identifiers prefixed `chapa-e2e-{runId}-`. Clean up only fixtures created by
this run and prove zero unexpected residue.

## Step 1: Fix the production target

1. Fetch current remote refs and tags.
2. Read production `/api/version` and require a 40-character `commitSha`,
   `environment` equal to `production`, and an uncached response.
3. Resolve the target release tag, `main` commit, production commit, and
   GitHub release. Require their source and tree identities to agree.
4. Resolve the immediately previous release tag as `baselineTag`.
5. Create an isolated clean verification worktree at the immutable target.

Any identity ambiguity is **BLOCKED**.

## Step 2: Run deterministic and deployed verification

In the immutable target worktree run sequentially:

```bash
pnpm run release:validate-docs
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run test:contract:local
pnpm run build
```

Then, against the exact production URL:

```bash
EXPECTED_DEPLOYMENT_COMMIT="$targetCommit" EXPECTED_DEPLOYMENT_ENV=production \
RELEASE_VERIFICATION_MODE=deep PLAYWRIGHT_BASE_URL="https://chapa.thecreativetoken.com" \
  pnpm --filter @chapa/web exec playwright test \
    e2e/release-required.spec.ts --grep @release-required --project=chromium
```

Deep production adds `profile.share-verification` and `locales.en-es` to the
four default checks. Reconfirm `/api/version` immediately before probing. Do
not convert preview, local, or historical evidence into a current production
observation. An absent target, wrong identity, degraded dependency,
unexpected write, or stale response is **BLOCKED**.

## Step 3: Run fresh-context exploratory charters (when requested or risk-selected)

Invoke `/explore-release "$targetCommit"` when the freshness of deployed
behavior for this target has not been recently exercised, or when a specific
risk area warrants it. This step is not mandatory for every invocation of
`/prodplaybook` — size it to the actual risk, and record why it was run or
skipped.

## Step 4: Record and report

Write `docs/agents/prodplaybook-report.md` containing: exact target SHA and
tree, production identity, every command run and its result, deep-mode
scenario results, exploratory charter findings (if run) with triage, fixture
and cleanup evidence, and any limitation. State `PASS` or `BLOCKED` and, if
`BLOCKED`, the exact failed or missing check and the minimum safe next
action.

## Completion contract

Do not report `/prodplaybook` complete or `PASS` unless:

- production target, tag, source, and tree identities agree;
- all deterministic checks passed;
- all deep-mode production scenarios passed;
- any exploratory charters run are complete, triaged, and clean; and
- `docs/agents/prodplaybook-report.md` contains exact SHAs, tree digests,
  scenario results, findings, and evidence paths.

If blocked, lead with `BLOCKED`, name the exact failed or missing check,
preserve findings, and state the minimum safe next action. Never describe a
partial run as exhaustive or production-verified.
