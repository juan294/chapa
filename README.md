# Chapa — Developer Impact Badge

Generate a live, embeddable, animated SVG badge showcasing your GitHub Impact Score.

## Quick Start

```bash
# Prerequisites: Node.js 20+, corepack enabled
corepack enable pnpm

# Install dependencies
pnpm install

# Copy env vars and fill in values
cp .env.example .env.local

# Run dev server
pnpm run dev
```

## Project Structure

```
chapa/
├── apps/web/           # Next.js 15 app (App Router)
│   ├── app/            # Pages and API routes
│   ├── components/     # React components
│   ├── lib/            # Business logic
│   │   ├── auth/       # GitHub OAuth
│   │   ├── cache/      # Redis caching
│   │   ├── github/     # GitHub API client + queries
│   │   ├── impact/     # Impact v3 scoring engine
│   │   └── render/     # SVG badge renderer
│   └── styles/         # Global CSS (Tailwind v4)
├── packages/shared/    # Shared types (@chapa/shared)
├── docs/               # Specs and design docs
└── scripts/            # Setup scripts
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_CLIENT_ID` | Yes | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | Yes | GitHub OAuth App client secret |
| `NEXTAUTH_SECRET` | Yes | Session signing secret |
| `UPSTASH_REDIS_REST_URL` | Yes | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | Upstash Redis REST token |
| `NEXT_PUBLIC_POSTHOG_KEY` | No | PostHog project API key |
| `NEXT_PUBLIC_POSTHOG_HOST` | No | PostHog ingestion host |

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm run dev` | Start development server |
| `pnpm run build` | Production build |
| `pnpm run test` | Run all tests |
| `pnpm run test:watch` | Run tests in watch mode |
| `pnpm run test:coverage` | Run tests with coverage |
| `pnpm run typecheck` | TypeScript check (all workspaces) |
| `pnpm run lint` | ESLint check |

## Key Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | Landing page |
| `GET /u/:handle` | Share page with badge + breakdown |
| `GET /u/:handle/badge.svg` | Embeddable SVG badge |
| `GET /api/health` | Health check |

## License

MIT
