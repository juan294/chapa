---
phase: 12B
release: v2.12.0
issues: ["#516", "#763", "#765"]
batch_eligible: true
depends_on: ["12A"]
effort: M
---

# Phase 12B — Experiment refactor + coverage cleanup (`#516`, `#763`, `#765`)

## Goal

- **`#516`** — `app/experiments/*` pages have grown beyond what's
  reasonable for single page files. Refactor each into smaller components
  living in `app/experiments/<exp>/_components/` (Next.js underscore
  prefix prevents route discovery).
- **`#763`** — `app/experiments/hexmap/page.tsx` is 123 LOC with 0%
  coverage AND ships in the bundle. Either gate the entire experiments
  tree behind the `experiments_enabled` feature flag at build time (so
  it doesn't ship at all when disabled in production), or add coverage.
  Recommendation: build-time gate is better since experiments are
  deliberately not for production users.
- **`#765`** — 17 jsdom navigation warnings per test run obscure real
  warnings. Track them down and either silence intentionally
  (`window.location` mocking pattern) or fix the test code that triggers
  them.

## #516 — Experiment page refactor

For each of the 13 experiment pages, split into:
- `page.tsx` — minimal mount + page-level layout
- `_components/<feature>.tsx` — interactive pieces

Don't over-engineer. The goal is "files under 150 LOC" not "perfect
abstraction". One round of focused splits.

## #763 — Build-time gate

```ts
// apps/web/lib/feature-flags-build.ts (new)
export const EXPERIMENTS_ENABLED = process.env.NEXT_PUBLIC_EXPERIMENTS_ENABLED === "true";
```

```tsx
// apps/web/app/experiments/layout.tsx
import { notFound } from "next/navigation";
import { EXPERIMENTS_ENABLED } from "@/lib/feature-flags-build";

export default function ExperimentsLayout({ children }) {
  if (!EXPERIMENTS_ENABLED) notFound();
  return <>{children}</>;
}
```

Crucially, ALSO use `next.config.js` `redirects` or a build-time check
to ensure the experiment chunks are tree-shaken when the env var is
unset:

```ts
// next.config.ts
const config = {
  // when EXPERIMENTS_ENABLED is false at build time, exclude the route
  // from page generation by setting an empty rewrite OR by omitting via
  // a build-time generated route map.
};
```

The Vercel production deployment has `NEXT_PUBLIC_EXPERIMENTS_ENABLED`
unset, so the build-time gate will exclude these chunks.

If the build-time tree-shake is too complex to verify, fall back to
explicit `dynamic` imports gated on the runtime feature flag — at least
the chunks load on demand only.

## #765 — jsdom navigation warnings

```bash
# Find test files producing the warnings
pnpm test 2>&1 | grep -B2 "Not implemented: navigation"
```

Common culprits:
- Tests that trigger `<a href="...">` clicks without preventing default
- Tests that call `window.location.assign(...)` directly without mocking
- React Server Components with redirects in test envs

Fix by wrapping click handlers in `e.preventDefault()` in test setup, or
mock `window.location` once in `apps/web/vitest.setup.ts`.

## Files

- Refactor: `app/experiments/*/page.tsx` -> add `_components/` siblings
- New: `apps/web/lib/feature-flags-build.ts`
- New: `apps/web/app/experiments/layout.tsx` (gate)
- Modified: `apps/web/next.config.ts` (or build-time route exclusion)
- Modified: `apps/web/vitest.setup.ts` (jsdom location mock)

## Acceptance criteria

### Automated
- [ ] All experiment `page.tsx` files ≤ 80 LOC
- [ ] Production build with `NEXT_PUBLIC_EXPERIMENTS_ENABLED` unset omits
      experiment chunks from `route-bundle-stats.json` (verified by
      grepping for `experiments/` in the JSON)
- [ ] `pnpm run test 2>&1 | grep -c "Not implemented: navigation"` returns `0`
- [ ] `pnpm run typecheck && pnpm run test && pnpm run lint` all pass

### Manual
- Vercel preview without `EXPERIMENTS_ENABLED`: visiting
  `/experiments/hexmap` returns 404
- Vercel preview WITH `EXPERIMENTS_ENABLED=true`: pages render correctly

## Closing the issues

```bash
gh issue close 516 --comment "Fixed in <sha>. Experiment pages split into _components/; each page.tsx <= 80 LOC."
gh issue close 763 --comment "Fixed in <sha>. Experiments tree gated by NEXT_PUBLIC_EXPERIMENTS_ENABLED at build time; chunks not shipped in production."
gh issue close 765 --comment "Fixed in <sha>. jsdom navigation warnings eliminated via window.location mock in vitest.setup.ts."
```
