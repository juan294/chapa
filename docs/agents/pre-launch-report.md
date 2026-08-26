# Pre-Launch Codebase Audit
> Generated on 2026-08-26 | Branch: `develop` | 8 specialist roles in 2 parallel waves
> Focus: comprehensive release readiness, with emphasis on Creator Studio revival at `99fe96e0d2d90783e6d3cb5b2acdd161e320806e`

## 1. Executive Summary

The Creator Studio revival is well tested and its security boundary is sound, but the audit found several failure modes that the green suite does not cover. The largest risks are semantic rather than syntactic: the Studio can fabricate zero metrics on a cold profile cache, a rejected durable save can still become authoritative in Redis, and a network-level save failure can disappear without a visible result. The default-Spanish experience also becomes English after the welcome message, while both control modes have accessibility-state defects.

**Top 3 strengths:**

- Exact-candidate verification is strong: 478 test files and 7,836 tests passed locally, followed by typecheck and lint; all six exact-SHA workflows passed, including real local-Supabase contracts and deployed E2E.
- The Studio security boundary is narrow and sound: session-derived ownership, exact allow-listed config values, forced RLS, server-only service credentials, no wildcard mutation CORS, and no new secret exposure.
- The production build remains within budget: the largest client chunk is 227.1 KB raw against the 350 KB gate, and Studio effects stay code-split.

**Top 5 risks:**

1. A cold or expired profile cache can render plausible zero or stale metrics in Studio instead of current owner data (FE-H1).
2. Redis can expose a config that Supabase rejected, or retain an older config after a successful durable save (BE-H1).
3. Network failures and duplicate save submissions can leave persistence state ambiguous (FE-H2).
4. The Spanish-default product exposes an English Studio control surface and recovery path (UX-H1).
5. Quick Controls and terminal autocomplete do not expose correct assistive state (UX-H2).

**Verdict: CONDITIONAL** — No launch-blocker was found, but six high-severity findings are marked Before launch. The Studio flag must remain disabled until Wave 1 remediation is merged, fully verified, released, and production identity is confirmed.

## 2. System Architecture Overview

Chapa is a pnpm monorepo with a Next.js application under `apps/web`, shared domain types and pure logic under `packages/shared`, and operational tooling under `scripts`. `/studio` is a dynamic authenticated server page. It checks the DB-backed feature flag and session, then loads profile material and the saved Studio config in parallel. `StudioClient` owns configuration, preview, terminal, quick-control, motion, and save state. Supabase is the durable source for `studio_configs`; Redis caches the payload for one year, but each hit is accepted only after its revision matches Supabase. Production deploys only from `main`, while `develop` is the integration branch.

The replacement candidate adds backward-compatible migration 035 for database-ordered Studio cache revisions. It adds no workflow, environment-variable, cron, or Vercel configuration change. Migration 035 was applied and verified before the release PR; the release must still squash `develop` into `main`, prove tree equality, verify exact production identity, and only then enable `studio_enabled` through the admin API.

## 3. End-to-End Flow Analysis

The entry path is feature flag → session → GitHub token → profile materialization plus saved config → `StudioClient`. The current `readOnly` profile request suppresses live GitHub and linked-platform fetches, so a cold key becomes a zero profile and an expired primary entry can become stale preview data. The save path validates the config, then starts Redis and Supabase writes concurrently even though Supabase is documented as the success criterion. The client handles HTTP failures but not a rejected `fetch`, and `saving` does not prevent another save.

The release path is healthy at the current `develop` SHA, but the repository instructions do not define a production-bound tag lookup. Because release squashes are not ancestors of `develop`, an ancestry-based lookup chooses `v2.22.0`; the correct production baseline and rollback reference is `v2.22.1`, whose commit matches current `main` and production.

## 4. Frontend / UI Findings (Staff Frontend Engineer)

### Domain Model

