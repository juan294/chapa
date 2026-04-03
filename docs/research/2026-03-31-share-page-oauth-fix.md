# Research: Share Page OAuth Fix (Option B)

> **Date:** 2026-03-31
> **Branch:** `develop`
> **Context:** Share page uses `GITHUB_TOKEN` (limited scope) instead of user's OAuth token, causing incorrect Quality scores

---

## 1. The Problem

The share page at `/u/[handle]/page.tsx:117` calls `getStats(handle)` **without a token**. This forces a fallback to `GITHUB_TOKEN` (env var), which has limited scope and sees fewer PRs than the user's OAuth token.

**Token data comparison:**
- `GITHUB_TOKEN` → ~10 merged PRs (public only), some reviews visible → collaborative profile → Quality=28
- User OAuth token → 78 merged PRs (including private repos), 0 reviews → solo profile → Quality=83

The profile type flip (solo→collaborative) is the core issue: the collaborative Quality formula heavily penalizes low review counts.

---

## 2. Why the Share Page Avoids Auth (ISR Architecture)

### The Intentional Design

**Commit 6540ba7** (`perf(share): make ISR functional by removing headers() dependency. Fixes #555`):
> "The share page had revalidate=3600 but ISR was inert because headers() and the server-side Navbar forced dynamic rendering on every request."

The share page is ISR-cached at `page.tsx:1`:
```typescript
export const revalidate = 3600; // 1 hour
```

**Why ISR matters:** Per commit message, ISR "cuts serverless invocations 80-90%."

### What Breaks ISR

Calling `headers()` or `cookies()` from `next/headers` in a page component **forces dynamic rendering**, completely bypassing ISR. Every page view becomes a serverless function invocation.

### Current Enforcement

Six test assertions at `page.test.ts:114-141` guard ISR compatibility:

| Test | Line | Assertion |
|------|------|-----------|
| Exports revalidate | 115-117 | `export const revalidate = 3600` present |
| No `next/headers` import | 119-122 | Source does not contain `from "next/headers"` |
| No `headers()` call | 124-127 | Source does not match `\bheaders\(\)` |
| No `readSessionCookie` | 129-131 | Source does not contain `readSessionCookie` |
| Uses NavbarClient | 133-136 | Uses client-side navbar, not server-side |
| Uses SharePageOwnerContent | 138-140 | Session check is client-side |

### The ISR-Compatible Pattern (current)

```
Server (ISR-cached, shared across all visitors):
  page.tsx → getStats(handle) [no token] → renders badge SVG inline

Client (per-visitor, after hydration):
  NavbarClient → useSession() → /api/auth/session → shows login state
  SharePageOwnerContent → useSession() → shows owner sections if match
```

**Key:** The server render is identical for all visitors. Per-user differentiation happens client-side only.

---

## 3. How Other Routes Handle Auth + Data

### Badge SVG Route (the working pattern)

`badge.svg/route.ts:74-87` — reads session cookie optionally, passes token to getStats:
```typescript
const session = readSessionCookie(request.headers.get("cookie"), sessionSecret);
if (session) token = session.token;
// ...
const stats = await getStats(handle, token);
```

This works because **route handlers (GET/POST) are always dynamic** in Next.js App Router — they don't participate in ISR. The `Cache-Control` headers handle CDN caching instead.

### Refresh Route

`api/refresh/route.ts:33-62` — requires session, passes token:
```typescript
const { session, error } = requireSession(request);
// ...
const stats = await getStats(handle, session.token);
```

### Generate Route

`api/generate/route.ts:21-39` — requires session, passes token.

### Debug-Quality Route

`api/admin/debug-quality/route.ts:21-25` — reads session cookie if available, falls back to `GITHUB_TOKEN`.

---

## 4. The Data Flow (getStats → fetchStats → GitHub)

### Cache-first architecture (`client.ts:40-65`)

```
getStats(handle, token?)
  → Check Redis cache (key: stats:v2:merged:<handle>)
  → If cached → return cached (ignores token)
  → If not cached → _fetchAndCache(handle, ..., token)
    → fetchStats(handle, token) [stats.ts:9-17]
      → fetchContributionData(handle, token) [queries.ts:32]
        → effectiveToken = token ?? process.env.GITHUB_TOKEN?.trim()
        → GitHub GraphQL API call with effectiveToken
    → Cache result (6h primary, 7d stale)
    → Return
```

**Critical observation at `client.ts:48-49`:** When cache exists, the token parameter is ignored entirely:
```typescript
const cached = await cacheGet<StatsData>(cacheKey);
if (cached) return _enrichWithLogins(cached, handle);
```

This means **the cache is shared regardless of who fetched the data**. If the badge route fetches with an OAuth token and caches the result, the share page will serve that same cached data without needing a token.

### Cache key is handle-only

`client.ts:45`: `const cacheKey = \`stats:v2:merged:${lowerHandle}\`;`

There is no per-token cache key. All callers share the same cache entry for a given handle.

---

## 5. Existing Client-Side Session Infrastructure

### useSession hook (`hooks/useSession.ts`)

Module-level promise deduplication — all components share one `/api/auth/session` fetch:
```typescript
let cachedPromise: Promise<SessionUser | null> | null = null;
```

Returns `{ session, loading, invalidate }` where `session` contains `{ login, name, avatar_url, isAdmin }`.

