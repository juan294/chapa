# Chapa E2E Pro Release Verification Blueprint

> **Adaptation status:** Chapa-specific decision source for implementation
>
> **Upstream:** CC-RPI E2E Pro Release Verification Playbook, version 1.0
>
> **Adoption scope:** Wave A and the existing Wave B workflow
>
> **Daily procedure:** `docs/release/release-playbook.md` after Phase 5

This document is the comprehensive Chapa adaptation of the CC-RPI E2E Pro
blueprint. It records architecture, invariants, schemas, evidence semantics, and
the risk decisions for every implementation wave. It is not the daily production
release procedure. The operational procedure is a separate document limited to
200 lines and is implemented later in this plan.

The implementation status matters:

- Phase 1 creates this decision source.
- Waves A and B are selected for the current implementation plan.
- Paths described as planned do not exist merely because this document names
  them.
- Waves C through H are recorded with project-specific applicability decisions
  but are not implemented by this plan.
- No production release, merge, deployment, migration, cron invocation,
  notification, tag, or publication is authorized by this document.

## 1. Where E2E Pro Fits in Chapa

E2E Pro is Chapa's release-verification layer. It answers whether every required
check ran and passed against the exact content and deployments involved in the
release. It does not replace Chapa's existing release machinery.

- `.claude/commands/release.md` remains the only versioning and tagging
  authority. In Phase 5 it delegates ordering and evidence gates to
  `docs/release/release-playbook.md`.
- `.claude/commands/explore-release.md` remains the fresh-context exploratory
  executor. It contributes schema-valid charter evidence and never tags.
- `docs/runbooks/release-checklist.md`,
  `docs/runbooks/deployment-smoke.md`, `docs/runbooks/migrations.md`,
  `docs/runbooks/rollback.md`, `docs/runbooks/incident-response.md`, and
  `docs/runbooks/observability.md` retain capability and operational detail.
  They do not become competing top-level release procedures.
- Existing unit, contract, journey, build-artifact E2E, deployed smoke, and
  nightly probes remain the execution layers. E2E Pro selects, attributes, and
  analyzes their evidence rather than replacing them.

Chapa uses `develop` as its integration branch and `main` as production. A
production release is a `develop` to `main` pull request and the repository's
release command uses squash merge. (`CLAUDE.md:287-296`,
`.claude/commands/release.md:238-287`)

### Adoption scaling

Wave A is the mandatory floor and is adopted now. Chapa already has the Wave B
exploratory command, so this plan connects it to the same candidate and evidence
contract. Waves C through H remain risk-selected structural work.

The selected scope deliberately does not create empty registries, generators, or
cadence records. A named empty structure would imply coverage that does not yet
exist.

## 2. Purpose

For every Chapa release, the implemented Wave A and B system answers:

1. What is the last released baseline?
2. Which immutable `develop` commit and Git tree constitute the release
   candidate?
3. Which checks are mechanically required for that candidate?
4. Did each required check pass in its declared environment?
5. Does each result contain its required oracle evidence?
6. Did independent exploratory charters use the same candidate and complete all
   eight maneuvers?
7. Did the squash-produced `main` commit preserve the candidate tree?
8. Does production report the expected `main` deployment identity?
9. Is cleanup complete and is every optional exception authorized and unexpired?
10. Has an authorized operator approved the tag after the complete evidence
    report?

The system combines deterministic test evidence, deployed read-only evidence,
local synthetic state transitions, independent exploration, manual obligations,
deployment identity, observability readbacks, and rollback references.

## 3. Chapa Release-Verification Diagnosis

Chapa already has substantial verification behavior distributed across several
surfaces:

- CI runs static checks, sharded unit coverage, a local-Supabase contract,
  desktop and mobile journey E2E, a production build, sharded built-artifact E2E,
  deployed smoke, and a release-PR migration check.
  (`.github/workflows/ci.yml:9-152`, `.github/workflows/ci.yml:192-492`)
- The release checklist binds preview verification to the exact `develop`
  commit and records real OAuth, badge, share, health, verification, and locale
  arcs. (`docs/runbooks/release-checklist.md:27-49`)
- The nightly workflow runs strict production smoke and preserves failure
  artifacts. (`.github/workflows/nightly-prod-probe.yml:1-64`)
- The exploratory command fixes immutable refs, uses fresh contexts, requires all
  eight maneuvers, and blocks on failures, skipped high-risk areas, absent
  cleanup, or untriaged findings. (`.claude/commands/explore-release.md:22-125`)
- The rollback runbook separates application rollback from database rollback and
  verifies health and public badge behavior. (`docs/runbooks/rollback.md:11-64`)

Wave A turns those distributed signals into one fail-closed decision. Wave B
makes exploratory output attributable to the same candidate and consumable by
the analyzer.

## 4. Normative Language

The terms **MUST**, **MUST NOT**, **SHOULD**, and **MAY** have these meanings:

- **MUST / MUST NOT:** release-safety invariant; the Chapa adaptation does not
  weaken it.
