---
phase: 12D
release: v2.12.0
issues: ["#769", "#770", "#779", "#780", "#781", "#782"]
batch_eligible: true
depends_on: ["12A"]
effort: S
---

# Phase 12D — UX polish batch (`#769`, `#770`, `#779`, `#780`, `#781`, `#782`)

Six small, independent UX fixes. One commit per fix; bundled into one
phase for the v2.12 release log.

## #769 — `BadgeOverlay` annotation panels hidden on mobile

**File:** `apps/web/components/BadgeOverlay.tsx:299, 358`

The annotation pills currently use a `hidden md:block` Tailwind pattern.
Mobile users see no annotations.

```tsx
// Replace: className="hidden md:block ..."
// With:    className="block ..."
// And: ensure the pills don't overlap badge content on small screens
//      via positioning tweaks (test on iPhone 12 viewport)
```

If layout breaks on mobile, the alternative is auto-cycling a hint pill
on first view rather than showing all simultaneously.

## #770 — Landing CTA no progress UX

**File:** `apps/web/app/page.tsx`

After clicking the "Generate badge" CTA, there's no progress feedback
until the OAuth redirect happens. Users may double-click or assume
nothing is happening.

```tsx
const [pending, setPending] = useState(false);
function handleStart() {
  setPending(true);
  window.location.href = "/api/auth/login";
}
return (
  <button onClick={handleStart} disabled={pending}>
    {pending ? "Connecting GitHub..." : "Generate your badge"}
  </button>
);
```

## #779 — Archetype link hover inconsistency

**File:** referenced in pre-launch report §14, exact location to identify
during /implement (likely in `app/archetypes/page.tsx` or
`components/ArchetypeCard.tsx`).

Audit hover states across archetype links: ensure consistent transition
duration, color, and underline behavior. Use design system tokens.

## #780 — `rounded-full` on text content

**Files:** referenced in pre-launch report §14. Per design system: text
buttons use `rounded-lg`; only icon-only buttons may use `rounded-full`.

Sweep the codebase:
```bash
grep -rE "rounded-full" apps/web/components apps/web/app | grep -vE "icon|avatar|dot|cursor|badge-color"
```

For each match where the element contains text: replace with `rounded-lg`.

## #781 — Enterprise example same color 3 rows

**File:** referenced in pre-launch report §14, likely in
`app/about/page.tsx` (the "Enterprise" example block).

Three rows currently use the same color, breaking visual hierarchy.
Either alternate via dimension colors (`text-dimension-delivery`,
`text-dimension-quality`, `text-dimension-consistency`) or reduce to one
visual hierarchy color.

## #782 — Copyright year caching

**File:** likely `app/layout.tsx` or a footer component.

The copyright year is hard-coded or computed at build time, so once cached
it can become stale. Compute server-side per-render with `new Date().getFullYear()`,
OR set it as a build-time constant and accept it freezes per-deploy.
Prefer server-side dynamic to avoid year-wrap surprises.

```tsx
// apps/web/components/Footer.tsx
<span>© {new Date().getFullYear()} Chapa</span>
```

This must run server-side (Server Component) so the rendered HTML always
has the current year. If currently in a `"use client"` component, move it
into a server component slot.

## Files

- Modified: `apps/web/components/BadgeOverlay.tsx` (#769)
- Modified: `apps/web/app/page.tsx` (#770)
- Modified: ~3 files for hover consistency (#779)
- Modified: variable files containing `rounded-full` on text (#780)
- Modified: ~1 file for color-pattern fix (#781)
- Modified: footer component (#782)
- Test files updated for components above

## Acceptance criteria

### Automated
- [ ] `pnpm run test`, `pnpm run typecheck`, `pnpm run lint` pass
- [ ] New tests for #769 (annotations visible at mobile breakpoint),
      #770 (button disabled while pending), #782 (year matches `Date`)

### Manual
- Mobile viewport (iPhone 12, 390px): annotations visible on the badge preview
- Click the landing CTA: button shows "Connecting GitHub..."
- Visit `/about`: archetype hover states all behave the same
- No `rounded-full` on text buttons
- `/about` enterprise example shows visual hierarchy
- Footer shows current year

## Closing the issues

```bash
gh issue close 769 --comment "Fixed in <sha>. BadgeOverlay annotations now visible on mobile."
gh issue close 770 --comment "Fixed in <sha>. Landing CTA shows 'Connecting GitHub...' progress."
gh issue close 779 --comment "Fixed in <sha>. Archetype link hover normalized."
gh issue close 780 --comment "Fixed in <sha>. rounded-full removed from text content per design system."
gh issue close 781 --comment "Fixed in <sha>. Enterprise example uses dimension colors for visual hierarchy."
gh issue close 782 --comment "Fixed in <sha>. Copyright year computed server-side per render."
```