The server page resolves gates and data, then passes immutable initial values to `StudioClient`. The client owns preview and command state. Terminal and Quick Controls converge through shared command actions, while the preview uses shared badge content plus lazy client-only effects.

#### FE-H1 Cold-cache Studio visits render fabricated zero metrics
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/studio/page.tsx:21-50, apps/web/app/studio/page.tsx:83-96, apps/web/lib/github/client.ts:62-89, apps/web/lib/github/client.ts:127-143
- **What's happening:** Studio calls `materializePublicProfile` with `readOnly: true`. On a primary-cache miss, that mode does not fetch GitHub or linked platforms. It returns only a protected baseline or `null`, and the page converts `null` into a complete zero-stat profile.
- **Why it matters:** New, evicted, or inactive users can see plausible but false zero metrics, stale platform data, and missing verification while the served badge would fetch current data.
- **Recommendation:** Add a live-fetch-capable owner materialization mode that omits snapshot, verification-record, telemetry, and notification side effects. Cover cold-primary/no-baseline and expired-primary/baseline-present paths.
- **Regression risk:** Preserve scope-ranking and degraded-fetch guards. Opening Studio must not persist snapshots, verification records, badge-generation telemetry, or email side effects.
- **Expected impact:** Studio shows truthful current owner data and preserves served-badge parity.
- **Effort estimate:** M

#### FE-H2 Save failures are not fully handled and duplicate saves can overlap
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/studio/StudioClient.tsx:108-125, apps/web/app/studio/StudioClient.tsx:133-162, apps/web/app/studio/StudioClient.tsx:265-280, apps/web/app/studio/QuickControls.tsx:137-152
- **What's happening:** `handleSave` handles non-2xx responses but has no `catch` for a rejected `fetch`. Its `finally` clears the indicator without adding a result. The `saving` state does not disable the Quick Controls button or `/save`, so requests can overlap and finish out of order.
- **Why it matters:** The core persistence action can fail silently or show misleading completion state.
- **Recommendation:** Use explicit dirty, saving, saved, and error states. Catch transport failures, map API statuses to actionable localized messages, respect `Retry-After`, and reject duplicate save submissions while one request is active.
- **Regression risk:** Preserve editing, reset, help, and terminal history while saving. Failed saves must retain unsaved config, and late responses must not overwrite newer edits.
- **Expected impact:** Every save has one honest and recoverable outcome.
- **Effort estimate:** M

## 5. Backend / API / Data Findings (Staff Backend Engineer)

### Domain Model

Next.js handlers enforce the feature flag, session, validation, and response contract. The session login selects the durable Supabase row and Redis key. Supabase is the source of truth; Redis is best-effort acceleration.

#### BE-H1 Redis can expose an uncommitted or stale Studio configuration
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/api/studio/config/route.ts:79-116, apps/web/lib/db/studio.ts:17, apps/web/lib/db/studio.ts:128-145, apps/web/lib/cache/redis.ts:75-97, apps/web/app/api/studio/config/route.test.ts:202-260
- **What's happening:** PUT starts Redis and Supabase writes concurrently. If Redis succeeds and Supabase fails, the API returns an error but the read path serves the rejected cached value. Production `cacheSet` normally resolves `false` on failure, while the route handles only rejection, so an old one-year cache entry can also survive a successful durable save. Overlapping saves can leave different winners in Redis and Postgres.
- **Why it matters:** A failed save can appear applied, or a successful save can appear reverted, for up to the 365-day cache TTL.
- **Recommendation:** Commit Supabase first. After success, update or invalidate Redis, handle `cacheSet === false`, and define deterministic ordering for concurrent saves. Add DB-fail/cache-success, DB-success/cache-false, and overlapping-save tests.
- **Regression risk:** Redis must remain best-effort. A cache outage must not turn a committed durable save into an API failure. Preserve immediate read-after-write without letting an older request overwrite newer state.
- **Expected impact:** API responses, Redis reads, and durable configuration agree under partial failure and concurrency.
- **Effort estimate:** M

