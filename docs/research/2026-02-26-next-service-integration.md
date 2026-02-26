# Next Service Integration — Research

> Date: 2026-02-26
> Status: Research complete
> Context: Bitbucket integration is shipped. What's next?

## 1. Existing Multi-Platform Research — Accuracy Check

The original research document (`docs/research/multi-platform.md`, dated 2026-02-18) evaluated 7 platforms and recommended a priority order. Here's how it holds up now that Bitbucket has been implemented.

### What the document recommended

| Priority | Platform | Feasibility | Status today |
|----------|----------|-------------|--------------|
| 1st | Codeberg / Forgejo / Gitea | 5/5 | Not started |
| 2nd | GitLab | 5/5 | Not started |
| Watch | Gitness | 3/5 | Not started |
| Skip | SourceHut | 2/5 | N/A |
| Skip | Radicle | 1/5 | N/A |
| Skip | OneDev | 2/5 | N/A |

### What actually happened

Bitbucket was **not in the original research document** — it was researched separately (`docs/research/2026-02-23-bitbucket-integration.md`) and implemented first, presumably due to its enterprise user base (10M+ users) and the Atlassian ecosystem overlap with GitHub.

### Accuracy assessment

The original document's core claims remain accurate:

1. **"Architecture is fundamentally platform-agnostic"** — Confirmed. The Bitbucket integration required zero changes to scoring (`computeImpactV4()`) or badge rendering. All investment was in OAuth + API client + data transformation, exactly as predicted. (`apps/web/lib/impact/` and `apps/web/lib/render/` were untouched.)

2. **"`mergeStats()` already provides a working blueprint"** — Confirmed. The merge function at `apps/web/lib/github/merge.ts` handles Bitbucket data identically to supplemental data. The only addition was the `{ markAsSupplemental: false }` option to distinguish verified linked platforms from unverified EMU uploads (`client.ts:93`).

3. **"Platform Comparison Matrix"** — Still accurate. The API types, auth methods, and data model matches for GitLab, Codeberg, Gitea, SourceHut, Radicle, and Gitness have not changed. No major API deprecations or new platforms have emerged since February 18.

4. **"Effort estimates"** — Partially validated. The Bitbucket integration (5 phases, ~20 files) matches the "L" t-shirt size predicted for "first non-GitHub platform." However, the document predicted Codeberg/Forgejo would be "S" (lowest effort) — this remains plausible given the GitHub-compatible API and native heatmap endpoint, but is untested.

5. **"Priority order" (Codeberg first, then GitLab)** — Still reasonable, but Bitbucket going first changed the dynamics. The abstraction layer that the document said should come first (`PlatformQuery` interface) was **not built**. Instead, Bitbucket was wired directly into `getStats()` at `client.ts:88-94`. This means the next integration will either need to formalize the abstraction or follow the same direct-wiring pattern.

### What the document got wrong or missed

1. **Bitbucket was missing entirely.** The research evaluated open-source Git forges but not commercial platforms. Bitbucket's 10M+ enterprise users made it a higher-priority target than Codeberg's 200K.

2. **The `PlatformQuery` interface was not needed yet.** The document proposed abstracting upfront (Phase 1). In practice, Bitbucket was added by extending `getStats()` directly with a `_fetchBitbucketIfLinked()` function — simpler, less speculative. The abstraction can still be introduced when a third platform makes the pattern clear.

3. **Token refresh complexity was underestimated.** The document treated OAuth as uniform across platforms. In practice, Bitbucket's 2-hour token expiry required a lazy refresh mechanism with a 5-minute buffer (`apps/web/lib/auth/bitbucket.ts:210-221`), encrypted token storage in Supabase (`apps/web/lib/db/user-platforms.ts`), and proactive refresh in the stats fetch pipeline (`client.ts:139-164`). GitLab and Codeberg may have different token lifecycles.

4. **Self-hosted instance support was not addressed.** The document mentions Gitea/Forgejo needing a "custom instance URL" field but doesn't detail the UX or database implications. The current `user_platforms` table schema (`docs/research/multi-platform.md:290-304`) includes an `instance_url` column, but the implemented schema (`apps/web/lib/db/user-platforms.ts`) does not have this column yet.