- **SHOULD:** default design; deviation requires a recorded reason.
- **MAY:** optional based on project risk and environment capability.

Deferred means not implemented and not counted. Deferred structural work never
weakens the Wave A and B invariants implemented now.

## 5. Chapa Decision Ledger

| ID | Chapa decision |
|---|---|
| D01 | `docs/release/release-playbook.md` is the single short procedural source of truth after Phase 5. Commands delegate to it. |
| D02 | The procedural playbook stays at 200 lines or fewer. Feature detail remains in linked runbooks and machine-readable contracts. |
| D03 | A release run with zero passing checks MUST fail. |
| D04 | Any required result that is missing, failed, or skipped MUST block. Quarantine or an exception cannot excuse a required miss. |
| D05 | `quality/release-required.json` is the requiredness authority. Test names and tags are selectors, not requiredness policy. |
| D06 | The fixed candidate is `{developCommit, candidateTreeDigest}`. Preview proves `developCommit`; the squash-produced `mainCommit` MUST have the same tree digest; production proves `mainCommit`. |
| D07 | `/release` creates a tag only after pre-merge evidence, authorized promotion, main-tree equality, production identity, production-safe probes, final analysis, and explicit tag authorization. |
| D08 | Deterministic checks are the reproducible foundation. Exploratory charters complement them and never replace them. |
| D09 | Every exploratory charter runs in a fresh context that did not implement the candidate. |
| D10 | Every charter reports all eight maneuvers exactly once as passed, failed, or not applicable with a concrete reason. |
| D11 | Ordinary interaction coverage will use constrained pairwise selection only if Wave D is adopted. Known-dangerous interactions will use explicit scenarios. |
| D12 | A capability registry will be schema-validated and implementation-independent only if Wave C is adopted. No registry exists in Wave A by implication. |
| D13 | Diff-derived plan compilation is deferred to Wave E. Wave A prepares an explicit obligation set from the required catalog and never silently accepts an empty set. |
| D14 | UI evidence alone is insufficient when HTTP, datastore, vendor, telemetry, cleanup, or deployment identity can disprove it. |
| D15 | Local substitutes and real-vendor probes are complementary. Additional provider fault legs and scheduled real-seam probes are Wave F work. |
| D16 | Per-release manual obligations are recorded in the Wave A manifest. Cross-release TTL enforcement is deferred to Wave H. |
| D17 | Broader model-based verification is deferred to Wave G. The existing offline/retry journey remains current deterministic evidence. |
| D18 | Preview is Chapa's only named pre-production deployment tier. It MUST NOT be described as proving production-only behavior that it cannot exercise. |
| D19 | Test data is synthetic, run-scoped, identifiable, and cleaned up with residue evidence. Real user data MUST NOT be used. |
| D20 | Production operations, outward effects, destructive writes, migrations, cron execution, email, merge, deployment, environment changes, tagging, and publishing require the repository's explicit authorization boundary. |

### Delivery sequence

1. Adapt and lock this blueprint.
2. Implement schemas, the required catalog, preparation, collection, analyzer,
   renderer, and adversarial fixtures.
3. Add deployment identity and the initial required probes.
4. Aggregate exact-candidate evidence without deploying.
5. Reconcile release instructions around the short playbook and connect
   exploratory output.
6. Rehearse one passing run and every mandatory block class without releasing.

## 6. Project Adaptation Profile

| Area | Chapa value |
|---|---|
| Project | Chapa Developer Impact Badge |
| Repository visibility | Private |
| Primary product type | Next.js web application in a pnpm workspace |
| Package/build system | pnpm 10; Next.js build |
| Integration branch | `develop` |
| Production branch | `main` |
| Merge strategy | Squash merge from `develop` to `main` |
| Release artifact | Vercel deployment plus tagged `main` commit, content-bound by Git tree digest |
| Deployment provider | Vercel |
| Local test target | Next.js on port 3001 with local Supabase for contract and journey tests |
| Preview target | Exact-commit Vercel preview |
| Staging target | None; preview is the only named pre-production deployment tier |
| Production target | `https://chapa.thecreativetoken.com` |
| Test runners | Vitest and Playwright |
| Unit command | `pnpm run test` |
| Integration command | `pnpm run test:contract:local` |
| E2E command | `pnpm run test:e2e` |
| Typecheck command | `pnpm run typecheck` |
| Lint command | `pnpm run lint` |
| Build command | `pnpm run build` |
| Release validation commands | `pnpm run quality:validate`, `pnpm run release:analyze`, and `pnpm run release:render-report` after their implementation |
| Primary datastore | Supabase Postgres |
| Cache and current binary store | Upstash Redis; generated OG image binaries currently use Redis |
| Queue/event system | No separate queue; Vercel cron route handlers and provider webhooks are the asynchronous boundaries |
| Authentication | GitHub identity with optional Bitbucket, Codeberg, and GitLab links |
| Payments/entitlements | None |
| Email/notifications | Resend, Svix-authenticated inbound email, Gmail forwarding, and an operational alert webhook |
| Other external vendors | GitHub, Bitbucket, Codeberg, GitLab, Vercel, Upstash, Supabase, PostHog |
| Observability | Vercel logs and analytics, `/api/health`, Redis cron heartbeats, PostHog, webhook alerts |
| Hardware/real-device surfaces | None; Playwright covers desktop Chrome and Pixel 5 emulation |
| Agent command directory | `.claude/commands/` |
| Capability registry owner | Solo project operator if Wave C is adopted |
| Release approver | Project owner through explicit release approvals |
| Rollback authority | Project owner / solo incident operator |

