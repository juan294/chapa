# Chapa — Developer Impact Badge

[![CI](https://github.com/juan294/chapa/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/juan294/chapa/actions/workflows/ci.yml)
[![Security Scan](https://github.com/juan294/chapa/actions/workflows/security.yml/badge.svg?branch=develop)](https://github.com/juan294/chapa/actions/workflows/security.yml)
[![Secret Scanning](https://github.com/juan294/chapa/actions/workflows/gitleaks.yml/badge.svg?branch=develop)](https://github.com/juan294/chapa/actions/workflows/gitleaks.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178c6)
![Node.js](https://img.shields.io/badge/Node.js-20%2B-43853d)
![Next.js](https://img.shields.io/badge/Next.js-16-000000)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

Generate a **live, embeddable, animated SVG badge** that showcases your developer impact from GitHub, Bitbucket, Codeberg, and GitLab activity — with multi-dimensional scoring, verification, and one-click sharing.

<a href="https://chapa.thecreativetoken.com/u/juan294">
  <img src="https://chapa.thecreativetoken.com/u/juan294/badge.svg" alt="juan294's Chapa Impact Badge" width="100%" />
</a>

---

## WebMCP

Chapa adds a WebMCP layer to four surfaces: the landing page, the Creator Studio, and the public profile and verification pages. The landing page is the front door, where `get_site_capabilities` returns a map of every route and the tools it carries, so an agent can find the right page instead of guessing at one. Studio tools reuse the existing command registry, so agent actions update the same preview and terminal that the user sees. Saving is always human-gated; in judge demo mode (`/studio?demo=1`), confirmed saves stay local and never write production data. Landing, public profile, and verification tools are read-only.

Registration uses the current `document.modelContext.registerTool(tool, { signal })` contract, an `AbortController` for cleanup, feature detection for unsupported clients, and a remote feature-flag kill switch.

See the [WebMCP tool catalog and judge guide](docs/webmcp.md) and the [under-three-minute demo script and submission checklist](docs/webmcp-demo-script.md).

The write-up [WebMCP, Explained. And What Happened When I Shipped It](docs/webmcp-explained-and-how-i-shipped-it.md) (published on [X](https://x.com/JuanG294/status/2094005233990893844), LinkedIn and Medium) covers the design framework, the tested tool-map contract, and the rules that came out of shipping it. The [production demo transcript](docs/webmcp-demo-transcript.md) (2026-09-01, Chrome 151 with the WebMCP flag) records an agent driving all four surfaces end to end, and is linked from the landing page as the agent-tested proof. A companion note, [The WebMCP directories made me use a mouse](docs/webmcp-directories-are-not-webmcp-ready.md), records what the directory submissions taught.

The catalog's [Design methodology](docs/webmcp.md#design-methodology) documents each user goal, initial state, role-play, and recovery path.

Runtime status: a preview-only `chapa_hello` spike passed native registration, discovery, and execution in flagged Chrome 151 on 2026-08-27, and the production preflight on 2026-09-01 found all 19 registrations across 18 distinct names on four surfaces (see the transcript above). Chapa is listed on [webmcp.com](https://webmcp.com), in the [official MCP Registry](https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.juan294/chapa) as `io.github.juan294/chapa`, and as an ownership-verified [Glama connector](https://glama.ai/mcp/connectors/com.thecreativetoken.chapa/chapa). The ChatGPT in-app client was unavailable for the spike, so this README does not claim ChatGPT runtime validation.

### Prior work and submission-period work

For this submission, all work through 2026-08-24 is prior work. The badge, scoring engine, share and verification pages, CLI, admin surfaces, and earlier Studio foundation already existed. The released baselines are [v2.22.0](https://github.com/juan294/chapa/releases/tag/v2.22.0) (2026-08-19) and [v2.22.1](https://github.com/juan294/chapa/releases/tag/v2.22.1) (2026-08-23).

Submission-period work started after that cutoff:

- The Creator Studio revival and hardening landed on 2026-08-26 and was released as [v2.23.0](https://github.com/juan294/chapa/releases/tag/v2.23.0).
- The pre-launch audit remediation — 73 findings across two waves, including both launch-blockers — landed on 2026-08-27 and was released as [v2.24.0](https://github.com/juan294/chapa/releases/tag/v2.24.0).
- Two follow-up releases landed on 2026-08-28: [v2.24.1](https://github.com/juan294/chapa/releases/tag/v2.24.1) (EMU handles no longer pollute the warm-cache registry) and [v2.25.0](https://github.com/juan294/chapa/releases/tag/v2.25.0), which flipped the signal-less default locale to English and fixed the feature-flag cache bug that made Creator Studio unreachable in a real browser.
- The WebMCP layer runs from [3156fcaa](https://github.com/juan294/chapa/commit/3156fcaab716c0712044b9a6b59233ff28767043) through [699f94b0](https://github.com/juan294/chapa/commit/699f94b000a6fb561f9001c3a54b2b509e6efe5d). The local receipt is `git log --oneline 3156fcaa^..699f94b0`:

```text
699f94b0 feat(webmcp): add public read tools
15be8695 feat(studio): add judge demo mode
57142416 feat(webmcp): add Studio tool catalog
30f4c750 feat(webmcp): add registration infrastructure
13bdd871 docs(webmcp): pass Chrome runtime gate
b338942d test(webmcp): add main-world execution probe
d7777e47 docs(webmcp): record blocked runtime gate
3156fcaa feat(webmcp): add runtime spike
```

- The layer has continued since that first contiguous block, so later WebMCP commits are no longer one range. The receipt for them is `git log --oneline -E --grep='^[a-z]+\(webmcp\):' 699f94b0..HEAD`:

```text
71e2ff47 docs(webmcp): add submission package
e72a4e3a refactor(webmcp): harden tool lifecycle
f5e9e85e feat(webmcp): add tool outcome telemetry
80e327d5 feat(webmcp): improve agent workflow recovery
5551020d docs(webmcp): document agent workflow design
d771b544 feat(webmcp): add landing discovery tools
18779e40 docs(webmcp): document landing discovery
```

## What It Does

Chapa analyzes your last 12 months of activity across connected platforms and generates a badge with:

- **Impact Score** (0–100) with tier (Emerging → Solid → High → Elite)
- **4–5 Dimension Profile** — Delivery, Quality, Consistency, Breadth + optional Craft (AI tool insights)
- **Developer Archetype** — Builder, Quality Champion, Marathoner, Polymath, Artificer, Balanced, or Emerging
- **Activity Timeline** — 13-week daily contribution dot visualization
- **Radar Chart** — pentagon (5 dimensions) or diamond (4 dimensions) breakdown
- **Verification Hash** — HMAC-SHA256 watermark proving badge authenticity

## Features

### Multi-Platform Support

Connect GitHub (primary), Bitbucket, Codeberg, and GitLab to aggregate your impact across platforms. Stats are merged automatically — repos are summed, social metrics take the max to avoid double-counting mirrors.

### Embeddable Badge (`/u/:handle/badge.svg`)

A 1200×630 animated SVG you can embed anywhere — GitHub profile READMEs, personal sites, portfolios. Cached at the CDN edge for 6 hours.

```markdown
![My Chapa Badge](https://chapa.thecreativetoken.com/u/YOUR_HANDLE/badge.svg)
```

### Share Page (`/u/:handle`)

Public profile page with full score breakdown, interactive radar chart, dimension details with explanatory tooltips, embed snippets (Markdown + HTML), and one-click sharing to X, LinkedIn, and Bluesky.

### Creator Studio (`/studio`)

Terminal-first Studio design playground with seven visual categories, live preview, and saved Studio configuration. Requires GitHub login. A saved Studio configuration changes the public SVG badge and share page and invalidates the badge cache.

### CLI Tool (`chapa-cli`)

For developers on **GitHub Enterprise (EMU)** — merge your work contributions into your personal Chapa badge via a secure device auth flow.

```bash
npx chapa-cli login
npx chapa-cli merge
```

Supports `--insecure` for corporate networks with TLS interception and `--verbose` for diagnostics.

### Bilingual UI (EN / ES)

Chapa's interface is available in English and Spanish. A language picker (globe icon, next to the theme toggle in the nav bar) saves your preference in a cookie. Your locale is resolved in that order — the `chapa-locale` cookie first, then your browser's `Accept-Language` header — so a Spanish visitor gets Spanish. English is the fallback only when a request carries no locale signal at all, which is the normal case for an embedded badge in a README. The main content pages (landing, about, privacy, terms, archetype guides) are server-rendered per locale — both languages are pre-built, so there's no flash of the wrong language while the page loads.

### Admin Dashboard (`/admin`)

Admin-only dashboard with user management, agent fleet monitoring, feature flags, engagement controls, campaign management, and a command bar. Access controlled by the `ADMIN_HANDLES` environment variable.

### Badge Verification

Badges marked **Verified metrics** include a 32-character HMAC-SHA256 hash. Anyone can look up the original stored verification record at `/api/verify/:hash` and compare its returned fields with the badge. The lookup does not scan or re-sign an SVG.

## Quick Start

```bash
# Prerequisites: Node.js 20+, corepack enabled
corepack enable pnpm

# Install dependencies
pnpm install

# Copy env vars and fill in values
cp .env.example .env.local

# Run dev server (port 3001)
pnpm run dev
```

## Project Structure

```
chapa/
├── apps/web/              # Next.js 16 app (App Router)
│   ├── proxy.ts           # Narrow locale rewrite for the 9 content pages below (no visible URL prefix)
│   ├── app/               # Pages and API routes
│   │   ├── api/           # Auth, refresh, verify, health, CLI, cron, admin endpoints
│   │   ├── [locale]/      # Landing, about, privacy, terms, archetypes — server-rendered per locale
│   │   ├── admin/         # Admin dashboard (protected)
│   │   ├── u/[handle]/    # Share page + badge.svg route
│   │   ├── studio/        # Creator Studio
│   │   ├── settings/      # Account settings (connections, insights import, identity)
│   │   └── verify/        # Badge verification landing
│   ├── components/        # React components (terminal UI, badge, dashboard, nav, tooltips)
│   └── lib/               # Business logic
│       ├── auth/          # GitHub, Bitbucket, Codeberg OAuth + CLI token management
│       ├── cache/         # Upstash Redis (6h TTL)
│       ├── dashboard/     # Insight generation (CoachingInsights, DimensionCard, SubMetricPanel)
│       ├── db/            # Supabase data access (users, platforms, snapshots, campaigns)
│       ├── github/        # GraphQL client + stats aggregation + multi-platform merge
│       ├── bitbucket/     # Bitbucket API client + stats aggregation
│       ├── codeberg/      # Codeberg API client + stats aggregation
│       ├── gitlab/        # GitLab API client + stats aggregation
│       ├── history/       # Lifetime metric snapshots (Supabase)
│       ├── i18n/          # Locale detection, dictionaries (en/es), server + client translation
│       ├── impact/        # Impact v6 scoring engine
│       ├── insights/      # AI tool insights integration
│       ├── profile/       # Profile materialisation and orchestration
│       ├── render/        # React-to-SVG badge renderer
│       ├── verification/  # HMAC-SHA256 badge signing
│       ├── webmcp/        # Agent-facing tool adapter, shared tools, route/tool map
│       ├── effects/       # Visual effects library
│       └── email/         # Resend integration + campaigns
├── packages/
│   ├── cli/               # chapa-cli npm package
│   └── shared/            # Shared types, constants, scoring utils
└── docs/                  # Specs, design system, guides
```

## Impact v6 Scoring

Chapa computes a multi-dimensional developer profile from commits, PRs, code reviews, and activity patterns:

| Dimension | What it measures |
|-----------|-----------------|
| **Delivery** | PRs merged, issues closed, commits, lead time modifier (±5%) |
| **Quality** | Code reviews + review ratio (collaborative) or PR hygiene (solo), batch size score |
| **Consistency** | Active days, heatmap evenness, week coverage |
| **Breadth** | Repository diversity, cross-project influence, community signals |
| **Craft** *(optional)* | AI tool usage patterns via Claude Code insights |

An internal **confidence score** (50–100) reflects data completeness and gently adjusts the composite score to produce the final tier. Confidence is not shown on developer-facing pages — it works behind the scenes to ensure fair scoring.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4 (dark theme, purple accent) |
| Caching | Upstash Redis |
| Database | Supabase (PostgreSQL) |
| Data | GitHub GraphQL API, Bitbucket REST API, Codeberg/Gitea API, GitLab REST API |
| Analytics | PostHog |
| Email | Resend |
| CLI | Node.js, tsup, device auth flow |
| Hosting | Vercel |
| Testing | Vitest with a TDD workflow |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_CLIENT_ID` | Yes | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | Yes | GitHub OAuth App client secret |
| `NEXTAUTH_SECRET` | Yes | Session signing / token encryption secret |
| `NEXT_PUBLIC_BASE_URL` | Yes | Base URL for OAuth redirects |
| `UPSTASH_REDIS_REST_URL` | Yes | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | Upstash Redis REST token |
| `SUPABASE_URL` | No | Supabase project URL (DB features degrade gracefully) |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Supabase service role key (server-side only) |
| `NEXT_PUBLIC_POSTHOG_KEY` | No | PostHog project API key |
| `NEXT_PUBLIC_POSTHOG_HOST` | No | PostHog ingestion host |
| `CHAPA_ALERT_WEBHOOK_URL` | No | Active operational alert webhook for health, badge, OAuth, and cron failures |
| `RESEND_API_KEY` | No | Resend email service |
| `BITBUCKET_CLIENT_ID` | No | Bitbucket OAuth consumer key |
| `BITBUCKET_CLIENT_SECRET` | No | Bitbucket OAuth consumer secret |
| `CODEBERG_CLIENT_ID` | No | Codeberg OAuth app client ID |
| `CODEBERG_CLIENT_SECRET` | No | Codeberg OAuth app secret |
| `GITLAB_CLIENT_ID` | No | GitLab OAuth app client ID |
| `GITLAB_CLIENT_SECRET` | No | GitLab OAuth app secret |
| `NEXT_PUBLIC_GITLAB_ENABLED` | No | Set to `"true"` to enable GitLab link/unlink in User Menu |
| `CHAPA_VERIFICATION_SECRET` | No | Required in production for `/api/verify`; when unset outside production, verification is disabled |
| `ADMIN_HANDLES` | No | Comma-separated admin GitHub handles |
| `CRON_SECRET` | No | Required anywhere `/api/cron/*` should run; cron routes return 503 when it is unset |

See `.env.example` for the full list with descriptions.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm run dev` | Start dev server (port 3001) |
| `pnpm run build` | Production build |
| `pnpm run test` | Run all tests |
| `pnpm run test:watch` | Tests in watch mode |
| `pnpm run test:coverage` | Tests with coverage report |
| `pnpm run typecheck` | TypeScript check (all workspaces) |
| `pnpm run lint` | ESLint check |

## Key Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | Landing page |
| `GET /u/:handle` | Share page — badge preview, breakdown, embed snippets |
| `GET /u/:handle/badge.svg` | Embeddable SVG badge (CDN-cached) |
| `GET /studio` | Creator Studio (auth required) |
| `GET /admin` | Admin dashboard (admin handles only) |
| `GET /about` | About page (scoring explainer, archetype showcase) |
| `GET /api/health` | Health check (`status`, timestamp, and Redis/Supabase/GitHub dependency probes) |
| `GET /api/version` | No-store deployment identity for release verification |
| `GET /api/verify/:hash` | Badge verification |
| `POST /api/refresh?handle=` | Force refresh (rate-limited) |
| `GET /api/history/:handle` | Score history, trend, and diff |

## Embed Your Badge

**Markdown:**
```markdown
[![Chapa Badge](https://chapa.thecreativetoken.com/u/YOUR_HANDLE/badge.svg)](https://chapa.thecreativetoken.com/u/YOUR_HANDLE)
```

**HTML:**
```html
<a href="https://chapa.thecreativetoken.com/u/YOUR_HANDLE">
  <img src="https://chapa.thecreativetoken.com/u/YOUR_HANDLE/badge.svg" alt="Chapa Impact Badge" width="600" />
</a>
```

## License

Chapa is available under the [MIT License](LICENSE).
