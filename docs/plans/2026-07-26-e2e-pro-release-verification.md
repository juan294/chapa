# Implementation Plan — Chapa E2E Pro Release Verification

> **Status:** Implemented; non-production rehearsal complete
> **Date:** 2026-07-26
> **Research input:** `docs/research/2026-07-26-e2e-pro-release-verification.md`
> **Upstream blueprint:** `/Users/juan/code/cc-rpi/templates/e2e-pro-playbook-template.md` version 1.0

## 1. Goal

Create Chapa's local, project-specific E2E Pro system so every production release has a fixed candidate, an explicit machine-readable obligation set, independently attributable evidence, a fail-closed decision, and tag-last authorization.

The implementation keeps `/release` as Chapa's only versioning and tagging authority, connects the existing `/explore-release` workflow, and preserves the repository's `develop → main` squash-release topology. The upstream blueprint defines E2E Pro as a verification layer rather than a replacement release command. (`/Users/juan/code/cc-rpi/templates/e2e-pro-playbook-template.md:12-31`, `.claude/commands/release.md:238-292`)

## 2. Selected adoption scope

### Selected: complete Wave A and integrate the existing Wave B now

Wave A is the universal floor: non-empty passing evidence, required skip/failure enforcement, fixed candidate identity, and tag-last ordering. Chapa already has `/explore-release`, so Wave B becomes part of the same evidence contract in this implementation. (`/Users/juan/code/cc-rpi/templates/e2e-pro-playbook-template.md:33-42`, `/Users/juan/code/cc-rpi/templates/e2e-pro-playbook-template.md:253-367`, `.claude/commands/explore-release.md:22-125`)

The adapted local blueprint will contain explicit Chapa decisions for Waves C–H, but this plan will not create empty capability, combination, compiler, vendor, state-machine, or cadence artifacts merely to resemble the full template. The blueprint makes those waves risk-selected structural work rather than the default adoption floor. (`/Users/juan/code/cc-rpi/templates/e2e-pro-playbook-template.md:33-42`, `/Users/juan/code/cc-rpi/templates/e2e-pro-playbook-template.md:177-189`)

### Options considered

| Option | Trade-off | Decision |
|---|---|---|
| Documentation-only adaptation | Produces a Chapa-specific document but cannot prove that required checks executed. The blueprint explicitly says the copied document is not the finished system. (`/Users/juan/code/cc-rpi/templates/e2e-pro-playbook-template.md:44-52`) | Rejected |
| Full Waves A–H in one implementation | Builds the whole structural program before the mandatory gate is available and conflicts with the blueprint's risk-scaled sequencing. (`/Users/juan/code/cc-rpi/templates/e2e-pro-playbook-template.md:33-42`, `/Users/juan/code/cc-rpi/templates/e2e-pro-playbook-template.md:177-189`) | Rejected for this plan |
| Wave A plus existing Wave B, with recorded C–H decisions | Delivers a runnable release gate first and leaves later structural work explicit rather than implied. | Selected |

## 3. Locked decisions