The product, deployment, branch, provider, test, storage, vendor, and authority
values above come from the project research and current source.
(`docs/research/2026-07-26-e2e-pro-release-verification.md:38-61`)

### Environment truth table

| Environment | Exact artifact or commit | Real auth | Real datastore | Real vendors | Safe writes | Main limitations |
|---|---:|---:|---:|---:|---:|---|
| `local-contract` | Yes, current checkout/build | Synthetic session | Yes, local Supabase | No; provider credentials are dummy or modeled | Yes, synthetic local writes only | Does not prove deployed configuration, Vercel routing, or live provider contracts |
| `ci-build` | Yes, uploaded Next.js build and exact checkout | Synthetic/dummy | Local Supabase in contract job | GitHub token in ordinary E2E; other deployed vendors are not fully real | Yes, local fixture writes | Build-artifact E2E is not a deployed Vercel environment |
| `preview` | Yes, verified through `/api/version` after Phase 3 | Real GitHub OAuth is a manual authorized arc | Managed Supabase and Redis as configured | Real configured seams | Read-only required probes; separately authorized interaction only | No separate staging tier; production-only aliases, schedules, and configuration are not implied |
| `production` | Yes, verified through `/api/version` after Phase 3 | Real | Real managed services | Real | Read-only required probes; operations require explicit authorization | Public environment; no synthetic production writes in Wave A |

The current CI/local, preview, and production execution behavior is documented
at `docs/research/2026-07-26-e2e-pro-release-verification.md:63-71`.

## 7. Actors, States, Data, and Seams

### Actors

- Anonymous visitor using public profile, badge, verification, share, and health
  surfaces.
- Authenticated profile owner using GitHub identity and linked developer
  platforms.
- Administrator using protected administrative routes.
- Scheduled Vercel cron caller authenticated by `CRON_SECRET`.
- Resend/Svix webhook caller.
- Solo release approver and rollback operator.

### Release-sensitive state

- Stateless signed identity session with a 24-hour lifetime.
- Users, metric snapshots, verification records, feature flags, linked platform
  credentials and metadata, tool insights, campaign state, supplemental stats,
  and Creator Studio configurations in Supabase.
- Current and stale profile/cache data, configuration, cron heartbeats,
  deduplication state, and OG image binaries in Redis.
- Candidate commit, tree digest, preview identity, squash-produced main commit,
  main tree digest, production identity, scenario results, fixtures, cleanup,
  exceptions, and authorization state in the E2E Pro run.

### External seams

Vercel, GitHub, Bitbucket, Codeberg, GitLab, Upstash Redis, Supabase, PostHog,
Resend/Svix, Gmail forwarding, and the alert webhook are release-sensitive
integration boundaries. (`CLAUDE.md:363-415`)

### Scheduled work

Vercel schedules warm-cache, audience synchronization, campaign processing, and
latency checks. Successful scheduled work updates Redis heartbeat state that
`/api/health` evaluates separately from core dependency health.
(`apps/web/vercel.json:1-33`, `docs/runbooks/observability.md:100-107`)

### Accepted runtime behavior

The evidence model retains Chapa's documented rate-limit fail-open behavior,
stateless session model, scoped OAuth behavior, post-response badge side
effects, locking boundaries, outage behavior, and escaped inline SVG handling.
An accepted runtime behavior is not a release-result exception: required probes
still need their declared expected outcomes.

## 8. Locked Vocabulary and Artifact Topology

### Environments

```text
local-contract
ci-build
preview
production
```

### Safety classes

```text
read-only
synthetic-local-write
authorized-preview-interaction
production-operation
outward-effect
```

`production-operation` and `outward-effect` are authorization classifications,
not permission to execute those actions.

### Oracle classes used by Wave A

```text
ui
http
datastore
vendor
telemetry
cleanup
deployment-identity
configuration
```

Object/filesystem and queue/event are valid blueprint oracle classes but are not
initial Wave A requirements:

- Chapa has no separate object store in the current architecture; OG image
  binaries currently reside in Redis.
- Chapa has no separate queue. Cron and webhook behavior remains represented
  through HTTP, datastore, vendor, and telemetry evidence.
- If later changes add object storage or a queue, the required catalog and
  applicable capability records must add those oracle classes explicitly.

### Tracked artifacts selected by the implementation plan

