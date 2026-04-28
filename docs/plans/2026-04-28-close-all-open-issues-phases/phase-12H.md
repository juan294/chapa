---
phase: 12H
release: v2.12.0
issues: ["#755", "#756", "#761"]
batch_eligible: true
depends_on: ["12A"]
effort: S
---

# Phase 12H — Frontend M-batch (`#755`, `#756`, `#761`)

Three M-priority frontend fixes deferred to wave-2.

## #755 — Navbar ISR edge case

**File:** referenced in pre-launch report §14, likely
`apps/web/components/Navbar.tsx` or similar.

The Navbar's session-resolved state can flicker on ISR-cached pages
because the cached HTML shows logged-out chrome briefly, then hydration
swaps to logged-in. Fix: render a stable skeleton on SSR and only swap
the auth-dependent chunk after `useSession()` resolves.

```tsx
// apps/web/components/Navbar.tsx
const { user, isLoading } = useSession();

return (
  <nav>
    <Logo />
    {isLoading ? <NavbarSkeleton /> : user ? <UserMenu user={user} /> : <LoginCTA />}
  </nav>
);
```

Test with React Testing Library that the loading state renders, then the
authenticated state replaces it after the session resolves.

## #756 — Duplicate SVG icons across components

Sweep `apps/web/components/` for inline SVG `<svg>...</svg>` blocks.
Identify duplicates (same `viewBox` + same `<path>`). Extract to
`apps/web/components/icons/` as named exports.

Common candidates:
- GitHub octocat
- Bitbucket logo
- Codeberg logo
- Chevron up/down
- External-link arrow
- Copy icon
- Check icon

Pseudocode:

```tsx
// apps/web/components/icons/GithubIcon.tsx
export function GithubIcon({ className = "h-4 w-4" }) {
  return <svg ...>...</svg>;
}
```

Consolidate to ~10 named icon components. Replace inline duplicates with
imports.

Per the design system: `strokeWidth="1.5"`, `strokeLinecap="round"`,
`strokeLinejoin="round"`, `aria-hidden="true"` on decorative icons.

## #761 — `dbGetUsers` no pagination

**File:** likely `apps/web/lib/db/users.ts:dbGetUsers`.

The current `dbGetUsers` returns all rows in a single Supabase query.
At scale, this is unsafe. Add cursor-based pagination:

```ts
export interface DbGetUsersOptions {
  cursor?: string;       // last returned handle (for cursor pagination)
  limit?: number;        // max 200, default 50
  filter?: string;       // ILIKE handle filter
  sort?: "handle" | "created_at" | "score";
}

export async function dbGetUsers(opts: DbGetUsersOptions = {}) {
  const limit = Math.min(200, opts.limit ?? 50);
  let query = supabase.from("users").select("...").order(opts.sort ?? "handle");
  if (opts.cursor) query = query.gt("handle", opts.cursor);
  if (opts.filter) query = query.ilike("handle", `%${opts.filter}%`);
  const { data, error } = await query.limit(limit + 1);
  // ...
  const hasMore = data.length > limit;
  return {
    users: data.slice(0, limit),
    nextCursor: hasMore ? data[limit - 1].handle : null,
  };
}
```

Update callers — admin users API (`/api/admin/users`) and warm-cache
priority list logic — to use the paginated form.

## Files

- Modified: `apps/web/components/Navbar.tsx` (#755)
- Modified: `apps/web/components/Navbar.test.tsx`
- New: `apps/web/components/NavbarSkeleton.tsx`
- New: `apps/web/components/icons/*.tsx` (~10 files) (#756)
- Modified: variable component files removing inline SVG dupes (#756)
- Modified: `apps/web/lib/db/users.ts` (#761)
- Modified: `apps/web/app/api/admin/users/route.ts` (use paginated)
- Modified: matching tests

## Acceptance criteria

### Automated
- [ ] No SSR/CSR hydration mismatch warnings in `pnpm run test`
- [ ] `dbGetUsers({ limit: 10 })` returns at most 10 users + `nextCursor`
- [ ] Inline SVG count in `apps/web/components/*.tsx` (excluding `icons/`)
      drops by ≥30%
- [ ] `pnpm run test`, `pnpm run typecheck`, `pnpm run lint` pass

### Manual
- Visit `/`; navbar doesn't flash logged-out chrome before hydrating
- `/admin` users table loads in pages of 50 with "Load more" button
- Visual regression: every replaced icon renders identically to before

## Closing the issues

```bash
gh issue close 755 --comment "Fixed in <sha>. Navbar renders a stable skeleton on SSR and swaps to auth chrome after useSession resolves."
gh issue close 756 --comment "Fixed in <sha>. Duplicate inline SVG icons consolidated into apps/web/components/icons/."
gh issue close 761 --comment "Fixed in <sha>. dbGetUsers now cursor-paginated; admin users API uses limit+nextCursor."
```