| ID | Decision | Implementation consequence |
|---|---|---|
| D1 | The comprehensive local adaptation lives at `docs/playbooks/e2e-pro-release-verification.md`. | Phase 1 copies and rewrites the upstream blueprint using verified Chapa values; no placeholders remain. |
| D2 | The short procedural authority lives at `docs/release/release-playbook.md` and stays at 200 lines or fewer. | `/release` delegates to it. Existing runbooks retain detailed capability procedures without restating the top-level sequence. The blueprint separates the comprehensive adoption document from the short operational procedure. (`/Users/juan/code/cc-rpi/templates/e2e-pro-playbook-template.md:8-10`, `/Users/juan/code/cc-rpi/templates/e2e-pro-playbook-template.md:156-157`, `/Users/juan/code/cc-rpi/templates/e2e-pro-playbook-template.md:997-1001`) |
| D3 | Machine-readable tracked contracts use JSON. | Chapa can parse them with project-native TypeScript/`tsx` and does not add a YAML dependency solely for Wave A. The blueprint permits JSON. (`/Users/juan/code/cc-rpi/templates/e2e-pro-playbook-template.md:487-490`, `package.json:17-25`) |
| D4 | `quality/release-required.json` is the requiredness authority. | Test names and `@release-required` selectors locate execution; they do not decide whether a scenario blocks. Requiredness remains machine-readable. (`/Users/juan/code/cc-rpi/templates/e2e-pro-playbook-template.md:158-161`, `/Users/juan/code/cc-rpi/templates/e2e-pro-playbook-template.md:322-350`) |
| D5 | Generated run evidence is untracked and candidate-external. | `quality/evidence/runs/` is gitignored, uploaded as CI evidence, and the final manifest/report are attached to the GitHub release. Evidence generation never changes the tree being verified. |
| D6 | Chapa's fixed candidate is `{developCommit, candidateTreeDigest}`. | Preview proves `developCommit`; the squash-produced `mainCommit` must have the same tree digest; production proves `mainCommit`. This preserves squash merge while binding both deployments to identical content. Chapa currently verifies a develop preview and later tags the squashed main commit. (`docs/runbooks/release-checklist.md:27-34`, `.claude/commands/release.md:238-292`) |
| D7 | `/api/version` is the deployment-identity oracle. | Preview and production return the Vercel commit SHA through the centralized environment module; the release gate fails closed when expected or reported identity is absent. Direct environment reads remain centralized. (`apps/web/lib/env.ts:1-20`, `apps/web/lib/env.ts:270-282`) |
| D8 | Required synthetic writes run against local Supabase; preview and production Wave A probes are read-only. | The existing journey already performs state changes, database readback, offline recovery, and cleanup against local Supabase; deployed smoke already has read-only public paths. (`apps/web/e2e/journey.spec.ts:33-176`, `apps/web/e2e/smoke.spec.ts:7-125`) |
| D9 | Required checks cannot be excepted. Optional failures require an authorized, expiring exception. | The analyzer rejects required failure/skip even when marked quarantined and ignores expired optional exceptions. (`/Users/juan/code/cc-rpi/templates/e2e-pro-playbook-template.md:288-320`, `/Users/juan/code/cc-rpi/templates/e2e-pro-playbook-template.md:972-993`) |
| D10 | Implementation and rehearsal do not authorize production actions. | Merge, production deployment, migration application, cron execution, email/webhook effects, environment changes, tagging, and publishing remain separate explicit authorization boundaries. (`CLAUDE.local.md:97-142`, `.claude/commands/explore-release.md:95-105`, `docs/runbooks/release-checklist.md:69-78`) |

## 4. Non-goals

- This plan does not implement Waves C–H or create empty registries for them; their project-specific applicability is recorded in the adapted blueprint.
- This plan does not introduce a new staging environment, deployment provider, datastore, queue, vendor credential, or product feature.
- This plan does not replace Chapa's existing deterministic suites; it selects, normalizes, and analyzes their evidence.
- This plan does not run a real production release. The first production use remains a separately authorized `/release`.
- This plan does not open a GitHub epic automatically. The adapted blueprint can provide the issue body for a separately authorized repository action.

## 5. Target artifact topology

```text
docs/
  playbooks/
    e2e-pro-release-verification.md       # comprehensive Chapa adaptation
  release/
    release-playbook.md                   # <=200-line procedural authority
  runbooks/
    release-checklist.md                  # detailed manual/capability arcs
    deployment-smoke.md                   # deployed-smoke detail
    migrations.md                         # database operation detail
    rollback.md                           # rollback detail

quality/
  release-required.json                   # requiredness authority
  schemas/
    release-required.schema.json
    release-run.schema.json
    evidence-fragment.schema.json
    evidence-manifest.schema.json
    exploratory-charter.schema.json
  fixtures/
    passing-release-run.json
    blocked-zero-pass.json
    blocked-required-skip.json
    blocked-candidate-mismatch.json
    blocked-missing-cleanup.json
    blocked-incomplete-charter.json
  evidence/
    README.md
    runs/                                 # generated and gitignored

scripts/quality/
  contracts.ts
  validate-release-required.ts
  validate-release-required.test.ts
  prepare-release-run.ts
  prepare-release-run.test.ts
  collect-playwright-evidence.ts
  collect-playwright-evidence.test.ts
  analyze-release-run.ts
  analyze-release-run.test.ts
  merge-release-evidence.ts
  merge-release-evidence.test.ts
  render-release-report.ts
  render-release-report.test.ts
  validate-release-docs.ts
  validate-release-docs.test.ts
  verify-deployment-identity.ts
  verify-deployment-identity.test.ts

apps/web/app/api/version/
  route.ts
  route.test.ts

.github/workflows/
  release-verification.yml                # parameterized, non-deploying verifier
```

