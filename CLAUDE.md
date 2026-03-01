# Chapa — Dev Impact Badge

## One-liner
Chapa generates a **live, embeddable, animated SVG badge** that showcases a developer's **Impact v4 Profile** (4 dimensions + archetype + confidence) from GitHub activity, with a Creator Studio for badge customization, a share page, and one-click sharing.

## Goals
1. GitHub OAuth login (for "Verified" mode + better API limits).
2. Compute **Impact v4 Profile** from last 12 months (365 days):
   - 4 dimensions (Delivery, Quality, Consistency, Breadth), each 0–100
   - developer archetype (Builder, Quality Champion, Marathoner, Polymath, Balanced, Emerging)
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
- GET `/` Landing + GitHub login (terminal-first UI)
- GET `/studio` Creator Studio (badge customization, requires auth)
- GET `/admin` Admin dashboard (requires auth + admin handle, see `ADMIN_HANDLES`)
- GET `/u/:handle` Share page (badge preview, breakdown, embed snippet, share CTA)
- GET `/u/:handle/badge.svg` Embeddable badge SVG (cacheable)
- GET `/api/verify/:hash` Badge verification endpoint
- GET `/api/admin/users` Admin user list (session auth + admin check)
- POST `/api/supplemental` Upload EMU supplemental stats (CLI)
- POST `/api/studio/config` Save/load badge customization config
- POST `/api/refresh?handle=` Force refresh (rate-limited)
- GET `/api/history/:handle` Score history, trend, and diff (public, rate-limited)

## Data & types
Shared types live in: `packages/shared/src/types.ts`
- `StatsData` — aggregated GitHub stats (23 fields)
- `ImpactV4Result` — 4 dimensions, archetype, composite score, confidence, tier
- `BadgeConfig` — Creator Studio visual customization (9 categories)
- `SupplementalStats` — EMU account merge payload
- `RawContributionData` — raw GraphQL response shape
- `MetricsSnapshot` — compact historical metric record (~300 bytes, stored in Redis sorted sets)

## Rendering requirements
- Default badge size: 1200×630 (wide)
- Default theme: Warm Amber (dark + amber/gold accent)
- SVG must be crisp and readable when scaled down
- Animations must be subtle (heatmap fade-in, impact pulse)

## Design system (MANDATORY for UI work)
- Full spec: @docs/design-system.md
- Accent color: `#7C6AEF` (cool indigo/violet). Use `text-amber`, `bg-amber`.
- Heading font: **JetBrains Mono** (`font-heading`) — monospace, no italic.
- Body font: **Plus Jakarta Sans** (`font-body`) — default on `<body>`.
- Light/dark theme support via `next-themes`. Light is the default; dark (`#0A0A0F`) is the signature brand look. Badge SVG always renders dark.
- All colors and fonts are defined in `apps/web/styles/globals.css` via Tailwind v4 `@theme`.

## Badge branding
Footer shows "Forged from purpose. Driven by curiosity." + dynamic platform logos (GitHub, Bitbucket, Codeberg).
- Personal badges show only logos for platforms the user has connected
- Demo badges show all 3 platform logos
- Branding is behind a flag: `includeBranding`
- Branding is isolated in `apps/web/lib/render/BadgeBranding.tsx`
- Avatar placeholder (when no user photo) shows the Chapa shield icon

## Caching rules
- Cache computed stats + impact per user/day (TTL 24h)
- Cache SVG output per user/day + theme (TTL 24h)
- **Lifetime metrics**: `MetricsSnapshot` records stored in Redis sorted sets (`history:<handle>`) with **no TTL** — permanent history. Max 1 snapshot per user per day (date-based dedup). Captured automatically by cron warm-cache, badge route `after()`, and refresh endpoint.
- **Rate-limit fail-open**: The Redis rate limiter (`rateLimit()` in `lib/cache/redis.ts`) intentionally allows all requests when Redis is unavailable (fail-open). This is an availability-first design — blocking every embedded badge because Redis is temporarily down is worse than briefly losing rate enforcement. GitHub's own API limits and CDN caching provide secondary protection. See `redis.ts` for the full rationale.
- Response headers for badge endpoint (6h s-maxage provides fresher badge updates):
  - `Cache-Control: public, s-maxage=21600, stale-while-revalidate=604800`

## Code ownership areas
- OAuth: `apps/web/app/api/auth/*`, `apps/web/lib/auth/*`
- GitHub data: `apps/web/lib/github/*`, `apps/web/lib/cache/*`
- Impact scoring: `apps/web/lib/impact/*`, types in `packages/shared`
- SVG rendering: `apps/web/lib/render/*`, `apps/web/app/u/[handle]/badge.svg/route.ts`
- Share page: `apps/web/app/u/[handle]/page.tsx`, `apps/web/components/*`
- Lifetime history: `apps/web/lib/history/*`
- Data access (Supabase): `apps/web/lib/db/*`
- Admin dashboard: `apps/web/app/admin/*`, `apps/web/components/AdminDashboardClient.tsx`
- Global command bar: `apps/web/components/GlobalCommandBar.tsx`, `apps/web/components/terminal/command-registry.ts`
- Tooltips: `apps/web/components/InfoTooltip.tsx`, `apps/web/components/BadgeOverlay.tsx`