#### BE-M1 The config read boundary trusts unknown JSON and hides storage failures
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** supabase/migrations/027_create_studio_configs.sql:7-10, apps/web/lib/db/studio.ts:27-37, apps/web/lib/db/studio.ts:102-145, apps/web/lib/validation.ts:49-78, apps/web/app/api/studio/config/route.ts:40-41, apps/web/app/studio/page.tsx:83-96
- **What's happening:** The database constrains `config` only as non-null JSONB. Redis hits and durable JSON are not decoded as `BadgeConfig`; the page force-casts the result. A missing row, unavailable Supabase client, query error, and malformed row all become `null`, which selects defaults.
- **Why it matters:** Invalid or legacy data can reach the client, while a returning user can see defaults during a dependency failure and overwrite a valid durable config.
- **Recommendation:** Validate at the cache/database boundary and return discriminated `found`, `not_found`, `unavailable`, and `invalid` results. Evict invalid cache values. Only `not_found` should select defaults.
- **Regression risk:** Exact validation can reject older schemas. Add tested normalization or version migration before enforcing the boundary.
- **Expected impact:** Only valid config reaches Studio, and dependency failure no longer looks like first use.
- **Effort estimate:** M

## 6. Performance and Scalability Findings (Performance Engineer)

### Domain Model

Studio loads profile and config data in parallel, then renders a client preview with lazy effects. The exact build has 73 client chunks totaling 2,017.1 KB raw and 646.5 KB gzip; the largest chunk is 227.1 KB raw. Studio-specific chunks total 218.4 KB raw and 70.9 KB gzip.

#### PE-M1 Studio verification loads unused trend state on every request
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/studio/page.tsx:83-95, apps/web/lib/profile/materialize-profile.ts:90-118, apps/web/lib/profile/materialize-profile.ts:130-167, apps/web/lib/profile/public-profile.ts:56-68
- **What's happening:** The public-profile materializer reads the latest snapshot and dirty marker even though Studio uses fresh `displayImpact` and public verification inputs that do not depend on either value.
- **Why it matters:** Two remote operations, including a possible Supabase fallback, add tail latency to every Studio request.
- **Recommendation:** Add a Studio-focused projection that loads live stats and Craft data, computes fresh impact, and applies completeness checks without trend state.
- **Regression risk:** Preserve Craft contribution, stats-completeness checks, and verification inputs. Never mint verification from empty fallback stats.
- **Expected impact:** Remove two remote operations from each Studio request.
- **Effort estimate:** M

#### PE-M2 Default-config users repeatedly hit unbounded Redis and Supabase reads
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/studio/page.tsx:83-87, apps/web/lib/db/studio.ts:102-144, apps/web/lib/cache/redis.ts:57-71, apps/web/lib/async/with-timeout.ts:20-40
- **What's happening:** A missing config row is not negatively cached, so unsaved users query Supabase on every page load. Neither the Redis read nor the Supabase config query has a request deadline.
- **Why it matters:** First-time users are the common launch case, and a degraded dependency can hold the dynamic route until the platform timeout.
- **Recommendation:** Cache a typed no-config sentinel for a short TTL and apply a bounded read deadline. A successful save must overwrite the sentinel.
- **Regression risk:** The sentinel must not hide later saves or malformed rows. Timeout must retain a safe, explicit degraded result.
- **Expected impact:** Fewer database reads and a bounded config-load p99.
- **Effort estimate:** M

