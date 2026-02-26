# Codeberg Integration Plan

> Date: 2026-02-26
> Issue: TBD (create before implementation)
> Branch: `feature/codeberg-integration`
> Research: `docs/research/2026-02-26-next-service-integration.md`

## Overview

Add Codeberg (codeberg.org) as a linked platform, following the exact Bitbucket integration pattern. Users log in with GitHub (unchanged), then optionally link their Codeberg account from the User Menu. Codeberg stats are fetched via OAuth, merged with GitHub data, and reflected in the badge.

**Scope:** Codeberg.org SaaS only. Self-hosted Gitea/Forgejo instances are a future follow-up.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Identity | GitHub handle remains primary | Same as Bitbucket — linked account, not primary login |
| OAuth | Authorization Code Grant (confidential client) | Matches Bitbucket pattern. No PKCE needed for server-side flow |
| Token body format | JSON | Codeberg/Forgejo uses JSON for token exchange (not form-encoded like Bitbucket) |
| Token expiry | Handle both cases | If `expires_in` + `refresh_token` present → store and lazy-refresh. If absent → treat as long-lived (like GitHub). Reuse `isTokenExpired()` |
| Scopes | None specified in URL | Codeberg/Forgejo doesn't implement OAuth scopes yet — tokens get full user permissions |
| Heatmap | Native `/api/v1/users/{username}/heatmap` endpoint | Returns `{timestamp, contributions}[]` — no reconstruction needed (unlike Bitbucket) |
| PR stats | Inline in PR response | Codeberg PRs include `additions`, `deletions`, `changed_files` inline — no separate diffstat calls (unlike Bitbucket) |
| Social metrics | Stars, forks, watchers all available | Codeberg repos have `stars_count`, `forks_count`, `watchers_count` (unlike Bitbucket which has no stars) |
| Feature flag | `NEXT_PUBLIC_CODEBERG_ENABLED` + DB flag `codeberg_integration` | Same dual-tier pattern as Bitbucket |
| Confidence | `platform_linked` flag (0 penalty) | Same as Bitbucket — verified OAuth data gets no penalty |
| Cache key | `stats:v2:codeberg:{handle}` | Follows established pattern |
| API budget | ~20-50 REST calls per user, 30s timeout | Much fewer than Bitbucket (~100-150) because no workspace enumeration, no separate diffstat, and native heatmap |

## Architecture

```
User clicks "Link Codeberg" in User Menu
  → GET /api/auth/codeberg/connect (requires GitHub session)
    → Generate CSRF state cookie
    → Redirect to https://codeberg.org/login/oauth/authorize
  → User consents on Codeberg
  → Codeberg redirects to /api/auth/codeberg/callback?code=...&state=...
    → Validate CSRF state
    → POST https://codeberg.org/login/oauth/access_token (JSON body)
    → GET https://codeberg.org/api/v1/user (fetch profile)
    → Store encrypted tokens in user_platforms (platform="codeberg")
    → Invalidate merged + codeberg stats cache
    → Redirect to /u/{handle}?codeberg=linked

Badge generation (getStats pipeline):
  1. Cache lookup (stats:v2:merged:{handle})
  2. Fetch GitHub stats
  3. Fetch Codeberg stats if linked & enabled
     a. Check stats:v2:codeberg:{handle} cache
     b. If miss: dbGetLinkedPlatform(handle, "codeberg")
     c. If expired: refresh token (if refresh_token exists) or skip
     d. Fetch heatmap + repos + PRs + reviews + issues
     e. Transform → StatsData, cache at stats:v2:codeberg:{handle}
  4. Merge: mergeStats(github, codeberg, {markAsSupplemental: false})
  5. Merge supplemental (EMU) if exists
  6. Set linkedPlatforms: [...existingPlatforms, "codeberg"]
  7. Cache final result
```

## Codeberg API Endpoints (verified against live codeberg.org)

| Endpoint | Method | Purpose | Response shape |
|----------|--------|---------|---------------|
| `/login/oauth/authorize` | GET | OAuth authorization | Redirect |
| `/login/oauth/access_token` | POST | Token exchange (JSON body) | `{access_token, token_type, expires_in?, refresh_token?}` |
| `/api/v1/user` | GET | Authenticated user profile | `{login, full_name, avatar_url, ...}` |
| `/api/v1/users/{username}/heatmap` | GET | Contribution heatmap | `{timestamp: number, contributions: number}[]` |
| `/api/v1/users/{username}/repos` | GET | User's repos | `{name, full_name, stars_count, forks_count, watchers_count, has_issues, fork, owner, ...}[]` |
| `/api/v1/repos/{owner}/{repo}/pulls?state=closed` | GET | Merged PRs | `{number, user, merged, additions, deletions, changed_files, ...}[]` |
| `/api/v1/repos/{owner}/{repo}/pulls/{index}/reviews` | GET | PR reviews | `{user, state, ...}[]` where state = `APPROVED` / `REQUEST_CHANGES` / etc. |
| `/api/v1/repos/{owner}/{repo}/issues?state=closed&type=issues` | GET | Closed issues | `{number, user, state, closed_at, ...}[]` |