## Acceptance criteria
- A user can log in with GitHub (OAuth success).
- `/u/:handle/badge.svg` loads publicly without auth (use cached public stats where possible).
- Badge shows: heatmap, radar chart (4 dimensions), archetype label, stars/forks/watchers, Impact tier, adjusted score.
- `/u/:handle` shows badge + breakdown + embed snippet. Confidence is computed internally but not shown to users.
- Caching prevents repeated GitHub API calls for same handle within 24h.
- Confidence messaging is non-accusatory (never claims wrongdoing).
- Repo contains `docs/impact-v4.md` and `docs/svg-design.md` as spec truth.
- Creator Studio at `/studio` allows badge visual customization (9 categories).
- Admin dashboard at `/admin` shows user table with refresh, sortable columns, and command bar.
- Badge and breakdown elements have explanatory tooltips (hover/tap/keyboard accessible).
- Lifetime metric snapshots are recorded automatically (cron, badge route, refresh).

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

# RPI Workflow

This project follows the Research-Plan-Implement (RPI) methodology.
All significant changes go through four phases:
1. `/research` — Understand the codebase as-is
2. `/plan` — Create a phased implementation spec
3. `/implement` — Execute one phase at a time with review gates
4. `/validate` — Verify implementation against the plan

## Context Management

- Each RPI phase should be its own conversation. Don't run research + plan + implement in one session.
- Use `/clear` between unrelated tasks. Use `/compact` when context is heavy but the task continues.
- Subagents are context control mechanisms — they search/read in their window and return only distilled results.
- Research and planning happen on `develop`. Implementation happens in worktrees.
- If research comes back wrong, throw it out and restart with more specific steering.

## Rules for All Phases

- Read all mentioned files COMPLETELY before doing anything else.
- Never suggest improvements during research — only document what exists (documentarian rule).
- Every code reference must include `file:line`.
- Spawn parallel subagents for independent research tasks.
- Wait for ALL subagents before synthesizing.
- Never write documents with placeholder values.

## Rules for Implementation

- Follow the atomic loop: implement → review (plan compliance) → fix → approve → `/simplify` (code quality) → verify.
- Run `/simplify` after reviewer approval — it handles code reuse, quality, and efficiency in one native pass.
- Check for `[batch-eligible]` phases in the plan — use `/batch` to execute independent phases in parallel.
- Run ALL automated verification after each phase.
- STOP after each phase and wait for human confirmation.
- Never auto-proceed to the next phase.
- If the plan doesn't match reality, STOP and explain the mismatch.

## Testing Philosophy

- Prefer automated verification over manual testing.
- Manual testing is ONLY for: sudo, hardware, new installs, truly visual-only validation.
- If you can verify it with a command or tool, do so automatically.
- Don't use Claude for linting/formatting — use automated tools and hooks instead.

## Research Documents
Store in: `docs/research/YYYY-MM-DD-description.md`

## Implementation Plans
Store in: `docs/plans/YYYY-MM-DD-description.md`
Phase files: `docs/plans/YYYY-MM-DD-description-phases/phase-N.md`

---

# Development

## Git Workflow

**`develop` is the default branch. `main` is production only.**

1. All development happens on `develop`
2. Never commit directly to `main` — it represents what's deployed
3. Release to production via PR: `develop` → `main`
4. Always run checks before committing (pre-commit hooks enforce this)
5. Always `git pull --rebase` before pushing

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

### CRITICAL: Run verification commands sequentially, NEVER in parallel
Never run typecheck, lint, or test as parallel sibling Bash tool calls.
Chain with `&&` or `;`: `pnpm run typecheck 2>&1; pnpm run lint 2>&1`

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

RESEND_API_KEY=            # Resend email service (optional — email features degrade gracefully)
RESEND_WEBHOOK_SECRET=     # Resend webhook HMAC secret (optional — webhook verification)
SUPPORT_FORWARD_EMAIL=     # Gmail address for email forwarding (optional)

GITHUB_TOKEN=              # GitHub personal access token (optional — fallback when no OAuth token available)

CHAPA_VERIFICATION_SECRET= # HMAC secret for badge verification hash generation (required for /api/verify)
NEXT_PUBLIC_STUDIO_ENABLED= # Set to "true" to enable Creator Studio (optional, disabled by default)
NEXT_PUBLIC_EXPERIMENTS_ENABLED= # Set to "true" to enable /experiments pages (optional, disabled by default)

BITBUCKET_CLIENT_ID=           # Bitbucket OAuth consumer key (optional — Bitbucket integration disabled without it)
BITBUCKET_CLIENT_SECRET=       # Bitbucket OAuth consumer secret (optional — server-side only)
NEXT_PUBLIC_BITBUCKET_ENABLED= # Set to "true" to enable Bitbucket link/unlink in User Menu (optional, disabled by default)