#### PE-M3 Every configuration change remounts the complete preview
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/studio/StudioClient.tsx:91-104, apps/web/app/studio/StudioClient.tsx:254-274, apps/web/app/studio/BadgePreviewCard.tsx:80-86, apps/web/components/badge/BadgeContent.tsx:241-262, apps/web/lib/effects/heatmap/HeatmapGrid.tsx:278-302
- **What's happening:** Each config change increments `previewKey`, which destroys and recreates the entire preview, restarts heatmap/counter animations, reloads effect state, and can reschedule confetti. A separate explicit refresh action already exists.
- **Why it matters:** Rapid control use causes avoidable main-thread work and mobile jank.
- **Recommendation:** Update normal config through props without changing the key. Reserve remounting for explicit refresh or narrowly identified effects.
- **Regression risk:** Verify every effect and reduced-motion transition; use selective restart signals where mount-time replay is required.
- **Expected impact:** Responsive editing under animation-heavy presets.
- **Effort estimate:** M

## 7. Reliability / DevOps / Observability Findings (DevOps / SRE Lead)

### Domain Model

`develop` is the integration branch and protected `main` drives Vercel production. Releases use a squash PR, exact tree comparison, production identity verification, read-only production probes, and tag-last publication. The replacement candidate adds only the backward-compatible Studio revision migration; it changes no hosting or vendor infrastructure surface.

#### DO-M1 An ancestry-based baseline lookup selects v2.22.0 instead of production v2.22.1
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** .claude/commands/release.md:18-20, docs/release/release-playbook.md:22, docs/release/release-playbook.md:47-51, docs/runbooks/rollback.md:20-24, docs/runbooks/rollback.md:66-69
- **What's happening:** Production and `origin/main` are commit `28437a6e`, tagged `v2.22.1`, but release squash history is not an ancestor of `develop`. `git describe --tags --abbrev=0` at the candidate returns `v2.22.0`. The instructions say to find the latest release tag but do not define a production-bound lookup.
- **Why it matters:** The release diff can include already shipped work and the rollback reference can skip the current production release.
- **Recommendation:** Resolve the baseline from the exact production `main` commit and require the annotated tag to dereference to the commit returned by production `/api/version`. Use `v2.22.1` for this candidate.
- **Regression risk:** Annotated tags require dereferencing; verify `tag^{commit}`, `origin/main`, and production identity before recording the baseline.
- **Expected impact:** Correct release notes, candidate diff, and one-release rollback target.
- **Effort estimate:** S

## 8. Security / Privacy Findings (Security Reviewer)

### Domain Model

Studio ownership comes only from the encrypted server session. PUT accepts exact enum-backed config values and uses the session login for Redis and Supabase. The service-role client is server-only, `studio_configs` has forced RLS, and the browser receives only public profile and verification data.

No release-relevant security finding was found. `gitleaks` found no leaks in `v2.22.1..HEAD`; both production and full dependency audits reported no known vulnerabilities. Fail-open rate limiting was not re-raised because it is an explicit accepted risk.

## 9. Code Quality / Maintainability Findings (Principal Architect)

### Domain Model

Application code is split between `apps/web` and `packages/shared`; operational and release tooling is under root `scripts`. Studio command metadata feeds both terminal commands and Quick Controls, while the client preview imports shared visual metadata from SVG-rendering modules.

#### AR-H1 Root operational scripts remain outside static quality gates
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** tsconfig.json:1-4, package.json:9-10, .github/workflows/ci.yml:28-44, vitest.config.ts:7-11, scripts/backfill-supabase.ts:246, scripts/quality/prepare-release-run.ts:12-28, scripts/quality/prepare-release-run.ts:143-146
- **What's happening:** Root typecheck and lint run only workspace package scripts, leaving 25 non-test TypeScript modules under `scripts` unchecked. A direct strict compile finds an implicit `any` in `backfill-supabase.ts` and an invalid `PrepareOptions` to `Record<string, unknown>` assignment in `prepare-release-run.ts`.
- **Why it matters:** CI can be green while release, migration, repair, and backfill tooling contains type errors.
- **Recommendation:** Add a script-specific strict TypeScript config and root ESLint target, fix current errors, and wire both into the existing gates. Add explicit script coverage policy without changing application coverage silently.
- **Regression risk:** Preserve repo-root execution, aliases, Node environment, and release-script runtime behavior. Add the gate incrementally and verify real release commands.
- **Expected impact:** High-consequence operational tooling fails in CI instead of at release time.
- **Effort estimate:** M