Per-run evidence follows the blueprint's candidate, environment, timestamp, stable scenario, oracle, fixture, cleanup, and exception model. (`/Users/juan/code/cc-rpi/templates/e2e-pro-playbook-template.md:911-993`)

## 6. Candidate identity model

Chapa's source and production commits differ because promotion is a squash merge. The candidate contract therefore binds content and deployments as follows:

```text
baselineTag = latest release tag
developCommit = immutable develop SHA used for preview evidence
candidateTreeDigest = git rev-parse developCommit^{tree}

require preview./api/version.commitSha == developCommit

mainCommit = squash-produced main SHA
mainTreeDigest = git rev-parse mainCommit^{tree}
require mainTreeDigest == candidateTreeDigest
require production./api/version.commitSha == mainCommit

tagTarget = mainCommit
```

The manifest stores both commits, both tree digests, the preview and production URLs, the deployment-reported identities, and the evidence timestamps. A stale preview, a content-changing squash, a stale production alias, or an absent identity blocks the run before tagging. This applies the blueprint's fixed-candidate and tag-last decisions without changing Chapa's branch strategy. (`/Users/juan/code/cc-rpi/templates/e2e-pro-playbook-template.md:161-162`, `/Users/juan/code/cc-rpi/templates/e2e-pro-playbook-template.md:352-367`, `CLAUDE.md:287-296`)

## 7. Initial required probe set

| Stable scenario | Environment | Safety | Evidence |
|---|---|---|---|
| `deployment.preview-identity` | Preview | Read-only | `/api/version` HTTP body matches `developCommit` |
| `deployment.production-identity` | Production | Read-only | `/api/version` HTTP body matches `mainCommit`; main tree matches candidate tree |
| `health.core-dependencies` | Preview and production | Read-only | Redis, Supabase, and GitHub dependency fields are `ok`; cron freshness remains a separate monitoring signal, matching current smoke semantics. (`apps/web/e2e/smoke.spec.ts:15-47`) |
| `profile.public-badge-read` | Preview and production | Read-only | HTTP 200, SVG content type, opening and closing SVG tags. (`apps/web/e2e/smoke.spec.ts:49-70`) |
| `profile.public-share-read` | Preview and production | Read-only | HTTP 200 and visible body through the existing smoke-only path. (`apps/web/e2e/smoke.spec.ts:72-94`) |
| `auth.github-login-redirect` | Preview | Read-only | Redirect status and GitHub location. (`apps/web/e2e/smoke.spec.ts:96-119`) |
| `auth.protected-write-denied` | Preview | Read-only negative probe | Unauthenticated Studio configuration write is denied and produces no state. |
| `studio.config-persistence` | Local contract | Synthetic write | UI/HTTP success, Supabase readback, offline/retry behavior, and cleanup. (`apps/web/e2e/journey.spec.ts:35-136`) |
| `profile.snapshot-integrity` | Local contract | Synthetic write | Snapshot numeric fields and Craft variants read back from Supabase. (`apps/web/e2e/journey.spec.ts:110-134`) |
| `operations.vercel-cron-registration` | CI | Read-only static gate | Existing `check:vercel-config` result covers the production escape in which cron configuration lived at the wrong root. (`package.json:22-25`, `docs/logs/2026-07-16-scoring-incident-and-cron-outage.md:8-14`) |
| `database.pending-migrations` | CI | Read-only datastore gate | The exact release-PR attempt must report no unapplied production migrations; a missing or skipped result blocks. |
| `release.manual-arcs` | Preview | Authorized manual verification | Six candidate-bound manual obligation records plus the aggregate manual result cover OAuth, authenticated badge/share, locale, migration review, and rollback readiness. |

