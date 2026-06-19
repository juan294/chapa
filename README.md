# Chapa — Developer Impact Badge

[![CI](https://github.com/juan294/chapa/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/juan294/chapa/actions/workflows/ci.yml)
[![Security Scan](https://github.com/juan294/chapa/actions/workflows/security.yml/badge.svg?branch=develop)](https://github.com/juan294/chapa/actions/workflows/security.yml)
[![Secret Scanning](https://github.com/juan294/chapa/actions/workflows/gitleaks.yml/badge.svg?branch=develop)](https://github.com/juan294/chapa/actions/workflows/gitleaks.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178c6)
![Node.js](https://img.shields.io/badge/Node.js-20%2B-43853d)
![Next.js](https://img.shields.io/badge/Next.js-16-000000)
![License](https://img.shields.io/badge/License-MIT-yellow)

Generate a **live, embeddable, animated SVG badge** that showcases your developer impact from GitHub, Bitbucket, Codeberg, and GitLab activity — with multi-dimensional scoring, verification, and one-click sharing.

<a href="https://chapa.thecreativetoken.com/u/juan294">
  <img src="https://chapa.thecreativetoken.com/u/juan294/badge.svg" alt="juan294's Chapa Impact Badge" width="100%" />
</a>

---

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

Terminal-first badge customization UI with 9 visual effect categories, live preview, and config persistence. Requires GitHub login.

### CLI Tool (`chapa-cli`)

For developers on **GitHub Enterprise (EMU)** — merge your work contributions into your personal Chapa badge via a secure device auth flow.

```bash
npx chapa-cli login
npx chapa-cli merge
```

Supports `--insecure` for corporate networks with TLS interception and `--verbose` for diagnostics.

### Bilingual UI (ES / EN)

Chapa's interface is available in Spanish (default) and English. A language picker (globe icon, next to the theme toggle in the nav bar) saves your preference in a cookie. The default locale is auto-detected from your browser's `Accept-Language` header.

### Admin Dashboard (`/admin`)

Admin-only dashboard with user management, agent fleet monitoring, feature flags, engagement controls, campaign management, and a command bar. Access controlled by the `ADMIN_HANDLES` environment variable.

### Badge Verification

Every badge includes a 32-character HMAC-SHA256 hash. Anyone can verify a badge is authentic at `/api/verify/:hash` — no tampering possible.

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
│   ├── app/               # Pages and API routes
│   │   ├── api/           # Auth, refresh, verify, health, CLI, cron, admin endpoints
│   │   ├── admin/         # Admin dashboard (protected)
│   │   ├── u/[handle]/    # Share page + badge.svg route
│   │   ├── studio/        # Creator Studio
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
| Testing | Vitest, 456+ test files, 7,800+ tests, TDD workflow |

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

MIT