**Pagination:** `?page=N&limit=M` query params (default limit varies, max 50). No `next` URL — must increment `page` until result count < limit.

**Authentication:** `Authorization: token <access_token>` header (Codeberg/Forgejo also accepts `Bearer` but `token` prefix is canonical).

## StatsData Field Mapping

| StatsData field | Codeberg source | Notes |
|----------------|-----------------|-------|
| handle | `user.login` | From authenticated user endpoint |
| displayName | `user.full_name` | Falls back to `user.login` if empty |
| avatarUrl | `user.avatar_url` | Direct URL |
| commitsTotal | Sum from heatmap `contributions` | Heatmap gives daily totals — sum all |
| activeDays | Count of heatmap entries with contributions > 0 | Direct from heatmap |
| heatmapData | Transform `{timestamp, contributions}` → `{date, count}` | Convert Unix timestamp → YYYY-MM-DD, filter to SCORING_WINDOW_DAYS |
| prsMergedCount | Count PRs where `merged: true` | Filter `state=closed` + `merged=true` + authored by user |
| prsMergedWeight | `computePrWeight({additions, deletions, changedFiles})` per PR | Inline in PR response — no separate diffstat needed |
| linesAdded | Sum `additions` from merged PRs | Inline in PR response |
| linesDeleted | Sum `deletions` from merged PRs | Inline in PR response |
| reviewsSubmittedCount | Count reviews with state `APPROVED` or `REQUEST_CHANGES` | From `/pulls/{index}/reviews`, exclude self-reviews |
| issuesClosedCount | Count issues where `state=closed` | From issues endpoint with `type=issues` filter |
| reposContributed | Repos with >= REPO_DEPTH_THRESHOLD commits | Inferred from heatmap or commit counts |
| topRepoShare | Max repo commits / total commits | Computed from repo commit distribution |
| maxCommitsIn10Min | Max daily count >= 30 → daily count, else 0 | Same heuristic as Bitbucket |
| totalStars | Sum `stars_count` from owned repos | Available (unlike Bitbucket) |
| totalForks | Sum `forks_count` from owned repos | Available |
| totalWatchers | Sum `watchers_count` from owned repos | Available (unlike Bitbucket) |

**Key advantage over Bitbucket:** Codeberg has all social metrics (stars, forks, watchers), heatmap data is pre-computed, and PR stats are inline. This means ~50% fewer API calls.

## Phases

| Phase | Description | New files | Modified files |
|-------|-------------|-----------|----------------|
| **1: Feature flag + Platform type** | Add `"codeberg"` to Platform union, add feature flag functions | 0 | 3 |
| **2: OAuth helpers + routes** | OAuth flow (connect, callback, disconnect, status) | 6 | 0 |
| **3: Data fetching + stats transform** | REST client, types, heatmap/repo/PR queries, StatsData transform | 5 | 0 |
| **4: Merge pipeline** | Wire into `getStats()`, add `_fetchCodebergIfLinked()` | 0 | 1 |
| **5: UI** | Add Codeberg link/unlink to UserMenu | 0 | 1 |

**Total: 11 new files, 5 modified files**

## Environment Variables (new)

```
CODEBERG_CLIENT_ID=              # Codeberg OAuth app client ID
CODEBERG_CLIENT_SECRET=          # Codeberg OAuth app secret (server-side only)
NEXT_PUBLIC_CODEBERG_ENABLED=    # Set to "true" to enable Codeberg linking
```

## Prerequisites

Before implementation, create a Codeberg OAuth application:

1. Go to https://codeberg.org/user/settings/applications
2. Click "Create a new OAuth2 Application"
3. **Application Name:** `Chapa`
4. **Redirect URI:** `https://chapa.thecreativetoken.com/api/auth/codeberg/callback`
   - For local dev: `http://localhost:3001/api/auth/codeberg/callback`
5. Save the Client ID and Client Secret
6. Add to `.env.local` and Vercel environment variables

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Codeberg rate limits (undocumented) | Low | Medium | Daily caching (6h TTL), 30s fetch timeout, fail-open |
| Token expiry behavior unclear | Medium | Low | Handle both cases: refresh if `expires_in` present, treat as long-lived if absent |
| Heatmap data doesn't match scoring window | Low | Low | Filter by SCORING_WINDOW_DAYS during transform |
| Codeberg API changes | Low | Medium | Types are version-pinned, tests catch regressions |

## Phase files

- [Phase 1: Feature flag + Platform type](./2026-02-26-codeberg-integration-phases/phase-1.md)
- [Phase 2: OAuth helpers + routes](./2026-02-26-codeberg-integration-phases/phase-2.md)
- [Phase 3: Data fetching + stats transform](./2026-02-26-codeberg-integration-phases/phase-3.md)
- [Phase 4: Merge pipeline](./2026-02-26-codeberg-integration-phases/phase-4.md)
- [Phase 5: UI](./2026-02-26-codeberg-integration-phases/phase-5.md)
