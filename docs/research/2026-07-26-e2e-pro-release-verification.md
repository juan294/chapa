# Research: Chapa production release verification and E2E Pro adoption context

**Date:** 2026-07-26
**Branch researched:** `develop`
**Research question:** How does the latest CC-RPI E2E Pro blueprint correspond to Chapa's current release, test, deployment, data, observability, and rollback system?

## Executive summary

The CC-RPI template defines E2E Pro as a release-verification layer in front of the existing `/release` authority. Its universal floor is Wave A: zero-pass rejection, blocking required failures and skips, fixed-candidate evidence, and tag-last ordering. The template makes the project adaptation profile and environment truth table the evidence-gathering step before implementation. (`/Users/juan/code/cc-rpi/templates/e2e-pro-playbook-template.md:8-16`, `/Users/juan/code/cc-rpi/templates/e2e-pro-playbook-template.md:33-52`, `/Users/juan/code/cc-rpi/templates/e2e-pro-playbook-template.md:193-244`)

Chapa's release verification is currently distributed across `/release`, `/explore-release`, the release checklist, migration and rollback runbooks, the main CI workflow, deployment smoke tests, and the nightly production probe. The flow distinguishes local verification, CI against a built artifact, an exact-commit preview, the `main` production deployment, post-release checks, and rollback verification. (`.claude/commands/release.md:7-81`, `.claude/commands/explore-release.md:22-125`, `docs/runbooks/release-checklist.md:5-49`, `.github/workflows/ci.yml:205-449`, `.github/workflows/nightly-prod-probe.yml:1-64`, `docs/runbooks/rollback.md:11-64`)

The existing automated layers cover unit and coverage gates, migration validation, a real local-Supabase contract test, a browser journey on desktop and mobile projects, built-artifact Playwright shards, strict deployment smoke tests, and a scheduled production probe. The manual checklist covers real OAuth, public and authenticated badge flows, share and verification surfaces, health, and both English and Spanish. (`.github/workflows/ci.yml:9-28`, `.github/workflows/ci.yml:30-152`, `.github/workflows/ci.yml:205-381`, `apps/web/playwright.config.ts:3-40`, `docs/runbooks/release-checklist.md:27-49`)

Chapa's primary release-sensitive seams are GitHub and linked source platforms, Supabase, Redis, Vercel, PostHog, Resend/Svix, cron execution, and the alert webhook. Its durable state includes users, metric snapshots, verification records, feature flags, linked platforms, tool insights, email campaigns and sends, supplemental stats, and Studio configurations. (`CLAUDE.md:55-70`, `CLAUDE.md:363-415`, `supabase/migrations/001_create_tables.sql:8-97`, `supabase/migrations/003_create_feature_flags.sql:5-27`, `supabase/migrations/010_add_user_platforms.sql:2-20`, `supabase/migrations/015_create_tool_insights.sql:5-29`, `supabase/migrations/016_create_email_campaigns.sql:2-44`, `supabase/migrations/024_create_supplemental_stats.sql:1-19`, `supabase/migrations/027_create_studio_configs.sql:1-17`)

## 1. Blueprint contract

The template is an adoption-and-architecture document that is copied into a target repository and adapted. It distinguishes that comprehensive document from the finished day-to-day release procedure, whose target size is 200 lines or fewer. (`/Users/juan/code/cc-rpi/templates/e2e-pro-playbook-template.md:1-10`, `/Users/juan/code/cc-rpi/templates/e2e-pro-playbook-template.md:997-1001`)

Its stated adoption sequence is:

1. Copy the template into the target repository.
2. Replace placeholders with verified project values.
3. Remove inapplicable sections while recording why.
4. Create the machine-readable artifacts represented by the document.
5. Preserve the evidence invariants while adapting paths, commands, tools, and environment tiers.
6. Track the implementation waves in a project epic. (`/Users/juan/code/cc-rpi/templates/e2e-pro-playbook-template.md:44-54`)

