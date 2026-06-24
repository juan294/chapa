# Chapa — Dev Impact Badge

## One-liner
Chapa generates a **live, embeddable, animated SVG badge** that showcases a developer's **Impact v6 Profile** (4–5 dimensions + archetype + confidence) from GitHub activity and optional AI tool insights, with a Creator Studio for badge customization, a share page, and one-click sharing.

## Goals
1. GitHub OAuth login (for "Verified" mode + better API limits).
2. Compute **Impact v6 Profile** from last 12 months (365 days):
   - 4 core dimensions (Delivery, Quality, Consistency, Breadth) + optional 5th (Craft), each 0–100
   - developer archetype (Builder, Quality Champion, Marathoner, Polymath, Artificer, Balanced, Emerging)
     - Note: "Quality Champion" is the display name; internal code/routes use "guardian" (e.g., `/archetypes/guardian`, `--color-archetype-guardian`)
   - composite score (0–100), confidence (50–100) + reasons, adjusted score, tier.

3. Serve **Creator Studio**: `/studio` (badge customization with 9 visual categories).
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
- GET `/api/health` Health check (Redis dbsize + Supabase query + GitHub API probe, rate-limited; returns "skipped" for unconfigured services)
- GET `/api/feature-flags` Public feature flag values
- GET `/u/:handle/og-image` OG image for share page (dynamic, cached)
- GET `/og-image` Default OG image
- GET `/llms.txt` LLM-friendly site summary
- GET `/llms-full.txt` Full LLM-friendly site content
- GET `/.well-known/security.txt` Security contact info

### Authenticated API
- POST `/api/supplemental` Upload EMU supplemental stats (CLI)
- GET|PUT `/api/studio/config` Load/save badge customization config
- POST `/api/refresh?handle=` Force refresh (rate-limited)
- POST `/api/generate` Generate badge for authenticated user
- POST `/api/recalculate` Recalculate impact scores
- GET `/api/insights/:handle` AI tool insights for a user
- POST `/api/insights` Submit tool insights data
- GET `/api/cli/auth/poll` CLI device auth polling (RFC 8628-style: first poll issues + returns a `device_code`; subsequent polls from the CLI should echo it to bind the session to the initiating device; legacy CLIs that omit it still work)
- POST `/api/cli/auth/approve` CLI device auth approval

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
- POST `/api/webhooks/resend` Resend email webhook (HMAC verified)
- GET `/api/cron/warm-cache` Daily cache warming (bearer auth via `CRON_SECRET`)
- GET `/api/cron/sync-audience` Daily Resend audience sync (bearer auth via `CRON_SECRET`)
- GET `/api/cron/process-campaigns` Daily campaign batch processor (bearer auth via `CRON_SECRET`)
- POST `/api/telemetry` Client telemetry ingestion

## Data & types
Shared types live in: `packages/shared/src/types.ts`
- `StatsData` — aggregated GitHub stats (30 fields, includes `batchSizeScore`, `medianPrLeadTimeHours`, `primaryReviewsSubmittedCount`)
- `ImpactV6Result` — 4–5 dimensions (Craft optional), archetype, composite score, confidence, tier
- `BadgeConfig` — Creator Studio visual customization (9 categories)
- `SupplementalStats` — EMU account merge payload
- `RawContributionData` — raw GraphQL response shape
- `MetricsSnapshot` — compact historical metric record (~300 bytes, stored in Supabase `metrics_snapshots` table)

## Rendering requirements
- Default badge size: 1200×630 (wide)
- Default theme: Warm Amber (dark + amber/gold accent)
- SVG must be crisp and readable when scaled down
- Animations must be subtle (heatmap fade-in, impact pulse)

## Design system (MANDATORY for UI work)
- Full spec: @docs/design-system.md
- Accent color: `#8B5CF6` (saturated violet). Use `text-amber`, `bg-amber`.
- Heading font: **JetBrains Mono** (`font-heading`) — monospace, no italic.
- Body font: **Plus Jakarta Sans** (`font-body`) — default on `<body>`.
- Light/dark theme support via `next-themes`. Light is the default; dark (`#0A0A0F`) is the signature brand look. Badge SVG always renders dark.
- All colors and fonts are defined in `apps/web/styles/globals.css` via Tailwind v4 `@theme`.

