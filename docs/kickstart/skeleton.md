mkdir -p chapa/{docs,apps/web,packages/shared}
cd chapa

# workspace files
touch CLAUDE.md README.md package.json pnpm-workspace.yaml .gitignore .env.example

# docs
touch docs/{spec.md,impact-v3.md,svg-design.md,tasks.md,demo.md}

# shared package
mkdir -p packages/shared
touch packages/shared/{package.json,types.ts}

# web app structure
mkdir -p apps/web/{app,components,lib/{auth,github,cache,impact,render,analytics},styles}
mkdir -p apps/web/app/{api,u}
mkdir -p apps/web/app/u/[handle]/badge.svg
mkdir -p apps/web/app/api/{auth,impact}

touch apps/web/package.json
touch apps/web/{next.config.js,postcss.config.js,tailwind.config.ts,tsconfig.json}
touch apps/web/styles/globals.css

touch apps/web/app/{layout.tsx,page.tsx}
touch apps/web/app/u/[handle]/page.tsx
touch apps/web/app/u/[handle]/badge.svg/route.ts
touch apps/web/app/api/impact/route.ts

touch apps/web/components/{BadgePreview.tsx,CopyButton.tsx,ImpactBreakdown.tsx,ShareButton.tsx}

touch apps/web/lib/auth/github.ts
touch apps/web/lib/github/{client.ts,queries.ts,stats.ts}
touch apps/web/lib/cache/redis.ts
touch apps/web/lib/impact/{v3.ts,v3.test.ts}
touch apps/web/lib/render/{BadgeSvg.tsx,GithubBranding.tsx,theme.ts,heatmap.ts}
touch apps/web/lib/analytics/posthog.ts