The blueprint identifies a project implementation plan, a short release playbook, capability and constraint registries, scenario and evidence directories, a plan compiler, a run analyzer, and `/explore-release` as the durable artifact family; its listed paths are illustrative and defer to project conventions. (`/Users/juan/code/cc-rpi/templates/e2e-pro-playbook-template.md:56-77`)

The decision ledger establishes a single procedural source of truth, a short operational playbook, zero-pass failure, required-check enforcement, machine-readable requiredness, fixed candidate identity, tag-last ordering, deterministic and exploratory separation, multi-layer evidence, synthetic fixtures, and explicit authorization for production-affecting actions. (`/Users/juan/code/cc-rpi/templates/e2e-pro-playbook-template.md:150-175`)

Wave B generates charters from the last release and candidate, executes them in fresh contexts, and records all eight maneuvers as `PASS`, `FAIL`, or reasoned `N/A`. Its safety contract confines agents to synthetic run-scoped fixtures and authorized operations, with cleanup and residue evidence. (`/Users/juan/code/cc-rpi/templates/e2e-pro-playbook-template.md:369-449`, `/Users/juan/code/cc-rpi/templates/e2e-pro-playbook-template.md:470-481`)

The release-procedure template orders preflight and candidate fixation, obligation compilation, sequential deterministic gates, deployed-candidate verification, exploratory charters, cadence-bound arcs, evidence analysis, authorization and tagging, and rollback. The analyzer's fail conditions include zero passes, required failure or skip, absent evidence or cleanup, candidate mismatch, unmapped impact, overdue critical obligations, and untriaged exploratory outcomes. (`/Users/juan/code/cc-rpi/templates/e2e-pro-playbook-template.md:997-1105`)

## 2. Chapa project adaptation profile

| Area | Current project evidence |
|---|---|
| Project and product | Chapa is a Developer Impact Badge web product with a public profile, badge, and developer-impact scoring surfaces. (`README.md:1-14`, `CLAUDE.md:8-24`) |
| Repository visibility | The repository is private. (`docs/accepted-risks.md:159-163`) |
| Product and build system | The application is a Next.js web application in a pnpm workspace. (`docs/decisions/2026-06-20-deployment-stack.md:7-12`, `pnpm-workspace.yaml:1-3`, `package.json:4-8`) |
| Branch topology | `develop` is the integration branch and `main` is the production branch. (`CLAUDE.md:287-296`) |
| Merge and release form | `/release` pushes `develop`, opens a `develop`-to-`main` PR, enables squash auto-merge, then resolves the squashed commit on `main` before tagging and creating the GitHub release. (`.claude/commands/release.md:238-292`) |
| Deployment provider | Vercel builds previews and the production deployment. (`docs/decisions/2026-06-20-deployment-stack.md:30-39`, `docs/decisions/2026-06-20-deployment-stack.md:46-60`) |
| Local target | The web app runs on port 3001; the contract harness starts local Supabase and uses its local API and keys. (`apps/web/package.json:6-13`, `scripts/test-contract-local.ts:7-20`) |
| Preview target | The release checklist records a candidate preview URL tied to the exact `develop` commit. (`docs/runbooks/release-checklist.md:27-34`) |
| Staging representation | The deployment stack names Vercel preview deployments for `develop` and production deployment for `main`; it does not name another deployment tier. (`docs/decisions/2026-06-20-deployment-stack.md:46-60`) |
| Production target | The canonical production URL is `https://chapa.thecreativetoken.com`. (`CLAUDE.md:26-31`) |
| Verification runners | Vitest covers unit and coverage execution; Playwright covers browser journey, built-artifact E2E, deployment smoke, and nightly production probes. (`package.json:9-16`, `apps/web/playwright.config.ts:3-40`, `.github/workflows/ci.yml:30-152`, `.github/workflows/ci.yml:205-449`) |
| Primary datastore | Supabase Postgres stores durable application state. (`docs/decisions/2026-06-20-deployment-stack.md:34-38`, `docs/decisions/2026-06-20-deployment-stack.md:73-86`) |
| Cache and binary state | Redis is the hot read path for score and configuration data and currently holds generated OG image binaries; the recorded ADR describes a future move of those binaries to object storage. (`CLAUDE.md:143-165`, `docs/decisions/2026-03-14-og-image-cache-migration.md:1-9`, `docs/decisions/2026-03-14-og-image-cache-migration.md:51-53`) |
| Runtime boundary | A single Next.js/Vercel runtime serves user routes and cron route handlers. (`docs/decisions/2026-06-20-runtime-boundary.md:27-46`) |
| Authentication | GitHub is the primary identity provider, with Bitbucket, Codeberg, and GitLab connections represented in the product. (`CLAUDE.md:55-70`) |
| Payments | The project documents no paid tiers. (`CLAUDE.md:21-24`) |
| Notifications | Resend handles email, Svix signatures authenticate inbound email webhooks, Gmail forwarding receives forwarded mail, and an alert webhook receives operational alerts. (`docs/decisions/2026-06-20-deployment-stack.md:88-94`, `CLAUDE.md:397-415`) |
| Observability | The project uses Vercel logs and analytics, `/api/health`, cron heartbeats, PostHog, and webhook alerts. (`docs/runbooks/observability.md:88-107`, `docs/runbooks/incident-response.md:12-21`) |
| Device surface | Playwright exercises desktop Chrome and a Pixel 5 emulation project. (`apps/web/playwright.config.ts:20-29`) |
| Release approval | `/release` stops for human version selection and full-diff confirmation. (`.claude/commands/release.md:61-81`, `.claude/commands/release.md:142-145`) |
| Rollback authority | The incident runbook assigns the solo operator the operational response and recovery flow. (`docs/runbooks/incident-response.md:36-51`) |