## Badge branding
Footer shows "Forged from purpose. Driven by curiosity." + dynamic platform logos (GitHub, Bitbucket, Codeberg, GitLab).
- Personal badges show only logos for platforms the user has connected
- Demo badges show all 4 platform logos (GitHub, Bitbucket, Codeberg, GitLab)
- Branding is behind a flag: `includeBranding`
- Branding is isolated in `apps/web/lib/render/BadgeBranding.tsx`
- Avatar placeholder (when no user photo) shows the Chapa shield icon

## Caching rules
- Cache computed stats + impact per user/day (TTL 24h)
- Cache SVG output per user/day + theme (TTL 24h + per-handle jitter of 0–2h to spread UTC-midnight recompute spikes)
- **Lifetime metrics**: `MetricsSnapshot` records stored in Supabase `metrics_snapshots` table — permanent history. Max 1 snapshot per user per day (UNIQUE constraint on handle+date). Captured automatically by cron warm-cache, badge route `after()`, and refresh endpoint.
- **Supplemental EMU stats**: durably stored in Supabase `supplemental_stats` table (one row per `target_handle`). Redis (`supplemental:<handle>`, 24h TTL) is the hot read path; on miss, `getStats()` falls back to Supabase and rehydrates Redis via fire-and-forget. A missed CLI upload day no longer drops EMU data from scores.
- **Same-day refresh signal**: a CLI supplemental upload sets `stats:dirty:<handle>` in Redis (1h TTL). `materializeProfile` reads the marker and the smoothing policy bypasses the same-day EMA lock so the user sees the new score immediately; `runPublicProfileSideEffects` then routes today's snapshot through `dbReplaceSnapshot` (UPSERT) and clears the marker. Default behavior (no dirty marker) preserves the existing feedback-loop protection.
- **Feature flags**: Async DB-backed flag reads live in `apps/web/lib/feature-flags.ts` (server-only). Synchronous client-safe helpers (`isStudioEnabledSync`, etc.) live in `apps/web/lib/feature-flags-sync.ts` — use the sync module in client components and middleware; use the async module in server actions and API routes.
- **Rate-limit fail-open**: The Redis rate limiter (`rateLimit()` in `lib/cache/redis.ts`) intentionally allows all requests when Redis is unavailable (fail-open). This is an availability-first design — blocking every embedded badge because Redis is temporarily down is worse than briefly losing rate enforcement. GitHub's own API limits and CDN caching provide secondary protection. See `redis.ts` for the full rationale.
- Response headers for badge endpoint (6h s-maxage provides fresher badge updates):
  - `Cache-Control: public, s-maxage=21600, stale-while-revalidate=86400`

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
- Global command bar: `apps/web/components/GlobalCommandBar.tsx`, `apps/web/components/terminal/command-registry.ts`
- Tooltips: `apps/web/components/InfoTooltip.tsx`, `apps/web/components/BadgeOverlay.tsx`
- i18n: `apps/web/lib/i18n/*` (dictionaries, detection, server/client translation, locale cookie)
- Dashboard components: `apps/web/lib/dashboard/generate-insights.ts`, `apps/web/components/dashboard/DimensionCard.tsx`, `apps/web/components/dashboard/InsightCard.tsx`, `apps/web/components/dashboard/SubMetricPanel.tsx`
- Share toolbar: `apps/web/components/BadgeToolbar.tsx`

## Acceptance criteria
- A user can log in with GitHub (OAuth success).
- `/u/:handle/badge.svg` loads publicly without auth (use cached public stats where possible).
- Badge shows: heatmap, radar chart (4 or 5 dimensions — pentagon when Craft is present, diamond fallback), archetype label, stars/forks/watchers, Impact tier, adjusted score.
- `/u/:handle` shows badge + breakdown + embed snippet. Confidence (% + penalty flags) is shown only to the profile owner in the "How is my score calculated" panel; it is hidden from visitors and excluded from public metadata (JSON-LD).
- Caching prevents repeated GitHub API calls for same handle within 24h.
- Confidence messaging is non-accusatory (never claims wrongdoing).
- Repo contains `docs/impact-v6.md` (current spec truth), `docs/impact-v4.md`, `docs/impact-v5.md`, and `docs/svg-design.md`.
- Creator Studio at `/studio` allows badge visual customization (9 categories).
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
- **Accepted risks**: See `docs/accepted-risks.md` for formally documented design decisions and known limitations. Items in that file are intentional and should not be flagged as audit warnings.