```text
docs/playbooks/e2e-pro-release-verification.md
docs/release/release-playbook.md
quality/release-required.json
quality/schemas/release-required.schema.json
quality/schemas/release-run.schema.json
quality/schemas/evidence-manifest.schema.json
quality/schemas/exploratory-charter.schema.json
quality/fixtures/passing-release-run.json
quality/fixtures/blocked-zero-pass.json
quality/fixtures/blocked-required-skip.json
quality/fixtures/blocked-candidate-mismatch.json
quality/fixtures/blocked-missing-cleanup.json
quality/fixtures/blocked-incomplete-charter.json
quality/evidence/README.md
scripts/quality/contracts.ts
scripts/quality/validate-release-required.ts
scripts/quality/prepare-release-run.ts
scripts/quality/collect-playwright-evidence.ts
scripts/quality/analyze-release-run.ts
scripts/quality/render-release-report.ts
scripts/quality/verify-deployment-identity.ts
apps/web/app/api/version/route.ts
apps/web/e2e/release-required.spec.ts
.github/workflows/release-verification.yml
```

Tests live beside the TypeScript implementations. Generated run evidence lives
under `quality/evidence/runs/{runId}/`, is gitignored, and is uploaded as an
external Actions/release artifact. Generating evidence never changes the tree
being verified.

## 9. Candidate Identity Contract

Chapa's preview source commit and tagged production commit differ because the
release is squash-merged. Candidate identity therefore binds both source
identity and content:

```text
baselineTag = latest release tag
developCommit = immutable develop commit used for preview evidence
candidateTreeDigest = Git tree digest of developCommit

previewReportedCommit = commit returned by preview /api/version
require previewReportedCommit == developCommit

mainCommit = squash-produced main commit
mainTreeDigest = Git tree digest of mainCommit
require mainTreeDigest == candidateTreeDigest

productionReportedCommit = commit returned by production /api/version
require productionReportedCommit == mainCommit

tagTarget = mainCommit
```

The run records both commits, both tree digests, both deployed identities, both
URLs, and the observation timestamps. It blocks on a mutable or absent candidate,
a stale preview, absent deployment identity, changed tree, stale production
alias, or evidence from another candidate.

## 10. Implementation Waves

### Wave A — Adopted: Make the Existing Release Gate Truthful

Wave A is implemented by the current six-phase plan.

#### A1. Reconcile release instructions

Phase 5 creates `docs/release/release-playbook.md` as the short source of truth.
The release and exploratory commands delegate to it, and subordinate runbooks
retain detailed operations without restating the top-level sequence.

The documentation contract fails if the short procedure exceeds 200 lines,
`/release` does not link it, required stages are absent, or a tracked file states
a conflicting merge strategy or tag order.

#### A2. Enforce a non-empty pass

The analyzer implements:

```text
passedCount > 0
requiredMisses is empty
blockingFailures is empty
blockingEvidenceDefects is empty
```

It rejects at least:

| Case | Decision |
|---|---|
| At least one pass and no blocking condition | pass |
| Zero results passed | blocked |
| All results skipped | blocked |
| Required result missing | blocked |
| Required result skipped | blocked |
| Required result failed | blocked |
| Required failure marked quarantined | blocked |
| Expected oracle absent | blocked |
| Candidate/deployment identity mismatch | blocked |
| Fixture cleanup or residue evidence absent | blocked |
| Exploratory maneuver absent or failed | blocked |
| High-risk area skipped or finding untriaged | blocked |
| Optional failure with no authorized unexpired exception | blocked |

#### A3. Initial required probe set

| Stable scenario ID | Environment | Safety | Required proof |
|---|---|---|---|
| `deployment.preview-identity` | `preview` | `read-only` | `/api/version` commit equals `developCommit` |
| `deployment.production-identity` | `production` | `read-only` | main tree equals candidate tree and `/api/version` equals `mainCommit` |
| `health.core-dependencies` | `preview`, `production` | `read-only` | Redis, Supabase, and GitHub dependency fields are `ok` |
| `profile.public-badge-read` | `preview`, `production` | `read-only` | HTTP 200, SVG content type, valid SVG body markers |
| `profile.public-share-read` | `preview`, `production` | `read-only` | HTTP 200 and visible body through the smoke-only path |
| `auth.github-login-redirect` | `preview` | `read-only` | Redirect status and GitHub location |
| `auth.protected-write-denied` | `preview` | `read-only` | Unauthenticated Studio write denied with no resulting state |
| `studio.config-persistence` | `local-contract` | `synthetic-local-write` | UI/HTTP success, Supabase readback, offline retry, cleanup |
| `profile.snapshot-integrity` | `local-contract` | `synthetic-local-write` | Numeric snapshot and Craft variants read back from Supabase |
| `operations.vercel-cron-registration` | `ci-build` | `read-only` | `check:vercel-config` passes for all registered schedules |

`quality/release-required.json` records each scenario's owner, selector,
environment, requiredness, safety class, expected oracles, and retention. A tag
or test name alone never grants or removes required status.