## 3. Environment truth table

| Environment | Artifact and services | Current verification behavior |
|---|---|---|
| Local | Next.js runs on port 3001 and the contract harness provisions local Supabase. (`apps/web/package.json:6-13`, `scripts/test-contract-local.ts:7-20`) | The contract harness performs a real local-Supabase integration run; the Playwright journey creates and reads local fixtures and cleans them up. (`.github/workflows/ci.yml:205-256`, `apps/web/e2e/journey.spec.ts:33-176`) |
| CI build/E2E | CI builds the Next.js application, uploads the build artifact, then E2E shards download and exercise it with CI fixture configuration. (`.github/workflows/ci.yml:258-364`) | Unit/coverage, contract, journey, build, E2E, scoring-integrity, migration, and configuration checks are represented as separate jobs or steps. (`.github/workflows/ci.yml:9-28`, `.github/workflows/ci.yml:30-152`, `.github/workflows/ci.yml:192-293`, `.github/workflows/ci.yml:295-381`) |
| Preview | The release checklist binds a Vercel preview URL to the exact `develop` candidate commit. (`docs/runbooks/release-checklist.md:27-34`) | Manual checks cover real OAuth and connected-platform flows, badge and Studio behavior, public SVG, sharing, verification, health, and English/Spanish behavior. (`docs/runbooks/release-checklist.md:35-49`) |
| Production | `main` deploys to the canonical Vercel production domain with managed external services. (`docs/decisions/2026-06-20-deployment-stack.md:46-60`, `CLAUDE.md:26-31`) | A strict deployment smoke job can target a configured base URL, the checklist records immediate post-release reads, and a scheduled strict Chromium probe targets production. (`.github/workflows/ci.yml:383-449`, `docs/runbooks/release-checklist.md:115-127`, `.github/workflows/nightly-prod-probe.yml:1-64`) |

## 4. Current release lifecycle

