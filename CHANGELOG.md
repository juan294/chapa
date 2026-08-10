# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.20.0] - 2026-08-10

### Added

- **Fail-closed E2E Pro release verification.** Release candidates now carry
  exact deployment identity through `/api/version`, a declared required-probe
  set, candidate-bound evidence, and an analyzer that refuses incomplete or
  mismatched production proof.
- **Production E2E operator playbook and command.** The release workflow now
  documents rehearsal, promotion, readback, rollback, and tag-last publication
  as one auditable path.

### Fixed

- **Campaign delivery retries are now atomic and replay-safe.** Workers claim a
  stable lease-bound batch, reuse provider idempotency keys across retries, and
  acknowledge the complete batch in one database operation. Partial or empty
  acknowledgements are rejected, while transient delivery failures are
  requeued without losing send identity or leaving a campaign stuck.
- **Server jobs now fail safely under overlap and partial persistence.** The
  warm-cache scheduler fills its fixed seat budget without duplicating work,
  and campaign processing releases or recovers claims when durable state cannot
  be confirmed.
- **GitHub statistics preserve the best observable dataset.** Server-token
  fetches are classified by their effective private-repository visibility,
  scope-blind user refreshes cannot outrank complete data, and in-flight/cache
  coordination no longer lets a weaker fetch replace a stronger one.
- Release probes run only in verification contexts, and Playwright no longer
  discovers unit-test files as browser tests.
- CI uses the repository-pinned Knip version, while async UI tests now wait for
  teardown work instead of leaking unhandled activity between cases.
- Security-triage findings were remediated and compatible dependency updates
  were applied without widening the release scope, including patched floors for
  `dompurify`, `js-yaml`, `nanoid`, `brace-expansion`, and `undici`.

### Changed

- Release and agent workflows are synchronized with cc-rpi v1.28.2, including
  lower-cost model routing for mechanical automation.

## [2.19.1] - 2026-07-18

### Fixed

- **`heal-poisoned-stats` can now detect the #1045 corruption shape (#1049).** The
  script's detection — and the persist-boundary gate — keyed only on
  `prsMergedCount === 0`, the #1002-era signature. #1004's token-scoped search replaced
  that zero with a plausible positive count (140 of 987), which disarmed the repair tool
  for the same reason it disarmed the guard: three poisoned snapshot rows persisted and
  were undetectable. A new `isScopeBlindedStats` predicate catches the positive-count
  shape via a provable bound (a full PR sample of *n* nodes cannot weigh less than
  0.169·*n*, so weight below 0.15·*n* proves node truncation) corroborated by a
  lines-per-PR impossibility check. Snapshot-row selection moved from a SQL-side zero
  filter into the same shared TS predicates (single source of truth), rows are deleted by
  an exact reviewed date list, and `statsLookComplete` now gates both shapes so this can
  never persist again. Also corrected the script's inverted healing note (post-#1050 the
  `repo`-scoped server token is the healer, not the user's session token). The dry run
  itself caught one more bug before touching data: `metrics_snapshots`' real column is
  `issues_closed`, not `issues_closed_count`.