---

## 2. Current Architecture — What Bitbucket Built

The Bitbucket integration established a concrete pattern for adding new services. Here is the exact anatomy:

### File structure per platform

```
OAuth helpers:       apps/web/lib/auth/bitbucket.ts            (222 lines)
OAuth routes:        apps/web/app/api/auth/bitbucket/
                       connect/route.ts                         (37 lines)
                       callback/route.ts                        (103 lines)
                       disconnect/route.ts                      (POST, removes link)
                       status/route.ts                          (lightweight check)
Data types:          apps/web/lib/bitbucket/types.ts            (92 lines)
API queries:         apps/web/lib/bitbucket/queries.ts          (347 lines)
Stats transform:     apps/web/lib/bitbucket/stats-aggregation.ts (94 lines)
Stats orchestrator:  apps/web/lib/bitbucket/stats.ts            (20 lines)
```

### Shared infrastructure (reusable for any platform)

| Component | Location | What it does |
|-----------|----------|-------------|
| Platform type | `packages/shared/src/platforms.ts:2` | `Platform = "github" \| "bitbucket"` — extend for new platforms |
| LinkedPlatform | `packages/shared/src/platforms.ts:5-9` | DB record shape (no tokens) |
| DB access | `apps/web/lib/db/user-platforms.ts` | CRUD for linked platforms — `dbGetLinkedPlatform()`, `dbUpsertLinkedPlatform()`, `dbDeleteLinkedPlatform()`, `dbUpdatePlatformTokens()`, `dbGetLinkedPlatforms()` |
| Feature flags | `apps/web/lib/feature-flags.ts` | Dual-tier: sync (env var) + async (DB-backed) |
| Stats merge | `apps/web/lib/github/merge.ts` | `mergeStats(primary, secondary, options)` — additive numerics, max social, merge heatmaps |
| Token encryption | `apps/web/lib/auth/github.ts` | AES-256-GCM encrypt/decrypt using `NEXTAUTH_SECRET` |
| Confidence flags | `apps/web/lib/impact/utils.ts:141-147` | `platform_linked` (0 penalty) for verified OAuth-linked platforms |
| Stats orchestrator | `apps/web/lib/github/client.ts:38-115` | `getStats()` — cache → GitHub → Bitbucket → merge → supplemental → cache |

### Cache key structure

```
stats:v2:merged:<handle>       — Final merged stats (6h TTL)
stats:v2:bitbucket:<handle>    — Bitbucket-only stats (6h TTL)
stats:stale:<handle>           — Stale fallback for merged (7d TTL)
supplemental:<handle>          — EMU supplemental data
```

### Environment variables per platform

```
<PLATFORM>_CLIENT_ID=              # OAuth consumer key
<PLATFORM>_CLIENT_SECRET=          # OAuth consumer secret (server-side only)
NEXT_PUBLIC_<PLATFORM>_ENABLED=    # Feature flag (client-side)
```

Plus a DB-backed `feature_flags` row for server-side async checks.

### UI integration point

`apps/web/components/UserMenu.tsx` — single file that shows "Link [Platform]" or "[Platform] linked / Unlink" based on status fetched from `/api/auth/<platform>/status`.

---

## 3. Candidate Assessment for Next Service

### Option A: Codeberg / Forgejo / Gitea

**Why it was recommended first in the original research:**
- GitHub-compatible REST API (intentionally designed that way)
- Native `/users/:username/heatmap` endpoint — no calendar reconstruction needed
- One integration covers Codeberg SaaS + any self-hosted Forgejo/Gitea instance
- Growing FOSS community (200K+ on Codeberg, thousands of self-hosted instances)

**What has changed since the research:**
- Nothing material. Codeberg still runs Forgejo, API is stable, heatmap endpoint still exists.
- Forgejo federation (ForgeFed/ActivityPub) is still under development — not yet usable for cross-instance aggregation.

