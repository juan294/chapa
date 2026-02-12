# Chapa Task Board

> Rule: avoid file overlap. Each teammate owns their section’s files.

## Milestone 0 — Repo skeleton (Lead)
- [ ] Create Next.js App Router project (TS + Tailwind)
- [ ] Add `CLAUDE.md` and docs/
- [ ] Add env var placeholders:
  - [ ] `GITHUB_CLIENT_ID`
  - [ ] `GITHUB_CLIENT_SECRET`
  - [ ] `NEXTAUTH_SECRET` (if NextAuth)
  - [ ] `UPSTASH_REDIS_REST_URL`
  - [ ] `UPSTASH_REDIS_REST_TOKEN`
  - [ ] `NEXT_PUBLIC_POSTHOG_KEY`
  - [ ] `NEXT_PUBLIC_POSTHOG_HOST`
- [ ] Set base domain plan: `chapa.thecreativetoken.com`

---

## Teammate A — OAuth + session (apps/web/app/api/auth/*, apps/web/lib/auth/*)
### OAuth
- [ ] Implement GitHub OAuth login/callback (NextAuth or custom)
- [ ] Store token server-side securely
- [ ] Provide `getAuthedGithubClient()` helper
- [ ] Basic “me” fetch to confirm auth
- [ ] Add “Verified” boolean in server context

### DX
- [ ] Add README snippet: “How to set up GitHub OAuth App”
- [ ] Error handling for missing env vars

Acceptance
- [ ] Login works locally
- [ ] Token accessible in server routes

---

## Teammate B — GitHub stats + caching (apps/web/lib/github/*, apps/web/lib/cache/*)
### Stats queries
- [ ] Implement GraphQL queries for last 365 days:
  - [ ] `commitsTotal` (proxy ok)
  - [ ] `activeDays`
  - [ ] `prsMergedCount`
  - [ ] per-PR filesChanged/additions/deletions for PR weight
  - [ ] `reviewsSubmittedCount`
  - [ ] `issuesClosedCount` (best-effort)
  - [ ] `linesAdded/linesDeleted` totals (best-effort)
  - [ ] `reposContributed` and `topRepoShare`

### Derived metrics
- [ ] Compute `prsMergedWeight` with PR weight formula + caps
- [ ] Compute `maxCommitsIn10Min` (approx; from commit timestamps available)
- [ ] (Optional) `docsOnlyPrRatio`
- [ ] (Optional) `microCommitRatio`

### Caching
- [ ] Implement Redis cache wrappers:
  - [ ] get/set JSON with TTL
  - [ ] daily cache keying
- [ ] Add fallback: if GitHub fails, serve last cached

Acceptance
- [ ] `getStats(handle, token?)` returns `StatsData`
- [ ] Rate limit failures do not break badge if cached exists

---

## Teammate C — Impact v3 scoring + tests (apps/web/lib/impact/*)
### Scoring
- [ ] Implement `computeImpactV3(stats: StatsData): ImpactV3Result`
- [ ] Ensure v3 includes:
  - [ ] base score
  - [ ] confidence [50..100]
  - [ ] adjusted score
  - [ ] tier mapping
  - [ ] flags + up to 2 reasons
  - [ ] breakdown (normalized components)

### Tests
- [ ] Unit tests for:
  - [ ] normalization + caps (no NaNs)
  - [ ] confidence clamp boundaries
  - [ ] tier thresholds
  - [ ] “generated change pattern” triggers only when conditions met

Acceptance
- [ ] Tests run in CI (`pnpm test` or `vitest`)
- [ ] Output is stable and deterministic for a given stats input

---

## Teammate D — React-to-SVG renderer + badge endpoint (apps/web/lib/render/*, apps/web/app/u/[handle]/badge.svg/route.ts)
### Renderer
- [ ] Build `BadgeSvg` React component producing `<svg width="1200" height="630">`
- [ ] Implement:
  - [ ] background card + border
  - [ ] title block
  - [ ] heatmap grid (13×7) with palette
  - [ ] stats column (PRs, Reviews, Commits)
  - [ ] Impact tier + score + confidence
  - [ ] footer branding (flagged)

### Animation
- [ ] Heatmap fade-in by week OR subtle impact glow pulse

### Endpoint
- [ ] Route `/u/[handle]/badge.svg`
- [ ] Fetch stats + impact (cached)
- [ ] Render SVG → string
- [ ] Set cache headers (s-maxage + swr)

Acceptance
- [ ] SVG loads in browser
- [ ] SVG embeds in README via URL
- [ ] Branding toggle works

---

## Teammate E — Share page + embed + share CTA (apps/web/app/u/[handle]/page.tsx, apps/web/components/*)
### Page UI
- [ ] `/u/[handle]` page:
  - [ ] badge preview (use `<img src="/u/.../badge.svg">` or inline)
  - [ ] key numbers: tier, score, confidence
  - [ ] confidence reasons (max 2)
  - [ ] breakdown bars (normalized components)

### Embed snippets
- [ ] Markdown snippet:
  - `![Chapa Badge](https://chapa.thecreativetoken.com/u/<handle>/badge.svg)`
- [ ] HTML snippet:
  - `<img src="..." alt="Chapa Badge" />`
- [ ] Copy buttons with PostHog tracking

### Share CTA
- [ ] “Share on X” button:
  - prefilled text + link to `/u/<handle>`
- [ ] OG metadata for share page (title + description)

### Refresh (optional)
- [ ] Refresh button (disabled if updated recently)
- [ ] If implemented, calls `/api/refresh?handle=`

Acceptance
- [ ] Share page looks great and is responsive
- [ ] Copy buttons work
- [ ] Share opens X compose

---

## Milestone 1 — Polish + deployment (Lead)
- [ ] Create GitHub OAuth app + set callback URLs for prod
- [ ] Add domain in Vercel + HTTPS
- [ ] Setup Upstash Redis
- [ ] Setup PostHog env vars
- [ ] Add README with:
  - [ ] local setup steps
  - [ ] env vars
  - [ ] deploy notes
  - [ ] demo script link

---

## Milestone 2 — Extras (nice-to-have)
- [ ] 2 additional themes (same layout)
- [ ] Verified stamp (OAuth required)
- [ ] “Chapa Studio” (agent team) generates:
  - [ ] short impact summary paragraph
  - [ ] 3 X share text variants (humble/proud/hiring)
- [ ] Sample gallery page with 3 example handles