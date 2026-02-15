# Chapa — Developer Impact Badge

[![CI](https://github.com/juan294/chapa/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/juan294/chapa/actions/workflows/ci.yml)
[![Security Scan](https://github.com/juan294/chapa/actions/workflows/security.yml/badge.svg?branch=develop)](https://github.com/juan294/chapa/actions/workflows/security.yml)
[![Secret Scanning](https://github.com/juan294/chapa/actions/workflows/gitleaks.yml/badge.svg?branch=develop)](https://github.com/juan294/chapa/actions/workflows/gitleaks.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6)
![Node.js](https://img.shields.io/badge/Node.js-20%2B-43853d)
![Next.js](https://img.shields.io/badge/Next.js-16-000000)
![License](https://img.shields.io/badge/License-MIT-yellow)

Generate a **live, embeddable, animated SVG badge** that showcases your developer impact from GitHub activity — with multi-dimensional scoring, verification, and one-click sharing.

<a href="https://chapa.thecreativetoken.com/u/juan294">
  <img src="https://chapa.thecreativetoken.com/u/juan294/badge.svg" alt="juan294's Chapa Impact Badge" width="100%" />
</a>

---

## What It Does

Chapa analyzes your last 12 months of GitHub activity and generates a badge with:

- **Impact Score** (0–100) with tier (Emerging → Solid → High → Elite)
- **4-Dimension Profile** — Building, Guarding, Consistency, Breadth
- **Developer Archetype** — Builder, Guardian, Marathoner, Polymath, Balanced, or Emerging
- **Activity Heatmap** — 13-week daily contribution visualization
- **Radar Chart** — visual breakdown of your 4 dimensions
- **Verification Hash** — HMAC-SHA256 watermark proving badge authenticity

## Features

### Embeddable Badge (`/u/:handle/badge.svg`)

A 1200×630 animated SVG you can embed anywhere — GitHub profile READMEs, personal sites, portfolios. Cached at the CDN edge for 24 hours.

```markdown
![My Chapa Badge](https://chapa.thecreativetoken.com/u/YOUR_HANDLE/badge.svg)
```

### Share Page (`/u/:handle`)

Public profile page with full score breakdown, dimension details with explanatory tooltips, embed snippets (Markdown + HTML), and one-click sharing to X.

### Creator Studio (`/studio`)

Terminal-first badge customization UI with 9 visual effect categories, live preview, and config persistence. Requires GitHub login.

### CLI Tool (`chapa-cli`)

For developers on **GitHub Enterprise (EMU)** — merge your work contributions into your personal Chapa badge via a secure device auth flow.

```bash
npx chapa-cli login
npx chapa-cli merge
```

Supports `--insecure` for corporate networks with TLS interception and `--verbose` for diagnostics.

### Admin Dashboard (`/admin`)

Admin-only dashboard with user management, sortable data table, manual refresh, and a command bar with `/sort`, `/refresh` commands. Access controlled by the `ADMIN_HANDLES` environment variable.

### Badge Verification

Every badge includes an 8-character HMAC-SHA256 hash. Anyone can verify a badge is authentic at `/api/verify/:hash` — no tampering possible.

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
│   │   ├── api/           # Auth, refresh, verify, health, CLI, cron endpoints
│   │   ├── admin/         # Admin dashboard (protected)
│   │   ├── u/[handle]/    # Share page + badge.svg route
│   │   ├── studio/        # Creator Studio
│   │   └── verify/        # Badge verification landing
│   ├── components/        # React components (terminal UI, badge, nav, tooltips)
│   └── lib/               # Business logic
│       ├── auth/          # GitHub OAuth + CLI token management
│       ├── cache/         # Upstash Redis (24h TTL)
│       ├── github/        # GraphQL client + stats aggregation
│       ├── history/       # Lifetime metric snapshots (Redis sorted sets, no TTL)
│       ├── impact/        # Impact v4 scoring engine
│       ├── render/        # React-to-SVG badge renderer
│       ├── verification/  # HMAC-SHA256 badge signing
│       ├── effects/       # Visual effects library
│       └── email/         # Resend integration
├── packages/
│   ├── cli/               # chapa-cli npm package (v0.2.7)
│   └── shared/            # Shared types, constants, scoring utils
└── docs/                  # Specs, design system, guides
```

## Impact v4 Scoring

Chapa computes a multi-dimensional developer profile from commits, PRs, code reviews, and activity patterns:

| Dimension | What it measures |
|-----------|-----------------|
| **Building** | Commits landed, PRs merged, code volume |
| **Guarding** | Code reviews, review comments, review depth |
| **Consistency** | Activity spread, heatmap evenness, streak patterns |
| **Breadth** | Repository diversity, language variety |

An internal **confidence score** (50–100) reflects data completeness and gently adjusts the composite score to produce the final tier. Confidence is not shown on developer-facing pages — it works behind the scenes to ensure fair scoring.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4 (dark theme, purple accent) |
| Caching | Upstash Redis |
| Data | GitHub GraphQL API |
| Analytics | PostHog |
| Email | Resend |
| CLI | Node.js, tsup, device auth flow |
| Hosting | Vercel |
| Testing | Vitest, 77+ test files, TDD workflow |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_CLIENT_ID` | Yes | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | Yes | GitHub OAuth App client secret |
| `NEXTAUTH_SECRET` | Yes | Session signing secret |
| `NEXT_PUBLIC_BASE_URL` | Yes | Base URL for OAuth redirects |
| `UPSTASH_REDIS_REST_URL` | Yes | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | Upstash Redis REST token |
| `NEXT_PUBLIC_POSTHOG_KEY` | No | PostHog project API key |
| `NEXT_PUBLIC_POSTHOG_HOST` | No | PostHog ingestion host |
| `RESEND_API_KEY` | No | Resend email service |
| `RESEND_WEBHOOK_SECRET` | No | Resend webhook HMAC secret |

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
| `GET /api/health` | Health check |
| `GET /api/verify/:hash` | Badge verification |
| `GET /api/admin/users` | Admin user list (auth + admin check) |
| `POST /api/refresh?handle=` | Force refresh (rate-limited) |

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
