# Multi-Platform Support Research

> Issue: [#418](https://github.com/juan294/chapa/issues/418)
> Date: 2026-02-18
> Status: Research complete — no implementation decision yet

## Executive Summary

Chapa's architecture is **fundamentally platform-agnostic**. The scoring pipeline (`StatsData` → `ImpactV4Result`) contains zero GitHub-specific logic. All GitHub coupling lives in two layers: the GraphQL query and the OAuth flow. The existing `SupplementalStats` merge pattern already provides a working blueprint for multi-platform aggregation.

Of the 7 platforms researched, **3 are viable near-term integrations** (GitLab, Codeberg, Gitea/Forgejo), 1 is a watch-and-wait (Gitness), and 3 are not worth pursuing now (SourceHut, Radicle, OneDev).

---

## 1. Platform Assessment

### Tier 1 — High value, low effort

#### GitLab (gitlab.com)

| Attribute | Details |
|-----------|---------|
| **Backing** | GitLab Inc. (NASDAQ: GTLB, ~$5B market cap) |
| **Model** | SaaS + self-hosted (CE is MIT-licensed) |
| **Users** | 30M+ registered, 1M+ active licensed, 50%+ of Fortune 100 |
| **API** | REST v4 + GraphQL (versionless) |
| **Auth** | OAuth 2.0 with granular scopes, PATs |
| **Rate limits** | 2,000 req/min (authenticated SaaS) |
| **Data model match** | Very high — Repos, MRs (≈PRs), Issues, Stars, Forks |
| **Heatmap API** | No direct equivalent — must reconstruct from Events API (`/users/:id/events`) |
| **Key gap** | Some analytics gated behind Premium tier; contribution calendar must be computed |
| **Feasibility** | **5/5** |

GitLab is the highest-value target. Massive user base, mature API, near-identical data model. The main work is mapping MRs→PRs and computing contribution calendars from the Events API.

#### Codeberg (codeberg.org)

| Attribute | Details |
|-----------|---------|
| **Backing** | Codeberg e.V. (German non-profit, ~1,200 members) |
| **Model** | SaaS only (runs Forgejo) |
| **Users** | 200K+ registered, 300K+ repos |
| **API** | REST only (Swagger/OpenAPI), no GraphQL |
| **Auth** | OAuth 2.0 with granular scopes (since Forgejo 1.23), PATs |
| **Rate limits** | 2,000 req/300s (~400/min) |
| **Data model match** | Near-identical to GitHub (intentionally designed that way) |
| **Heatmap API** | `GET /users/:username/heatmap` — direct equivalent |
| **Key gap** | REST-only (no GraphQL), modest rate limits |
| **Feasibility** | **5/5** |

Codeberg is the **lowest-hanging fruit**. The API was designed to be GitHub-compatible, and it has a dedicated heatmap endpoint that returns the same shape as GitHub's contribution calendar. A single integration covers Codeberg and all Forgejo/Gitea instances.

#### Gitea / Forgejo (self-hosted)

| Attribute | Details |
|-----------|---------|
| **Backing** | Gitea Ltd (commercial) / Forgejo under Codeberg e.V. |
| **Model** | Primarily self-hosted, thousands of instances worldwide |
| **API** | Same as Codeberg (Swagger REST) |
| **Auth** | OAuth 2.0 provider, PATs |
| **Rate limits** | No built-in limits — instance operators configure at proxy level |
| **Data model match** | Near-identical (designed as lightweight GitHub clone) |
| **Heatmap API** | `GET /users/:username/heatmap` (same as Codeberg) |
| **Key gap** | Each instance is a separate universe — user must provide instance URL |
| **Feasibility** | **5/5** |

Same API as Codeberg. The key architectural implication: Chapa would need a "custom instance URL" field for self-hosted Gitea/Forgejo users. One API client serves all instances.

**Notable:** Forgejo federation (ActivityPub/ForgeFed) is under active development. HTTP signatures on ActivityPub endpoints were merged in 2025. Cross-instance activity aggregation could eventually simplify multi-instance support.

### Tier 2 — Watch and wait

#### Gitness / Harness Code Repository

| Attribute | Details |
|-----------|---------|
| **Backing** | Harness Inc. (well-funded enterprise CI/CD company) |
| **Model** | Self-hosted (open source) + Harness Cloud |
| **API** | REST with Swagger/OpenAPI |
| **Auth** | Token-based (sparse OAuth documentation) |
| **Data model match** | Close to GitHub (repos, PRs, branches) |
| **Community** | ~34K GitHub stars, unclear real-world adoption |
| **Feasibility** | **3/5** |

Backed by a well-funded company but unclear adoption outside enterprise CI/CD pipelines. Worth monitoring but not worth building for yet.

### Tier 3 — Not recommended

#### SourceHut (sr.ht)

| Attribute | Details |
|-----------|---------|
| **Model** | Email-driven workflows (git send-email, mailing list patches) |
| **API** | GraphQL only (REST being removed) |
| **Data model match** | **Fundamentally different** — patches instead of PRs, no stars/forks/watchers, no contribution graphs |
| **Community** | Thousands (niche — kernel devs, FOSS purists) |
| **Feasibility** | **2/5** |

The email-patch workflow is philosophically incompatible with PR-based metrics. Building/Guarding/Breadth dimensions would need complete reimagining. Tiny user base doesn't justify the effort.

#### Radicle (radicle.xyz)

| Attribute | Details |
|-----------|---------|
| **Model** | Peer-to-peer, decentralized (CRDTs, gossip protocol, cryptographic IDs) |
| **API** | Local HTTP JSON API via `radicle-httpd` (read-only, no central server) |
| **Auth** | Ed25519 keypairs — no OAuth, no PATs |
| **Data model match** | **Very different** — Collaborative Objects (COBs), no social metrics |
| **Community** | Very small (crypto/Web3 niche) |
| **Feasibility** | **1/5** |

No central API to query, no social metrics, incompatible auth model, negligible user base.

#### OneDev

| Attribute | Details |
|-----------|---------|
| **Model** | Self-hosted Java Git server |
| **API** | REST (incomplete documentation) |
| **Community** | Small |
| **Feasibility** | **2/5** |

Incomplete API surface, self-hosted only, small community. Not worth pursuing.

---

## 2. Platform Comparison Matrix

| Platform | API Type | Auth | Heatmap API | Stars/Forks | Rate Limits | Data Match | Users | Feasibility |
|----------|----------|------|-------------|-------------|-------------|------------|-------|-------------|
| **GitHub** (current) | REST + GraphQL | OAuth 2.0 | `contributionsCollection` | Yes | 5,000/hr | Baseline | 100M+ | N/A |
| **GitLab** | REST + GraphQL | OAuth 2.0 | Events API (compute) | Stars, Forks | 2,000/min | Very high | 30M+ | **5/5** |
| **Codeberg** | REST | OAuth 2.0 | `/users/:name/heatmap` | Stars, Forks, Watchers | 400/min | Near-identical | 200K+ | **5/5** |
| **Gitea/Forgejo** | REST | OAuth 2.0 | `/users/:name/heatmap` | Stars, Forks, Watchers | Instance-set | Near-identical | Thousands of instances | **5/5** |
| **SourceHut** | GraphQL | OAuth 2.0 | None | None | Undocumented | Very different | Thousands | **2/5** |
| **Radicle** | Local REST | Crypto keys | None | None | N/A | Very different | Very small | **1/5** |
| **Gitness** | REST | Token | Unknown | Likely | Unknown | Close | Small | **3/5** |

---

## 3. Current Architecture Analysis

### What Chapa Fetches from GitHub

```
User profile:     login, name, avatarUrl
Contributions:    365-day calendar (date + count per day)
Pull requests:    merged PRs with additions, deletions, changedFiles (max 100)
Reviews:          totalCount of review contributions
Issues:           totalCount of issue contributions
Repos:            contributed-to repos with commit counts (max 20)
Owned repos:      stargazerCount, forkCount, watchers (max 100)
```

### StatsData Field Classification

**23 fields total:**

| Category | Fields | Platform-agnostic? |
|----------|--------|-------------------|
| **Identity** | handle, displayName, avatarUrl | Yes (all platforms have user profiles) |
| **Activity** | commitsTotal, activeDays, heatmapData | Yes (universal git concepts) |
| **Building** | prsMergedCount, prsMergedWeight, issuesClosedCount, linesAdded, linesDeleted | Yes (PR/MR + issues exist everywhere) |
| **Guarding** | reviewsSubmittedCount | Yes (code review is universal) |
| **Consistency** | maxCommitsIn10Min | Yes (temporal analysis) |
| **Breadth** | reposContributed, topRepoShare, totalStars, totalForks, totalWatchers | Conceptually yes (naming differs) |
| **Quality** | microCommitRatio, docsOnlyPrRatio | Yes (computed from git data) |
| **Metadata** | fetchedAt, hasSupplementalData | Yes |

**Key insight:** ~20 of 23 fields are platform-agnostic. The 3 "GitHub-named" fields (stars, forks, watchers) are conceptually universal — just need field-name mapping.

### Impact v4 Scoring — Zero Platform Coupling

All 4 dimensions operate on `StatsData` (platform-agnostic):

| Dimension | Formula | GitHub-specific inputs | Notes |
|-----------|---------|----------------------|-------|
| **Building** | 70% PR weight + 20% issues + 10% commits | None | PRs/MRs universal |
| **Guarding** | 60% reviews + 25% review ratio + 15% code quality | None | Reviews universal |
| **Consistency** | 50% active days + 35% heatmap evenness + 15% inverse burst | None | Temporal analysis |
| **Breadth** | 35% repos + 25% concentration + 15% stars + 10% forks + 5% watchers + 10% docs | Star/fork/watcher naming | Conceptually universal |

### Existing Extensibility: SupplementalStats

The `mergeStats()` function in `apps/web/lib/github/merge.ts` already merges two `StatsData` objects:

- Additive fields (commits, PRs, reviews, issues, LOC): **summed**
- Social metrics (stars, forks, watchers): **max** (avoid double-counting)
- Heatmap: **merged by date** (sum counts for same day)
- Concentration: **recomputed** from combined data

This pattern works **today** for merging any platform's data — the only requirement is transforming platform-specific API responses into `StatsData` shape.

### Coupling Points (GitHub-specific code)

| Component | Location | Coupling | Effort to abstract |
|-----------|----------|----------|-------------------|
| **GraphQL query** | `packages/shared/src/github-query.ts` | Hard — GitHub-specific query syntax | High |
| **API client** | `apps/web/lib/github/queries.ts` | Hard — GitHub endpoint + token format | High |
| **OAuth flow** | `apps/web/lib/auth/`, `apps/web/app/api/auth/*` | Hard — GitHub OAuth specifics | High |
| **Raw data transform** | `packages/shared/src/stats-aggregation.ts` | Medium — `buildStatsFromRaw()` expects GitHub shape | Medium |
| **Avatar fetching** | `apps/web/lib/render/avatar.ts` | Low — URL format differs per platform | Low |
| **Cache keys** | `apps/web/lib/cache/redis.ts` | Low — keys are `stats:v2:<handle>` | Low (add platform prefix) |
| **Badge rendering** | `apps/web/lib/render/` | None — operates on `StatsData` + `ImpactV4Result` | None |

---

## 4. Architecture Sketch: Platform-Agnostic Data Layer

### Proposed Abstraction

```
┌──────────────────────────────────────────────────────────┐
│                    Badge Request                          │
│              /u/[handle]/badge.svg                        │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│               Stats Orchestrator                          │
│  Fetches from all linked platforms, merges into one       │
│  StatsData using mergeStats()                             │
└───┬──────────┬──────────┬────────────────────────────────┘
    │          │          │
    ▼          ▼          ▼
┌────────┐ ┌────────┐ ┌────────────┐
│ GitHub │ │ GitLab │ │ Codeberg/  │   ... future platforms
│ Query  │ │ Query  │ │ Gitea/     │
│        │ │        │ │ Forgejo    │
└───┬────┘ └───┬────┘ └─────┬──────┘
    │          │             │
    ▼          ▼             ▼
┌──────────────────────────────────────────────────────────┐
│              PlatformQuery Interface                      │
│                                                           │
│  interface PlatformQuery {                                │
│    platform: "github" | "gitlab" | "gitea";              │
│    fetchStats(login: string, token: string): StatsData;  │
│  }                                                        │
│                                                           │
│  Each implementation:                                     │
│  1. Calls platform-specific API                           │
│  2. Transforms response into StatsData shape              │
│  3. Returns normalized, platform-agnostic data            │
└──────────────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│          Impact v4 Scoring (unchanged)                    │
│  computeImpactV4(mergedStats) → ImpactV4Result           │
│  Pure function — no platform awareness needed             │
└──────────────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│          Badge Renderer (unchanged)                       │
│  renderBadgeSvg(stats, impact, config) → SVG string      │
│  Maybe: add platform icons to badge                       │
└──────────────────────────────────────────────────────────┘
```

### Auth Layer

```
┌──────────────────────────────────────────────────────────┐
│               PlatformAuth Interface                      │
│                                                           │
│  interface PlatformAuth {                                 │
│    platform: string;                                      │
│    getAuthorizationUrl(state: string): string;            │
│    exchangeCode(code: string): Promise<Token>;            │
│    refreshToken(token: Token): Promise<Token>;            │
│  }                                                        │
│                                                           │
│  Implementations: GitHubAuth, GitLabAuth, GiteaAuth       │
│  Each needs: clientId, clientSecret, redirectUri           │
└──────────────────────────────────────────────────────────┘
```

### Cache Key Evolution

```
Current:     stats:v2:<handle>
Proposed:    stats:v2:github:<handle>
             stats:v2:gitlab:<handle>
             stats:v2:gitea:<instance>:<handle>
Merged:      stats:v2:merged:<handle>  (combined from all platforms)
```

### Database: Platform Connections

```sql
-- New table: user_platforms
CREATE TABLE user_platforms (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES users(id),
  platform     text NOT NULL,          -- 'github', 'gitlab', 'gitea'
  instance_url text,                   -- null for SaaS, URL for self-hosted
  remote_login text NOT NULL,          -- username on that platform
  token        text,                   -- encrypted OAuth token
  connected_at timestamptz DEFAULT now(),
  UNIQUE(user_id, platform, instance_url)
);
```

---

## 5. Effort Estimates

### T-shirt Sizing

| Work Item | Size | Notes |
|-----------|------|-------|
| **Platform abstraction layer** (`PlatformQuery` interface + factory) | **M** | Define interface, refactor GitHub client to implement it, wire into stats orchestrator |
| **Codeberg/Gitea/Forgejo integration** | **S** | Near-identical API to GitHub, heatmap endpoint exists, REST-only (simpler than GraphQL) |
| **GitLab integration** | **M** | Different API shape, must compute contribution calendar from Events API, different MR model |
| **Multi-platform OAuth** | **L** | Each platform has different OAuth flows, need auth provider abstraction, token storage, UI for connecting/disconnecting |
| **Cross-platform identity** | **M** | `user_platforms` table, UI for linking accounts, handle disambiguation |
| **Score merging UX** | **S** | Badge already supports `hasSupplementalData`, need indicator for multi-platform source |
| **Badge visual changes** | **S** | Optional: platform icons, "Powered by GitHub + GitLab" attribution |
| **Total for first non-GitHub platform** | **L** | Abstraction layer (M) + platform client (S/M) + OAuth (L) + identity (M) + UX (S) |

### Timeline Estimate (if prioritized)

- **Phase 1 — Abstraction layer:** Refactor GitHub client behind `PlatformQuery` interface. No new platforms yet, but architecture is ready. ~1 week.
- **Phase 2 — Codeberg/Forgejo:** First non-GitHub integration. Lowest effort due to API compatibility. ~3-4 days.
- **Phase 3 — GitLab:** Larger effort due to API differences. ~1-2 weeks.
- **Phase 4 — Multi-account UX:** UI for connecting/managing multiple platforms, merged badge display. ~1 week.

---

## 6. Recommendation

### Priority Order

1. **Codeberg / Forgejo / Gitea** — Lowest effort, growing community (especially FOSS migrants), one integration covers all instances. The heatmap endpoint makes this nearly trivial.
2. **GitLab** — Largest user base after GitHub, enterprise presence, strong API. More work but massive reach.
3. **Wait on everything else** — SourceHut, Radicle, Gitness are either too niche or too architecturally different to justify effort now.

### Strategic Take

The "move away from GitHub" trend is real but early. The most likely scenario is **multi-platform usage** (developers on GitHub + GitLab, or GitHub + Codeberg) rather than a mass exodus. Chapa's competitive advantage would be being the **only** impact badge that aggregates across platforms — positioning us as the developer identity layer, not just a GitHub widget.

The existing `SupplementalStats` merge pattern means we can prototype multi-platform aggregation **without touching the scoring engine**. The abstraction layer is the main investment, and it's a one-time cost that makes every subsequent platform cheap to add.

### Next Steps (when ready to implement)

1. Create `PlatformQuery` interface and refactor `GitHubQuery` to implement it
2. Add Codeberg/Forgejo as first non-GitHub platform (proof of concept)
3. Evaluate adoption and user demand before investing in GitLab
4. Consider CLI support (`chapa link gitlab`) for the chapa-cli tool
