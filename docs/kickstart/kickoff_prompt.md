We are building "Chapa" (Dev Impact Badge).

First: read and internalize these repo docs as the source of truth:
- CLAUDE.md
- docs/spec.md
- docs/impact-v3.md
- docs/svg-design.md
- docs/tasks.md
- docs/demo.md

Then do this in planning mode:

1) Propose an implementation plan that matches the milestones in docs/tasks.md.
2) Create an agent team with these teammates and roles (avoid file overlap):
   - Teammate A (OAuth + session): apps/web/app/api/auth/*, apps/web/lib/auth/*
   - Teammate B (GitHub stats + caching): apps/web/lib/github/*, apps/web/lib/cache/*
   - Teammate C (Impact v3 + tests): apps/web/lib/impact/* and types in packages/shared/types.ts
   - Teammate D (React-to-SVG renderer + badge endpoint): apps/web/lib/render/*, apps/web/app/u/[handle]/badge.svg/route.ts
   - Teammate E (Share page UI + embed/share): apps/web/app/u/[handle]/page.tsx, apps/web/components/*
3) Break down tasks into a shared task list that mirrors docs/tasks.md, with each task producing a clear deliverable (file(s) created/updated, or endpoint working).
4) Enforce these rules:
   - Impact Score v3 only (no v1/v2).
   - Confidence is non-accusatory; never claims cheating; only signal strength with up to 2 reasons.
   - Badge is 1200×630, Midnight Mint theme, subtle animations.
   - GitHub logo/"Powered by GitHub" included but isolated behind a feature flag includeGithubBranding.
   - Cache stats/impact/svg daily per handle (TTL 24h) and set Cache-Control headers on /badge.svg.
   - Handle GitHub API failures by serving cached data if available.
5) Start with Milestone 0 (repo skeleton) and coordinate the teammates to implement Milestone 0–1 end-to-end first (a working badge for one handle), then iterate.

Output format for your plan:
- Architecture overview (routes, modules, cache keys)
- Ordered milestones with checklists (referencing docs/tasks.md IDs)
- Team assignments (who owns what files)
- Risks + mitigations (rate limits, SVG rendering quirks, OAuth callback URLs)
- A short demo checklist that matches docs/demo.md