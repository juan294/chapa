chapa/
├─ CLAUDE.md
├─ README.md
├─ package.json
├─ pnpm-workspace.yaml
├─ .gitignore
├─ .env.example
├─ docs/
│  ├─ spec.md
│  ├─ impact-v3.md
│  ├─ svg-design.md
│  ├─ tasks.md
│  └─ demo.md
├─ packages/
│  └─ shared/
│     ├─ package.json
│     └─ types.ts
└─ apps/
   └─ web/
      ├─ package.json
      ├─ next.config.js
      ├─ postcss.config.js
      ├─ tailwind.config.ts
      ├─ tsconfig.json
      ├─ app/
      │  ├─ layout.tsx
      │  ├─ page.tsx                 # landing
      │  ├─ u/
      │  │  └─ [handle]/
      │  │     ├─ page.tsx           # share page
      │  │     └─ badge.svg/
      │  │        └─ route.ts        # SVG endpoint
      │  └─ api/
      │     ├─ auth/                 # OAuth routes live here (or NextAuth)
      │     └─ impact/
      │        └─ route.ts           # optional JSON API: stats+impact
      ├─ components/
      │  ├─ BadgePreview.tsx
      │  ├─ CopyButton.tsx
      │  ├─ ImpactBreakdown.tsx
      │  └─ ShareButton.tsx
      ├─ lib/
      │  ├─ auth/
      │  │  └─ github.ts
      │  ├─ github/
      │  │  ├─ client.ts
      │  │  ├─ queries.ts
      │  │  └─ stats90d.ts
      │  ├─ cache/
      │  │  └─ redis.ts
      │  ├─ impact/
      │  │  ├─ v3.ts
      │  │  └─ v3.test.ts
      │  ├─ render/
      │  │  ├─ BadgeSvg.tsx
      │  │  ├─ GithubBranding.tsx
      │  │  ├─ theme.ts
      │  │  └─ heatmap.ts
      │  └─ analytics/
      │     └─ posthog.ts
      └─ styles/
         └─ globals.css