### 4.1 Orientation and release preparation

`/release` begins by reading project and local authorization context, confirming the branch, locating the latest release, collecting commits and changed files, and asking the operator to select the version. (`.claude/commands/release.md:7-81`)

It then updates version and changelog references, runs typecheck, lint, tests, and build sequentially, presents the complete diff, and stops for confirmation before publish actions. (`.claude/commands/release.md:83-148`)

The release checklist separately records that the `develop` CI run is green and the local typecheck, lint, tests, and build are green before candidate verification. (`docs/runbooks/release-checklist.md:5-25`)

### 4.2 Candidate and data preparation

The checklist associates the candidate preview URL with the exact `develop` commit and exercises real identity, profile, badge, share, verification, health, and locale flows against that deployment. (`docs/runbooks/release-checklist.md:27-49`)

The migration runbook records migration review and application as an explicit release operation, and CI conditionally validates release PR migration state. (`docs/runbooks/migrations.md:107-115`, `.github/workflows/ci.yml:451-492`)

### 4.3 CI and deployed verification

The main CI workflow runs for pushes and pull requests involving `develop` and `main`. (`.github/workflows/ci.yml:1-8`)

Its deterministic layers include lint, typecheck, circular-dependency checks, migration and configuration validation, coverage shards and aggregation, scoring-integrity checks, a real local-Supabase contract, desktop and mobile browser journeys, a production build, bundle analysis, and sharded browser E2E against the uploaded build artifact. (`.github/workflows/ci.yml:9-28`, `.github/workflows/ci.yml:30-152`, `.github/workflows/ci.yml:192-381`)

The deployment-smoke job treats an absent deployment URL as fatal on `main` and non-fatal on other refs; when configured, it runs strict smoke tests and uploads failure evidence. (`.github/workflows/ci.yml:383-449`)

The deployment-smoke runbook describes the intended target as the exact Vercel deployment produced for the candidate commit. (`docs/runbooks/deployment-smoke.md:48-53`)

### 4.4 Publish, exploration, and tag

The publish phase pushes `develop`, creates a release PR to `main`, requests squash auto-merge, and waits for the resulting `main` commit. The tag and GitHub release are created against that squashed production commit. (`.claude/commands/release.md:238-292`)

`/explore-release` fixes the comparison refs, generates risk charters from the diff, applies eight maneuvers under an explicit safety boundary, writes an evidence report, and hands blocking findings back without changing implementation during the exploratory run. (`.claude/commands/explore-release.md:22-125`)

### 4.5 Post-release observation and rollback

The checklist records production health, public badge behavior, and cron/monitoring checks within the post-release window. (`docs/runbooks/release-checklist.md:115-127`)

The nightly workflow runs the strict smoke suite in Chromium against production and retains Playwright evidence on failure. (`.github/workflows/nightly-prod-probe.yml:1-64`)

The rollback runbook records two application rollback paths—promoting a known-good Vercel deployment and reverting through Git—and then verifies health, public badge behavior, and the Vercel deployment header. Database rollback is handled as a separate operation. (`docs/runbooks/rollback.md:11-64`)

## 5. Automated verification inventory