Real OAuth completion, migration application, operational cron invocation, and
outbound notifications are not silently automated as required probes. They
remain manual or explicitly authorized obligations with recorded outcomes.

#### A4. Release ordering

The Phase 5 procedure establishes this order:

1. Confirm authorized scope and select a version.
2. Prepare version and changelog changes and obtain full-diff approval.
3. Commit and push the `develop` release candidate under the applicable
   authorization.
4. Fix `developCommit` and `candidateTreeDigest`.
5. Wait for exact-commit CI and preview.
6. Prepare the run and import deterministic evidence.
7. Run required preview probes against the verified preview.
8. Run `/explore-release` against the same candidate.
9. Complete due authorized manual obligations.
10. Create or reuse the release PR under explicit authorization.
11. Import release-PR evidence, including migration status when applicable.
12. Analyze the complete pre-merge evidence.
13. Obtain separate merge authorization and squash merge.
14. Resolve `mainCommit` and prove tree equality.
15. Wait for production to report `mainCommit`.
16. Run production-safe read-only required probes.
17. Analyze final evidence.
18. Present the complete report and obtain explicit tag authorization.
19. Tag `mainCommit`, create the GitHub release, and attach evidence.
20. Perform post-release reads or invoke the authorized rollback procedure.

PR creation does not authorize merge. Analyzer success does not authorize a
production operation or tag.

### Wave B — Adopted: Independent Exploratory Release Charters

Chapa's existing `/explore-release` command supplies the execution protocol.
Phase 5 connects it to the Wave A run.

#### B1. Charter generation

Charters derive from:

```text
baselineTag..developCommit
```

A tiny isolated diff receives one charter. A normal release receives two to four.
Additional charters require distinct high-risk capability groups.

Every charter declares changed capability, affected actors, surfaces, states,
external seams, risk hypothesis, environment, allowed operations, and safety
class. Outward writes, state transitions, vendor/retry behavior, authorization,
multi-surface behavior, changed promises, and recent escape classes receive
priority.

#### B2. Fresh-context execution

Every charter is executed by an agent context that:

- did not implement the candidate;
- receives the candidate record, charter, safety boundary, and evidence format;
- does not receive unverified implementer assumptions as facts;
- works independently from other charter agents; and
- reports findings without fixing code or production during the charter.

#### B3. Mandatory maneuvers

Each charter reports these eight rows exactly once:

| # | Maneuver | Required intent |
|---:|---|---|
| 1 | Try the action twice | Duplicate, repeat, and idempotency behavior |
| 2 | Edit after every error | Recovery, stale-state clearing, successful resubmission |
| 3 | Interrupt mid-flow | Back, refresh, reopen, timeout, reconnect, or resume |
| 4 | Use a second session or role | Authorization, propagation, isolation, concurrency |
| 5 | Switch locale and viewport/device | English/Spanish, desktop/mobile, and state transfer |
| 6 | Compare copy with outcome | Visible promises agree with actual outcome |
| 7 | Read back downstream state | Authorized HTTP, datastore, vendor, or telemetry evidence |
| 8 | Ask whether the resulting behavior is valid | Unsafe, contradictory, confusing, or impossible states |

Each result is `passed` with evidence, `failed` with reproduction and evidence,
or `not-applicable` with a concrete reason. An omitted row invalidates the
charter. The default timebox is 30 minutes; time expiry does not convert an
untested high-risk area into a pass.

#### B4. Safety and block rules

Charter agents use identifiers prefixed `chapa-e2e-{runId}-`, touch no real user
data, operate only within the run authorization, and remove only their own
fixtures. Production writes, cron work, migrations, email, messages,
environment changes, destructive mutations, and outward effects require
explicit authorization.

The charter or release is blocked when a maneuver fails, a high-risk area is
skipped, cleanup evidence is absent, a finding lacks triage, a charter references
another candidate, or an allowed optional exception is absent or expired.

### Wave C — Deferred: Capability Registry

No empty capability registry is created in this plan. Wave C is later structural
work requiring a measured census and explicit ownership.

If adopted, `quality/capabilities.json` will be schema-validated and will record:

- stable capability ID and owner;
- risk and implementation-independent description;
- surfaces, actors, states, factors, invariants, and transitions;
- expected oracles;
- execution tiers;
- cadence;
- safety and authorization;
- path, route, schema, job, and vendor ownership.

The census will cover new user-facing routes, mutations, jobs, webhooks, vendors,
flags, actors, persisted states, and release-critical infrastructure. New
unexplained census entries will fail; existing coverage will begin from a
measured baseline and ratchet.

Capability invariants will describe observable product truth, including
authorization, data integrity, repeat behavior, recovery, concurrency, copy
versus outcome, cleanup, vendor degradation, privacy, and product validity.

### Wave D — Deferred: Constrained Combination Coverage

Wave D begins only after a measured Wave C registry exists. No combination count
is claimed by this plan.