The catalog records owner, runner, selector, environment, safety class, requiredness, expected oracle layers, and evidence retention for every scenario. The deployed checks remain read-only; real OAuth completion, cron execution, migration application, and outbound notifications remain manual/authorized arcs.

## 8. Analyzer contract

```text
analyze(requiredCatalog, releaseRun, evidenceManifest, now):
  validate schema versions and reject malformed inputs
  require immutable baselineTag, developCommit, and candidateTreeDigest
  require preview identity == developCommit

  index planned obligations and actual results by (stable scenarioId, environment)
  reject duplicates, unknown results, and missing required results
  reject when passedCount == 0

  for each required result:
    reject unless status == "passed"
    reject when any expected oracle lacks evidence

  for each optional failed result:
    require an authorized, unexpired exception with reason and follow-up

  for each fixture:
    require run-scoped identifier
    require cleanupStatus == "removed"
    require zero-residue evidence

  for each exploratory charter:
    require the same candidate
    require maneuvers 1 through 8 exactly once
    reject failed maneuvers
    require a concrete reason for every not-applicable maneuver
    reject skipped high-risk areas and untriaged findings

  after squash:
    require mainTreeDigest == candidateTreeDigest
    require production identity == mainCommit

  return PASS only when blockingReasons is empty
```

The final report deterministically renders the decision, counts, identities, required results, exploratory charters, cleanup, exceptions, rollback reference, and pending tag authorization. Its structure follows the blueprint's release evidence report. (`/Users/juan/code/cc-rpi/templates/e2e-pro-playbook-template.md:1109-1163`)

## 9. Phase overview

| Phase | Title | Depends on | Batch | Primary outcome |
|---|---|---|---|---|
| 1 | Adapt and lock the Chapa blueprint | — | No | Complete local comprehensive playbook and fixed adoption decisions |
| 2 | Build the fail-closed evidence contract | Phase 1 | No | JSON schemas, required catalog, analyzer, renderer, adversarial fixtures |
| 3 | Prove candidate identity and initial required probes | Phase 2 | No | `/api/version`, dual-identity chain, tagged smoke/journey evidence |
| 4 | Transport and aggregate exact-candidate evidence | Phase 3 | No | Non-deploying release-verification workflow and durable artifacts |
| 5 | Establish the single operational release authority | Phase 4 | No | Short playbook; `/release` and `/explore-release` integration; tag-last flow |
| 6 | Rehearse pass and deliberate block paths | Phase 5 | No | Non-production evidence report proving the executable system |

No phase is marked `[batch-eligible]`. Each phase either defines a contract consumed by the next phase or changes the same release/evidence surface. Parallel work would create schema or procedure drift rather than independent file ownership.

```text
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6
```

## 10. Integration risks and containment

| Risk | Containment |
|---|---|
| Squash promotion changes the commit SHA | Bind the candidate to the develop commit plus Git tree digest, then require the main tree to match before production identity and tagging. (`.claude/commands/release.md:238-292`) |
| A static deployment URL can point at an older preview | `/api/version` and the expected SHA are mandatory; URL reachability without identity never counts. The current workflow only consumes a configured URL. (`.github/workflows/ci.yml:383-449`) |
| A skipped job is mistaken for a pass | The analyzer consumes results, not workflow conclusion alone; zero-pass and required-missing/skip cases fail. (`/Users/juan/code/cc-rpi/templates/e2e-pro-playbook-template.md:288-320`) |
| Overall health includes cron freshness that a new deployment cannot repair before merge | The deployed gate checks core dependencies while cron freshness remains separately visible and cadence-bound, matching the executable smoke semantics. (`apps/web/e2e/smoke.spec.ts:19-41`) |
| Evidence generation changes the candidate tree | Per-run evidence remains gitignored and is uploaded externally; tracked schemas and fixtures are fixed before candidate selection. |
| Existing branch-protection checks are renamed | Preserve current aggregate job names and add a new `Release Evidence` result rather than renaming existing gates. Current aggregate coverage and E2E jobs are explicit workflow nodes. (`.github/workflows/ci.yml:88-152`, `.github/workflows/ci.yml:366-381`) |
| Secrets or user data enter evidence | Collect allowlisted fields only, redact command output, use synthetic run IDs, and validate residue cleanup. The blueprint requires redacted, synthetic, run-scoped evidence. (`/Users/juan/code/cc-rpi/templates/e2e-pro-playbook-template.md:169-175`, `/Users/juan/code/cc-rpi/templates/e2e-pro-playbook-template.md:931-970`) |
| Verification accidentally performs production work | Production probes are read-only. Migration, cron, email, webhook, environment, merge, deploy, and tag actions remain explicit authorization gates. (`CLAUDE.local.md:97-142`, `docs/runbooks/release-checklist.md:51-78`) |
| CI and deployment cost expands | Reuse existing build, contract, journey, and smoke artifacts; the release workflow aggregates results rather than rerunning equivalent suites. Existing CI already separates and retains these layers. (`.github/workflows/ci.yml:205-449`) |

