---
phase: 10D
release: v2.10.0
issues: ["#757", "#758", "#760"]
batch_eligible: true
depends_on: ["10A"]
effort: M
---

# Phase 10D — Per-route perf (`#757`, `#758`, `#760`)

## Goal

Three smaller perf wins that don't depend on the share-page hot path:

- **`#757`** — Bitbucket/Codeberg paths add unconditional DB reads on
  every cache miss. Cache the link status per-handle for the duration of
  a request rather than fetching it twice.
- **`#758`** — Avatar base64 inlines ~40KB into the SVG response. Replace
  with the cached avatar URL referenced via `<image href=...>` so it can
  be cached separately and reused across SVG renders.
- **`#760`** — Heatmap SVG emits 91 SMIL `<animate>` elements that are
  invisible inside `<img>` embeds. Strip them when rendering for an
  `Accept` header indicating an external embed.

## Pseudocode

```ts
// apps/web/lib/db/users.ts (or wherever link status reads live)
// Add a request-scoped memoization wrapper.
import { cache } from "react"; // request-scoped cache

export const dbGetLinkedPlatforms = cache(async (handle: string) => {
  return supabase.from("user_platforms").select(...).eq("handle", handle);
});
```

`react`'s `cache()` deduplicates within a single Server Component request,
which is exactly what we want. Bitbucket and Codeberg handlers each call
through this helper and the second call returns the first result.

```ts
// apps/web/lib/render/avatar.ts
// Replace base64 inline with a referenced <image href>
// (only for SVG renders that will be served as image/svg+xml — the
// 1200x630 badge can stay base64 for OG image fidelity)

if (renderContext === "badge-svg") {
  return `<image href="${cachedAvatarUrl}" ... />`;
} else {
  return `<image href="data:image/png;base64,${b64}" ... />`; // OG only
}
```

```ts
// apps/web/lib/render/heatmap.ts
// Drop SMIL animations when rendering for an embed.
// Detection: check Accept header or a route-level flag passed by route.ts.

function renderHeatmap(opts: { animated: boolean; ... }) {
  return cells.map(cell => {
    const animateTag = opts.animated ? `<animate ... />` : "";
    return `<rect ...>${animateTag}</rect>`;
  });
}
```

The badge route at `apps/web/app/u/[handle]/badge.svg/route.ts` passes
`animated: false` by default (these are always embedded as `<img>`),
`true` only when rendered inline (e.g., share page fallback render).

## Files

- Modified: `apps/web/lib/db/users.ts` (or equivalent link-status accessor)
- Modified: `apps/web/lib/render/avatar.ts`
- Modified: `apps/web/lib/render/heatmap.ts`
- Modified: `apps/web/app/u/[handle]/badge.svg/route.ts`
- Modified: matching tests for each module

## Acceptance criteria

### Automated
- [ ] `pnpm run test`, `pnpm run typecheck`, `pnpm run lint` pass
- [ ] Bytes-per-SVG measurement (new test fixture asserts on byte length)
      drops by ≥25KB after avatar referencing change
- [ ] New test: animated heatmap when `Accept: image/svg+xml,*/*` and
      route-level `inline=true`; non-animated otherwise
- [ ] DB read count test: simulate a request hitting Bitbucket + Codeberg
      branches, assert `dbGetLinkedPlatforms` invoked once

### Manual
- curl the badge SVG, inspect bytes — expect ~25–40KB drop
- Open the badge in a browser tab, verify avatar still renders
- Embed the badge in a markdown preview, verify static (no animations)

## Closing the issues

```bash
gh issue close 757 --comment "Fixed in <sha>. Linked-platform DB reads now request-scoped via React cache(); single read per request."
gh issue close 758 --comment "Fixed in <sha>. Badge SVG references avatar URL instead of inlining base64."
gh issue close 760 --comment "Fixed in <sha>. Heatmap SMIL animations stripped when rendering for embed contexts."
```