**Note:** The `useSession` hook does **not** expose the OAuth token — only public profile fields. The session API endpoint (`api/auth/session/route.ts:34-41`) returns:
```typescript
{ user: { login, name, avatar_url, isAdmin } }
```

No `token` field is returned to the client (security — tokens stay server-side).

### SharePageOwnerContent (`components/SharePageOwnerContent.tsx:28-34`)

```typescript
const { session, loading } = useSession();
const isOwner = session?.login === handle;
```

This component receives `stats` and `impact` as props from the server render — it does **not** re-fetch data. It only uses the session for owner detection (show embed snippets vs CTA).

---

## 6. The Refresh Endpoint (Existing Auth-Driven Refresh)

`api/refresh/route.ts` already implements the pattern of:
1. Require auth (session cookie)
2. Clear cache
3. Fetch fresh stats with OAuth token
4. Store snapshot
5. Return fresh data

Rate limited at 15/handle/hour (line 46).

---

## 7. Architecture Constraints Summary

| Constraint | Source | Impact |
|------------|--------|--------|
| ISR requires no `headers()` in page | Next.js App Router | Share page can't read cookies server-side |
| Cache key is handle-only | `client.ts:45` | Cached data is shared regardless of who fetched it |
| `getStats()` returns cache on hit | `client.ts:48-49` | Token is only used on cache miss |
| Route handlers are always dynamic | Next.js App Router | badge.svg CAN read cookies |
| `useSession()` doesn't expose token | `api/auth/session/route.ts` | Client-side code can't pass OAuth token |
| 6h cache TTL | `client.ts:17` | Even with bad data, it expires in 6 hours |
| `after()` runs post-response | Next.js API | Deferred ops don't block response |

---

## 8. Possible Approaches (Documented As-Is from Codebase)

### Approach A: Client-side refresh on owner visit

The share page already has:
- Client-side owner detection via `SharePageOwnerContent` (`useSession()` → `isOwner`)
- Existing `/api/refresh` endpoint that uses OAuth token and clears cache
- Rate limiting on refresh (15/handle/hour)

Pattern: When `isOwner` is true and the cached data appears stale, the client component could trigger a refresh API call, which would update the cache with OAuth-sourced data. The page would show ISR-cached data initially, then revalidate via the refresh endpoint.

### Approach B: Dedicated "owner view" API endpoint

Pattern: A new API route (e.g., `/api/stats/[handle]`) that:
1. Reads session cookie (route handlers are always dynamic)
2. If authenticated user matches handle, fetches with OAuth token
3. If not, returns cached/public data
4. The share page's client component calls this endpoint when `isOwner` is true

### Approach C: Background cache warming on login/refresh

When a user logs in or refreshes, the system already caches stats with their OAuth token (via `/api/refresh` or `/api/generate`). Since cache keys are handle-based and shared, any subsequent share page load within 6h would use the OAuth-fetched data.

The badge.svg route also warms the cache with OAuth data when the logged-in user views their badge (`badge.svg/route.ts:87`).

### Approach D: Force-dynamic share page for owners

Pattern: Use middleware or route-level logic to detect session cookies and serve dynamic vs. ISR versions. Next.js middleware can set `x-middleware-rewrite` headers to route authenticated users to a dynamic variant.

---

## 9. Files That Would Be Involved

| File | Role | Current State |
|------|------|---------------|
| `apps/web/app/u/[handle]/page.tsx` | Share page server component | ISR, no auth, calls `getStats(handle)` |
| `apps/web/app/u/[handle]/page.test.ts` | ISR guard tests | 6 assertions block auth usage |
| `apps/web/components/SharePageOwnerContent.tsx` | Client-side owner content | Uses `useSession()`, receives data as props |
| `apps/web/app/api/refresh/route.ts` | Auth refresh endpoint | Uses OAuth token, clears cache |
| `apps/web/lib/github/client.ts` | Stats cache layer | Shared cache, token only on miss |
| `apps/web/hooks/useSession.ts` | Client session hook | Exposes login, not token |
| `apps/web/app/api/auth/session/route.ts` | Session info endpoint | Returns login, not token |

---

## 10. Key Insight: Cache Warming Already Works

The badge.svg route (`badge.svg/route.ts:74-87`) already reads the session cookie and passes the OAuth token to `getStats()`. When an authenticated user visits their share page, the browser also loads the badge SVG (either inline or via `<img>` fallback), which triggers a `getStats(handle, token)` call with OAuth.

However, in the current share page with inline SVG rendering, the badge SVG route is **not** triggered by the page load (the SVG is rendered server-side inline at `page.tsx:146`). The inline SVG uses `getStats(handle)` without a token.

The fallback `<img>` path (`page.tsx:257-260`) would trigger the badge.svg route, but this only fires when `inlineSvg` is null (render failure or custom config active).

---

## 11. Temporary Debug/Debugging Artifacts

The following artifacts from the debugging session exist on `develop`:

| File | Status | Action Needed |
|------|--------|---------------|
| `apps/web/app/api/admin/debug-quality/route.ts` | Temporary debug endpoint | Should be removed |
| Refresh rate limit bumped to 15/hr | `api/refresh/route.ts:46` | May want to revert to 5/hr |
| SWR reduced from 7d to 1d across multiple routes | Various | Intentional improvement (keep) |