#### AR-L1 Studio command metadata remains stringly typed across the action boundary
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/components/terminal/command-registry.ts:23-30, apps/web/components/terminal/command-registry.ts:52-74, apps/web/app/studio/useStudioCommands.ts:46-73, apps/web/app/studio/StudioClient.tsx:133-139
- **What's happening:** Category aliases and values use `Record<string, string>`, then the client casts `action.category` to `keyof BadgeConfig`.
- **Why it matters:** Metadata drift can pass typecheck and fail only at runtime.
- **Recommendation:** Type alias values with `satisfies Record<string, keyof BadgeConfig>` and use a narrowed Studio action type.
- **Regression risk:** Keep Studio typing local so the global terminal registry does not gain unnecessary domain coupling. Preserve aliases and inherited-key rejection.
- **Expected impact:** Command metadata drift becomes a compile-time error.
- **Effort estimate:** S

#### AR-L2 Client preview imports metadata from server SVG implementation modules
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/studio/PreviewFooter.tsx:1-9, apps/web/lib/render/BadgeBranding.tsx:3-16, apps/web/lib/render/VerificationStrip.ts:3-12
- **What's happening:** The client preview imports platform and verification constants from modules whose primary responsibility is server-side SVG rendering.
- **Why it matters:** A future server-only dependency in either renderer can break the Studio client bundle.
- **Recommendation:** Extract shared static visual metadata into a neutral module used by both client preview and SVG renderers.
- **Regression risk:** Preserve SVG bytes, platform order, deduplication, and tree-shaking.
- **Expected impact:** Explicit client/server boundaries without duplicated visual metadata.
- **Effort estimate:** S

#### AR-S1 TypeScript and ESLint major upgrades need explicit gate migration
- **Severity:** strategic
- **Time horizon:** Later
- **Evidence type:** [inference]
- **Files:** package.json:34, tsconfig.madge.json:2-10, apps/web/package.json:41-45, packages/shared/package.json:19-21
- **What's happening:** TypeScript 7 and ESLint 10 are available major upgrades. The Madge configuration still uses resolver behavior normalized to `node10`.
- **Why it matters:** A major upgrade can leave architecture or lint gates green while analyzing fewer edges or rules.
- **Recommendation:** Track both upgrades separately and add negative canaries that prove circular-dependency and custom lint detection before migration.
- **Regression risk:** Successful command exit is insufficient; compare analyzed files and edges before and after each upgrade.
- **Expected impact:** Tool upgrades preserve the strength of current gates.
- **Effort estimate:** L

## 10. Testing / QA Findings (QA / Reliability Lead)

### Domain Model

Vitest covers application behavior; contract files run separately against local Supabase; CI merges sharded coverage and runs real local-Supabase journeys plus deployed E2E. The release catalog records Studio config persistence as a local-contract obligation.

No separate QA finding was raised. The exact candidate passed 478 files and 7,836 tests, typecheck, lint, coverage, real local-Supabase contracts, build, both E2E shards, and every remote workflow. The audit did identify missing regression cases that belong to FE-H1, FE-H2, BE-H1, and UX-M1 rather than standalone test-policy findings.

## 11. UX Cohesion / Design System Findings (Product Designer / UX Lead)

### Domain Model

Studio is a responsive two-pane editor: preview above terminal below `lg`, split workspace at `lg`. Quick Controls and the terminal are equal control paths. Spanish is the default locale. The revived footer adds provenance and verification.