CODEBERG_CLIENT_ID=              # Codeberg OAuth app client ID (optional — Codeberg integration disabled without it)
CODEBERG_CLIENT_SECRET=          # Codeberg OAuth app secret (optional — server-side only)
NEXT_PUBLIC_CODEBERG_ENABLED=    # Set to "true" to enable Codeberg link/unlink in User Menu (optional, disabled by default)

ADMIN_HANDLES=                 # Comma-separated GitHub handles allowed to access /admin (server-side only, optional)
ADMIN_SECRET=                  # Bearer token for /api/admin/stats endpoint (optional)
ALLOW_AGENT_RUN=               # Set to "true" to allow /api/admin/agents/run endpoint (optional, disabled by default)

CRON_SECRET=                   # Vercel Cron auth (auto-injected by Vercel on Pro — set locally for testing)

VERCEL_ENV=                    # Auto-injected by Vercel (production/preview/development — do not set manually)
ANALYZE=                       # Set to "true" to enable @next/bundle-analyzer in next.config.ts (dev-only)
```

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
6. **Pure functions for scoring** — Impact v4 compute and normalization must be pure functions with deterministic output for a given input. This makes them trivially testable.

## Issues & Contributing

GitHub Issues is the single source of truth for planned work. Every issue gets **one type label** + **one priority label** + **area label(s)**.

**Type:** `type: bug` | `type: feature` | `type: enhancement` | `type: chore` | `type: security` | `type: docs`

**Priority:** `priority: critical` | `priority: high` | `priority: medium` | `priority: low`

**Area:** `area: oauth` | `area: scoring` | `area: badge` | `area: share-page` | `area: cache` | `area: infra` | `area: ux`

Reference issues in commits with `Fixes #N` or `Refs #N`.

## Agent Operational Rules

### Shell & Tools
- Chain verification commands sequentially, never as parallel Bash calls
- In worktrees: prefix every command with `cd /absolute/path && `
- Never use `~` in file tool paths — use full absolute paths starting with `/`
- Always pass `{ encoding: 'utf-8' }` to `execSync`/`spawnSync`

### Git Operations
- Run typecheck/lint BEFORE committing (pre-commit hooks run the same checks)
- `git pull --rebase` before every push
- Remove worktrees BEFORE merging PRs with `--delete-branch`
- `git worktree remove --force` (always use --force)
- `git branch -D` (uppercase) for worktree branch cleanup
- Use `;` not `&&` for multiple cleanup operations

### GitHub CLI
- Don't guess `gh --json` field names — query available fields first
- Check CI per-PR with `--json`, not chained human-readable output
- `review: fail` means "needs approval", NOT a CI failure

### Sub-Agents & Agent Teams
- Verify tool permissions before spawning sub-agents for write operations
- If a sub-agent fails due to permissions, take over manually immediately
- Monitor context size when running many parallel agents
- Agent Teams are enabled via `.claude/settings.json` — use them for complex parallel work
- When creating a team: break work so each teammate owns different files (avoid conflicts)
- Teammates don't inherit conversation history — include full context in spawn prompts
- Use subagents for focused tasks (result is all that matters); use teams for collaborative work requiring discussion

## Push Accountability

Every push to the development branch requires CI verification. After pushing:
1. Spawn a background agent to monitor CI: `gh run list --branch develop --limit 1`
2. If CI passes — log and move on
3. If CI fails — background agent investigates with `gh run view <id> --log-failed`, fixes, and re-pushes
4. Main terminal continues working — push verification is non-blocking
5. Never push to production from a background fix

## TDD Protocol

All code changes follow Red-Green-Refactor:
1. **Red** — Write a failing test FIRST
2. **Green** — Minimum code to pass
3. **Refactor** — Clean up with green tests

No exceptions. Bug fixes need a regression test. Refactors need existing coverage. No "tests later."

## Agent Autonomy

Before asking the user to do anything manually:
1. Exhaust CLI tools (`gh`, `git`, project CLIs)
2. Exhaust shell commands (curl, build scripts)
3. Exhaust file tools (Read/Edit/Write for config changes)
4. Only then ask for human help — with a clear explanation of what you tried

Autonomy applies to development work. Production-affecting actions always need explicit human authorization.

## Memory Management

When you discover an operational lesson during any session — CI failure pattern, permission issue, workaround, tooling quirk, environment-specific behavior — save it to auto memory immediately. Don't wait to be asked.

What to save proactively:
- CI/CD pipeline behaviors and failure patterns specific to this project
- Environment quirks (build flags, platform issues, dependency conflicts)
- Project-specific conventions confirmed by the user
- Workarounds for tools, APIs, or libraries used in this project
- Permission configurations that required adjustment

After completing `/bootstrap`, `/adopt`, or any significant configuration change, save the key decisions and project context to auto memory so future sessions start with full awareness.

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