**Implementation effort vs Bitbucket:**
- **Easier**: API is closer to GitHub's shape, heatmap endpoint exists (Bitbucket required manual reconstruction from commits)
- **Similar**: OAuth 2.0 flow, token storage, feature flag, UI
- **New challenge**: Self-hosted instances require a user-provided "instance URL" field. The `user_platforms` table would need an `instance_url` column (the original research doc's schema included this, but the current implementation does not).

**Estimated files to create:**

```
apps/web/lib/auth/codeberg.ts              (OAuth helpers)
apps/web/app/api/auth/codeberg/
  connect/route.ts
  callback/route.ts
  disconnect/route.ts
  status/route.ts
apps/web/lib/codeberg/types.ts             (API response types)
apps/web/lib/codeberg/queries.ts           (REST fetcher)
apps/web/lib/codeberg/stats-aggregation.ts (transform → StatsData)
apps/web/lib/codeberg/stats.ts             (orchestrator)
```

**What needs modification:**

| File | Change |
|------|--------|
| `packages/shared/src/platforms.ts:2` | Add `"codeberg"` to `Platform` union |
| `apps/web/lib/github/client.ts` | Add `_fetchCodebergIfLinked()` in `getStats()` pipeline |
| `apps/web/lib/feature-flags.ts` | Add `isCodebergEnabled()` / `isCodebergEnabledSync()` |
| `apps/web/components/UserMenu.tsx` | Add Codeberg link/unlink row |
| `apps/web/lib/db/user-platforms.ts` | Add `instance_url` support (for self-hosted) |
| `user_platforms` table | Migration to add `instance_url` column |

**Risk: self-hosted instances add UX complexity.** Codeberg.org is straightforward (single SaaS URL). But supporting arbitrary Gitea/Forgejo instances means: (a) user must enter a URL, (b) Chapa must validate the URL is a real Gitea/Forgejo instance, (c) OAuth consumer credentials must be per-instance (or the user provides a PAT). This is a significant scope expansion vs. SaaS-only platforms.

**Mitigation**: Start with Codeberg.org SaaS only. Add self-hosted Gitea/Forgejo as a follow-up. This keeps Phase 1 scoped to a known, single-instance integration.

### Option B: GitLab

**Why it's high-value:**
- 30M+ registered users, 50%+ of Fortune 100
- Mature OAuth 2.0 + REST + GraphQL APIs
- Data model very close to GitHub (MRs ≈ PRs, Stars, Forks, Issues)

**What has changed since the research:**
- Nothing material. GitLab API is stable, OAuth 2.0 is well-documented.

**Implementation effort vs Bitbucket:**
- **Similar**: OAuth 2.0, token refresh, REST/GraphQL data fetching
- **Harder**: No heatmap endpoint — must reconstruct contribution calendar from Events API (`/users/:id/events`), which is paginated and contains mixed event types
- **Different**: MRs instead of PRs, different diffstat shape, some analytics gated behind Premium tier

**Risk: Events API pagination for heatmap.** GitLab's Events API is the only way to reconstruct a contribution calendar. This requires paginating through up to a year of events, filtering by type, and aggregating by date. Rate limits (2,000 req/min) are generous, but the per-user API call budget could be higher than Bitbucket's ~100-150 calls.

### Option C: Formalize `PlatformQuery` abstraction first

The original research recommended building the abstraction layer before adding platforms. With Bitbucket complete, there are now two data points (GitHub + Bitbucket) to inform the interface design.

**What the abstraction would look like (based on actual patterns):**

```typescript
interface PlatformQuery {
  platform: Platform;
  fetchStats(login: string, token: string): Promise<StatsData | null>;
}

interface PlatformAuth {
  platform: Platform;
  getAuthorizationUrl(state: string): string;
  exchangeCode(code: string): Promise<TokenResponse>;
  refreshToken(refreshToken: string): Promise<TokenResponse | null>;
  fetchUser(accessToken: string): Promise<{ login: string; displayName: string; avatarUrl: string }>;
}
```

**Pros**: Makes adding platform N+1 cheaper. Reduces duplication in `getStats()`.
**Cons**: Premature if only adding one more platform. Current direct-wiring in `client.ts` is simple and works.

**Recommendation**: Build the abstraction when adding the third platform (i.e., when adding GitLab after Codeberg, or vice versa). Two platforms can be handled with direct wiring. Three platforms make the pattern clear enough to abstract well.

---

## 4. What the Document Does NOT Cover

The original multi-platform research (`docs/research/multi-platform.md`) focused exclusively on **Git hosting platforms** — services where developers host code and make commits, PRs, and reviews. It did not evaluate:

| Category | Examples | Present in research? |
|----------|----------|---------------------|
| Package registries | npm, PyPI, crates.io, Maven, NuGet, Docker Hub | No |
| Developer Q&A | Stack Overflow, Dev.to, Hashnode | No |
| Project management | Jira, Linear | No |
| Code playgrounds | CodePen, CodeSandbox | No |
| CI/CD platforms | CircleCI, Travis CI, GitHub Actions | No |

These services have fundamentally different data models from Git forges. They don't produce `StatsData`-shaped output (commits, PRs, reviews, heatmaps). Integrating them would require new scoring dimensions or a separate "developer activity" layer outside the current Impact v4 framework.

The `StatsData` → `ImpactV4Result` pipeline is designed around **code contribution metrics from Git forges**. Extending it to package downloads, Stack Overflow reputation, or Jira tickets would require rethinking the scoring model, not just adding another platform query.

---

## 5. Recommendation

### Next service: Codeberg (SaaS only)

**Rationale:**
1. **Lowest effort** — GitHub-compatible API with native heatmap endpoint. The Bitbucket integration required reconstructing heatmaps from commit timestamps; Codeberg provides them directly.
2. **Proven pattern** — Follow the exact Bitbucket file structure and wiring. No abstraction layer needed yet.
3. **Growing community** — 200K+ users, many migrating from GitHub for FOSS principles. Chapa as the only cross-platform badge is a differentiator.
4. **Scoped risk** — SaaS-only (codeberg.org) avoids the self-hosted instance URL complexity. Gitea/Forgejo self-hosted support can follow later.

### After Codeberg: Formalize abstraction, then GitLab

With three platform integrations (GitHub + Bitbucket + Codeberg), the patterns will be clear enough to extract a `PlatformQuery` + `PlatformAuth` interface. Then GitLab (30M+ users) becomes cheaper to add.

### Deferred: Non-Git services

Package registries, Stack Overflow, Jira, etc. would require a new scoring dimension or metric layer. Defer until the Git forge integrations are mature and there's clear user demand.

---

## File references

| Document | Path |
|----------|------|
| Original multi-platform research | `docs/research/multi-platform.md` |
| Bitbucket integration research | `docs/research/2026-02-23-bitbucket-integration.md` |
| Bitbucket integration plan | `docs/plans/2026-02-23-bitbucket-integration.md` |
| Bitbucket phase plans | `docs/plans/2026-02-23-bitbucket-integration-phases/phase-{1..5}.md` |
| Account linking UX research | `docs/research/2026-02-24-account-linking-ux-patterns.md` |
| Bitbucket unlink UX research | `docs/research/2026-02-24-bitbucket-unlink-ux.md` |
| Platform type definition | `packages/shared/src/platforms.ts` |
| Stats orchestrator (getStats) | `apps/web/lib/github/client.ts` |
| Stats merge function | `apps/web/lib/github/merge.ts` |
| Bitbucket OAuth helpers | `apps/web/lib/auth/bitbucket.ts` |
| Bitbucket data fetching | `apps/web/lib/bitbucket/queries.ts` |
| Bitbucket stats transform | `apps/web/lib/bitbucket/stats-aggregation.ts` |
| User platforms DB access | `apps/web/lib/db/user-platforms.ts` |
| Feature flags | `apps/web/lib/feature-flags.ts` |
| Confidence scoring | `apps/web/lib/impact/utils.ts` |
| User Menu UI | `apps/web/components/UserMenu.tsx` |