## 11. Global success criteria

### Automated

- JSON contract validation fails on unknown schema versions, duplicate stable IDs, missing owners, unsupported environments, absent selectors, or missing oracle declarations.
- Analyzer regression tests prove that zero pass, all skipped, required missing/skip/fail, quarantined required fail, candidate mismatch, absent oracle evidence, failed cleanup, expired exception, missing charter maneuver, failed maneuver, and skipped high-risk area all block.
- `/api/version` returns trimmed deployment identity and fails the required probe when identity is unavailable or differs.
- The preview identity, candidate tree, main tree, and production identity chain is mechanically verified.
- Existing smoke and journey execution emits stable scenario results with UI, HTTP, datastore, and cleanup evidence.
- The release-verification workflow uploads the candidate record, plan, raw results, evidence manifest, and rendered report and exposes one `Release Evidence` decision.
- Sequential repository verification passes:

  ```text
  pnpm run typecheck
  pnpm run lint
  pnpm run test
  pnpm run test:contract:local
  pnpm run test:e2e -- --grep @release-required
  pnpm run build
  pnpm run release:analyze -- --run quality/fixtures/passing-release-run.json
  ```

### Manual and operational

- A maintainer can follow `docs/release/release-playbook.md` without consulting a second top-level sequence.
- The generated report contains exact source, tree, preview, main, and production identities; timestamps; raw evidence references; fixture cleanup; exceptions; rollback target; and tag authorization.
- `/explore-release` emits all eight maneuver rows with evidence or concrete `N/A` reasons and uses fresh contexts.
- An explicit approval pause occurs after final analyzer `PASS` and before the tag command.
- A non-production rehearsal completes one passing run and deliberate blocked runs for zero-pass, required skip, identity mismatch, missing cleanup, and incomplete charter.
- The first real production use remains separately authorized and supplies the first production evidence manifest; this implementation plan does not itself merge, deploy, mutate production, run operational crons, send notifications, tag, or publish.

## 12. Phase files

- [Phase 1 — Adapt and lock the Chapa blueprint](2026-07-26-e2e-pro-release-verification-phases/phase-1.md)
- [Phase 2 — Build the fail-closed evidence contract](2026-07-26-e2e-pro-release-verification-phases/phase-2.md)
- [Phase 3 — Prove candidate identity and initial required probes](2026-07-26-e2e-pro-release-verification-phases/phase-3.md)
- [Phase 4 — Transport and aggregate exact-candidate evidence](2026-07-26-e2e-pro-release-verification-phases/phase-4.md)
- [Phase 5 — Establish the single operational release authority](2026-07-26-e2e-pro-release-verification-phases/phase-5.md)
- [Phase 6 — Rehearse pass and deliberate block paths](2026-07-26-e2e-pro-release-verification-phases/phase-6.md)

Each phase is implemented in an isolated worktree from `develop`, follows TDD where behavior changes, runs verification sequentially, and stops for human review before the next phase. (`.claude/rules/rpi-details.md:7-18`, `.claude/rules/rpi-details.md:31-47`)