If adopted, Chapa will inventory behavior-changing factors such as actor,
profile state, operation, source platform, locale, viewport, session freshness,
vendor outcome, retry, offline state, and concurrency. Ordinary interactions
will use deterministic constrained pairwise selection. Historical danger classes
will receive explicit three-way scenarios.

Constraints will distinguish:

- impossible state;
- unsafe or unauthorized test;
- unsupported environment; and
- valid negative scenario.

Generated plans will record generator version, registry revision, constraint
revision, seed when randomized, interaction strength, and stable scenario IDs.
Equal inputs must reproduce equal plans.

### Wave E — Deferred: Per-Release Plan Compiler

Wave E begins only after capability, constraint, environment, cadence, and escape
inputs exist. Wave A's explicit required obligation set is not represented as a
diff-derived compiler.

If adopted, the compiler will consume:

- baseline tag and fixed candidate;
- changed paths and dependencies;
- capability and scenario catalogs;
- constraints;
- environment capability records;
- cadence and last-run state;
- historical escape mappings; and
- active unexpired optional exceptions.

It will emit stable obligations containing scenario, capability, selection
reason, requiredness, environment, runner, safety class, expected oracles,
result, evidence, fixture cleanup, and any permitted exception.

Compilation will fail on a missing or mutable candidate, unmapped user-affecting
change, impacted critical capability with no scenario, unsupported required
environment, overdue critical obligation, missing required result, candidate
mismatch, failed cleanup, or zero passes.

### Wave F — Partially Present, Additional Work Deferred

Chapa currently has:

- deterministic unit and contract execution;
- a real local-Supabase contract and journey;
- built-artifact Playwright E2E;
- strict deployed smoke;
- a nightly production smoke;
- read-only smoke paths that avoid ordinary profile side effects.

This plan records those tiers but does not add permanent response-shaped fault
stubs, cost-bounded scheduled real-provider probes, or a separate representative
staging environment.

If additional Wave F work is adopted, each critical provider seam will receive:

- deterministic success, timeout, malformed, rejection, delay, and duplicate
  legs where relevant;
- recorded calls for assertions;
- no live credentials in local deterministic execution;
- a narrow scheduled real-seam probe with cost, rate, and timeout ceilings;
- provider and downstream application evidence; and
- explicit escalation without silent quarantine.

Preview limitations remain explicit. Preview evidence never counts as proof of
production-only scheduling or aliases.

### Wave G — Partially Present, Broader Models Deferred

The current local journey already covers studio persistence, offline failure,
retry, refresh, multiple profile shapes, downstream Supabase readback, and
cleanup. (`apps/web/e2e/journey.spec.ts:35-176`)

Broader state-machine models are deferred. If adopted, priority domains include:

- connected-platform link, refresh, disconnect, and degraded scope;
- profile generation, cache, snapshot, verification, and recovery;
- Studio save, offline queue, retry, refresh, and multi-session behavior;
- campaign lifecycle and delivery outcomes; and
- cron selection, work claims, completion, heartbeat, retry, and alerting.

Each model will define states, actions, transition preconditions, observable
postconditions, invariants after every transition, repeat/interruption
sequences, failure shrinking, and permanent regression preservation.

### Wave H — Per-Release Recording Adopted, TTL Automation Deferred

Wave A manifests record each manual obligation performed for the current release,
its executor, time, environment, candidate, result, and evidence.

Cross-release TTL automation is deferred. If adopted,
`quality/cadence.json` will record each obligation's capability, risk, interval,
owner, last success, candidate/environment identity, evidence, next due date,
blocking behavior, and expiring exception.

Manual never means silently optional. Until TTL automation exists, the Wave A
run explicitly lists due manual obligations and the analyzer rejects a missing
required current-release result.

## 11. Evidence Model

### Oracle semantics

| Oracle | Chapa proof |
|---|---|
| `ui` | Rendering, interaction, copy, navigation, locale, viewport, visible state |
| `http` | Status, body, schema, headers, redirect, authorization behavior |
| `datastore` | Supabase durability, uniqueness, scope, isolation, and readback |
| `vendor` | Real configured provider acceptance or health result |
| `telemetry` | Health components, cron heartbeat state, alerts, and retained execution references |
| `cleanup` | Run-owned fixtures removed with zero unexpected residue |
| `deployment-identity` | Preview reports `developCommit`; production reports `mainCommit`; both trees are content-bound |
| `configuration` | Schema-valid, repository-tracked deployment configuration such as Vercel cron registration |

Each required scenario declares every oracle capable of disproving its visible
result. The analyzer requires evidence for each declared oracle.

### Evidence manifest

The implemented JSON manifest contains:

```json
{
  "schemaVersion": 1,
  "release": {
    "baselineTag": "v2.21.0",
    "developCommit": "immutable commit SHA",
    "candidateTreeDigest": "Git tree digest",
    "previewUrl": "exact candidate preview URL",
    "previewReportedCommit": "deployment-reported commit SHA",
    "mainCommit": "squash-produced commit SHA or null before merge",
    "mainTreeDigest": "Git tree digest or null before merge",
    "productionUrl": "https://chapa.thecreativetoken.com",
    "productionReportedCommit": "deployment-reported commit SHA or null before merge"
  },
  "results": [
    {
      "scenarioId": "profile.public-badge-read",
      "required": true,
      "status": "passed",
      "environment": "preview",
      "startedAt": "UTC timestamp",
      "finishedAt": "UTC timestamp",
      "runner": "Playwright release-required selector",
      "evidence": {
        "http": "allowlisted result reference",
        "deployment-identity": "candidate record reference"
      },
      "fixtures": []
    }
  ],
  "exploratoryCharters": [],
  "manualObligations": [],
  "exceptions": [],
  "tagAuthorization": {
    "status": "pending"
  }
}
```

Examples in this decision source illustrate shape and are not reusable release
evidence.

Evidence MUST be attributable to a stable scenario, tied to the fixed candidate
and environment, timestamped, retained for the declared audit period, redacted
of secrets and personal data, and sufficient for another maintainer to verify.

### Exceptions

Only optional results may have exceptions. Each exception records a stable ID,
scenario ID, concrete reason, risk, authorized approver, creation time, expiry,
and follow-up issue. Expired exceptions are absent. Required misses, identity
mismatches, cleanup defects, zero-pass runs, and incomplete exploratory charters
cannot be excepted at report time.

## 12. Short Release Procedure Contract

Phase 5 creates `docs/release/release-playbook.md` with no more than 200 lines.
The procedure contains:

1. scope and authorization;
2. version and diff preparation;
3. candidate fixation;
4. exact-commit CI and preview verification;
5. deterministic, exploratory, and manual obligations;
6. release-PR evidence and pre-merge analysis;
7. separately authorized squash promotion;
8. main-tree and production identity verification;
9. production-safe read-only probes;
10. final analysis;
11. explicit tag authorization;
12. named tag and GitHub release creation;
13. evidence attachment; and
14. monitoring and rollback links.

It links to capability runbooks instead of duplicating their instructions.
`/release` reads and executes this procedure. `/explore-release` contributes
evidence but cannot release.

### Rollback contract

The release report names the previous evidence-approved deployment. On rollback:

- obtain required production authorization;
- promote the named deployment or perform the authorized Git recovery;
- verify restored `/api/version`;
- verify health and critical public reads;
- preserve failed-candidate evidence;
- coordinate separate schema recovery when a production migration is involved;
  and
- record incident follow-up with release run and rollback identities.

## 13. Required Reports

### Release evidence report

`scripts/quality/render-release-report.ts` deterministically renders:

- baseline tag;
- `developCommit` and candidate tree;
- preview URL and reported commit;
- `mainCommit` and main tree when present;
- production URL and reported commit when present;
- generated timestamp;
- pass or blocked decision;
- required, passed, failed, skipped, and missing counts;
- each deterministic result and raw evidence reference;
- exploratory charter decisions and maneuver completeness;
- manual obligations;
- fixtures, cleanup, and residue;
- optional exceptions and expiries;
- previous evidence-approved rollback target; and
- pending or granted tag authorization.

### Exploratory charter report

Each charter result contains:

- charter ID and candidate tree;
- capability, actors, surfaces, environment, `timeboxMinutes`, and fresh executor context;
- risk hypothesis;
- exactly eight maneuver results;
- reproduction and evidence for each failure;
- concrete reason for each not-applicable maneuver;
- findings with triage;
- skipped high-risk areas;
- fixture IDs and zero-residue evidence; and
- pass or blocked decision.

## 14. Chapa Stack-Specific Guidance

### Web and API behavior

Required selection considers browser behavior, accessibility, HTTP/server
actions, datastore readback, desktop and mobile viewports, multiple sessions,
English and Spanish, refresh/back/offline recovery, copy versus outcome, and
preview/production deployment identity.

API-focused scenarios consider contract and schema, authentication and
authorization, idempotency, replay, concurrency, database readback, rate limits,
timeouts, and dependency degradation.

### Monorepo behavior

Chapa has one deployed Next.js artifact plus a shared workspace package. Exact
build and deployment evidence must refer to the affected application artifact.
A green unaffected package cannot satisfy a required application obligation.

### Data and infrastructure behavior

Migration validation and application remain separate. Required release evidence
distinguishes static migration validation, release-PR drift checking, authorized
production application, and coordinated schema rollback. Code rollback never
claims to undo an applied database migration.

## 15. Historical Escapes Become Coverage

The July 16 scoring and cron incident records these selection and evidence
classes:

- Vercel configuration in the wrong root left all schedules unregistered.
- Whitespace in `CRON_SECRET` broke authentication.
- Token presence did not prove effective GitHub scope.
- A shared obsolete zero-score predicate crossed guard, persistence, and repair
  paths.

(`docs/logs/2026-07-16-scoring-incident-and-cron-outage.md:1-32`,
`docs/logs/2026-07-16-scoring-incident-and-cron-outage.md:58-62`)