| Layer | Current execution and oracle |
|---|---|
| Static and configuration | Lint, typecheck, circular dependencies, migration checks, Craft contract checks, and Vercel configuration validation. (`.github/workflows/ci.yml:9-28`) |
| Unit and coverage | Tests run in shards; coverage is merged and enforced centrally. (`.github/workflows/ci.yml:30-152`) |
| Scoring integrity | Conditional integrity checks exercise score-specific behavior when matching files change. (`.github/workflows/ci.yml:192-203`) |
| Integration contract | A Node 24 harness provisions local Supabase and exercises the service contract against it. (`.github/workflows/ci.yml:205-231`, `scripts/test-contract-local.ts:7-20`) |
| Browser journey | Desktop and mobile projects exercise fixture creation, login, generation, badge and Studio flows, offline behavior, sharing, refresh/readback, and cleanup. (`.github/workflows/ci.yml:233-256`, `apps/web/e2e/journey.spec.ts:33-176`) |
| Built-artifact E2E | CI uploads the build, shards Playwright execution, retains failure artifacts, and aggregates E2E status. (`.github/workflows/ci.yml:258-381`) |
| Deployment smoke | Strict smoke probes cover health, root, public profile, public badge, verification, and share surfaces, with dependency status interpreted separately from cron freshness. (`apps/web/e2e/smoke.spec.ts:7-125`) |
| Nightly production | A scheduled workflow runs the strict Chromium smoke suite against the canonical production URL and uploads reports on failure. (`.github/workflows/nightly-prod-probe.yml:1-64`) |

The Playwright configuration uses Spanish locale by default, captures traces on retry, defines desktop Chrome and Pixel 5 projects, and accepts either a local server or external base URL. (`apps/web/playwright.config.ts:3-40`)

## 6. Candidate identity and evidence

The documented pre-release candidate identity is the exact `develop` commit paired with its preview URL. The publish flow later resolves the squash-produced `main` commit and tags that commit. (`docs/runbooks/release-checklist.md:27-34`, `.claude/commands/release.md:238-292`)

CI packages the Next.js build as a named artifact, downloads it into E2E shards, uploads Playwright failure artifacts from individual shards, and aggregates the shard results. (`.github/workflows/ci.yml:258-381`)

The strict deployed-smoke job receives its target through `DEPLOYMENT_SMOKE_BASE_URL`, records the Playwright report and test output on failure, and distinguishes required production execution from conditional non-production execution. (`.github/workflows/ci.yml:383-449`)

## 7. Actors, capabilities, and state

The public actor can generate and view profiles, badges, verification pages, and share surfaces. The authenticated owner can connect platforms and manage profile-linked capabilities. Admin, cron, and webhook actors have distinct protected entry points. (`CLAUDE.md:35-118`)

Identity state is represented by a stateless signed session cookie with a 24-hour lifetime, and platform state spans GitHub plus linked Bitbucket, Codeberg, and GitLab identities. (`docs/accepted-risks.md:56-63`, `CLAUDE.md:55-70`)

Profile state includes generated score data, cached reads, durable snapshots, verification, supplemental metrics, tool insights, and Studio configuration. (`CLAUDE.md:143-165`, `supabase/migrations/001_create_tables.sql:20-97`, `supabase/migrations/015_create_tool_insights.sql:5-29`, `supabase/migrations/024_create_supplemental_stats.sql:1-19`, `supabase/migrations/027_create_studio_configs.sql:1-17`)

Runtime health distinguishes overall status, dependency status, and cron freshness, and includes component-level results in the response. (`apps/web/app/api/health/route.ts:17-45`, `apps/web/app/api/health/route.ts:219-269`)

## 8. Oracle layers and side-effect boundaries

The browser journey combines visible UI assertions with local Supabase fixture creation, downstream readback, refresh persistence, and fixture cleanup. (`apps/web/e2e/journey.spec.ts:33-176`)

The reliability playbook records API response, persisted-record, idempotency, and cleanup evidence as separate oracle layers for write paths. (`docs/playbooks/reliability-hardening-playbook.md:22-28`)

The deployed smoke suite uses read-only query flags on public routes; the share page, badge route, and public-profile service contain explicit smoke/read-only paths that avoid ordinary side effects. (`apps/web/app/u/[handle]/page.tsx:83-98`, `apps/web/app/u/[handle]/page.tsx:149-198`, `apps/web/app/u/[handle]/badge.svg/route.ts:202-225`, `apps/web/app/u/[handle]/badge.svg/route.ts:303-377`, `apps/web/lib/profile/public-profile.ts:69-100`, `apps/web/lib/profile/public-profile.ts:161-170`)

