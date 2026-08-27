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

Chapa adds a WebMCP layer to the Creator Studio and its public profile and verification pages. Studio tools reuse the existing command registry, so agent actions update the same preview and terminal that the user sees. Saving is always human-gated; in judge demo mode (`/studio?demo=1`), confirmed saves stay local and never write production data. Public profile and verification tools are read-only.

Registration uses the current `document.modelContext.registerTool(tool, { signal })` contract, an `AbortController` for cleanup, feature detection for unsupported clients, and a remote feature-flag kill switch.

See the [WebMCP tool catalog and judge guide](docs/webmcp.md) and the [under-three-minute demo script and submission checklist](docs/webmcp-demo-script.md).

Runtime status, 2026-08-27: a preview-only `chapa_hello` spike passed native registration, discovery, and execution in flagged Chrome 151. The completed tool catalog still needs final production verification after release and flag enablement. The ChatGPT in-app client was unavailable for the spike, so this README does not claim ChatGPT runtime validation.

### Prior work and submission-period work

For this submission, all work through 2026-08-24 is prior work. The badge, scoring engine, share and verification pages, CLI, admin surfaces, and earlier Studio foundation already existed. The released baselines are [v2.22.0](https://github.com/juan294/chapa/releases/tag/v2.22.0) (2026-08-19) and [v2.22.1](https://github.com/juan294/chapa/releases/tag/v2.22.1) (2026-08-23).

Submission-period work started after that cutoff:

- The Creator Studio revival and hardening landed on 2026-08-26 and was released as [v2.23.0](https://github.com/juan294/chapa/releases/tag/v2.23.0).
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

Terminal-first Studio design playground with 9 visual effect categories, live preview, and saved Studio configuration. Requires GitHub login. Saved Studio settings do not change the public SVG badge or share page.

### CLI Tool (`chapa-cli`)

For developers on **GitHub Enterprise (EMU)** — merge your work contributions into your personal Chapa badge via a secure device auth flow.

```bash
npx chapa-cli login
npx chapa-cli merge
```

Supports `--insecure` for corporate networks with TLS interception and `--verbose` for diagnostics.

### Bilingual UI (ES / EN)

Chapa's interface is available in Spanish (default) and English. A language picker (globe icon, next to the theme toggle in the nav bar) saves your preference in a cookie. The default locale is auto-detected from your browser's `Accept-Language` header. The main content pages (landing, about, privacy, terms, archetype guides) are server-rendered per locale — both languages are pre-built, so there's no flash of the wrong language while the page loads.

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
| Testing | Vitest, 513 test files, 8,688 tests, TDD workflow |

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