Wave A immediately maps the Vercel configuration escape to
`operations.vercel-cron-registration`, core health to effective dependency
status, and deployed identity to `/api/version`.

Later structural adoption records each escape with incident ID, capability,
missed selection or oracle reason, interacting factors, and permanent scenario
or invariant. A one-off regression does not close an escape when the actual
defect was impact mapping or evidence quality.

## 16. Anti-Patterns Rejected

Chapa E2E Pro rejects:

- treating this comprehensive document as the daily procedure;
- a green run with zero passes or only skips;
- required checks that silently skip on absent credentials, fixtures, URLs, or
  artifacts;
- quarantining or excepting a required miss;
- requiredness inferred only from a test name;
- tagging before final evidence and explicit authorization;
- testing one commit and deploying or tagging different content;
- accepting URL reachability without deployment identity;
- treating UI confirmation as durable-state proof;
- omitting exploratory maneuvers instead of recording a concrete
  not-applicable reason;
- using an implementer as the only exploratory reviewer;
- using real customer data;
- broad cleanup of shared data;
- exceptions without owner, follow-up, or expiry;
- counting preview as proof of production-only behavior;
- calling manual obligations optional merely because TTL automation is deferred;
- generating or accepting an empty obligation set;
- chaining verification so an early failure is masked; and
- treating analyzer PASS as authorization to merge, deploy, operate, tag, or
  publish.

## 17. Current Implementation Epic

The current implementation is tracked by:

- `docs/plans/2026-07-26-e2e-pro-release-verification.md`
- `docs/plans/2026-07-26-e2e-pro-release-verification-phases/phase-1.md`
- `docs/plans/2026-07-26-e2e-pro-release-verification-phases/phase-2.md`
- `docs/plans/2026-07-26-e2e-pro-release-verification-phases/phase-3.md`
- `docs/plans/2026-07-26-e2e-pro-release-verification-phases/phase-4.md`
- `docs/plans/2026-07-26-e2e-pro-release-verification-phases/phase-5.md`
- `docs/plans/2026-07-26-e2e-pro-release-verification-phases/phase-6.md`

The plan's non-negotiable current outcomes are:

- one short release source of truth;
- zero-pass rejection;
- required missing/skip/fail rejection;
- candidate and deployment identity;
- tag-last ordering;
- fresh-context exploratory charters;
- synthetic local fixtures and cleanup evidence;
- multi-layer oracle evidence; and
- a complete non-production rehearsal of passing and deliberately blocked runs.

Waves C through H require separate research, planning, and approval before their
structural artifacts are implemented.

## 18. Agent Implementation Brief

An implementation agent using this decision source must:

1. Read repository instructions, the current phase file, this adaptation,
   release commands, test rules, deployment rules, and relevant runbooks.
2. Work in the phase's isolated worktree and preserve concurrent changes.
3. Implement only the approved phase and stop at its review gate.
4. Write tests first for behavioral contracts.
5. Use the locked environment, safety, oracle, scenario, and identity vocabulary.
6. Keep requiredness machine-readable.
7. Fail closed for zero passes, required misses, identity mismatches, absent
   evidence, incomplete exploration, and cleanup defects.
8. Run verification sequentially.
9. Treat generated evidence as candidate-external and secret-safe.
10. Treat production and outward-facing actions as separate authorization
    boundaries.
11. Never tag or release during implementation or rehearsal.

Each phase delivers its scoped documentation or code, regression tests,
machine-readable artifacts where applicable, exact verification output, and
remaining deferred work. A copied blueprint alone is not an executable quality
system.

## 19. Definition of Done for the Selected Adoption

This Wave A and B adoption is complete only when:

- this Chapa-specific profile and environment truth table are verified;
- the single short release procedure exists and subordinate instructions
  delegate to it;
- zero-pass, required-missing, required-skip, required-failure, absent-oracle,
  identity-mismatch, cleanup, and incomplete-charter cases fail mechanically;
- every initial required probe is runnable in its declared environment;
- the run records an immutable `developCommit` and candidate tree;
- preview reports the expected `developCommit`;
- required deterministic, preview, exploratory, and manual evidence is
  attributable to the same candidate;
- the squash-produced main tree equals the candidate tree;
- production reports the expected `mainCommit`;
- the final report names the exact tested and deployed identities;
- tagging is unreachable before complete evidence and explicit authorization;
- generated evidence is external to the fixed candidate and contains no secrets
  or real-user fixture data;
- rollback names a previous evidence-approved deployment;
- a non-production rehearsal demonstrates a complete pass;
- deliberate zero-pass, required-skip, identity-mismatch, cleanup, missing
  oracle, and incomplete-charter cases block; and
- the first real production release remains separately authorized and supplies
  the first production evidence manifest.

At that point Chapa has the truthful mandatory E2E Pro floor and connected
independent exploration. Deferred Waves C through H remain explicit future work,
not implied coverage.