The health endpoint probes GitHub and other dependencies, aggregates component state, and triggers alert behavior from the resulting health model. (`apps/web/app/api/health/route.ts:53-118`, `apps/web/app/api/health/route.ts:194-270`)

Rollback verification includes HTTP health, public badge rendering, and the `x-vercel-id` response header as independent readbacks. (`docs/runbooks/rollback.md:40-53`)

## 9. External seams, persistence, and scheduled work

The deployment architecture names Vercel, GitHub, Redis, Supabase, PostHog, Resend/Svix, Gmail forwarding, linked source platforms, and the alert webhook as runtime integrations. (`CLAUDE.md:26-31`, `CLAUDE.md:363-415`)

The database schema persists:

- registered users, metric snapshots, and verification records; (`supabase/migrations/001_create_tables.sql:8-97`)
- feature flags and their configuration; (`supabase/migrations/003_create_feature_flags.sql:5-27`)
- encrypted linked-platform credentials and connection metadata; (`supabase/migrations/010_add_user_platforms.sql:2-20`)
- tool-insight reports and Craft scores; (`supabase/migrations/015_create_tool_insights.sql:5-29`)
- campaign definitions and per-recipient send outcomes; (`supabase/migrations/016_create_email_campaigns.sql:2-44`)
- durable supplemental stats; and (`supabase/migrations/024_create_supplemental_stats.sql:1-19`)
- durable Creator Studio configurations. (`supabase/migrations/027_create_studio_configs.sql:1-17`)

Vercel configuration defines four cron schedules with route-specific duration budgets. (`apps/web/vercel.json:1-33`)

The warm-cache route caps and batches work, rotates users, stores snapshots, updates heartbeat state, and emits alert outcomes. (`apps/web/app/api/cron/warm-cache/route.ts:30-63`, `apps/web/app/api/cron/warm-cache/route.ts:150-215`)

The campaign processor claims work, applies round-robin progression and quota/time limits, sends through the configured provider, and updates heartbeat state. (`apps/web/app/api/cron/process-campaigns/route.ts:33-114`)

The inbound email webhook verifies Svix signatures, deduplicates events through Redis, fetches content from Resend, and forwards the result. (`apps/web/app/api/webhooks/resend/route.ts:16-24`, `apps/web/app/api/webhooks/resend/route.ts:36-63`, `apps/web/app/api/webhooks/resend/route.ts:97-151`)

## 10. Recorded runtime behavior and authorization boundaries

The accepted-risk record documents public rate-limit fail-open behavior, the stateless session cookie, owner OAuth scope behavior, badge regeneration timing, in-memory and Redis locking boundaries, and escaped inline SVG/CSP handling. (`docs/accepted-risks.md:9-16`, `docs/accepted-risks.md:24-28`, `docs/accepted-risks.md:56-63`, `docs/accepted-risks.md:87-92`, `docs/accepted-risks.md:219-233`, `docs/accepted-risks.md:262-268`)

The Supabase outage playbook records the application behavior when durable snapshots cannot be written, and the Resend webhook records bounded duplicate-delivery behavior when Redis deduplication is unavailable. (`docs/runbooks/outage-playbook.md:29-48`, `apps/web/app/api/webhooks/resend/route.ts:97-117`)

Repository-local authorization reserves branch, PR, merge, deployment, production, environment, and other outward-facing operations for explicit approval. `/release` separately stops at version selection and full-diff confirmation; `/explore-release` limits charters to authorized environments and operations. (`CLAUDE.local.md:97-142`, `.claude/commands/release.md:61-81`, `.claude/commands/release.md:142-148`, `.claude/commands/explore-release.md:95-105`)

Cron operation and migration application are recorded as explicit operational actions in their release runbooks. (`docs/runbooks/release-checklist.md:69-78`, `docs/runbooks/migrations.md:107-115`)