## Deployment
- Production deploys from `main` only. Changes pushed to `develop` must be merged to `main` via PR before they go live.
- Always confirm the target branch before pushing — if the goal is production deployment, ensure the PR targets `main`.

## Language & Tone
- All user-facing content for the Asturias project must be in Spanish unless explicitly stated otherwise.
- For social media copy: keep tone confident and positive — avoid pitying, resentful, or overly dramatic language. Never mention unreleased/unpublished features.

---

## Internationalization (i18n)

The app supports two locales: `es` (Spanish, default) and `en` (English). All public-facing pages are translated.

### Architecture
- **Dictionaries**: `apps/web/lib/i18n/dictionaries/en.ts` and `es.ts` — both must be kept in sync (650+ leaf keys each). Run `pnpm run test` to verify key parity via `dictionaries/parity.test.ts`.
- **Locale detection**: `apps/web/lib/i18n/detect.ts` — reads the `chapa-locale` cookie first, then `Accept-Language` header, falls back to `DEFAULT_LOCALE` ('es').
- **Static rendering**: The root layout renders statically at `DEFAULT_LOCALE` (`es`) and ships only the active locale's dictionary to the client. Non-default locale dictionaries are loaded client-side on demand (after hydration) when the `chapa-locale` cookie indicates a different locale. This keeps content pages CDN-cacheable (ISR) at the cost of a brief locale flash for non-default-locale users.
- **Server components**: `import { getServerT } from '@/lib/i18n/server'` — pass the `locale` from params/cookies.
- **Client components**: `import { useTranslation } from '@/lib/i18n'` — returns `{ locale, t, setLocale }`. Always wraps in `LanguageProvider` on any real page.
- **Key resolution**: `t('section.key')` returns a string (or subtree for intermediate keys). Leaf keys always return `string` — cast with `as string` when TypeScript needs it for HTML attrs.
- **Locale switching**: `LanguageSwitcher` component calls `setLocale()`, which sets the `chapa-locale` cookie and soft-reloads via `router.refresh()`.

### Adding new strings
1. Add the English string to `en.ts` and the Spanish string to `es.ts` under the same key path.
2. Both files must have identical key structure — `parity.test.ts` will fail otherwise.
3. Use `t('section.key') as string` for `aria-label` and other HTML string attributes.
4. `DEFAULT_LOCALE` is `'es'` — server renders Spanish by default. Tests use English via the `useTranslation` fallback (no LanguageProvider).

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
| PR descriptions | `docs/prs/{number}_description.md` | |
| Research docs | `docs/research/YYYY-MM-DD-description.md` | |
| Plans | `docs/plans/YYYY-MM-DD-description.md` | Phase files in `-phases/phase-N.md` |

---

# Development

## Git Workflow

**`develop` is the default branch. `main` is production only.**

1. All development happens on `develop`
2. Never commit directly to `main` — it represents what's deployed
3. Release to production via PR: `develop` → `main`
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
- After merging to develop, if production deployment is the goal, immediately create a PR from develop → main.

### CI Gates (enforced in CI, must pass locally too)
- **Circular dependency check**: `pnpm run check:circular` (via `madge`) — no circular imports allowed.
- **`no-process-env` ESLint rule**: direct `process.env` access is banned outside `apps/web/lib/env.ts` (allowlisted). All env reads go through the centralized env module.
- **`packages/shared` import boundary**: application code may not import from `packages/shared` via relative paths — use the workspace alias (`@chapa/shared`).
- **Bundle-size budget**: the largest JS chunk must stay under 500 KB (checked in CI via build output analysis).
- **Coverage thresholds**: configured in `vitest.config.ts` — CI fails if coverage drops below defined per-module thresholds.

## Test Conventions