#### UX-H1 The Spanish-default Studio becomes an English control surface after its welcome
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/i18n/types.ts:1-4, apps/web/lib/i18n/dictionaries/es.ts:976-983, apps/web/app/studio/StudioClient.tsx:72-76, apps/web/app/studio/QuickControls.tsx:27-152, apps/web/app/studio/studio-options.ts:17-105, apps/web/app/studio/useStudioCommands.ts:26-191
- **What's happening:** Only metadata, nav, welcome, and hint copy is localized. Categories, options, commands, help, errors, save feedback, motion feedback, autocomplete, and accessible labels remain English.
- **Why it matters:** The default-Spanish workflow is mixed-language at every important customization and recovery step.
- **Recommendation:** Move all visible and accessible Studio copy into synchronized dictionaries. Keep command names, aliases, config values, URLs, and analytics identifiers untranslated.
- **Regression risk:** Locale changes must not erase config or history. Dictionary parity and stable command syntax must remain intact.
- **Expected impact:** Complete Spanish and English Studio journeys.
- **Effort estimate:** L

#### UX-H2 Both primary control modes have broken assistive-state semantics
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/studio/QuickControls.tsx:27-65, apps/web/app/studio/QuickControls.tsx:87-132, apps/web/styles/globals.css:528-542, apps/web/components/terminal/TerminalInput.tsx:116-139, apps/web/components/terminal/AutocompleteDropdown.tsx:41-79, apps/web/components/terminal/AutocompleteDropdown.tsx:94-125
- **What's happening:** Collapsed category option buttons remain in keyboard order because CSS only clips them. The main disclosure lacks expanded/control relationships. Terminal suggestions use a separate listbox, but the input exposes none of the ARIA combobox relationships or active option.
- **Why it matters:** Keyboard users encounter invisible controls, and screen-reader users cannot discover open panels or active suggestions.
- **Recommendation:** Remove collapsed options from interaction and the accessibility tree, add disclosure relationships, and implement the input/listbox as the ARIA combobox pattern.
- **Regression risk:** Preserve collapse motion, terminal history, and Arrow/Tab/Enter/Escape behavior.
- **Expected impact:** Predictable operation through both keyboard-first control modes.
- **Effort estimate:** M

#### UX-M1 The new preview footer can overflow narrow mobile cards
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [inference]
- **Files:** apps/web/app/studio/StudioClient.tsx:261-267, apps/web/app/studio/BadgePreviewCard.tsx:124-153, apps/web/app/studio/PreviewFooter.tsx:38-72, apps/web/lib/verification/hmac.ts:39-44, apps/web/app/studio/PreviewFooter.render.test.tsx:15-64
- **What's happening:** The platform pill and production host are both non-shrinking. The real verification line contains a 32-character hash with no wrapping or truncation. At 320–360px, card padding leaves too little width.
- **Why it matters:** Multi-platform branding and verification can overlap or be clipped.
- **Recommendation:** Stack or constrain branding at narrow widths, truncate the visual host with an accessible full value, wrap the hash separately, and add a 320px regression with four platforms and a real-length hash.
- **Regression risk:** Preserve platform order, full accessible values, and the desktop single-row composition.
- **Expected impact:** Legible parity footer on supported mobile widths.
- **Effort estimate:** S

## 12. Prioritized Action Plan

| ID | Domain | Title | Severity | Time Horizon | Effort | Impact |
| --- | --- | --- | --- | --- | --- | --- |
| AR-H1 | Architecture | Root scripts outside static gates | high | Before launch | M | Release-tool correctness |
| FE-H1 | Frontend | Cold cache fabricates zero metrics | high | Before launch | M | Truthful preview |
| FE-H2 | Frontend | Save lifecycle permits silent/overlapping failure | high | Before launch | M | Persistence trust |
| BE-H1 | Backend | Redis can expose uncommitted/stale config | high | Before launch | M | Durable consistency |
| UX-H1 | UX | Spanish workflow becomes English | high | Before launch | L | Locale completeness |
| UX-H2 | UX | Both controls have broken assistive state | high | Before launch | M | Accessibility |
| BE-M1 | Backend | Config read trusts unknown JSON | medium | Before launch | M | Data-boundary safety |
| PE-M1 | Performance | Unused trend reads on every Studio request | medium | Before launch | M | Tail latency |
| PE-M2 | Performance | Unbounded repeated default-config reads | medium | Before launch | M | Tail latency and load |
| DO-M1 | DevOps | Baseline lookup can choose wrong release | medium | Before launch | S | Correct rollback/diff |
| UX-M1 | UX | Footer can overflow mobile preview | medium | Before launch | S | Mobile parity |
| PE-M3 | Performance | Config edits remount full preview | medium | After launch | M | Interaction performance |
| AR-L1 | Architecture | Command metadata is stringly typed | low | After launch | S | Compile-time safety |
| AR-L2 | Architecture | Client imports server renderer metadata | low | After launch | S | Boundary safety |
| AR-S1 | Architecture | Toolchain majors need gate migration | strategic | Later | L | Future gate integrity |