- **`warm-cache`'s priority-handle ceiling could be silently bypassed.**
  `WARM_CACHE_PRIORITY_HANDLES` entries were merged into the per-run warm list *after* the
  `MAX_HANDLES` (50) rotation slice, so real per-run GitHub-call volume could reach
  `min(N, 50) + |priority handles|` instead of staying capped — a live risk once the cron
  went hourly (#1010). Fixed by reserving priority handles a seat *within* the ceiling:
  `rotationCeiling = MAX_HANDLES - priorityHandles.length` now sizes the rotation slice,
  wrap-around, and next-offset calculation, so total per-run work never exceeds 50
  regardless of how many priority handles are configured.

- **`dbGetCampaignStats` cut from 4 round trips to 1.** The campaign-send-status aggregate
  previously ran 4 parallel `COUNT` queries (one per status); it now fetches the `status`
  column once and reduces counts in JS via the existing `isCampaignSendStatus` guard — same
  result, a quarter of the database round trips on the `process-campaigns` cron's hot path.

## [2.19.0] - 2026-07-16

### Fixed

- **All four cron jobs had never run — not once, since the project was created (#1052).**
  The Vercel project's Root Directory is `apps/web`, and Vercel resolves `vercel.json`
  relative to it. The file lived at the repository root, so it was never read.

  Nothing failed. There is no error for configuration that is simply never loaded: it
  looked correct in review, in git, and in a passing test. Confirmed two ways —
  `/api/health` reported `lastRun: null` for all four heartbeats despite a 48h write TTL
  and an hourly schedule, and Vercel's dashboard showed the "Get Started with Cron Jobs"
  onboarding, which only renders for a project with **zero** registered crons (feature
  Enabled, team on Pro, so neither gating applied).

  Never ran: `warm-cache` (hourly), `sync-audience`, `process-campaigns`, `latency-check`.
  The `functions` block was ignored on the same grounds, including the `maxDuration: 300`
  that #942 documented as a Pro requirement. Several past commits were silent no-ops —
  `b24d9033` ("bump warm-cache cron from daily to hourly") changed nothing at all.

  This explains more than the crons: `warm-cache` is what re-fetches stats with the
  `repo`-scoped server token, so with it dead the badge cache was only ever populated by
  whichever request arrived first after a TTL expiry. The self-healing mechanism the
  caching design assumes did not exist in production — which is why the #1045 poisoning
  sat there for three days. The #974/#1018 badge latency SLO monitor has likewise never
  fired once.

  `vercel.json` now lives at `apps/web/vercel.json` (contents unchanged; its paths were
  already relative to `apps/web`). A new CI gate, `pnpm run check:vercel-config`, asserts
  the *location* — the part a contents test structurally cannot cover — plus that every
  `crons[].path` maps to a route file and every `functions` key matches a real file. See
  `docs/decisions/2026-07-16-vercel-json-must-live-in-root-directory.md`.

- **A user's own refresh was corrupting their own score, and the cache preferred the
  corrupt result (#1050).** `fetchScope` was assigned from token *presence* rather than
  from what the token could *see*:

  | path | token actually used | sees | was labelled |
  |---|---|---|---|
  | anonymous badge hit | server `GITHUB_TOKEN` (**has `repo`**) | **987 PRs** | `"public"` (rank 1) |
  | user's own refresh | session OAuth token (**no `repo`**) | **140 PRs** | `"authenticated"` (rank 2) |

  Since `scopeRank` ranks authenticated above public, the blinded fetch outranked and
  overwrote the complete one. #1004's non-downgrading rule was not merely bypassed — it
  was pointed backwards, actively preferring the corrupt data. Clicking Refresh collapsed
  the user's own Delivery 100 → 58.

  `fetchScope` now means "was this fetch private-inclusive?", derived from the same
  `OAUTH_SCOPES` constant the login URL uses, so adding `repo` to the OAuth app would
  update the pipeline's trust in session tokens in the same edit. This also makes
  `isDegradedPrFetch`'s #1045 shortfall check fire on exactly the refresh path that
  caused the corruption, where previously it could never fire at all.

- **`/api/health` now asserts the server token still carries `repo` scope (#1047),**
  returning `insufficient_scope` if not. The `fetchScope` logic above depends on that
  capability, and a token rotated without `repo` would silently blind every badge — a
  scope-blind token is a perfectly valid token and raises no error. A missing
  `x-oauth-scopes` header (fine-grained PAT / App token) is not treated as insufficient.

- **The missing-heartbeat grace window is restored, anchored durably (#1052).** A
  freshly-registered daily cron legitimately has no heartbeat for ~24h, and degrading then
  would report a fix as an outage. The anchor (`cron:health:first-seen`) lives in Redis, so
  unlike the `PROCESS_STARTED_AT` version removed in 2.18.1 — which could never elapse on
  serverless — this window genuinely expires and the check can still fail.

### Added

- `pnpm run check:vercel-config` CI gate (#1052), wired into `Lint & Typecheck`.

### Known issues

- **#1049** — poisoned snapshots for the affected handle (2026-07-14 → 07-16) are not yet
  healed. Healing is safe only once this release is deployed; before that, the next refresh
  would re-poison them.
- The OAuth app still requests no `repo` scope. Asking every user for full private-repo
  access to render a badge is a product decision, not a bug fix. This release makes the
  pipeline correct under the current, narrower scopes.

## [2.18.1] - 2026-07-16

### Fixed

- **Scoring integrity: re-armed the degraded-fetch guards that #1004 disarmed (#1045, #1046).**
  A scope-blinded GitHub fetch was being scored, cached, and persisted, collapsing an
  affected profile's Delivery from 100 to 58 and composite from 79 to 68 while
  `stats:stale` still held the correct data.

  #1004 was built on the premise that `search(is:merged)` is not token-scoped and could
  serve as an authoritative cross-check against the token-scoped `pullRequestContributions`
  sample. That premise is false — GitHub search returns only what the authenticating token
  can see (verified: 987 merged PRs authenticated vs 140 anonymous for the same user).
  Because every guard triggered only on `prsMergedCount === 0`, sourcing that count from
  search replaced the 0 with a plausible-but-wrong positive number and made the trigger
  unreachable. Nothing validated `linesAdded` (59 across 140 merged PRs), `linesDeleted`,
  or `prsMergedWeight` — which is 70% of Delivery.

  - `isDegradedPrFetch` now flags a lower-scoped fetch reporting a disproportionate
    shortfall against a better-scoped baseline, not only a collapse to exactly zero. Gated
    on crossing a scope boundary so an equally-scoped decline (real window eviction) still
    writes through.
  - `assessRawFetchIntegrity` now rejects a sample returning far fewer nodes than its own
    `totalCount` claims — the shape scope loss actually produces, since PR objects come back
    null for unreadable repos and are filtered while `totalCount` keeps counting them. Keyed
    on the payload's internal shape, so it needs no baseline and catches a handle's first
    degraded fetch.
  - The non-downgrading cache write rule now judges against `stats:stale` (the durable
    record of the best scope seen) instead of a primary key that `getStats` has already
    proven is a miss — which made the check a no-op on every non-racing call.
  - Corrected the "not token-scoped" comments that encoded the false premise.

  Guards remain strictly good-to-bad: an improving fetch always writes through, so a
  well-scoped fetch heals the data and it sticks.

- **Health: a missing cron heartbeat is now reported as stale (#1047).** The previous grace
  window was measured from process start; on serverless every cold start reloads the module,
  so a lambda never survived the 2h grace and the null branch — the most degraded state a
  cron has — was the one state the check could never report.

  **Operational note:** `/api/health` will begin returning `503 degraded` immediately after
  this deploy, because all four cron heartbeats are currently null and null is now correctly
  stale. This is accurate reporting of a pre-existing condition, not a regression. The
  underlying cause (why the crons record no heartbeat) remains under investigation in #1047.
  `CHAPA_ALERT_WEBHOOK_URL` is unconfigured, so this surfaces in the endpoint only.

- Closed coverage gaps from overnight triage: `KeyboardShortcutsListener` next/dynamic loader,
  `lib/github/stats.ts` `fetchStats` error closure, admin campaigns `?type=` branch (#1006).

### Changed

- Pinned `knip` at 6.27.0 and bumped `vite` 8.1.4 to 8.1.5 (devDependencies only).
- Synced agent reports and shared context from the overnight triage cycle.

### Known issues

- **#1050 — OAuth login lacks `repo` scope.** A user's own refresh sees only their public
  PRs and `fetchScope` labels that blinded fetch as `"authenticated"`, letting it outrank
  complete server-token data. In this release only `assessRawFetchIntegrity`'s sample check
  covers that path. Unresolved; needs a design decision.
- **#1049 — poisoned snapshots** for the affected handle (2026-07-14 to 07-16) are not yet
  healed; healing is deferred until #1050 lands.

## [2.18.0] - 2026-07-15

### Added
- **Locale-segmented content pages (#1023)**: the 9 public content pages (`/`, `/about`, `/about/scoring`, `/about/verification`, `/privacy`, `/terms`, 7 archetype pages) are now real React Server Components under `app/[locale]/...`, translated server-side via `getServerT(locale)` instead of a whole-page `"use client"` wrapper. A new, narrowly-scoped `apps/web/proxy.ts` (Next.js 16 renamed `middleware.ts` → `proxy.ts`) rewrites the canonical unprefixed URL to the internal locale route; both `en`/`es` variants are pre-rendered at build time, eliminating the locale-flash bug with no client-side re-render. See `docs/decisions/2026-07-15-i18n-middleware-carve-out.md` for the scope rationale (an intentional, narrow carve-out from the 2026-07-08 no-middleware ADR).
- **Badge latency SLO + `Server-Timing` header (#974)**: the badge route now carries a `Server-Timing` header (`cache;desc="hit"` on warm hits, `materialize`/`render` breakdown on cold misses, always a `total`), enforced against an 800ms cache-hit / 3000ms cache-miss p95 budget. A new daily `/api/cron/latency-check` synthetic monitor times the live endpoint and raises a P2 `badge_latency_slo_breach` alert on breach or probe failure; its own heartbeat is now monitored by `/api/health` (#1018).
- **Reconciliation alert on partial snapshot writes**: `reconcileSnapshotWrite` (`lib/profile/snapshot-write.ts`) wraps the Supabase `metrics_snapshots` write and its Redis mirror as one saga — if Supabase commits but the Redis write fails, a structured P2 operational alert fires instead of silently leaving the two stores diverged. Suppressed when Redis is unconfigured. Now tracks a tri-state write outcome (`inserted`/`duplicate`/`failed`, #1015/#1016) so a benign same-day duplicate still gets an opportunistic cache refresh instead of being treated as a failure, and the public badge path now escalates a genuine failure via `captureServerError` instead of silently discarding it (#1009).
- **CI vulnerability and license gates replaced**: `pnpm audit` scanned zero packages (npm retired its legacy audit endpoint) — replaced with `osv-scanner` (`scripts/check-vulnerabilities.ts`, `pnpm run check:vulnerabilities`), gated to fail only on HIGH/CRITICAL vulnerabilities with a published fix (#1008). The license-compliance check was a 3-item GPL/AGPL denylist that missed most non-allowlisted licenses (and, due to pnpm's symlinked layout, only ever scanned ~16 of ~90 production packages) — replaced with an explicit MIT/Apache-2.0/BSD/ISC/0BSD/CC0-1.0 allowlist (`scripts/check-licenses.ts`, `pnpm run check:licenses`) with documented per-package exceptions (#1012).
- **CI gate for pending Supabase migrations (#1011)**: a new `pending-migrations-check` job (`scripts/check-pending-migrations.ts`, `pnpm run check:pending-migrations`) runs on PRs targeting `main` and fails if the linked production project has schema drift from what's in `supabase/migrations/`.

### Fixed
- **Fail-closed rate limiting on session/refresh routes**: `/api/auth/session` and `/api/refresh` now fail closed on a Redis outage instead of fail-open, tightening two auth-critical routes while public badge reads keep the documented fail-open behavior.
- **Fail-closed rate limiting + replay-resistant nonce on platform OAuth (#1027)**: Bitbucket/Codeberg/GitLab connect/callback/disconnect now use `rateLimitStrict` (fail-closed) instead of fail-open, matching the existing session/refresh policy, and share GitHub's single-use state-consume nonce (via a new per-platform `chapa_<provider>_oauth_state_store` cookie) so a captured `state` value can't be replayed.
- **Badge route latency fixes against the SLO budget**: the durable Supabase snapshot write no longer blocks the response (moved into `after()`, #1013); the SVG cache read deadline was raised 250ms→500ms so Redis tail latency no longer misclassifies a cache-hit as a miss (#1014); the render-lock loser's poll budget was shortened from ~2000ms to ~950ms so a concurrent cold-handle request can't burn its full poll time and still exceed the cache-miss budget (#1029); the avatar fetch is now capped at 1000ms and skips the shared SVG cache write on timeout so a placeholder avatar can't poison the 24h cache (#1029/PE-L1).
- **Warm-cache cron bumped from daily to hourly (#1010)**: at the previous 50-handle/run daily ceiling, users beyond the ceiling could go days between proactive cache warms and lifetime-history snapshots; hourly cadence (same per-run ceiling) shrinks that gap ~24x while staying well within GitHub's rate-limit budget.
- **`?lang=` deep link now applies the locale on the current page load (#1020)**: previously it only wrote the `chapa-locale` cookie for a *future* load; a shared `/handle?lang=en` link showed the wrong language until a manual reload.
- **5 hardcoded-English error boundaries translated (#1022)**: `studio`, `verify`, `generating`, `experiments`, and `admin` error boundaries now use `useTranslation()` like the rest of the app; `verify/error.tsx` also switched from brand-amber to the verification flow's teal tokens.
- **Tooltip portal-rendering fixes (#1021/#1040)**: `HeatmapGrid`'s cell tooltip (used in the interactive badge and Studio preview) now portals to `document.body` with viewport-fixed positioning and a top-of-viewport auto-flip, matching the pattern already used elsewhere; `BadgeOverlay`'s z-index was corrected; `InfoTooltip` gained the same auto-flip. Dimension/intensity colors for these components were consolidated into one shared `lib/utils/dimension-colors.ts` module.
- **`Navbar`/`NavbarClient` consolidated (#1025)**: the two independently-drifting implementations (including divergent admin-status computation) now share one `NavbarShell` presentational component; a reserved-width loading placeholder removes the login-link flash on ISR pages.
- **`/api/challenge` email failures now captured (#1030)**: a Resend outage previously dropped score-dispute emails with only a `console.error`; now escalated via `captureServerError` while keeping the existing 200 response (email remains best-effort).
- **`/api/cron/process-campaigns` no longer starves concurrent campaigns (#1035)**: previously processed only the first active campaign per run; now round-robins across all active campaigns within the time/quota budget.
- **`no-process-env` ESLint rule broadened (#1017)**: previously only caught `process.env.X` member access; now also catches a bare `process.env` spread/reference (e.g. `{ ...process.env }`), with a documented exception for the one legitimate child-process-env-passthrough site.
- **Supplemental stats validation hardening**: added non-negative/magnitude caps to `medianPrLeadTimeHours` and `primaryReviewsSubmittedCount`, and corrected the `optionalRatios` allowlist from stale field names to the real fields that feed scoring (`batchSizeScore`, `prDescriptionRate`, `featureBranchRate`, `issueLinkageRate`).
- **Health check now probes `metrics_snapshots` instead of `users`**: mirrors the actual hot-path read shape so an RLS misconfiguration scoped to `metrics_snapshots` is caught.
- **Landing page (`/`) made statically renderable**: split into a `force-static` wrapper + client-side translated body, restoring ISR-cacheability without breaking locale switching.
- **Bounded refetch churn on total GitHub fetch failure**: a sustained GitHub outage with stale data present now re-caches the stale data into the primary key instead of forcing a refetch on every request.
- **`sitemap.ts` omitted the Artificer archetype page (#1041)**: `/archetypes/artificer` existed and was linked in-app but was missing from the `ARCHETYPES` array powering `sitemap.xml`, so it was never discovered via search-engine crawl.
- **Navbar login link + logo cursor failed WCAG AA contrast in light theme (#1043)**: the login link's `text-terminal-dim` (2.53:1) is now `text-text-secondary` (4.84:1), with padding added so its touch target meets the 24×24px minimum; the logo's blinking cursor glyph moved from `text-amber` (4.23:1) to `text-amber-dark` (5.70:1).

### Changed
- **Shared `buildStatsFrom*` PR-metrics pipeline**: the previously copy-pasted PR-metrics aggregation across Bitbucket/GitLab/Codeberg was folded into `computePlatformStats`, with a new cross-platform parity test.
- **GitHub stats aggregation now covered by the cross-platform parity test (#1024)**: the burst-spike detection threshold (`30`) is now a single shared `DAILY_COMMIT_SPIKE_THRESHOLD` constant instead of being hardcoded separately in GitHub's own aggregation path and the shared platform-stats skeleton; the parity test now includes a GitHub fixture.
- **Typed i18n accessors completed (#1026)**: finished migrating the remaining unchecked `t() as string[]` casts (landing, privacy, terms, about, verification, scoring, archetype pages) to `tArray`/`tObject`; added an ESLint guard forbidding the unchecked pattern going forward.
- **Per-module coverage floors (#1028)**: `apps/web/lib/impact/**` and `apps/web/lib/github/stats-integrity.ts` now have coverage floors well above the global gate (95/90/95/95 and 90/85/90/90 respectively), so a regression that strips tests from the scoring pipeline or the degraded-fetch guard can no longer pass CI on the strength of the rest of the codebase's coverage.
- **Exact solo/collaborative threshold test (#1032)**: `detectProfileType`'s behavior is now pinned exactly at `SOLO_REVIEW_RATIO_THRESHOLD` (0.15), not just well above/below it.
- **Local contract-test preflight script (#1036)**: `pnpm run test:contract:local` mirrors CI's Supabase-env wiring so the contract suite can be run locally without a cryptic env-var error.
- **`knip.json` cleanup (#1033)**: removed several `ignoreDependencies`/`ignore` entries knip can now resolve on its own.
- **Dev-dependency bump (#1037)**: `vitest`/`@vitest/coverage-v8` 4.1.8→4.1.10 (kept version-locked), `tsx` 4.22.4→4.23.1, `vite` 8.0.16→8.1.4.
- **CI pipeline sharding (#1007)**: build no longer waits on the full test suite; unit/coverage and E2E suites each run as two shards with an aggregator gate, cutting the critical path from ~11m toward ~4.5–5m.

### Docs
- New ADR documenting the decision to gate `/studio`, `/admin`, and `/cli/authorize` inline per-page rather than via a global `middleware.ts`, plus a 2026-07-15 addendum documenting the narrow, deliberate carve-out for the locale-segmented content-page proxy (#1023).
- New "Reversing a Migration" runbook section (forward-only migrations, paired reverse-script requirement for destructive changes, expand-migrate-contract pattern) and `CREATE INDEX CONCURRENTLY` guidance for populated tables (#1019/#1031).
- Five new formally-documented accepted risks: axe-core's MPL-2.0 license and GitHub Advanced Security unavailable on this repo's tier (from the prior cycle); CC-BY-4.0 (`caniuse-lite`), Unlicense (`fast-sha256`), and MIT-0 (`postal-mime`) transitive-dependency licenses, and the stateless session cookie's lack of server-side revocation (#1012/#1038).

## [2.17.0] - 2026-07-08

### Added
- **Scoring-data integrity contract (#1004)**: a durable, three-boundary defense that ends the recurring "a degraded GitHub fetch collapses a user's score" class of bug (previously patched piecemeal by #826/#930/#1001/#1002 and the 2026-03-31 OAuth fix). (1) **Fetch boundary** — an authoritative `search(is:merged)` merged-PR count plus `assessRawFetchIntegrity` rejects a structurally-valid-but-degraded payload (e.g. empty PR nodes while `search` reports merged PRs) at the source, before it can be scored, cached, or persisted — and it needs no prior baseline. (2) **Cache boundary** — scope-aware, non-downgrading writes so a public/cron `GITHUB_TOKEN` fetch can never clobber a user's authenticated (private-inclusive) data, and `stats:stale` only ever holds complete data. (3) **Persist boundary** — snapshot history and the HMAC verification record are gated on stats completeness, so corruption is never written to permanent history or attested. A real-pipeline regression contract test fails the build if the class regresses; `stats_fetch_rejected` / `snapshot_skipped_incomplete_stats` telemetry surface degradation in production.
- **`heal-poisoned-stats` maintenance script**: repairs already-poisoned cache keys and corrupt snapshot rows for affected handles (dry-run by default, `--apply` to purge).

### Fixed
- **Delivery collapse for private-heavy users (#1004)**: the authoritative merged-PR count resolves the intermittent `prsMergedCount: 0` → Delivery ≈ 30 collapse (and solo→collaborative flip) that a token-scoped or partial `contributionsCollection` fetch could produce; affected profiles recover to their true Delivery once a healthy fetch lands, and can no longer be re-poisoned by a lower-scope fetch.

## [2.16.1] - 2026-07-07

### Fixed
- **Delivery score collapse from partial GitHub fetches (#1002)**: a token-scoped GitHub `contributionsCollection` fetch that could not see a user's private-repo merges returned `prsMergedCount: 0`, collapsing the Delivery dimension (70% PR-weighted) and flipping the profile to "collaborative". A new `isDegradedPrFetch` guard (`apps/web/lib/github/stats-integrity.ts`) now detects this collapse and serves last-known-good instead of caching the zero — preserving the `stats:stale` fallback and emitting a `github_degraded_pr_fetch` telemetry event. The data self-heals on the next authenticated fetch.
- **Headline score inconsistent with dimensions (#1001)**: the displayed composite was EMA-smoothed while the dimensions shown beside it were recomputed fresh, so a real dimension change (e.g. Delivery dropping) appeared on the radar immediately while the headline lagged for days. The live headline is now the fresh score — always reconcilable with the dimensions — and EMA smoothing is retained only for the persisted history/trend snapshot.
- **Admin user search returning zero results (#1003)**: the admin users search AND-combined its handle and display-name filters, so a handle-only match with a null or non-matching display name returned no rows. Restored OR semantics via a sanitized `.or(...)` filter, guarded by a real-Postgres contract test.

## [2.16.0] - 2026-07-06

### Added
- **Reliability hardening (#987–#992)**: real-stack contract test coverage, write-route registration checks, DB-backed journey E2E tests, persistence fail-closed fixes, and cron/client-error canaries, plus reliability process documentation

### Fixed
- **Admin Users tab rate limiting (#993)**: the Users tab tripped "Too many requests" during normal use — search input now debounces (400ms) instead of firing a fetch per keystroke, and the endpoint's rate limit was raised from 10 to 30 requests/60s to give headroom for legitimate pagination/sort/search
- **Score challenge rate limiting (#976)**: `/api/challenge`'s IP and handle rate limiters switched from fail-open to fail-closed, closing a gap carried across several triage cycles
- **Landing page locale switching**: restored `getServerLocale()` after an earlier ISR optimization silently broke locale switching — the page body stayed in Spanish regardless of the selected language
- **Center nav labels locale bug (#979)**: nav labels in `NavbarClient` now derive from the active locale instead of a stale value
- **Contract & reliability CI stabilized**: contract suite now runs on Node 24; flaky reliability CI checks hardened

### Changed
- Migrated the Claude Code Review workflow and RPI commands to Sonnet 5
- Synced with cc-rpi blueprint v1.25.0
- Documented the detect-don't-mask rationale for NOT-NULL numeric snapshot columns

62 new tests since v2.15.0; total test count: 8,174 across 477 files.

## [2.15.0] - 2026-06-25

### Added
- **Score challenge flow (#933)**: users can dispute their computed Impact score via a structured challenge form; challenges are recorded and trigger a manual re-review workflow
- **Score transparency panel (#932)**: share page shows a detailed breakdown of how the composite score was calculated, with per-dimension contribution weights and confidence notes
- **Supabase backing store for studio config (#935)**: badge customisation config is now durably stored in Supabase (`studio_configs` table) with Redis as a hot read cache; config survives Redis eviction
- **Fail-closed rate limiting for auth and write routes (#954)**: `rateLimitStrict()` blocks requests when Redis is unavailable on sensitive paths (`/api/auth/callback`, `/api/supplemental`, `/api/insights`); public badge routes remain fail-open
- **Cross-platform aggregation helper (#947)**: `computePlatformStats()` extracted to `packages/shared` and shared across Bitbucket, Codeberg, and GitLab stat builders; parity test added
- **Input validation on admin routes (#951)**: Zod schemas validate all `POST /api/admin/feature-flags` and `POST /api/admin/campaigns` request bodies; invalid payloads return structured 400 errors
- **Health endpoint alertWebhook status (#943)**: `/api/health` response includes `alertWebhook: "configured" | "skipped"` so operators can verify the alert webhook is wired up
- **`no-restricted-imports` ESLint rule (#948)**: relative imports from `packages/shared` are banned; the `@chapa/shared` workspace alias is the only permitted path

### Fixed
- **Avatar fetch timeout (#961)**: reduced from 5 s to 2 s to prevent slow avatar CDNs from blocking badge renders
- **Landing page static rendering (#945)**: `getServerLocale()` removed from the root page; the landing page now renders statically at `DEFAULT_LOCALE` and is fully CDN-cacheable
- **i18n: dimension tooltip copy (#937)**: dimension `tip` strings moved into the i18n dictionaries so they are translatable; hardcoded English copy removed from `DimensionCard`
- **i18n: avatar alt text (#939)**: `aria.avatarAlt` key added; avatar `alt` attributes across `AdminUserTable`, `UserMenu`, and `BadgeContent` now use translated strings
- **i18n: experiment page aria-labels (#957)**: `aria.impactScoreValue` and `aria.impactScoreTier` keys added; number-counters and metallic-shimmer experiment pages use `useTranslation` instead of hardcoded English
- **i18n: aria-label templates (#938)**: `aria.dimensionScore`, `aria.dimensionLabel`, `aria.dimensionBreakdown`, `aria.impactScore` keys added; `ImpactBreakdown` and `SubMetricPanel` use translated strings
- **Supplemental dual-write failures surfaced (#936)**: `/api/supplemental` now inspects `Promise.all` results and returns 500 when the Supabase write fails; previously silent DB failures were swallowed
- **Admin bulk-recalculate deduplication (#952)**: pending-handles computation uses a `Set` to avoid processing the same handle twice when it appears in both active and provided lists
- **CLI auth device-code window shortened (#953)**: unconfirmed device sessions expire after 1 minute instead of 5; a TODO comment marks the legacy no-device-code path for removal in v2.16
- **Bundle size CI budget (#940)**: `bundle-size.yml` and `CLAUDE.md` now consistently enforce the 350 KB/chunk limit; the stale 500 KB figure is removed
- **Vercel cron maxDuration (#942)**: `vercel.json` declares `maxDuration: 300` for the three cron routes; the release checklist documents that this requires Vercel Pro
- **Validation numeric range caps (#950)**: `isValidStatsShape` caps 12 numeric fields (e.g. `totalCommits ≤ 100 000`, `stars ≤ 1 000 000`) to reject implausibly large supplemental payloads
- **CSP unsafe-inline documented (#959)**: `docs/accepted-risks.md` and `next.config.ts` comment explain the `unsafe-inline` script policy and reference issue #959
- **`posthog-js` import optimisation (#959)**: `optimizePackageImports` hint added to `next.config.ts` so Next.js tree-shakes the PostHog bundle more aggressively

### Changed
- **Pre-deploy migration runbook (#941)**: `docs/runbooks/migrations.md` documents the required pre-deploy migration check so database schema is always in sync before a release
- 126 new tests; total test count: 8,112 across 473 files

## [2.14.0] - 2026-06-24

### Added
- **Release-candidate deployment gates**: release runbooks now require strict smoke tests against the exact preview URL and commit SHA, with Redis, Supabase, and GitHub health dependencies all reporting `ok`
- **Supplemental upload payload guard**: `/api/supplemental` rejects oversized request bodies before JSON parsing

### Fixed
- **Static public content locale rendering**: `/about`, `/about/scoring`, `/about/verification`, `/privacy`, `/terms`, `/verify`, and `/archetypes/*` remain statically generated while visible copy hydrates from the active client locale
- **Navbar first paint**: localized server-provided navigation labels are preserved on initial render
- **Admin bulk recalculation freshness**: recalculation now invalidates public read models, badge SVG cache, snapshots, history, and share-page ISR after writes; cursor pagination is sorted and deduplicated
- **Supplemental upload hardening**: IP rate limiting and auth resolution run before JSON parsing, reducing unauthenticated parsing work

### Changed
- **Vercel release validation**: preview deployments are no longer skipped for non-production branches, enabling release-candidate smoke testing before merge
- **License compliance**: CI now scans `apps/web` production dependencies
- **Deployment smoke**: strict smoke now requires Redis, Supabase, and GitHub health checks to report `ok` rather than accepting skipped dependencies
- 19 new tests; total test count: 7,986 across 464 files

## [2.13.0] - 2026-06-23

### Added
- **Progressive disclosure on share page (#783)**: badge value is shown as a clear score + tier headline by default; the radar chart and dimension breakdown are revealed behind a "View full profile" hint, reducing first-load cognitive load
- **Landing page UX (#770 #781)**: CTA button shows a loading spinner during navigation; enterprise-row accent colors are varied per card for visual rhythm
- **Delete-user tool (#927)**: `pnpm run delete-user <handle>` dry-runs then wipes all Supabase rows and Redis keys for a handle — useful for resetting test accounts or honouring deletion requests. Also available as `/delete-user` skill

### Fixed
- **GitLab scores always 0 for active users (#928)**: the per-MR diffstat loop and five independent top-level fetches (events, MRs, reviews, issues, projects) were sequential, blowing past the 8 s outer deadline. GitLab activity was silently dropped from the merge and a 0 score was cached. All fetches now run concurrently via `Promise.all`
- **Language picker active locale (#918 region)**: the locale switcher showed the wrong active locale when page content was statically rendered at the default locale
- **NEXT_PUBLIC env flags (#918)**: flags read via static `process.env.NEXT_PUBLIC_*` literals so Next.js inlines them at build time; dynamic access prevented client-side env reads from resolving
- **Landing nav links**: NavbarClient section links were broken after the ISR/static-render refactor (#861)

### Changed
- **Unified platform fetch stack (#744)**: Bitbucket, Codeberg, and GitLab share a single `fetchLinkedPlatformStats` skeleton (positive cache → negative cache → feature flag → DB link → token refresh → fetch → cache write); per-platform divergence expressed through callbacks only
- **`StatsData` defaults via `normalizeStats`**: all platform stat builders go through a single normalisation pass, eliminating scattered field defaults and ensuring consistent shape
- **Frontend consolidation (#745 #756 #774 #780 #516)**: shared icon components, `createModuleStore` hook factory, experiment sub-components extracted from large pages, `rounded-lg` fix applied uniformly
- **Non-production Vercel builds skipped**: preview deployments on non-develop/main branches are cancelled early to save build minutes
- **CI**: Lighthouse audit enforced on `/u/:handle`; bundle-size SIGPIPE flake fixed (`sort|awk` instead of `sort|head`); GitHub Security & Quality Alerts scanning added to triage workflow
- 377 new tests; total test count: 7,967 across 463 files

## [2.12.0] - 2026-06-23

Pre-launch hardening and release readiness.

## [2.11.0] - 2026-06-19

### Added
- **GitLab as a connectable source (#855)**: link gitlab.com accounts (OAuth connect / callback / disconnect / status via the shared platform factory); GitLab MR, commit, and review data merge into Impact v6 scoring; GitLab logo appears in badge branding for connected users. New env vars `GITLAB_CLIENT_ID`, `GITLAB_CLIENT_SECRET`, `NEXT_PUBLIC_GITLAB_ENABLED`; migration `026_seed_integration_flags.sql` seeds the integration feature-flag rows (DB value overrides env)
- **CLI device-code binding (#869)**: `/api/cli/auth/poll` issues an RFC 8628-style `device_code` on the first poll and binds the session to the initiating device; fully backward-compatible with existing CLI binaries (legacy clients that don't echo it keep working)
- **CI gates**: per-route bundle-size budget (`scripts/check-bundle-size.sh`), Vitest coverage thresholds, madge circular-dependency check, a `no-process-env` ESLint rule (env access funneled through `lib/env.ts`), and a `packages/shared` import boundary
- **Operational alerting**: warm-cache cron emits P2 alerts on high handle-failure rate (#751) and when the per-run handle ceiling is approached (#773)

### Fixed
- **Score integrity (#859)**: GitLab/Bitbucket/Codeberg pagination now treats `429`/`5xx` mid-fetch as a failure (falls back to cached data) instead of caching truncated results as a successful empty response
- **Auth hardening**: structural bearer-token pre-check stops GitHub-API amplification via bogus tokens (#860); supplemental ownership check runs before the rate-limit increment (#890); IP rate-limiting precedes auth resolution on `/api/recalculate` and `/api/insights`; `getClientIp` fails safe instead of collapsing headerless requests into one bucket (#868); centralized handle-ownership gate (#896); session cookies carry an `iat` and expire server-side (#889)
- **Performance**: badge and OG routes read the response cache before rate-limiting (#882, #775); render-lock losers serve a stale badge immediately instead of polling (#757); enriched login stats are backfilled into the cache (#761); badge fonts load once at module scope (#893); per-handle cache TTL jitter spreads the UTC-midnight recompute (#776); webhook dedup uses an atomic set-if-absent status (#887)
- **i18n leaks**: archetype "Dominant dimension" label (#864), share-page social metadata (#865), public dashboard aria-labels (#866), verify page (#876), 404 page (#877), scoring CTA (#878), Studio (#769), and the mixed-language archetype connector (#875) are now localized
- **Content pages** (`/`, `/about*`, `/archetypes/*`, `/privacy`, `/terms`, `/verify`) are now statically rendered / ISR and CDN-cacheable instead of `force-dynamic` (#861, #874)

### Changed
- **i18n client payload roughly halved (#862)**: only the active locale's dictionary ships in the client bundle; the other locale is loaded on demand. The root layout renders statically at `DEFAULT_LOCALE`, with the user's locale applied client-side from the cookie
- `lib/db/campaigns.ts` split by responsibility (crud / sends / types); sync feature-flag helpers extracted to `lib/feature-flags-sync.ts`
- External-platform reads use bounded, jittered retries; upstream error bodies are truncated and sanitized in logs
- `.worktrees/` excluded from TypeScript / ESLint / build scope

### Security
- Forced `undici >= 7.28.0` via pnpm override, resolving transitive advisories pulled in through `jsdom` (#863)
- Gitleaks GitHub Action upgraded to v3

## [2.10.0] - 2026-05-03

### Added
- **Full i18n system** (#837): Chapa now supports English and Spanish across every public page. Includes structured locale dictionaries (`en.ts` / `es.ts`, 650+ keys each), cookie-based locale persistence (`chapa-locale`), `Accept-Language` header detection, `useTranslation()` client hook, `getServerT(locale)` server helper, `interpolate()` placeholder substitution, and `LangSync` / `LocaleSync` utilities
- **`LanguageSwitcher` component**: Globe-icon dropdown in the navbar (between ThemeToggle and login CTA). Shows `ES | EN` pill — active locale highlighted in amber; choice persists across page loads
- **Shared `ArchetypePage` component** (`app/archetypes/_components/ArchetypePage.tsx`): All 7 archetype guide pages consolidated into one locale-aware component, eliminating duplication
- **Dictionary parity test** (`lib/i18n/dictionaries/parity.test.ts`): CI enforces identical key structure between `en.ts` and `es.ts`

### Fixed
- **`DEFAULT_LOCALE` set to `'es'`**: Server renders Spanish by default, matching the project language policy
- **`resolveTranslation` sub-tree access**: Intermediate key paths now return the sub-tree rather than `undefined`
- **Turbopack build**: Removed server-only exports (`server.ts`, `cookie.ts`) from the i18n barrel `index.ts` to fix Turbopack bundling errors
- **E2E locale**: Playwright config updated with `locale: 'es-ES'` globally; copy-button and theme-toggle selectors updated for Spanish UI
- **Feature-flag cache bust**: `PATCH /api/admin/feature-flags` now calls `revalidateTag('feature-flags')` after writes, reducing ISR stale window from ~5 min to seconds

### Changed
- **`SPANISH_PUBLIC_COPY` removed**: `lib/copy/public-flow.ts` deleted; all copy migrated to structured i18n dictionaries
- **"Insignia" → "Chapa"**: All references to "insignia/insignias" in the Spanish dictionary replaced with "Chapa/Chapas" (brand name)
- 338 new tests; total test count: 7,530 across 440 files

## [2.9.1] - 2026-05-01

### Fixed
- **OAuth state comparison** (#835): Upstash auto-deserialises stored `"1"` as the number `1`; state comparison now coerces both sides to string before comparing, restoring OAuth login for affected users

## [2.9.0] - 2026-05-01

### Added
- **Typed env getters**: Centralised `process.env` access with runtime type assertions (`lib/env.ts`)
- **Structured JSON logger with request correlation** (#712): `withStructuredLogger()` wrapper emits `requestId`-correlated JSON logs for all API routes
- **`withErrorCapture()` on all 44 API routes** (#707): Unified error capture wrapper replaces scattered try/catch; all errors flow to `lib/analytics/server-errors.ts`

### Fixed
- **ISR regression** (triage 2026-04-30): Pages with `force-dynamic` incorrectly fell through to stale ISR cache; routing corrected
- **Five correctness fixes** (#726, #731, #766, #767, #768): One-line fixes across scoring edge cases and API response shapes
- **Warm-cache observability** (#702, #750): Failures array included in warm-cache cron response; rotation logic deferred to avoid blocking the main pass
- **CORS guard**: Added missing `Access-Control-Allow-Origin` headers on affected public API routes

### Performance
- **Share page TTFB** (#800): Profile lookups parallelised; avatar fetch deadline tightened — measured ~200 ms improvement on cold-start
- **Cached SVG read-before-render** (#720): Share page reads a previously rendered SVG from Redis before triggering a re-render pass
- **Bundle size**: `SharePageOwnerContent` and `PostHogInit` deferred from initial render bundle

## [2.8.0] - 2026-04-27

### Added
- **Active alerts**: Launch-critical active alert integration for real-time status notifications
- **Structured error logger**: `withErrorCapture()` wrapper and structured JSON logger (`lib/analytics/server-errors.ts`) for consistent server-side error observability
- **Auth modules**: Cleanly separated authentication concerns — `oauth-state` (Redis-backed CSRF-safe state), `session` (session management), `cookie-policy`, `github-session-token` (Supabase-backed token store), `unsubscribe-token` (HMAC-signed)
- **Profile modules**: `materialize-profile`, `orchestrated-profile`, `public-profile`, `post-write-invalidation` — replaces scattered profile assembly logic
- **Spanish localization**: Public flow copy (`lib/copy/public-flow.ts`) translated to Spanish for all error pages, verify flow, and public-facing messages
- **Lease-based campaign send claiming**: Atomic SQL lease (`claim_campaign_sends()`) prevents duplicate email sends in multi-worker deployments
- **Deployment smoke test gate**: CI workflow validates deployment shape before proceeding
- **Migration validation script**: `scripts/validate-migrations.ts` enforces sequential `NNN_` naming on Supabase migrations
- **Auto-commit agent reports**: `scripts/commit-reports.sh` + launchd job (`com.chapa.commit-reports`) automatically commits `docs/agents/` updates at 10:30 UTC daily
- **CODEOWNERS**: `.github/CODEOWNERS` with catch-all `@juan294` ownership
- **Operational runbooks**: `docs/runbooks/` — incident-response, migrations, outage-playbook, release-checklist, rollback, secret-rotation (6 guides)
- **AGENTS.md**: Codex compatibility guide for AI agent workflows
- **Craft score backfill script**: `apps/web/scripts/backfill-craft-scores.ts` for applying formula changes to existing stored scores
- **`useIsClient` hook**: Extracted SSR-safe hydration check from presentational components into `apps/web/hooks/useIsClient.ts`
- **`useSession` hook**: Dedicated hook at `apps/web/hooks/useSession.ts`
- **`StatusCallout` component**: Reusable status/alert callout with semantic variants
- **`ClientFeatureFlagsProvider`**: Client-side feature flag injection component
- **Health endpoint GitHub API probe**: `/api/health` now validates GitHub API reachability alongside Redis and Supabase checks
- **`WARM_CACHE_PRIORITY_HANDLES` env var**: Comma-separated handles always included in warm-cache cron runs
- 237 new tests; total test count: 7,192 across 438 files

### Fixed
- **Quality cliff at solo→collaborative boundary** (#827): `computeQuality` now returns `max(collaborativeFormula, soloFormula)` so users with strong solo signals don't drop sharply when crossing the 0.15 review-to-PR threshold
- **Supplemental EMU stats persistence** (#825): Supplemental stats now persist to a new Supabase table (`supplemental_stats`, migration 024) with Redis-as-hot-path / Supabase-as-fallback in `getStats()`. A missed CLI day no longer drops EMU contributions silently
- **Same-day refresh after CLI supplemental upload** (#826): New `stats:dirty:<handle>` Redis marker; `materializeProfile` reads it as `inputsChanged` and `smoothScore` bypasses the same-day EMA lock so freshly uploaded data lands in today's score immediately. `runPublicProfileSideEffects` routes through `dbReplaceSnapshot` and clears the marker after a successful write
- **BadgeToolbar render test flakiness** (#822): Added `vi.useRealTimers()` in `afterEach` to prevent fake-timer leak between tests
- **Craft scoring single source of truth**: `/api/refresh` and `/api/recalculate` no longer mutate stored craft scores — all paths read from `getCachedCraftScore()`. Formula changes require explicit backfill via the new backfill script
- **GitHub OAuth tokens moved to Supabase**: Tokens stored in `user_github_session_token` (encrypted) instead of session cookies, preventing token leak via log capture (#807)
- **Campaign send deduplication**: Claim sends before delivery with lease-based locking; prevents duplicate emails in multi-worker environments (#793)
- **Campaign payload validation**: Payloads validated on write, not just on send (#795)
- **Admin dashboard state**: Stabilized loading and error state transitions (#789, #790)
- **Admin user search**: Uses `ILIKE` for case-insensitive handle/name filtering
- **Admin agents/run auth**: Endpoint now requires valid auth; bulk-recalculate uses cursor pagination for large user sets
- **Badge cache coordination**: Hardened concurrent SVG cache writes and sideeffect deduplication (#799, #801)
- **Redis fail-open for public side effects**: Badge route side effects (snapshot, PostHog) fail silently on Redis outage rather than blocking the SVG response (#792)
- **Snapshot invalidation order**: Centralized and consistent cache invalidation sequence on profile writes (#794)
- **Auth cookie policy**: Hardened `SameSite`, `Secure`, and `HttpOnly` attributes; separate policy per environment (#806, #813)
- **Verification read path**: Unified verification data access via single read path (#812)
- **Resend webhook deduplication**: Deduplicated webhook event delivery to prevent double-processing (#796, #809)
- **Cron fail-secure**: All cron endpoints return `503` when `CRON_SECRET` is unset (previously allowed through); `getClientIp` now trusts `x-vercel-forwarded-for` over spoofable headers
- **OAuth callback state**: Stabilized local OAuth callback state transitions for dev environment
- **Module cache on logout**: Module-level promise caches (e.g. `useSession`) cleared on logout
- **`withTimeout()` helper**: Replaced `Promise.race` with a named helper for better error context
- **SVG route**: Cache key, sideeffect dedup guard, and rate limit key corrected
- **Public client shell**: Deferred to avoid SSR/client hydration mismatch (#786, #797)
- **Studio availability flag**: Unified `NEXT_PUBLIC_STUDIO_ENABLED` check across all entry points (#788)
- **Share page UX**: Stabilized public share page rendering and loading state (#787, #818, #821)
- **Status semantics**: Unified status field across admin and API responses (#820)
- **InfoTooltip z-index**: Increased from `9999` to `99999` to layer above animated ancestors
- **Heatmap keyboard navigation**: Day cells are keyboard-navigable with `tabindex`, `role`, and `aria-label` (UX-H4)
- **Radar animation reduced-motion**: Respects `prefers-reduced-motion` media query
- **Badge preview CLS**: Eliminated layout shift on badge preview mount (FE-M5)
- **BadgeContent avatar**: Adds `.img-outline` per design system
- **Profile date alignment**: `buildSnapshot` now uses the `today` param consistently for date binding
- **`useTrendData` waterfall**: Module-level promise cache eliminates redundant sequential fetches

### Security
- **PostCSS XSS CVE**: Pinned `postcss >= 8.5.10` to resolve CVE
- **Next.js 16.2.4**: Resolves PPR-related DoS vulnerability (GHSA-q4gf-8mx6-v5v3)

### Changed
- **Removed stale components**: `ShareBadgePreview`, `ShareBadgePreviewLazy`, `HeroScoreZone`, `RadarChartInteractive` (superseded by current dashboard design)
- **Third-party license inventory**: Refreshed to reflect current dependency set

### Dependencies
- Next.js: 16.2.2 → 16.2.4
- React / React-DOM: 19.2.4 → 19.2.5
- TypeScript: 6.0.2 → 6.0.3
- ESLint: 9.27.0 → 9.39.0
- vitest / @vitest/coverage-v8: 4.1.2 → 4.1.4
- @supabase/supabase-js: 2.103.0 → 2.104.1
- posthog-js: 1.367.0 → 1.372.1
- resend: 6.10.0 → 6.12.2
- @playwright/test: 1.58.2 → 1.59.1
- @types/node: 25.5.0 → 25.6.0
- jsdom: 29.0.2 → 29.1.0
- vite: 8.0.8 → 8.0.10
- tailwindcss / @tailwindcss/postcss: 4.2.2 → 4.2.4

## [2.7.2] - 2026-04-04

### Fixed
- **Craft recompute on refresh**: `/api/refresh` now recomputes craft scores from stored raw data when supplemental insights are present, preventing stale craft dimensions after a force-refresh
- **Craft score passed to impact**: Craft score is now correctly forwarded into the impact calculation pipeline after a refresh, ensuring the badge reflects the latest craft data

## [2.7.1] - 2026-04-04

### Fixed
- **Craft recompute on recalculate**: `/api/recalculate` now recomputes craft scores from stored raw data rather than using cached values, preventing stale craft dimensions after an insights upload

## [2.7.0] - 2026-04-04

### Added
- **Craft dimension scoring page**: New "Craft — AI tool mastery" section on `/about/scoring` explaining how to unlock Craft, the 2-week upload cadence, sub-dimensions, and friction exclusion rationale
- **Insights import cooldown**: Disables "Import Insights" button for 14 days after upload, matching Claude Code's generation cycle; shows re-enable date in tooltip
- **Claude Code footer attribution**: "Powered by Claude Code" with animated star spinner in landing page footer; platform logos (GitHub, Bitbucket, Codeberg) in icons-only layout
- **Owner cache warm on share page**: When badge owners visit their own `/u/:handle`, a client hook silently calls `/api/refresh` with their OAuth token to warm cache and trigger ISR rebuild
- **9 UI polish improvements**: `tabular-nums` on scores, `text-balance`/`text-pretty`, `.img-outline` for avatars, `shadow-card`/`shadow-card-hover` CSS properties, icon cross-fade transitions, `useAnimatedUnmount` hook, `collapse-grid` utility, asymmetric CTA padding
- 41 new test files; total test count: 6,955 across 389 files

### Fixed
- **Craft scoring fairness (critical)**: Excluded friction events (wrong approach, buggy code, misunderstood request) and tool errors from Effectiveness sub-score — these are the AI tool's mistakes, not the developer's. Weights redistributed to achievement rate (55%) + satisfaction rate (45%)
- **Release PR filtering**: Cross-default PRs (develop→main) no longer dilute featureBranchRate, batchSizeScore, issueLinkageRate, prDescriptionRate for solo quality metrics
- **Solo profile detection**: Uses `primaryReviewsSubmittedCount` instead of combined total, preventing supplemental EMU reviews from flipping solo devs to collaborative
- **Merge quality rate preservation**: `mergeOptionalWeightedAvg` no longer treats `undefined` as 0, which was dragging primary quality rates toward zero
- **Minimum sample guard**: Falls back to all merged PRs when fewer than 5 dev PRs remain after release PR filtering
- **ADMIN_SECRET fail-secure**: Returns 503 when env var unset (was 401, confusable with invalid token)
- **Heatmap keyboard accessibility**: Added keyboard navigation and accessible descriptions to heatmap grid
- **WCAG blockers**: Replaced `div[role=button]` with native `<button>` in DimensionCard; moved progressbar ARIA to outer container
- **BadgeOverlay tooltip**: Screen reader announcement on desktop
- **Score snapshot upsert**: Refresh endpoint uses `dbReplaceSnapshot` (UPSERT) so corrected scores overwrite stale same-day snapshots
- **Badge freshness**: Reduced `stale-while-revalidate` from 7 days to 1 day; added `revalidatePath()` to refresh endpoint
- **OG image font paths**: Use `process.cwd()` instead of `__dirname` for Turbopack compatibility
- **Feature flag caching**: 5-minute TTL eliminates redundant Supabase queries

### Changed
- **Impact v4 → v6 rename**: `computeImpactV4` → `computeImpactV6`, `ImpactV4Result` → `ImpactV6Result`, `v4.ts` → `v6.ts` across 71 files — aligns code naming with spec version
- **TypeScript 6.0**: Upgraded from 5.9.3 to 6.0.2; zero type errors, all tests pass
- **Next.js 16.2.2**: PPR DoS security fix
- **`noUnusedLocals` + `noUnusedParameters`**: Enabled in both tsconfigs
- Platform OAuth status rate limit raised from 20/15min to 120/15min

### Documentation
- All living specs updated: impact-v6.md (effectiveness formula, consistency table, v4→v6), svg-design.md (heatmap palette, type rename)
- CRON_SECRET fail-open documented as accepted risk (#685)
- Architecture diagram (`docs/chapa-architecture.drawio`) added
- Pre-launch audit report (6 specialists, all GREEN)
- MetricsSnapshot JSDoc corrected (Redis → Supabase)
- StatsData field count updated (29 → 30)
- README badges and test counts refreshed

## [2.6.0] - 2026-03-29

### Added
- **Scoring v6.1**: Batch size score replaces micro-commit ratio in Quality (15% signal); week coverage replaces inverse burst in Consistency (15% signal); ±5% lead time modifier on Delivery; ratio-based solo profile detection (threshold 0.15); burst confidence threshold raised to 100
- **Portfolio API integration**: Reduced `/api/profile/:handle` cache from 1h to 5min CDN (`s-maxage=300`); `WARM_CACHE_PRIORITY_HANDLES` env var for guaranteed daily cache warming of specified handles; craft dimension persisted in `metrics_snapshots` table (migration 019)
- **Admin bulk-recalculate endpoint**: `POST /api/admin/bulk-recalculate` for force-recalculating impact scores after scoring formula updates
- **Scoring pipeline hardening**: Field completeness guard (`stats-schema.ts`), golden-file scoring tests, end-to-end pipeline integrity tests, `makeFullStats()` test factory, CI scoring integrity gate
- **Shared `useSession()` hook**: Eliminates 3-4 redundant `/api/auth/session` fetches per page via module-level promise deduplication
- 27 new tests; total test count: 6,654 across 382 files

### Fixed
- Tier range copy corrected across BadgeOverlay tooltip, llms.txt, llms-full.txt (Emerging 0-29, Solid 30-69)
- Solo quality fields preserved in `mergeStats` — no longer silently dropped
- Share page Refresh button restored via client-side session check (#647)
- Error handling added to `/api/supplemental`, `/api/insights`, `/api/insights/:handle` — unhandled exceptions now return JSON 500 instead of raw errors (#653)
- RadarChart SVG hit areas now keyboard-accessible: `tabIndex`, `role="button"`, `aria-label`, `onKeyDown` for Enter/Space (#652)
- Mobile nav links include `aria-current` for active state (#642)
- Unused `_resetSessionCache` export removed (knip dead code)

### Changed
- `verifyAdminSecret()` extracted as shared helper — deduplicates bearer-token auth in stats and bulk-recalculate routes (#651)
- Composite score description on `/about/scoring` now documents solo profile quality exclusion
- CI checkout uses `fetch-depth: 0` for accurate scoring file diffs
- Supabase local dev config added (`supabase/config.toml`) with non-conflicting ports

### Documentation
- All scoring docs updated to match v6.1 code: how-it-works, scoring-explainer-video, spec, cli-guide
- `WARM_CACHE_PRIORITY_HANDLES` documented in CLAUDE.md
- StatsData field count corrected (25→29), MetricsSnapshot storage location updated
- README verification hash length corrected (8→32 chars), test counts updated
- Node.js version in cli-guide updated (18→20)
- Scoring pipeline hardening plan — all 5 phases marked complete
- Synced with cc-rpi blueprint v1.14.1

## [2.4.1] - 2026-03-27

### Added
- Share page Suspense boundary for progressive streaming — page shell renders immediately, badge content loads asynchronously with `BadgeSkeleton` fallback (#635)
- 43 new tests: 6 new test files (5 loading.tsx + ClientAnalytics), heading hierarchy regression tests, health endpoint coverage; total test count: 6,414 (#637)

### Fixed
- Linked platforms now appear in Data Sources and badge footer even when stats fetch temporarily fails (expired token, API error) — DB link status is the source of truth (#632)
- Health endpoint uses `dbsize()` instead of `ping()` for actual Redis data-access check; returns `"skipped"` (200 OK) instead of `"unavailable"` (503) when services are not configured (#634)
- Cron auth logs a warning when `CRON_SECRET` is not set, making unprotected endpoints visible in logs (#633)
- Heading hierarchy corrected in experiment pages — `h1` now precedes `h2` in DOM order (#636)
- E2E health test updated to accept `"skipped"` status

### Changed
- UserMenu platform visibility driven by server-side status API instead of client-side sync flags — eliminates env var / DB flag mismatches
- Parallelized linked-platform DB fallback checks via `Promise.all`; extracted `fetchPlatformStatus()` helper in UserMenu
- 6 minor/patch dependency updates: @supabase/supabase-js, posthog-js, svix, @next/bundle-analyzer, @types/node, eslint-config-next (#638)

### Documentation
- Updated README test counts, CLAUDE.md health endpoint + agent report descriptions
- Updated spec.md with Craft dimension, Artificer archetype, profile API + health endpoints
- Updated badge specs: "Platform Branding" (was "GitHub Branding"), 4/5-axis radar chart, 3 missing render files
- Removed stale Confidence references from badge design doc
- Added CHANGELOG link reference definitions for all versions

## [2.4.0] - 2026-03-27

### Added
- Public profile API endpoint (`GET /api/profile/:handle`) — read-only, rate-limited (60 req/IP/min), CORS-enabled, 1h CDN cache; returns latest impact dimensions, archetype, tier, and optional craft score for external consumers (portfolio sites)
- 17 new tests across profile endpoint, history API, campaigns a11y, unsubscribe HTML, share page coverage; total test count: 6,371
- Share page test coverage boosted from 84% to 100% statements

### Changed
- History API (`/api/history/:handle`) strips `confidence` and `confidencePenalties` from response (internal-only data, per CLAUDE.md policy)
- 4 admin routes (users, feature-flags, engagement-flags, agents-summary) migrated to shared `adminAuth()` helper (-105 lines)
- Profile endpoint queries parallelized via `Promise.all` and typed with shared `DimensionScores`
- Dev dependencies: vitest bumped to 4.1.2, pnpm overrides for picomatch (>=4.0.4) and brace-expansion (>=5.0.5) — 0 audit vulnerabilities
- Font files excluded from coverage reporting (binary .ttf noise)

### Fixed
- Flaky `BadgeToolbar.render.test.tsx` test: replaced `setTimeout` with `queueMicrotask` in MockImage callback to eliminate async race
- Campaigns dashboard: added keyboard support (`role="button"`, `tabIndex`, Enter/Space `onKeyDown`) to table rows
- Unsubscribe HTML: added `lang="en"` attribute to `<html>` tag

### Documentation
- `CLAUDE.md`: added `GET /api/profile/:handle` to Public API routes
- `docs/accepted-risks.md`: documented lightningcss MPL-2.0 license as accepted build-only dependency

## [2.3.0] - 2026-03-24

### Added
- Badge loading skeleton (`BadgeSkeleton`) — shimmer placeholder while badge `<img>` loads on share page
- Redis craft score cache (`lib/cache/craft-cache.ts`) — 1h TTL, fail-open to Supabase
- Pre-warming of avatar and craft caches in `warm-cache` cron job
- Generic platform OAuth handler factory (`lib/auth/platform-oauth.ts`) — eliminates Bitbucket/Codeberg code duplication
- `ClientAnalytics` wrapper component for Vercel Analytics/SpeedInsights (Next.js 16 Server Component compatibility)
- ~167 new tests across 48 test files; function coverage boosted from 81.3% to 85.7%
- Shared test helpers: `adminAuthSetup()` for campaign tests, platform auth fixtures
- `report-reader` module for agents-summary route (isolates filesystem access from Turbopack NFT tracing)

### Changed
- HMAC verification hash increased from 64 bits (16 hex chars) to 128 bits (32 hex chars); verification endpoints accept legacy 8/16/32-char formats
- Supabase: `FORCE ROW LEVEL SECURITY` enabled on all 9 tables (defense-in-depth)
- Vercel Analytics and SpeedInsights dynamically imported (reduces server bundle)
- Dev dependencies updated: vitest 4.1.1, @vitest/coverage-v8 4.1.1

### Fixed
- `next/dynamic` with `ssr: false` in Server Component (Next.js 16 build failure) — extracted to client component
- Unhandled "window is not defined" error from `useAnimatedCounter` test cleanup
- `type="button"` added to UserMenu trigger and platform unlink buttons (prevents accidental form submission)
- `htmlFor`/`id` pairing on number-counters experiment slider (screen reader accessibility)
- NFT trace warning in agents-summary route (filesystem reads extracted to separate module)

## [2.2.0] - 2026-03-23

### Added
- YouTube video explainer embed on `/about/scoring` page via new `LiteYouTubeEmbed` component (lazy-loads iframe on click, ~800KB saved on initial load)
- Scoring explainer video source document (`docs/scoring-explainer-video.md`)
- Bearer token authentication for `/api/insights` and `/api/recalculate` endpoints (enables CLI workflows without browser session)
- Shared `resolveRequestAuth()` module supporting both Bearer token and session cookie auth
- Shared `verifyCronSecret()` helper centralizing cron route authentication
- `loading.tsx` for `/coming-soon` route
- 28 new tests: render tests for 9 page components, cron auth helper, Bearer auth resolver, YouTube embed

### Changed
- Cron routes (`warm-cache`, `sync-audience`, `process-campaigns`) refactored to use shared `verifyCronSecret()` helper
- `/api/supplemental` route refactored to use shared `resolveRequestAuth()`
- Removed deprecated `X-XSS-Protection` header (CSP provides real XSS protection)
- CSP updated: added `i.ytimg.com` to `img-src`, `youtube-nocookie.com` to `frame-src`

### Fixed
- OAuth token lost in `resolveRequestAuth` for browser-initiated recalculations
- Campaign feature highlight inputs missing `aria-label` attributes
- RadarChartInteractive SVG vertices suppressing focus outline via inline style
- Scoring page public URL using AND instead of OR for `low_activity_signal` confidence penalty

## [2.1.0] - 2026-03-22

### Added
- Campaign type system: `announcement` (manual blast) vs `engagement` (automated score-bump template)
- Send test email endpoint for campaign drafts (`POST /api/admin/campaigns/:id/test`)
- BIMI logo for email branding (`apps/web/public/bimi.svg`)
- `microCommitRatio` metric: fraction of merged PRs with < 10 lines changed (`MICRO_PR_LINE_THRESHOLD`)
- `MICRO_PR_LINE_THRESHOLD` constant extracted to `packages/shared/src/constants.ts`
- `dev` and `developer` added to `DEFAULT_BRANCH_NAMES` for accurate feature branch detection
- 57 new tests (html-helpers, error boundaries, campaign a11y, experiment landmarks)

### Changed
- `low_activity_signal` confidence penalty: AND → OR (triggers on either low days or low commits)
- Score-bump notification threshold raised from 5 to 10 points (`SCORE_BUMP_THRESHOLD`)
- Email templates: improved subject lines (show delta/tier), multi-paragraph body support, shared `featureRow()` helper
- Next.js updated to 16.2.1
- Dev dependencies updated: vitest 4.1.0, jsdom 29.0.1

### Fixed
- Campaign template placeholder interpolation (ctaUrl, ctaText, features array, engagement fields)
- Email feature bullet spacing
- Campaign form a11y: added `htmlFor`/`id` label associations and `aria-label` on remove buttons
- 7 experiment pages: changed `<div>` to `<main>` for proper landmark semantics
- Suppressed expected stderr noise in error-handling tests

## [2.0.0] - 2026-03-22

### Added

**Multi-Platform Integration**
- Bitbucket OAuth connect/disconnect with encrypted token storage in Supabase
- Codeberg OAuth connect/disconnect with encrypted token storage in Supabase
- Multi-platform stats merging (GitHub + Bitbucket + Codeberg) in badge and share page
- Platform-specific data source chips on share page with clickable profile links
- Dynamic platform logo branding in badge footer (shows only connected platforms)

**Impact V6 Scoring**
- Optional 5th dimension: Craft (AI tool usage insights via Claude Code reports)
- Artificer archetype for developers with strong Craft scores
- Pentagon radar chart when Craft data is present (falls back to diamond for 4 dimensions)
- Impact V6 spec documented as current source of truth (`docs/impact-v6.md`)

**Impact Dashboard Redesign**
- Interactive radar chart with clickable vertices and dimension detail panels
- Enhanced dimension cards with sparklines and expandable sub-metric breakdowns
- Coaching insights with trend-based recommendation cards
- Dot timeline activity chart replacing hex heatmap
- Bold hero score variant with tier badge

**Badge V3**
- Pentagon radar for 5-dimension profiles
- Dot timeline activity visualization
- Platform-neutral Chapa branding (replaced GitHub-only footer)
- Grouped pill container with opacity contrast text
- Updated branding tagline

**Admin & Infrastructure**
- Feature flags system (Supabase `feature_flags` table + API + admin UI)
- Agent fleet: 7 scheduled agents (Coverage, Cost Analyst, QA, Security, Performance, Documentation, cc-rpi Update) with launchd plists and admin dashboard
- Agent run API for manual triggering
- Engagement tab with score notification toggles
- Admin dashboard data layer migrated from Redis to Supabase
- Batch snapshot queries with skeleton loader and deferred search

**Email & Campaigns**
- Campaign management system: CRUD, preview, send, cron processing
- Score-bump email notifications
- Resend audience sync cron job
- Email unsubscribe endpoint with webhook verification

**CLI & Integrations**
- Claude Code Insights import (upload HTML report, compute Craft dimension)
- Telemetry API for CLI merge audit data
- Recalculate endpoint for score refresh after insights upload

**UX & Accessibility**
- Dark/light theme with `next-themes` (light default, dark signature brand)
- Skip-to-main-content link (WCAG 2.4.1)
- ARIA labels on all interactive elements (admin table, confidence bars, dropdowns, overlays)
- Focus trap in mobile nav, keyboard navigation on radar chart and dimension cards
- `prefers-reduced-motion` support across all animations
- Loading and error boundaries for all major routes
- Social sharing: Bluesky and LinkedIn added to share dropdown
- Updated favicon and logo with shield + glow design

**Testing & CI**
- Test suite expanded: 330 test files, 5,680 tests (was 130 files, 2,100 tests)
- 100% API route test coverage (41/41 handlers)
- Render tests for 9 previously untested components
- 113 admin sub-component render tests
- Lighthouse CI workflow for Core Web Vitals tracking
- Bundle size CI with 500KB budget check
- Circular dependency check (madge) in CI
- Dead code detection (knip) in CI

**New API Routes**
- `/api/auth/bitbucket/*` (callback, connect, disconnect, status)
- `/api/auth/codeberg/*` (callback, connect, disconnect, status)
- `/api/admin/campaigns` (CRUD + preview + send)
- `/api/admin/agents-summary`, `/api/admin/agents/run`
- `/api/admin/engagement-flags`, `/api/admin/feature-flags`
- `/api/feature-flags` (public)
- `/api/insights`, `/api/insights/:handle`
- `/api/notifications/unsubscribe`
- `/api/recalculate`
- `/api/telemetry`
- `/api/cron/process-campaigns`, `/api/cron/sync-audience`

### Changed
- Impact scoring: "Building" dimension renamed to "Delivery", "Guarding" to "Quality"
- Archetype: "Guardian" renamed to "Quality Champion" (internal routes still use "guardian")
- Lifetime metric snapshots migrated from Redis sorted sets to Supabase `metrics_snapshots` table
- `GithubBranding.tsx` replaced with platform-neutral `BadgeBranding.tsx`
- `KeyboardShortcutsProvider` wrapper replaced with `KeyboardShortcutsListener` sibling component
- Activity heatmap redesigned from hexagonal grid to dot-based timeline
- Badge cache headers changed from 24h to 6h `s-maxage` for fresher updates

### Fixed
- Token refresh resilience: transient failures (network, timeout) no longer auto-unlink Bitbucket/Codeberg — only confirmed revocation (`400 + invalid_grant`) triggers unlinking
- RLS enabled on all Supabase tables with explicit deny policies for anon role
- Rate limiting added to all API endpoints
- XSS vector: escape handle param in unsubscribe HTML response
- Badge: star pill trailing space, metric pill sizing, empty hexagon visibility
- Accessibility: nested button violations, focus indicators, dark mode contrast, touch targets
- Performance: inline badge SVG, parallel data fetching, lazy-load command bar
- Studio: `force-dynamic` export to suppress build cache warnings
- Experiment pages: heading hierarchy fix, loading state fallbacks
- UTC timezone bug in streak calculation

### Security
- AES-256-GCM token encryption for all platform OAuth tokens
- CSRF state validation with `timingSafeEqual` on all OAuth callbacks
- Comprehensive security headers (HSTS, CSP, X-Frame-Options, Permissions-Policy)
- `flatted` override bumped to `>=3.4.2` (prototype pollution CVE)
- Next.js updated to 16.2.0 (resolved 5 security advisories)
- Dependency audit: `eslint` transitive deps overridden for known vulnerabilities

## [1.0.0] - 2026-02-16

### Added
- Impact v4 scoring engine with 4 dimensions (Delivery, Quality, Consistency, Breadth)
- Developer archetype classification (Builder, Quality Champion, Marathoner, Polymath, Balanced, Emerging)
- Embeddable SVG badge at `/u/:handle/badge.svg` with heatmap, radar chart, and animations
- Share page at `/u/:handle` with score breakdown, tooltips, and embed snippets
- Creator Studio at `/studio` with 9 visual customization categories
- GitHub OAuth login for verified badges
- Badge verification via HMAC-SHA256 hash at `/api/verify/:hash`
- Admin dashboard at `/admin` with user management and command bar
- CLI tool (`chapa-cli`) for GitHub Enterprise (EMU) account merging
- Lifetime metric snapshots stored in Redis sorted sets (permanent history)
- Score history API with trend and diff calculations
- PostHog analytics integration
- Resend email notifications (first badge, webhooks)
- Warm-cache cron job for active users
- Dark/light theme support with terminal-first design system
- Comprehensive test suite (130+ test files, 2100+ tests)
- CI/CD with GitHub Actions (tests, typecheck, lint, security scanning, bundle analysis)
- Public release documentation (LICENSE, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY)

[Unreleased]: https://github.com/juan294/chapa/compare/v2.20.0...HEAD
[2.20.0]: https://github.com/juan294/chapa/compare/v2.19.1...v2.20.0
[2.19.1]: https://github.com/juan294/chapa/compare/v2.19.0...v2.19.1
[2.19.0]: https://github.com/juan294/chapa/compare/v2.18.1...v2.19.0
[2.18.1]: https://github.com/juan294/chapa/compare/v2.18.0...v2.18.1
[2.18.0]: https://github.com/juan294/chapa/compare/v2.17.0...v2.18.0
[2.17.0]: https://github.com/juan294/chapa/compare/v2.16.1...v2.17.0
[2.16.1]: https://github.com/juan294/chapa/compare/v2.16.0...v2.16.1
[2.16.0]: https://github.com/juan294/chapa/compare/v2.15.0...v2.16.0
[2.15.0]: https://github.com/juan294/chapa/compare/v2.14.0...v2.15.0
[2.14.0]: https://github.com/juan294/chapa/compare/v2.13.0...v2.14.0
[2.13.0]: https://github.com/juan294/chapa/compare/v2.12.0...v2.13.0
[2.12.0]: https://github.com/juan294/chapa/compare/v2.11.0...v2.12.0
[2.11.0]: https://github.com/juan294/chapa/compare/v2.10.0...v2.11.0
[2.10.0]: https://github.com/juan294/chapa/compare/v2.9.1...v2.10.0
[2.9.1]: https://github.com/juan294/chapa/compare/v2.9.0...v2.9.1
[2.9.0]: https://github.com/juan294/chapa/compare/v2.8.0...v2.9.0
[2.8.0]: https://github.com/juan294/chapa/compare/v2.7.2...v2.8.0
[2.7.2]: https://github.com/juan294/chapa/compare/v2.7.1...v2.7.2
[2.7.1]: https://github.com/juan294/chapa/compare/v2.7.0...v2.7.1
[2.7.0]: https://github.com/juan294/chapa/compare/v2.6.0...v2.7.0
[2.6.0]: https://github.com/juan294/chapa/compare/v2.4.1...v2.6.0
[2.4.1]: https://github.com/juan294/chapa/compare/v2.4.0...v2.4.1
[2.4.0]: https://github.com/juan294/chapa/compare/v2.3.0...v2.4.0
[2.3.0]: https://github.com/juan294/chapa/compare/v2.2.0...v2.3.0
[2.2.0]: https://github.com/juan294/chapa/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/juan294/chapa/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/juan294/chapa/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/juan294/chapa/releases/tag/v1.0.0