- **File placement:** Tests live next to source files: `impact.ts` → `impact.test.ts`
- **Naming:** `<source-file-name>.test.ts` or `.test.tsx`
- **Structure:** Use `describe` blocks grouped by behavior area
- **Mocking:** Dependencies mocked at module level with `vi.mock()`, configured per test with `vi.mocked()`
- **API routes:** Test by importing the handler directly and passing a `NextRequest`

## Key Commands

```bash
# Before committing
pnpm run test           # Run all tests
pnpm run typecheck      # Check types
pnpm run lint           # Check linting

# Testing
pnpm run test:watch     # Watch mode
pnpm run test:coverage  # Coverage report

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
CHAPA_ALERT_WEBHOOK_URL=   # Webhook URL for P1 operational alerts (Discord/Slack/custom — optional; triggers on health_degraded, badge_5xx, oauth_callback_failure, cron_failure, warm_cache_high_failure_rate, warm_cache_ceiling_approached)

RESEND_API_KEY=            # Resend email service (optional — email features degrade gracefully)
RESEND_WEBHOOK_SECRET=     # Resend webhook HMAC secret (optional — webhook verification)
SUPPORT_FORWARD_EMAIL=     # Gmail address for email forwarding (optional)

GITHUB_TOKEN=              # GitHub personal access token (optional — fallback when no OAuth token available)

CHAPA_VERIFICATION_SECRET= # HMAC secret for badge verification hash generation (required for /api/verify)
NEXT_PUBLIC_STUDIO_ENABLED= # Set to "true" to enable Creator Studio (optional, disabled by default)
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

ADMIN_HANDLES=                 # Comma-separated GitHub handles allowed to access /admin (server-side only, optional)
ADMIN_SECRET=                  # Bearer token for /api/admin/stats endpoint (optional)
ALLOW_AGENT_RUN=               # Set to "true" to allow /api/admin/agents/run endpoint (optional, disabled by default)

CRON_SECRET=                   # Vercel Cron auth (auto-injected by Vercel on Pro — set locally for testing)
WARM_CACHE_PRIORITY_HANDLES=   # Comma-separated GitHub handles always included in warm-cache cron (optional)

VERCEL_ENV=                    # Auto-injected by Vercel (production/preview/development — do not set manually)
ANALYZE=                       # Set to "true" to enable @next/bundle-analyzer in next.config.ts (dev-only)
```

> **Intentionally omitted:** `CI`, `NODE_ENV`, and `VERCEL_*` are standard Node/Vercel build vars and do not need to be configured manually. `TESTPLATFORM_CLIENT_ID` / `TESTPLATFORM_CLIENT_SECRET` are test-only mocks — not real credentials and not needed in any deployed environment.

### Environment Variable Safety

**Always `.trim()` environment variables before use, especially API keys.**

When deploying to Vercel, env vars copied via CLI can include invisible trailing whitespace or newlines. This causes mysterious auth failures that look like wrong credentials.

```typescript
// ALWAYS do this:
const token = process.env.GITHUB_CLIENT_SECRET?.trim();
```

## Development Guardrails

1. **No secrets in code** — Use env vars. Never commit tokens, keys, or credentials.
2. **No copyleft dependencies** — MIT, Apache-2.0, BSD, ISC only.
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

## Working Patterns

<examples>
<example name="push-sequence">
Commit before pulling — hook blocks dirty pulls.

```bash
git add src/feature.ts && git commit -m "feat: add feature"
git pull --rebase && git push
```

</example>

<example name="worktree-cleanup">
Remove worktrees before merging PRs. Use -D (uppercase) for branches.

```bash
git worktree remove --force ../feature-branch; git branch -D feature-branch
```

</example>

<example name="file-paths">
Use absolute paths in all file tools and worktree commands. Never use ~.

```bash
cd /Users/dev/project && pnpm run test
```

</example>
</examples>

Rules load from `.claude/rules/` and `.claude/skills/` automatically.

## TDD Protocol

All code changes follow Red-Green-Refactor:
1. **Red** — Write a failing test FIRST
2. **Green** — Minimum code to pass
3. **Refactor** — Clean up with green tests

No exceptions. Bug fixes need a regression test. Refactors need existing coverage. No "tests later."

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