## 11. Historical release-verification patterns

The July 16 incident log records a badge and scoring incident involving misplaced Vercel configuration, cron schedules that were not registered, whitespace in `CRON_SECRET`, effective GitHub token scope, and an obsolete zero-score predicate shared across guard, persistence, and repair paths. (`docs/logs/2026-07-16-scoring-incident-and-cron-outage.md:1-32`, `docs/logs/2026-07-16-scoring-incident-and-cron-outage.md:58-62`)

The health route encodes serverless-uptime grace when interpreting cron freshness, and deployment smoke separates dependency health from cron staleness. (`apps/web/app/api/health/route.ts:20-39`, `apps/web/app/api/health/route.ts:157-183`, `apps/web/e2e/smoke.spec.ts:19-40`)

The reliability-hardening playbook records earlier seam failures involving success responses without persistence, a dropped `NOT NULL` constraint, and `.single()` result semantics. Its taxonomy covers deferred writes, idempotency, partial completion, cleanup, and related cross-layer outcomes. (`docs/playbooks/reliability-hardening-playbook.md:47-79`, `docs/playbooks/reliability-hardening-playbook.md:460-507`)

The latest tracked triage report records healthy core dependencies and four healthy cron jobs, with the alert-webhook check skipped and carried in issue `#1056`. (`docs/agents/triage-report.md:58-62`, `docs/agents/triage-report.md:77-79`)

## 12. Current correspondence with the blueprint

The existing release procedure is represented by `/release` plus linked release, migration, smoke, rollback, incident, and observability runbooks. The existing exploratory procedure is represented by `/explore-release`. (`.claude/commands/release.md:7-292`, `.claude/commands/explore-release.md:22-125`, `docs/runbooks/release-checklist.md:5-127`, `docs/runbooks/deployment-smoke.md:48-53`, `docs/runbooks/migrations.md:107-115`, `docs/runbooks/rollback.md:11-64`)

The deterministic release evidence currently comes from separate CI jobs and retained artifacts, while deployed evidence comes from the candidate preview checklist, strict deployment smoke, post-release checks, and the nightly production probe. (`.github/workflows/ci.yml:9-449`, `docs/runbooks/release-checklist.md:27-49`, `docs/runbooks/release-checklist.md:115-127`, `.github/workflows/nightly-prod-probe.yml:1-64`)

The product's capability inputs are currently expressed across project documentation, route implementations, database migrations, test files, operational runbooks, and accepted-risk records. (`CLAUDE.md:35-165`, `supabase/migrations/001_create_tables.sql:8-97`, `apps/web/e2e/journey.spec.ts:33-176`, `docs/playbooks/reliability-hardening-playbook.md:22-79`, `docs/accepted-risks.md:9-92`)

The repository's present evidence model already includes UI behavior, HTTP status and content, local database readback, health-component state, deployment headers, build artifacts, Playwright reports, and cleanup. (`apps/web/e2e/journey.spec.ts:33-176`, `apps/web/e2e/smoke.spec.ts:7-125`, `apps/web/app/api/health/route.ts:194-270`, `docs/runbooks/rollback.md:40-53`, `.github/workflows/ci.yml:258-449`)

## Conclusion

The latest blueprint supplies an adoption document and a phased verification architecture; Chapa supplies an existing release authority, exploratory command, layered automated suites, exact-preview checklist, production monitoring, durable-state model, operational safety boundaries, and rollback procedure. The project-specific source material required to populate the blueprint's profile, environment model, capability inputs, oracle layers, release ordering, and historical-risk inputs is represented in the evidence catalog above. (`/Users/juan/code/cc-rpi/templates/e2e-pro-playbook-template.md:44-77`, `.claude/commands/release.md:7-292`, `.claude/commands/explore-release.md:22-125`, `.github/workflows/ci.yml:9-449`, `docs/runbooks/release-checklist.md:5-127`)
