# Chapa — Dev Impact Badge

## One-liner
Chapa generates a **live, embeddable, animated SVG badge** that showcases a developer's **Impact v6 Profile** (4–5 dimensions + archetype + confidence) from GitHub activity and optional AI tool insights, with a Creator Studio for badge preview customization, a share page, and one-click sharing.

## Goals
1. GitHub OAuth login (for "Verified" mode + better API limits).
2. Compute **Impact v6 Profile** from last 12 months (365 days):
   - 4 core dimensions (Delivery, Quality, Consistency, Breadth) + optional 5th (Craft), each 0–100
   - developer archetype (Builder, Quality Champion, Marathoner, Polymath, Artificer, Balanced, Emerging)
     - Note: "Quality Champion" is the display name; internal code/routes use "guardian" (e.g., `/archetypes/guardian`, `--color-archetype-guardian`)
   - composite score (0–100), confidence (50–100) + reasons, adjusted score, tier.

3. Serve **Creator Studio**: `/studio` (badge customization with 6 visual categories, every one of which renders in the embedded badge).
4. Serve **embeddable SVG badge**: `/u/:handle/badge.svg`
5. Serve **share page**: `/u/:handle`
6. Badge **verification** via HMAC-SHA256 hash (proves badge data hasn't been tampered with).
7. Caching + rate limit friendliness (daily cache is fine).
8. Minimal analytics (PostHog) for key events.

## Non-goals (current scope)
- No long-term history charts (lifetime metric snapshots are stored but no UI yet)
- No leaderboard
- No paid tiers

## Stack decisions
- Next.js (App Router) + TypeScript + Tailwind
- Badge rendering: **React-to-SVG** (JSX template rendered server-side to string)
- Caching: Upstash Redis (via Vercel Marketplace) preferred
- Analytics: PostHog
- Domain: chapa.thecreativetoken.com

## Key routes

### Pages
- GET `/` Landing + GitHub login (terminal-first UI)
- GET `/studio` Creator Studio (badge customization, requires auth)
- GET `/settings` Account settings — connections, AI insights import, identity (requires auth, noindex)
- GET `/admin` Admin dashboard (requires auth + admin handle, see `ADMIN_HANDLES`)
- GET `/u/:handle` Share page (badge preview, breakdown, embed snippet, share CTA)
- GET `/u/:handle/badge.svg` Embeddable badge SVG (cacheable)
- GET `/verify/:hash` Badge verification page (public)
- GET `/about` About page (scoring explainer, archetype showcase)
- GET `/about/scoring` Scoring methodology detail
- GET `/about/verification` Badge verification explainer
- GET `/archetypes/:type` Archetype guide pages (builder, guardian, marathoner, polymath, artificer, balanced, emerging)
- GET `/generating/:handle` Badge generation loading screen
- GET `/cli/authorize` CLI device authorization flow
- GET `/privacy` Privacy policy
- GET `/terms` Terms of service
- GET `/coming-soon` Coming soon placeholder
- GET `/verify` Badge verification landing page
- GET `/experiments/*` Experimental feature pages (gated by feature flag)

### Auth API
- GET `/api/auth/login` GitHub OAuth login redirect
- GET `/api/auth/callback` GitHub OAuth callback (token exchange)
- GET `/api/auth/session` Current session info (login, name, avatar_url)
- POST `/api/auth/logout` Clear session cookie
- GET `/api/auth/bitbucket/callback` Bitbucket OAuth callback
- GET `/api/auth/bitbucket/connect` Bitbucket OAuth connect (link account)
- POST `/api/auth/bitbucket/disconnect` Bitbucket account unlink
- GET `/api/auth/bitbucket/status` Bitbucket connection status
- GET `/api/auth/codeberg/callback` Codeberg OAuth callback
- GET `/api/auth/codeberg/connect` Codeberg OAuth connect (link account)
- POST `/api/auth/codeberg/disconnect` Codeberg account unlink
- GET `/api/auth/codeberg/status` Codeberg connection status
- GET `/api/auth/gitlab/callback` GitLab OAuth callback (token exchange)
- GET `/api/auth/gitlab/connect` GitLab OAuth connect (link account)
- POST `/api/auth/gitlab/disconnect` GitLab account unlink
- GET `/api/auth/gitlab/status` GitLab connection status

### Public API
- GET `/api/verify/:hash` Badge verification endpoint
- GET `/api/profile/:handle` Public impact profile snapshot (rate-limited, CORS-enabled)
- GET `/api/history/:handle` Score history, trend, and diff (rate-limited)
- GET `/api/health` Health check (Redis dbsize + Supabase query + GitHub API probe + cron heartbeat staleness for warm-cache/sync-audience/process-campaigns/latency-check, rate-limited; returns "skipped" for unconfigured services; #1047 — asserts the server `GITHUB_TOKEN` still carries `repo` scope and returns a distinct `insufficient_scope` status if not, since that token silently losing `repo` would blind every badge to private-repo merges with no other signal)
- GET `/api/version` Read-only deployment identity (`commitSha` + Vercel
  environment, no-store); E2E Pro uses it to bind preview and production
  evidence to the fixed release candidate
- GET `/api/feature-flags` Public feature flag values
- GET `/api/insights/:handle` AI tool insights for a user (public, no auth; rate-limited; returns only computed scores, no raw data)
- GET `/u/:handle/og-image` OG image for share page (dynamic, cached)
- GET `/og-image` Default OG image
- GET `/llms.txt` LLM-friendly site summary
- GET `/llms-full.txt` Full LLM-friendly site content
- GET `/.well-known/security.txt` Security contact info

### Authenticated API
- POST `/api/supplemental` Upload EMU supplemental stats (CLI)
- GET|PUT `/api/studio/config` Load/save Studio preview configuration
- POST `/api/refresh?handle=` Force refresh (rate-limited)
- POST `/api/generate` Generate badge for authenticated user
- POST `/api/recalculate` Recalculate impact scores
- POST `/api/insights` Submit tool insights data
- GET `/api/cli/auth/poll` CLI device auth polling (RFC 8628-style: first poll issues + returns a `device_code`; subsequent polls from the CLI should echo it to bind the session to the initiating device; legacy CLIs that omit it still work)
- POST `/api/cli/auth/approve` CLI device auth approval
- POST `/api/challenge` Score challenge submission — authenticated, rate-limited; sends dispute email via Resend

### Admin API
- GET `/api/admin/users` Admin user list (session auth + admin check)
- GET `/api/admin/stats` Admin stats (bearer token auth via `ADMIN_SECRET`)
- POST|GET|DELETE `/api/admin/agents/run` Run an agent (requires `ALLOW_AGENT_RUN=true`)
- GET `/api/admin/agents-summary` Agent run summaries
- POST `/api/admin/bulk-recalculate` Force-recalculate impact scores for all or specified users (bearer token auth via `ADMIN_SECRET`)
- PATCH `/api/admin/feature-flags` Manage feature flags
- GET `/api/admin/engagement-flags` Manage engagement flags
- GET|POST `/api/admin/campaigns` Campaign list and creation (admin auth)
- GET|PATCH|DELETE `/api/admin/campaigns/:id` Campaign CRUD (admin auth, draft only)
- GET `/api/admin/campaigns/:id/preview` Campaign email preview (admin auth)
- POST `/api/admin/campaigns/:id/send` Initiate campaign send (admin auth)
- POST `/api/admin/campaigns/:id/test` Send test email for campaign draft (admin auth)
- GET `/api/notifications/unsubscribe` Email unsubscribe

### Webhooks & Cron
- **`vercel.json` must live at `apps/web/vercel.json`, not the repo root** — Vercel resolves the file relative to the project's Root Directory setting (`apps/web`), not the repo root. It lived at the repo root from project creation until #1052, so all four crons below were silently never registered for five months (no error, no log — the Vercel dashboard just showed the cron onboarding screen). See `docs/decisions/2026-07-16-vercel-json-must-live-in-root-directory.md` and the `check:vercel-config` CI gate below, which asserts the file's location.
- POST `/api/webhooks/resend` Resend email webhook (HMAC verified)
- GET `/api/cron/warm-cache` Hourly cache warming (bearer auth via `CRON_SECRET`; #1010 — was daily, bumped to hourly to shrink the per-handle staleness gap at the 50-handle/run ceiling)
- GET `/api/cron/sync-audience` Daily Resend audience sync (bearer auth via `CRON_SECRET`)
- GET `/api/cron/process-campaigns` Daily campaign batch processor (bearer auth via `CRON_SECRET`; #1035 — round-robins across all active campaigns per run within the time/quota budget, was previously limited to the first active campaign)
- GET `/api/cron/latency-check` Daily badge-route latency SLO synthetic monitor (bearer auth via `CRON_SECRET`); times `/u/:handle/badge.svg` and raises a P2 alert via `CHAPA_ALERT_WEBHOOK_URL` on p95 budget breach
- POST `/api/telemetry` Client telemetry ingestion

## Data & types
Shared types live in: `packages/shared/src/types.ts`
- `StatsData` — aggregated GitHub stats (30 fields, includes `batchSizeScore`, `medianPrLeadTimeHours`, `primaryReviewsSubmittedCount`)
- `ImpactV6Result` — 4–5 dimensions (Craft optional), archetype, composite score, confidence, tier
- `PublicImpactV6Result` / `ClientImpactV6Result` — `ImpactV6Result` with `confidence`/`confidencePenalties` omitted; used to redact confidence data out of the share page's server→client payload for visitors (#1067/#1122)
- `BadgeConfig` — Creator Studio visual customization (6 categories, all of which reach the SVG badge; `RETIRED_BADGE_CONFIG_KEYS` names the three dropped in #1191 and must be stripped from a persisted config before validation)
- `SupplementalStats` — EMU account merge payload
- `RawContributionData` — raw GraphQL response shape
- `MetricsSnapshot` — compact historical metric record (~300 bytes, stored in Supabase `metrics_snapshots` table)

## Rendering requirements
- Default badge size: 1200×630 (wide)
- Default theme: dark ground (`#0C0D14`) with the app's jade accent (`#1BD093`), converged in #1225. The `WARM_AMBER` constant name is historical; see `docs/svg-design.md`.
- SVG must be crisp and readable when scaled down
- Animations must be subtle (heatmap fade-in, impact pulse)

## Design system (MANDATORY for UI work)
- Full spec: @docs/design-system.md
- Accent color: jade, `oklch(.66 .15 163)` light / `oklch(.76 .16 163)` dark (#1206, replacing violet `#8B5CF6`). Use `text-amber`, `bg-amber` — the token name is retained deliberately; see design-system.md.
- Heading font: **JetBrains Mono** (`font-heading`) — monospace, no italic.
- Body font: **Plus Jakarta Sans** (`font-body`) — default on `<body>`.
- Light/dark theme support via `next-themes`. Light is the default; dark (`#08170f`, forest) is the signature brand look. Badge SVG always renders dark.
- All colors and fonts are defined in `apps/web/styles/globals.css` via Tailwind v4 `@theme`.

## Badge branding
Footer shows "Forged from purpose. Driven by curiosity." + dynamic platform logos (GitHub, Bitbucket, Codeberg, GitLab).
- Personal badges show only logos for platforms the user has connected
- Demo badges show all 4 platform logos (GitHub, Bitbucket, Codeberg, GitLab)
- Branding is behind a flag: `includeBranding`
- Branding is isolated in `apps/web/lib/render/BadgeBranding.tsx`
- Client-safe visual metadata lives in `apps/web/lib/badge-visual-metadata.ts`: platform logo paths, canonical platform order, and the verification coral token. Both the server SVG renderer and Studio preview consume it.
- Creator Studio renders the badge through `renderBadgeSvg` itself (`apps/web/app/studio/BadgePreviewCard.tsx`), so branding, platform logos and the verification strip come from `BadgeBranding.tsx` and `VerificationStrip.tsx` like everywhere else. `PreviewFooter.tsx` is gone — it drew a second footer beside the SVG's own (#1191, step 6). A saved Studio config changes the public SVG badge and the share page: the badge route resolves it via `resolveBadgeConfig(handle)` (`apps/web/lib/render/badge-config.ts`) and passes it to `renderBadgeSvg`, and saving invalidates that handle's badge cache (#1191, step 3).
- **This split is closed (#1191).** There is one badge implementation: `renderBadgeSvg`. It consumes all six surviving `BadgeConfig` categories; the three that could never cross to an SVG were dropped from the schema rather than labelled. `BadgeContent` was a second, DOM-based badge whose every visual element was maintained twice — it is now a ~60-line wrapper over `renderBadgeSvg`, used only by the flag-gated `/experiments/*` prototypes. **A badge visual is changed in one place now.** The decision, the invariants that must survive, and how badge design versions are tracked are in `docs/decisions/2026-08-30-one-badge-artifact.md`.
- Avatar placeholder (when no user photo) shows the Chapa shield icon

## Caching rules
- Cache computed stats + impact per user/day (TTL 6h primary, 7-day stale-fallback tier)
- Cache SVG output per user/day + theme + locale (TTL 24h + per-handle jitter of 0–2h to spread UTC-midnight recompute spikes)
- **Lifetime metrics**: `MetricsSnapshot` records stored in Supabase `metrics_snapshots` table — permanent history. Max 1 snapshot per user per day (UNIQUE constraint on handle+date). Captured automatically by cron warm-cache, badge route `after()`, and refresh endpoint.
- **Supplemental EMU stats**: durably stored in Supabase `supplemental_stats` table (one row per `target_handle`). Redis (`supplemental:<handle>`, 24h TTL) is the hot read path; on miss, `getStats()` falls back to Supabase and rehydrates Redis via fire-and-forget. A missed CLI upload day no longer drops EMU data from scores. Supplemental is composed onto GitHub-derived stats *after* the integrity guards run, and is deliberately excluded from the `stats:stale:v2:` baseline (#1060) — so a scope-rejected fetch re-composes the current supplemental instead of discarding it.
- **EMU handles never enter the primary `users` registry (#1199)**: the permanent `users` table (backing the warm-cache cron's handle list) is meant to hold primary GitHub identities only. `dbUpsertUser` no-ops and `dbGetAllUserHandles` filters out any handle that fails `isValidHandle` (EMU source handles can contain underscores) — otherwise a bad EMU handle got registered here and the hourly warm-cache cron retried an account the server token can never resolve, forever.
- **Only OAuth registers a user (#1239)**: `dbUpsertUser` is called from exactly one place, `app/api/auth/callback/route.ts`. Rendering a badge or a share page must never insert into `users`, because `/u/:handle` and `/u/:handle/badge.svg` accept any handle on earth: `getStats()` used to end with a `dbUpsertUser(handle)` fire-and-forget, so viewing a stranger's badge registered that stranger, gave them a name and avatar, and handed them to the hourly warm-cache cron, which then recomputed and re-snapshotted them daily. Guido van Rossum, Linus Torvalds and `octocat` were all in the production `users` table this way, with no email and no `user_platforms` row — the two things only the OAuth callback writes, and therefore the test for whether a row represents a real signup. The badge path may still *refresh* an existing user's name and avatar for `/admin`, via `dbUpdateUserProfile`, which is an UPDATE and matches nothing when the handle was never registered. A new caller that needs to record a handle belongs on the authenticated side of this line, not in the render path.
- **Scoring/cache seam flag combinations**: `materializeProfile` and `getStats` thread seven flags through one path (`readOnly`, `inputsChanged`, `ignoreSnapshot`, `policy`, `today`, plus the derived `statsComplete` and `fetchScope`). What each one does to cache reads, cache writes, live GitHub fetches, snapshot persistence and verification minting - and the three combinations that account for most of this seam's bug history - is a single derived table in `docs/decisions/2026-08-30-scoring-cache-seam-flag-combinations.md` (#1192). That table is the one place those rules are written; a new flag on this seam belongs in it, in the same commit that adds it.
- **Degraded-fetch protection (#1002, corrected #1050)**: GitHub's `contributionsCollection` is scoped to the authenticating token. The GitHub OAuth app requests no `repo` scope (`OAUTH_SCOPES`), so a user's own session token cannot see their private-repo merges — it is the *blinded* fetch. The server `GITHUB_TOKEN` (used by the warm-cache cron, bulk-recalculate, and any anonymous/tokenless badge hit) is `repo`-scoped and private-inclusive. `isDegradedPrFetch()` (`apps/web/lib/github/stats-integrity.ts`) detects the resulting collapse; `getStats()` then serves last-known-good, does **not** overwrite the `stats:stale:v2:<handle>` baseline (preserving the fallback), refreshes only the primary key with the re-composed value, and emits a `github_degraded_pr_fetch` telemetry event (carrying the classified `fetchScope` since #1060). The guard only blocks good→bad, so the next fetch by the server token heals the data and it sticks. A user's own Refresh click cannot repopulate private-repo PRs — only the server `GITHUB_TOKEN` can (or a future OAuth app requesting `repo`). `/api/health` asserts the server token still carries `repo` (`insufficient_scope` status otherwise, #1047). See `docs/accepted-risks.md` ("OAuth app requests no repo scope") for the full model, and the flag-combination table above for what `fetchScope` gates.
- **Scoring-data integrity contract (#1004, corrected #1045)**: a three-boundary defense on top of #1002 that ends the "degraded fetch collapses a score" class of bug at its root. Fetch boundary: `assessRawFetchIntegrity` rejects a structurally-inconsistent payload before it's scored, cached, or persisted — checking that the merged-PR sample's node count matches its own `totalCount` claim; `search(is:merged)` is token-scoped just like `pullRequestContributions`, so it cannot serve as an independent "authoritative" cross-check (a blinded fetch under-reports both fields consistently and the check would silently agree with itself). Cache boundary: scope-aware, non-downgrading writes — a lower-scoped fetch (`fetchScope: "public"`, e.g. a user's own session-token refresh, which omits `repo`) can never clobber a higher-scoped cache entry (`fetchScope: "authenticated"`, private-inclusive — e.g. the server `GITHUB_TOKEN`). **The guards operate exclusively on GitHub-derived stats (#1060/#1061, ADR `docs/decisions/2026-08-11-scoring-data-integrity-contract.md`)**: linked-platform and EMU supplemental data compose onto whichever GitHub-derived value the guards select, never before them. `stats:stale:v2:<handle>` is the protected baseline and holds GitHub-derived data ONLY (so it is composed the same way as the fresh value it is compared against); `stats:v2:merged:<handle>` holds the composed value callers receive. Composing first meant a rejected fetch silently discarded a fresh EMU merge for 6h (#1060) and a large supplemental could lift a scope-blinded fetch over both detection signatures (#1061). A rejected fetch now returns the better-scoped composed value to the caller, and a new data source belongs in `_compose`, never in the guard input. Persist boundary: snapshot history and the HMAC verification record are gated on stats completeness. `stats_fetch_rejected` / `snapshot_skipped_incomplete_stats` telemetry surface degradation in production; `heal-poisoned-stats` (maintenance script) repairs already-poisoned cache keys and snapshot rows. `scripts/recalculate-handles.ts` (`pnpm run recalculate-handles <handle>...`, dry-run by default) is the complementary tool for a *different* case — forcing one or more handles to recompute with current scoring code after a scoring bugfix ships, since a plain cache-bust isn't enough (the badge route's own SVG cache short-circuits, and a recomputed snapshot needs the `stats:dirty:<handle>` marker set to actually persist past the same-day UNIQUE constraint).
- **Snapshot-write reconciliation**: `reconcileSnapshotWrite` (`apps/web/lib/profile/snapshot-write.ts`) wraps the Supabase `metrics_snapshots` write and its Redis mirror as one saga, tracking a tri-state write outcome (`inserted` / `duplicate` / `failed`, #1015/#1016 — detected via row presence on the upsert response, not the PostgREST HTTP status code). A benign same-day `duplicate` still gets an opportunistic cache refresh rather than being treated as a failure; only a genuine `failed` write emits a structured P2 operational alert (suppressed when Redis is unconfigured). The public badge path (`persistProfileSnapshot`) escalates a genuine failure via `captureServerError` instead of silently discarding it (#1009) — satisfying the "durable write failure must be observable" rule below. Note: the saga only observes a single call's own outcome — it has no visibility into a race between concurrent producers (badge route, warm-cache cron, refresh, recalculate); this is an accepted, self-healing (via the next warm-cache pass) risk, not solved with locking.
- **Campaign send leases**: `claim_campaign_sends()` atomically claims one
  stable batch for a worker. Provider idempotency keys derive from that stable
  batch membership and must survive retries. After delivery,
  `acknowledge_campaign_sends()` applies the complete sent/failed result set in
  one transaction; empty, partial, or mismatched acknowledgements fail closed.
  A persistence failure must release or expire the lease so the same batch can
  be replayed safely, never silently reported as delivered. An oversized batch
  that gets recovered but exceeds the day's remaining quota carries a
  `group_token` (`campaign_sends.group_token`, migration `033`) so its
  membership stays identifiable across processing↔pending transitions —
  `release_campaign_send_lease()` releases the whole group back to `pending`
  as one unit instead of splitting it, preserving the indivisible membership
  provider idempotency keys depend on (#1085).
- **Feature flags**: Async DB-backed flag reads live in `apps/web/lib/feature-flags.ts` (server-only). Synchronous client-safe helpers (`isStudioEnabledSync`, etc.) live in `apps/web/lib/feature-flags-sync.ts` — use the sync module in client components and middleware; use the async module in server actions and API routes. An **absent** flag row is a normal, load-bearing state, not an error: `dbGetFeatureFlag` returns `null` and `checkFlag` falls back to the env var, so the DB read guards `if (!data) return null;` before `parseRow` rather than letting a missing row log a schema-mismatch warning (#1209). Every flag key the app reads now has a seeded row — migration `037` added `insights_integration`, completing `026`'s sweep (#857), which had covered bitbucket/codeberg/gitlab and missed it (#1210).
- **Rate-limit fail-open (with fail-closed exceptions)**: The Redis rate limiter (`rateLimit()` in `lib/cache/redis.ts`) allows all requests when Redis is unavailable (fail-open) on public reads — blocking every embedded badge because Redis is temporarily down is worse than briefly losing rate enforcement, and GitHub's own API limits + CDN caching provide secondary protection. Auth-critical and write routes use `rateLimitStrict` (fail-closed) instead: `/api/auth/session`, `/api/refresh`, and — since #1027 — all platform OAuth connect/callback/disconnect routes (Bitbucket/Codeberg/GitLab), which also share GitHub's single-use replay-consume nonce via a per-platform `chapa_<provider>_oauth_state_store` cookie. See `redis.ts` for the full fail-open rationale.
- Response headers for badge endpoint (6h s-maxage provides fresher badge updates):
  - `Cache-Control: public, s-maxage=21600, stale-while-revalidate=86400`
- **Badge latency SLO (#974)**: the badge route (`/u/:handle/badge.svg`) has a defined p95 latency budget — **800ms cache-hit**, **4100ms cache-miss** — enforced in `apps/web/lib/monitoring/latency-slo.ts`. Every badge response carries a `Server-Timing` header (`cache;desc="hit"` on warm hits, `cache;desc="cache-timeout"` when a Redis read exceeds its deadline (#1014), `materialize` + `render` breakdown on cold misses; always a `total`) so per-request latency is inspectable. The `/api/cron/latency-check` daily synthetic monitor times the live endpoint, writes its own heartbeat (monitored by `/api/health`, #1018), and raises a P2 `badge_latency_slo_breach` operational alert via `CHAPA_ALERT_WEBHOOK_URL` when the budget is exceeded (or the probe fails). Against this budget: the SVG cache-read deadline is 500ms (#1014, was 250ms — too tight, misclassified genuine hits as misses under Redis tail latency), the render-lock loser's poll budget is ~950ms (#1029, was ~2000ms), the avatar fetch is capped at 1000ms and skips the shared cache write on timeout (#1029/PE-L1), and the durable snapshot persist runs in `after()` rather than blocking the response (#1013). **Materialize deadline + background continuation (#1086)**: on a cold miss where a stale (yesterday's) SVG already exists, the foreground request races the materialize call against a 2200ms `BADGE_MATERIALIZE_DEADLINE_MS` deadline — on timeout it serves the stale SVG with a short-TTL `s-maxage=60` header instead of blocking further, while the original materialize call keeps running via `warmBadgeCacheInBackground` so the next request is warm. `finalizeMaterializedBadge`/`runBadgeSideEffects` are shared between the foreground and background paths so side effects (snapshot persist, cache writes) run exactly once either way. Avatar cache writes now track four outcomes instead of one boolean — success, real-fetch-failed, **permanently absent** (no `avatarUrl` at all, cached for a short `AVATAR_ABSENT_CACHE_TTL_SECONDS` window), and race-timeout (never cached) — so a handle with no avatar (e.g. a README embed) still gets cache population instead of forcing a full materialize+render on every request (#1080/#1088).

## Code ownership areas
- OAuth: `apps/web/app/api/auth/*`, `apps/web/lib/auth/*`
- GitHub data: `apps/web/lib/github/*`, `apps/web/lib/cache/*`
- Platform integrations: `apps/web/lib/bitbucket/*`, `apps/web/lib/codeberg/*`, `apps/web/lib/gitlab/*`
- Impact scoring: `apps/web/lib/impact/*`, types in `packages/shared`
- SVG rendering: `apps/web/lib/render/*`, `apps/web/app/u/[handle]/badge.svg/route.ts`
- Share page: `apps/web/app/u/[handle]/page.tsx`, `apps/web/components/*`
- Lifetime history: `apps/web/lib/history/*`
- Data access (Supabase): `apps/web/lib/db/*`
- Admin dashboard: `apps/web/app/admin/*`, `apps/web/components/AdminDashboardClient.tsx`
- Account settings: `apps/web/app/settings/*` (#1223) — connections, AI insights import and identity on a real page instead of only inside `UserMenu`'s dropdown. The connection and import logic lives in `apps/web/lib/platform/use-platform-connections.ts` and `apps/web/lib/insights/use-insights-import.ts`, shared with `UserMenu` rather than copied — the badge already taught this lesson (#1191). Account deletion is deliberately out of scope: it exists only as `scripts/delete-user.ts`, and making it self-serve is a retention decision, not a UI one.
- Global command bar: `apps/web/components/GlobalCommandBar.tsx`, `apps/web/components/terminal/command-registry.ts`
- Section header pattern: `apps/web/components/SectionHeader.tsx` (#1214) — the `% chapa <command>` marker plus right-aligned meta and rule, used by the landing page's sections
- Content page shell: `apps/web/components/content/*` (#1218) — `ContentPageHeader` (marker + title + intro) and `OnThisPageIndex` (sticky section index with an accent rail), shared by `/about`, `/about/scoring`, `/about/verification`, `/privacy`, `/terms` and `/verify`
- Share page header: `apps/web/app/u/[handle]/SharePageHeader.tsx` (#1217) — identity paired with the headline score, tier pill and verification pill
- Tooltips: `apps/web/components/InfoTooltip.tsx`, `apps/web/components/BadgeOverlay.tsx` (portal-rendered, viewport-fixed, auto-flip near the top of viewport — #1021)
- Navigation: `apps/web/components/NavbarShell.tsx` (shared presentational markup), `apps/web/components/Navbar.tsx` (server variant, non-ISR pages), `apps/web/components/NavbarClient.tsx` (client variant, ISR pages) — #1025
- Dimension/intensity colors (client-rendered heatmap/tooltip surfaces): `apps/web/lib/utils/dimension-colors.ts` (#1040) — deliberately separate from the server-rendered badge SVG's own literals in `apps/web/lib/render/theme.ts`
- i18n: `apps/web/lib/i18n/*` (dictionaries, detection, server/client translation, locale cookie, `tArray`/`tObject` typed accessors — use these, not an unchecked `t() as string[]` cast, #1026); `apps/web/proxy.ts` (locale-segmented content-page rewrite, #1023); `apps/web/app/[locale]/*` (the 9 locale-segmented content pages)
- Dashboard components: `apps/web/lib/dashboard/generate-insights.ts`, `apps/web/components/dashboard/DimensionCard.tsx`, `apps/web/components/dashboard/InsightCard.tsx`, `apps/web/components/dashboard/SubMetricPanel.tsx`
- Share toolbar: `apps/web/components/BadgeToolbar.tsx`
- Badge verification: `apps/web/lib/verification/*` — HMAC-SHA256 hash generation/verification (`hmac.ts`), verification record types and Supabase persistence (`store.ts`); backs goal #6 and `/verify/:hash`, `/api/verify/:hash`
- Analytics & error capture: `apps/web/lib/analytics/*` — PostHog client (`posthog.ts`) and `captureServerError` (`server-errors.ts`, 56+ importers — the highest-fan-in module in `lib/`) for structured server-side error/event capture
- Email: `apps/web/lib/email/*` — Resend client (`resend.ts`), transactional templates (`challenge.ts`, `notifications.ts`, `score-bump.ts`, `templates/announcement.ts`), campaign send payloads (`campaigns.ts`), Resend audience sync (`audience.ts`), unsubscribe URL signing (`unsubscribe-url.ts`)
- AI tool insights: `apps/web/lib/insights/*` — parses, validates, and scores uploaded AI coding tool reports (e.g. Claude Code) backing `/api/insights` and the dashboard insights panel
- Agent tooling: `apps/web/lib/agents/*` — reads and parses agent run reports/config for `/api/admin/agents/run` and `/api/admin/agents-summary`
- Campaigns: `apps/web/lib/campaigns/*` — campaign send payload construction/validation shared by `/api/admin/campaigns/*` and `/api/cron/process-campaigns`
- Score challenge: `apps/web/lib/challenge/*` — validation for `/api/challenge` score dispute submissions
- Crypto helpers: `apps/web/lib/crypto/*` — constant-time comparison (`safe-equal.ts`) for HMAC/token verification
- Leftover DOM effects: `apps/web/lib/effects/*` — no longer Studio's, since the six customization categories are rendered by `lib/render/badge-effects.ts` into the SVG (#1191, step 6). What survives here does so for a different consumer: `counters/` and `text/ScoreEffectText` + `tier/TierVisuals` for the dashboard, `heatmap/animations`, `interactions/use-tilt` and `celebrations/confetti` for their `/experiments/*` prototypes, and `defaults.ts` for the Studio presets. The DOM background, border, card-style and heatmap-grid implementations were deleted with `BadgeContent`.
- Creator Studio UI: `apps/web/app/studio/*` — authenticated owner preview (the real badge SVG), controls, save state, and command actions. `page.tsx` resolves the badge avatar server-side against a bounded deadline, as the badge route does, so the preview draws the owner's photo rather than the shield placeholder
- Creator Studio config: `apps/web/app/api/studio/config/route.ts`, `apps/web/lib/db/studio.ts` — Supabase is the only store; both GET and PUT read/write it directly with no Redis involvement (#1186/BE-L1 removed the Redis read because every cache hit still required a second, independent Supabase revision check to trust it; a later remediation removed the now-orphaned Redis write too, since nothing read that mirror back once the read path stopped consulting it). Migration 035's `revision` column and `set_studio_config_revision` trigger remain — `dbGetStudioConfig` still validates and returns a monotonically-increasing `revision` per row — but nothing outside this module consumes it today.
- HTTP utilities: `apps/web/lib/http/*` — client IP extraction (`client-ip.ts`) for rate limiting
- Keyboard shortcuts: `apps/web/lib/keyboard/*` — shortcut registry and React hook for the terminal/command-bar UI
- Monitoring: `apps/web/lib/monitoring/*` — badge latency SLO budgets and measurement (`latency-slo.ts`) backing `/api/cron/latency-check`
- Platform aggregation: `apps/web/lib/platform/*` — fetches and merges linked-platform (Bitbucket/Codeberg/GitLab) stats onto GitHub-derived stats
- Profile materialization: `apps/web/lib/profile/*` — orchestrates stats fetch → impact compute → snapshot persistence (`materialize-profile.ts`, `orchestrated-profile.ts`, `public-profile.ts`, `snapshot-write.ts`, `post-write-invalidation.ts`, `persist-guard.ts`) for the badge, share page, refresh, and recalculate paths
- Async utilities: `apps/web/lib/async/*` — fire-and-forget, timeout wrapping, and batch processing helpers used across cron/cache/warm-cache paths
- Test helpers: `apps/web/lib/test-helpers/*` — shared fixtures and mocks (admin auth, platform auth, dynamic mocking) reused across the test suite
- Design-token sync: `.design-sync/*` — `emit-tokens.mjs` plus `conventions.md`, `fonts.css`, and component previews under `.design-sync/previews/`; the tooling that keeps external design work aligned with the Jade palette (#1206). Not part of the app bundle.

## Acceptance criteria
- A user can log in with GitHub (OAuth success).
- `/u/:handle/badge.svg` loads publicly without auth (use cached public stats where possible).
- Badge shows: heatmap, radar chart (4 or 5 dimensions — pentagon when Craft is present, diamond fallback), archetype label, stars/forks/watchers, Impact tier, adjusted score.
- `/u/:handle` shows badge + breakdown + embed snippet. Confidence (% + penalty flags) is shown only to the profile owner in the "How is my score calculated" panel; it is hidden from visitors and excluded from public metadata (JSON-LD). Enforced server-side, not just UI-hidden (#1067/#1122): `redactImpactForVisitor()` (`apps/web/lib/profile/public-profile.ts`) strips `confidence`/`confidencePenalties` before the impact object ever crosses into the `"use client"` tree, so a visitor's RSC payload never contains confidence data.
- Caching prevents repeated GitHub API calls for same handle within 24h.
- Confidence messaging is non-accusatory (never claims wrongdoing).
- Repo contains `docs/impact-v6.md` (current spec truth), `docs/impact-v4.md`, `docs/impact-v5.md`, and `docs/svg-design.md`.
- Creator Studio at `/studio` allows badge customization (6 visual categories). Saving a config changes the embedded SVG badge and invalidates its cache. The three categories that could never reach an SVG — a hover tilt, a counting animation, a confetti burst on load — were removed in #1191 rather than shown as preview-only decoration.
- Admin dashboard at `/admin` shows user table with refresh, sortable columns, and command bar.
- Badge and breakdown elements have explanatory tooltips (hover/tap/keyboard accessible).
- Lifetime metric snapshots are recorded automatically (cron, badge route, refresh).
- Solo profile detection uses review-to-PR ratio threshold (0.15), not binary reviews === 0.
- Consistency dimension uses week coverage (active weeks / total weeks) instead of inverse burst.
- Quality dimension uses batch size score (fraction of PRs in 20-500 line sweet spot) instead of inverse micro-commit ratio.
- Quality dimension never punishes participation in code review: collaborative `computeQuality` returns `max(collaborativeFormula, soloFormula)` so users with strong solo signals don't drop sharply when crossing the 0.15 review-to-PR threshold (the cliff guard, #827).
- Delivery dimension applies a ±5% lead time modifier based on median PR open-to-merge duration.

## Engineering rules
- Prefer pure functions for scoring & rendering.
- Escape/encode any user-controlled text in SVG (handle, display name).
- Handle GitHub rate limit errors gracefully (serve cached or show "try later").
- A 500 on legal user input is always a bug.
- A durable write that fails but reports success is always a bug. Per-route
  behavior may be loud (5xx) or graceful (`persisted:false`), but every durable
  write failure must be observable through capture/logging.
- New write endpoints must be registered in the payload-matrix contract suite
  (`pnpm run check:write-registration`).
- **Accepted risks**: See `docs/accepted-risks.md` for formally documented design decisions and known limitations. Items in that file are intentional and should not be flagged as audit warnings.

## Deployment
- Production deploys from `main` only. Changes pushed to `develop` must be merged to `main` via PR before they go live.
- Always confirm the target branch before pushing — if the goal is production deployment, ensure the PR targets `main`.

## Language & Tone
- All user-facing content for the Asturias project must be in Spanish unless explicitly stated otherwise.
- For social media copy: keep tone confident and positive — avoid pitying, resentful, or overly dramatic language. Never mention unreleased/unpublished features.

---

## Internationalization (i18n)

The app supports two locales: `en` (English, default) and `es` (Spanish). All public-facing pages are translated.

### Architecture
- **Dictionaries**: `apps/web/lib/i18n/dictionaries/en.ts` and `es.ts` — both must be kept in sync (650+ leaf keys each). Run `pnpm run test` to verify key parity via `dictionaries/parity.test.ts`.
- **Locale detection**: `apps/web/lib/i18n/detect.ts` — reads the `chapa-locale` cookie first, then `Accept-Language` header, falls back to `DEFAULT_LOCALE` ('en').
- **Static rendering — locale-segmented content pages (#1023 / FE-H1)**: The 9 public content pages (`/`, `/about`, `/about/scoring`, `/about/verification`, `/privacy`, `/terms`, and the 7 `/archetypes/*` pages) are real React Server Components under `app/[locale]/...`. `apps/web/proxy.ts` (Next.js 16's root proxy file, formerly "middleware") rewrites the canonical, unprefixed request (e.g. `/about`) to the internal `/[locale]/about` route, resolving `locale` from the `chapa-locale` cookie first, then `Accept-Language`, falling back to `DEFAULT_LOCALE` — the same priority order as `getServerT`/`detect.ts`. `app/[locale]/layout.tsx`'s `generateStaticParams` pre-renders BOTH `/en/...` and `/es/...` variants at build time, so the rewrite always resolves to a cache hit: translated copy renders correctly on the very first response, with **no locale flash and no client-side re-render** for these 9 pages. The public URL never carries a locale prefix (no redirects — only rewrites); see `docs/decisions/2026-07-15-i18n-middleware-carve-out.md` for the narrow `proxy.ts` matcher and its relationship to the earlier no-middleware ADR. **Unaffected by this migration**: `/u/[handle]`, `/u/[handle]/badge.svg`, `/studio`, `/admin`, `/cli/authorize`, and all other non-migrated routes keep whatever i18n behavior they had before — the root layout still renders its shared client chrome (nav, `LanguageSwitcher`, `GlobalCommandBar`) statically at `DEFAULT_LOCALE` via the client `LanguageProvider`/`useTranslation()` context described below, so those small, shared components (not the 9 migrated pages' bodies) may still show a brief flash on non-default-locale loads — an accepted, out-of-scope trade for keeping the root layout free of per-request cookie/header reads.
- **Dynamic routes use one shared boundary (#1194)**: the static root layout cannot read cookies or headers, so it pins the locale at `DEFAULT_LOCALE` (#861, which is what keeps ISR alive) and sources no session. Every dynamic route therefore needs three separate corrections — the server `Navbar` for session, `DocumentLocaleMarker` for `<html lang>`, and a nested `LanguageProvider` for the real dictionary. The root layout's single `beforeInteractive` bootstrap applies inert locale markers while the initial HTML streams; each marker's layout effect handles later client navigation without rendering an executable `<script>` inside the changing route tree. `apps/web/components/DynamicRouteShell.tsx` renders all three route-owned parts together, so a route gets all of them or none instead of three chances to forget one. FE-H2 and FE-M1 were both that decision made inconsistently, and `/studio`, `/admin` and `/settings` were still missing both locale corrections until this landed. **A statically generated page must never import the shell** — it reads request state, so one import under `app/[locale]/` silently converts that page to dynamic and destroys the CDN caching #982/#1023 exist to preserve. `DynamicRouteShell.boundary.test.ts` fails if any `app/[locale]/` file or any `layout.tsx` imports it; static pages keep `NavbarClient`, which is exactly why that variant exists (#1025).
- **Server components**: `import { getServerT } from '@/lib/i18n/server'` — pass the `locale` from params/cookies. On the 9 migrated content pages, `locale` comes from the route's `[locale]` segment param (via `await params`), not from `DEFAULT_LOCALE` or `getServerLocale()`.
- **Client components**: `import { useTranslation } from '@/lib/i18n'` — returns `{ locale, t, setLocale }`. Always wraps in `LanguageProvider` on any real page.
- **Key resolution**: `t('section.key')` returns a string (or subtree for intermediate keys). Leaf keys always return `string` — cast with `as string` when TypeScript needs it for HTML attrs.
- **Locale switching**: `LanguageSwitcher` component calls `setLocale()`, which sets the `chapa-locale` cookie and soft-reloads via `router.refresh()`.

### Adding new strings
1. Add the English string to `en.ts` and the Spanish string to `es.ts` under the same key path.
2. Both files must have identical key structure — `parity.test.ts` will fail otherwise.
3. Use `t('section.key') as string` for `aria-label` and other HTML string attributes.
4. `DEFAULT_LOCALE` is `'en'` (#1201). It is the fallback for a request that carries **no locale signal at all**. A `chapa-locale` cookie wins first, then `Accept-Language`, in `proxy.ts`, `getServerLocale` and `detect.ts` alike, so a Spanish visitor still gets Spanish. The signal-less case is not rare here: a README `<img>` embed of `/u/:handle/badge.svg` sends no cookie and no useful header (the badge route resolves locale purely from `?lang=`), so every un-qualified embedded badge renders in this locale for a worldwide audience. It also governs the statically-built shells (root layout, the `loading.tsx` files, `/verify`) and the badge the warm-cache cron pre-warms.
5. **A page that overrides the client dictionary must pick it from `locale`, never hardcode one.** The root layout renders at `DEFAULT_LOCALE` and supplies that dictionary; a locale-segmented page passes `undefined` when its locale matches (reusing the root copy) and the *other* locale's dictionary otherwise: `dictionary={locale === DEFAULT_LOCALE ? undefined : locale === "es" ? es : en}`. `app/[locale]/page.tsx` previously spelled that final branch as a bare `en`, which was only correct while the default was `'es'`; #1201 fixed it. `/verify`, `/verify/[hash]` and `/u/[handle]` already used the locale-derived form.
6. Tests use English via the `useTranslation` fallback (no LanguageProvider).

### Key paths (common)
| Path | Usage |
|------|-------|
| `aria.*` | All `aria-label` strings for accessibility |
| `landing.*` | Landing page copy |
| `about.*` | About / scoring page copy |
| `sharePage.*` | Share page (`/u/:handle`) copy |
| `privacy.*`, `terms.*` | Legal pages |
| `archetypes.*` | Archetype guide pages |

---

## RPI Workflow

This project follows Research-Plan-Implement (RPI).

1. /research -- Understand the codebase as-is
2. /plan -- Create a phased implementation spec
3. /implement -- Execute one phase at a time with review gates
4. /validate -- Verify implementation against the plan

Each phase is its own conversation. STOP after each phase.
Use /clear between tasks, /compact when context is heavy.

## Project File Locations

Go directly to these paths -- never search for them.

| Topic | Path | Notes |
|-------|------|-------|
| Agent reports | `docs/agents/*-report.md` | Gitignored on public repos; tracked on private (Rule #70) |
| Agent logs | `logs/<name>.log`, `<name>.error.log` | Gitignored. Read alongside reports to diagnose failures |
| Agent scripts | `scripts/agents/` | Gitignored. Standalone bash files invoking Claude CLI headless |
| ADRs | `docs/decisions/` | Architecture decision records |
| Research docs | `docs/research/YYYY-MM-DD-description.md` | |
| Plans | `docs/plans/YYYY-MM-DD-description.md` | Phase files in `-phases/phase-N.md` |
| Reliability playbooks | `docs/playbooks/reliability-hardening-playbook.md` | Seam-bug hardening reference |
| Reliability plan | `docs/plans/2026-07-03-reliability-hardening.md` | Contract matrix, canaries, process guarantees |
| E2E Pro architecture | `docs/playbooks/e2e-pro-release-verification.md` | Comprehensive decisions and evidence semantics |
| Production E2E verification | `.claude/commands/prodplaybook.md` | Standalone freshness audit and verification; never releases |
| Production release procedure | `docs/release/release-playbook.md` | Single short ordering and authorization authority |

---

# Development

## Git Workflow

**`develop` is the default branch. `main` is production only.**

1. All development happens on `develop`
2. Never commit directly to `main` — it represents what's deployed
3. Release to production via a `develop` → `main` **merge-commit** PR, following
   `docs/release/release-playbook.md`; PR, merge, and tag approvals are separate.
   **Never squash a release PR.** A squash does not record the released
   `develop` commit as a parent, so the *next* release PR computes a stale
   merge-base — it comes back `CONFLICTING`, and a conflicting PR runs
   none of its `pull_request` checks, so the pending-migrations gate reports
   `skipped` rather than failing. That cost 40 hand-made back-merge commits and
   an auto-back-merge workflow that never once succeeded (it could not push to
   protected `develop`). A merge commit records the released `develop` commit
   as a parent, advances the shared merge-base, and needs no reconciliation;
   `git log --first-parent main` still reads one line per release. See #1228.
   Feature PRs into `develop` may still squash.
4. Always run checks before committing (pre-commit hooks enforce this)
5. Always `git pull --rebase` before pushing
6. Run verification sequentially with `;` or `&&`, never as parallel Bash calls

### Commit Messages

Use conventional commits with issue references:

```
feat(badge): add heatmap fade-in animation (#12)
fix(oauth): handle token expiry on callback (#7)
test(impact): add boundary tests for confidence clamp
chore: update dependencies
```

Prefixes: `feat`, `fix`, `test`, `refactor`, `chore`, `docs`

### Branch Naming

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feature/short-name` | `feature/heatmap-animation` |
| Bug fix | `fix/short-name` | `fix/oauth-token-expiry` |
| Refactor | `refactor/short-name` | `refactor/scoring-pipeline` |
| Chore | `chore/short-name` | `chore/update-deps` |

## Testing & CI
- This project uses TDD. Always write tests before or alongside implementation.
- All PRs must have CI green before merging. Run the full test suite locally before pushing.
- After merging to `develop`, production release work follows
  `docs/release/release-playbook.md`. Do not infer release PR or merge
  authorization from feature completion or green CI.

### CI Gates (enforced in CI, must pass locally too)
- **Circular dependency check**: `pnpm run check:circular` (via `madge`, pinned to 8.0.0 as a devDependency) — no circular imports allowed. It ran as `pnpm dlx madge` until #1153, which resolves the latest version at run time: a gate whose analyzer can change between two runs of the same commit cannot be compared before and after a toolchain upgrade. Changing the resolver is a visible commit now.
- **Toolchain majors are held back deliberately.** TypeScript stays on 6.x and ESLint on 9.x: `typescript-eslint` admits no TypeScript 7, and three plugins reached through `eslint-config-next` cap at ESLint 9 (`eslint-plugin-react` throws at rule-load time under 10). Measured, with the gate baseline and the unblock conditions, in `docs/decisions/2026-08-30-toolchain-major-upgrades-blocked.md` (#1153). Re-measure the gates before and after any future attempt — a major upgrade can leave a gate green while it analyzes fewer files, edges or rules, so command success is not evidence.
- **`no-process-env` ESLint rule**: direct `process.env` access is banned outside `apps/web/lib/env.ts` (allowlisted). All env reads go through the centralized env module. Catches both `process.env.X` member access and a bare `process.env` reference (e.g. `{ ...process.env }`, #1017).
- **`packages/shared` import boundary**: application code may not import from `packages/shared` via relative paths — use the workspace alias (`@chapa/shared`).
- **Bundle-size budget**: the largest JS chunk must stay under 350 KB (checked in CI via build output analysis).
- **Coverage thresholds**: configured in `vitest.config.ts` — a global floor, plus tighter per-module floors for `apps/web/lib/impact/**` (95/90/95/95 stmt/branch/fn/line) and `apps/web/lib/github/stats-integrity.ts` (90/85/90/90) so a regression can't strip tests from the scoring pipeline or the degraded-fetch guard and still pass on the strength of the rest of the codebase's coverage (#1028).
- **Contract-test job runs on Node 24**: the rest of CI (and local dev) targets Node 20+, but the `ci.yml` contract-test job pins Node 24 specifically — match that version if debugging that job locally. Run it locally via `pnpm run test:contract:local` (wraps `supabase status -o env`, never reads `.env.local`, #1036).
- **Vulnerability scan**: `pnpm run check:vulnerabilities` (`scripts/check-vulnerabilities.ts`, via `osv-scanner`) — fails only on HIGH/CRITICAL vulnerabilities with a published fix. Replaced `pnpm audit`, which had been silently scanning zero packages after npm retired its legacy audit endpoint (#1008).
- **License compliance**: `pnpm run check:licenses` (`scripts/check-licenses.ts`) — an explicit allowlist (MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, CC0-1.0) with documented per-package exceptions in `docs/accepted-risks.md`, rather than a denylist that missed most non-allowlisted licenses (#1012).
- **Pending-migrations check**: `pnpm run check:pending-migrations` (`scripts/check-pending-migrations.ts`) — runs on PRs targeting `main`, fails if the linked production Supabase project has schema drift from `supabase/migrations/` (#1011).
- **Vercel config location check**: `pnpm run check:vercel-config` (`scripts/check-vercel-config.ts`) — asserts `apps/web/vercel.json` exists at the Vercel project's Root Directory and every path it references resolves. Added by #1052 after `vercel.json` sat at the repo root (unread) for five months with all four crons silently unregistered and no error anywhere.

## Test Conventions

- **File placement:** Tests live next to source files: `impact.ts` → `impact.test.ts`
- **Naming:** `<source-file-name>.test.ts` or `.test.tsx`
- **Structure:** Use `describe` blocks grouped by behavior area
- **Mocking:** Dependencies mocked at module level with `vi.mock()`, configured per test with `vi.mocked()`
- **API routes:** Test by importing the handler directly and passing a `NextRequest`

## Key Commands

```bash
# Before committing
pnpm run test           # Unit + script suites (contract tests: pnpm run test:contract:local)
pnpm run typecheck      # Check types
pnpm run lint           # Check linting

# Testing
pnpm run test:watch          # Watch mode
pnpm run test:coverage       # Coverage report
pnpm run test:contract:local # Contract suite against local Supabase (run `supabase start` first)
pnpm run test:e2e -- --grep @release-required # Required deployed selectors

# Release direct-proof commands
pnpm run release:validate-docs   # Validate the release documentation contract
pnpm run release:verify-identity # Verify a candidate's deployed identity
pnpm run release:write-result -- --stage preview --input "$inputPath" --output "quality/evidence/runs/$runId/release-result.json"

# Development
pnpm run dev            # Local dev server (port 3001)
pnpm run build          # Production build
```

## Environment Variables

Required in `.env.local`:
```
GITHUB_CLIENT_ID=          # GitHub OAuth App
GITHUB_CLIENT_SECRET=      # GitHub OAuth App
NEXTAUTH_SECRET=           # Session signing (if NextAuth)
NEXT_PUBLIC_BASE_URL=      # Base URL for OAuth redirect (e.g., https://chapa.thecreativetoken.com)

UPSTASH_REDIS_REST_URL=    # Upstash Redis
UPSTASH_REDIS_REST_TOKEN=  # Upstash Redis

SUPABASE_URL=              # Supabase project URL (optional — database features degrade gracefully)
SUPABASE_SERVICE_ROLE_KEY= # Service role key (server-side only, never NEXT_PUBLIC_)

NEXT_PUBLIC_POSTHOG_KEY=   # PostHog analytics
NEXT_PUBLIC_POSTHOG_HOST=  # PostHog ingestion host
CHAPA_ALERT_WEBHOOK_URL=   # Webhook URL for P1/P2 operational alerts (optional, custom endpoint only — no Discord/Slack integration exists or is planned; triggers on health_degraded, badge_5xx, oauth_callback_failure, cron_failure, warm_cache_high_failure_rate, warm_cache_ceiling_approached, badge_latency_slo_breach). When unset (the current production default), the same signals deliver via email instead (Resend, to SUPPORT_FORWARD_EMAIL) — see docs/runbooks/incident-response.md.

RESEND_API_KEY=            # Resend email service (optional — email features degrade gracefully)
RESEND_WEBHOOK_SECRET=     # Resend webhook HMAC secret (optional — webhook verification)
SUPPORT_FORWARD_EMAIL=     # Gmail address for email forwarding (optional)

GITHUB_TOKEN=              # GitHub personal access token (optional — fallback when no OAuth token available)

CHAPA_VERIFICATION_SECRET= # HMAC secret for badge verification hash generation (required for /api/verify)
NEXT_PUBLIC_STUDIO_ENABLED= # Set to "true" to enable Creator Studio (optional, disabled by default)
NEXT_PUBLIC_STUDIO_DEMO_ENABLED= # Set to "true" to enable Studio's anonymous demo mode at /studio?demo=1 (optional, disabled by default)
NEXT_PUBLIC_EXPERIMENTS_ENABLED= # Set to "true" to enable /experiments pages (optional, disabled by default)

NEXT_PUBLIC_INSIGHTS_ENABLED=  # Set to "true" to enable AI Insights integration (optional, disabled by default)

BITBUCKET_CLIENT_ID=           # Bitbucket OAuth consumer key (optional — Bitbucket integration disabled without it)
BITBUCKET_CLIENT_SECRET=       # Bitbucket OAuth consumer secret (optional — server-side only)
NEXT_PUBLIC_BITBUCKET_ENABLED= # Set to "true" to enable Bitbucket link/unlink in User Menu (optional, disabled by default)

CODEBERG_CLIENT_ID=              # Codeberg OAuth app client ID (optional — Codeberg integration disabled without it)
CODEBERG_CLIENT_SECRET=          # Codeberg OAuth app secret (optional — server-side only)
NEXT_PUBLIC_CODEBERG_ENABLED=    # Set to "true" to enable Codeberg link/unlink in User Menu (optional, disabled by default)

GITLAB_CLIENT_ID=                # GitLab OAuth app client ID (optional — GitLab integration disabled without it)
GITLAB_CLIENT_SECRET=            # GitLab OAuth app secret (optional — server-side only)
NEXT_PUBLIC_GITLAB_ENABLED=      # Set to "true" to enable GitLab link/unlink in User Menu (optional, disabled by default)

NEXT_PUBLIC_WEBMCP_ENABLED=      # Set to "true" to register Chapa's WebMCP tools into a visitor's document.modelContext (optional, disabled by default)

ADMIN_HANDLES=                 # Comma-separated GitHub handles allowed to access /admin (server-side only, optional)
ADMIN_SECRET=                  # Bearer token for /api/admin/stats endpoint (optional)
ALLOW_AGENT_RUN=               # Set to "true" to allow /api/admin/agents/run endpoint (optional, disabled by default)

CRON_SECRET=                   # Vercel Cron auth (auto-injected by Vercel on Pro — set locally for testing)
WARM_CACHE_PRIORITY_HANDLES=   # Comma-separated GitHub handles always included in warm-cache cron (optional)

VERCEL_ENV=                    # Auto-injected by Vercel (production/preview/development — do not set manually)
ANALYZE=                       # Set to "true" to enable @next/bundle-analyzer in next.config.ts (dev-only)
```

> **Intentionally omitted:** `CI`, `NODE_ENV`, and `VERCEL_*` are standard Node/Vercel build vars and do not need to be configured manually. `TESTPLATFORM_CLIENT_ID` / `TESTPLATFORM_CLIENT_SECRET` are test-only mocks — not real credentials and not needed in any deployed environment.

> **Not a kill switch:** the `NEXT_PUBLIC_*_ENABLED` feature flags above are DB-backed (`apps/web/lib/feature-flags.ts`) — the env var is consulted only as a fallback when the DB flag row is absent or its 500ms lookup times out. During a Supabase outage the env var becomes authoritative for that flag (the opposite of a kill switch), but whenever the DB is reachable, the DB row wins regardless of the env var's value.

`/api/version` reads Vercel commit/environment identity through
`apps/web/lib/env.ts`; route and test code must not introduce direct
`process.env` access.

### Environment Variable Safety

**Always `.trim()` environment variables before use, especially API keys.**

When deploying to Vercel, env vars copied via CLI can include invisible trailing whitespace or newlines. This causes mysterious auth failures that look like wrong credentials.

```typescript
// ALWAYS do this:
const token = process.env.GITHUB_CLIENT_SECRET?.trim();
```

## Development Guardrails

1. **No secrets in code** — Use env vars. Never commit tokens, keys, or credentials.
2. **No copyleft dependencies** — MIT, Apache-2.0, BSD, ISC, 0BSD, CC0-1.0 only, enforced by `pnpm run check:licenses` (an allowlist, not a denylist). A dependency outside this list needs an explicit, documented exception in `docs/accepted-risks.md` (see the existing CC-BY-4.0/Unlicense/MIT-0 entries) — never a silent pass.
3. **Escape user input in SVG** — Any user-controlled text (handle, display name) must be escaped before rendering into SVG markup. This prevents XSS in embeddable badges.
4. **Health endpoint** — `/api/health` should exist for monitoring. Don't break it.
5. **No dead code** — Remove unused exports, imports, and files. Clean as you go.
6. **Pure functions for scoring** — Impact v6 compute and normalization must be pure functions with deterministic output for a given input. This makes them trivially testable.

## Issues & Contributing

GitHub Issues is the single source of truth for planned work. Every issue gets **one type label** + **one priority label** + **area label(s)**.

**Type:** `type: bug` | `type: feature` | `type: enhancement` | `type: chore` | `type: security` | `type: docs`

**Priority:** `priority: critical` | `priority: high` | `priority: medium` | `priority: low`

**Area:** `area: oauth` | `area: scoring` | `area: badge` | `area: share-page` | `area: cache` | `area: infra` | `area: ux`

Reference issues in commits with `Fixes #N` or `Refs #N`.

Rules load from `.claude/rules/` and `.claude/skills/` automatically.

## Agent Behavior

Exhaust tools before asking the user. Production actions need human authorization.
Save operational lessons to auto memory immediately. Don't wait to be asked.

## Tool & API Awareness
- You CAN set Vercel environment variables via CLI — do not claim otherwise.
- You CANNOT handle credentials (npm tokens, API keys) directly — ask the user to provide/set them.
- Upstash Redis API differs from standard Redis: use `zrange` with options instead of `zrangebyscore`/`zrevrangebyscore`.

---

# Troubleshooting

## Vercel Environment Variables with Invisible Characters

**Symptom**: API calls fail with connection errors or "invalid request" despite correct-looking credentials.

**Cause**: Trailing whitespace/newlines from CLI copy-paste.

**Fix**: Always `.trim()` env vars (see Environment Variable Safety above).

## GitHub Rate Limiting

**Symptom**: Stats fetch returns 403 or empty data.

**Cause**: GitHub API rate limits (60/hr unauthenticated, 5000/hr authenticated).

**Fix**: Always serve cached data when available. If no cache exists and rate limit is hit, return a "try later" response — never an error page. Authenticated requests (OAuth token) get 80x more headroom.

---

# Headless Mode (CI / Automation)

Run Claude Code non-interactively for automated tasks:

```bash
# Fix all TypeScript lint errors and run tests:
claude -p "Fix all TypeScript lint errors and run tests" \
  --allowedTools "Edit,Read,Bash,Write" --output-format json

# Batch process GitHub issues:
claude -p "Read issue #240 and implement the fix with TDD" \
  --allowedTools "Edit,Read,Bash,Write,Grep"
```