## 13. Top 10 Highest-ROI Improvements

1. BE-H1 — Make Supabase commit precede any cache mutation.
2. FE-H1 — Add a live-fetch/no-side-effect Studio materialization path.
3. FE-H2 — Make every save outcome explicit and single-flight.
4. UX-H2 — Repair disclosure and combobox semantics.
5. UX-H1 — Complete Studio localization while keeping command syntax stable.
6. BE-M1 — Decode saved config at the persistence boundary.
7. DO-M1 — Bind release baseline and rollback to production identity.
8. UX-M1 — Add a narrow, real-data footer layout.
9. PE-M2 — Bound and negatively cache the no-config read path.
10. AR-H1 — Put release and production scripts under static gates.

## 14. Before Launch / After Launch / Later Strategic

### Before launch (Wave 1)

- AR-H1: Root operational scripts remain outside static quality gates
- FE-H1: Cold-cache Studio visits render fabricated zero metrics
- FE-H2: Save failures are not fully handled and duplicate saves can overlap
- BE-H1: Redis can expose an uncommitted or stale Studio configuration
- BE-M1: The config read boundary trusts unknown JSON and hides storage failures
- PE-M1: Studio verification loads unused trend state on every request
- PE-M2: Default-config users repeatedly hit unbounded Redis and Supabase reads
- DO-M1: An ancestry-based baseline lookup selects v2.22.0 instead of production v2.22.1
- UX-H1: The Spanish-default Studio becomes an English control surface after its welcome
- UX-H2: Both primary control modes have broken assistive-state semantics
- UX-M1: The new preview footer can overflow narrow mobile cards

### After launch (Wave 2)

- PE-M3: Every configuration change remounts the complete preview
- AR-L1: Studio command metadata remains stringly typed across the action boundary
- AR-L2: Client preview imports metadata from server SVG implementation modules

### Later / strategic (Wave 3)

- AR-S1: TypeScript and ESLint major upgrades need explicit gate migration

## 15. Open Questions / Assumptions

- The audit treats the feature flip as a launch boundary even though the application itself is already public.
- `v2.22.1` is the correct baseline because its annotated tag dereferences to current production `main`; this must be rechecked immediately before release preparation.
- The Phase 5 verification window is five minutes. A stale flag read during that TTL is retried and is not itself a rollback trigger.
- The old generated pre-launch report was replaced by this exact-candidate audit. The unrelated modified `docs/agents/qa-report.md` was not touched.

## 16. Final Verdict

- **Verdict: CONDITIONAL**
- **What would most worry you about shipping today?** The Studio could tell three conflicting stories at once: stale or fabricated preview data, an error response from Supabase, and a different cached config restored on reload.
- **What gives you confidence?** The security boundary is clean, the candidate is exact-SHA CI green, coverage is high, local Supabase contracts pass, and the findings are concentrated into narrow work units with explicit invariants.
- **Next 5 actions:** validate this report; approve the Wave 1 decomposition; remediate with TDD in an isolated worktree; rerun all candidate gates and exact-SHA CI; resume documentation and release preparation only after Wave 1 is green.
