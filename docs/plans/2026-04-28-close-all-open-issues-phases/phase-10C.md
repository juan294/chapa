---
phase: 10C
release: v2.10.0
issues: ["#720", "#800", "#759"]
batch_eligible: true
depends_on: ["10A"]
effort: M
---

# Phase 10C — Share-page TTFB hot path (`#720`, `#800`, `#759`)

## Goal

On cache miss, the share page currently:
1. Awaits Redis reads for stats + supplemental
2. Issues a broad GitHub GraphQL query (or uses cached stats)
3. Optionally fetches Bitbucket + Codeberg sequentially
4. Computes the impact score
5. Awaits an avatar network fetch
6. Re-renders the badge SVG **inline on the share page** even though the
   `/badge.svg` route already produced (and cached) the same SVG

Three improvements:

- **`#720`** — Stop re-rendering the SVG inline on the share page; embed
  the cached `<img src="/u/<handle>/badge.svg">` instead, falling back to
  inline render only when the cache key is missing
- **`#800`** — Move the avatar fetch off the critical path (lazy-load it
  client-side or pre-fetch async without `await`)
- **`#759`** — Run Bitbucket + Codeberg fetches in parallel via
  `Promise.allSettled` instead of sequentially

## Pseudocode

```ts
// apps/web/lib/profile/materialize-profile.ts
// Replace serial waits with allSettled
const [bitbucketResult, codebergResult] = await Promise.allSettled([
  isBitbucketLinked ? fetchBitbucket(handle) : Promise.resolve(null),
  isCodebergLinked ? fetchCodeberg(handle) : Promise.resolve(null),
]);
```

```tsx
// apps/web/app/u/[handle]/page.tsx
// Stop server-rendering the badge SVG inline. Use the cached badge route.
// Only fall back to inline rendering if the SVG cache is unavailable.

const cachedSvgUrl = `${getBaseUrl()}/u/${handle}/badge.svg`;
return (
  <div>
    <img src={cachedSvgUrl} alt={`${handle}'s impact badge`} width={1200} height={630} />
    {/* Rest of share page content */}
  </div>
);
```

```ts
// apps/web/lib/render/avatar.ts
// Convert the synchronous avatar fetch into an opportunistic async load:
// - In SSR, we can use a placeholder (Chapa shield) data URI
// - Client hydrates and swaps in the real avatar when fetched
//
// Critical path no longer awaits avatar.
```

## Files

- Modified: `apps/web/lib/profile/materialize-profile.ts`
- Modified: `apps/web/lib/profile/materialize-profile.test.ts`
- Modified: `apps/web/app/u/[handle]/page.tsx`
- Modified: `apps/web/app/u/[handle]/page.test.tsx`
- Modified: `apps/web/lib/render/avatar.ts`
- Modified: `apps/web/components/SharePageContent` to use `<img>`

## Acceptance criteria

### Automated
- [ ] `pnpm run test`, `pnpm run typecheck`, `pnpm run lint` pass
- [ ] New tests: parallel platform fetch resolves on the slowest, not the sum
- [ ] New test: share page falls back to inline render when `/badge.svg` cache miss
- [ ] Lighthouse TTFB on cold `/u/<handle>` improves vs baseline (run via
      Lighthouse CI workflow on the PR)

### Manual
- Vercel preview: cold-load `/u/juan294` and inspect Network — share page
  HTML returns before any avatar request completes
- Verify Bitbucket+Codeberg parallel via timing in the materialize-profile
  log (debug logs from Phase 9B)

## Closing the issues

```bash
gh issue close 720 --comment "Fixed in <sha>. Share page embeds /badge.svg via <img>; inline render only on cache miss."
gh issue close 800 --comment "Fixed in <sha>. Avatar fetch moved off the critical path; client-side hydration swaps in the real avatar."
gh issue close 759 --comment "Fixed in <sha>. Bitbucket and Codeberg fetches now Promise.allSettled in parallel."
```
