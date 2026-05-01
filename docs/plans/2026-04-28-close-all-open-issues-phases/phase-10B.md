---
phase: 10B
release: v2.10.0
issues: ["#719", "#729", "#754"]
batch_eligible: false
depends_on: ["10A"]
effort: M
---

# Phase 10B — Layout chunk lazy-loading (`#719`, `#729`, `#754`)

## Goal

Drop layout-mounted chunks below the fold. Target: shave another ~150KB
off baseline routes so the post-10A `/u/[handle]` lands near 500KB and
non-share routes land near 450KB.

## Current state (verified 2026-04-28)

- Baseline `/` is 697KB First Load JS
- `apps/web/app/layout.tsx` force-loads:
  - `ThemeProvider` (small, must stay sync — no FOUC)
  - `PostHogProvider` -> `ClientAnalytics` (defer-able; analytics isn't critical for first paint)
  - `KeyboardShortcutsListener` (defer-able; only needed after first interaction)
  - `AuthorTypewriter` (small; render only in the landing-page header, not site-wide)
  - `UserMenu` (629 LOC including dropdown body) — the dropdown contents only matter when opened
- 43 `"use client"` files in `components/`

## Pseudocode

```tsx
// apps/web/app/layout.tsx
const ClientAnalytics = dynamic(
  () => import("@/components/ClientAnalytics"),
  { ssr: false },
);
const KeyboardShortcutsListener = dynamic(
  () => import("@/components/KeyboardShortcutsListener"),
  { ssr: false },
);
```

```tsx
// apps/web/components/UserMenu.tsx
// Split into UserMenu (button + login state) and UserMenuDropdown (the body).
// Lazy-load the dropdown only when opened.
const UserMenuDropdown = dynamic(() => import("./UserMenuDropdown"), {
  ssr: false,
});

return (
  <>
    <UserMenuButton onClick={toggle} />
    {open && <UserMenuDropdown ... />}
  </>
);
```

```tsx
// apps/web/components/AuthorTypewriter.tsx is currently in layout.
// Move its mount to apps/web/app/page.tsx only (landing page header).
// Remove from layout.tsx.
```

`#754` (KeyboardShortcutsListener store opacity): the listener uses a
module-level store with no ergonomics primitive — fix as part of the
dynamic-import refactor by extracting the store into a tiny `lib/stores/`
helper while we're touching the file.

## Files

- Modified: `apps/web/app/layout.tsx`
- Modified: `apps/web/app/page.tsx` (landing) — mount `AuthorTypewriter` here
- New split: `apps/web/components/UserMenuDropdown.tsx` (move dropdown body)
- Modified: `apps/web/components/UserMenu.tsx` (button + dropdown gate)
- Modified: `apps/web/components/KeyboardShortcutsListener.tsx`
- New (small): `apps/web/lib/stores/createReactStore.ts` (~30 LOC)
- All matching `*.test.tsx` updated

## Acceptance criteria

### Automated
- [ ] `/u/[handle]` First Load JS ≤ 510KB (post-10A); `/` ≤ 510KB
- [ ] All other routes ≤ 530KB
- [ ] `pnpm run test`, `pnpm run test:e2e`, `pnpm run typecheck`,
      `pnpm run lint` pass
- [ ] New test: `UserMenuDropdown` chunk not loaded when menu closed
- [ ] CI bundle-size workflow updated thresholds (`<=510KB` warn, `<=530KB` fail)

### Manual
- Vercel preview: open `/`, hit DevTools coverage tool — verify
  `KeyboardShortcutsListener.*.js` and `ClientAnalytics.*.js` are loaded
  AFTER first paint (or on first interaction)
- Open the user menu — verify the dropdown chunk loads ONLY then

## Closing the issues

```bash
gh issue close 719 --comment "Fixed in <sha>. Layout shell trimmed by lazy-loading ClientAnalytics, KeyboardShortcutsListener, and UserMenuDropdown; AuthorTypewriter moved to landing page."
gh issue close 729 --comment "Fixed in <sha>. Largest client components (UserMenu dropdown body, AuthorTypewriter) split out of the always-loaded baseline."
gh issue close 754 --comment "Fixed in <sha>. KeyboardShortcutsListener migrated to lib/stores/createReactStore primitive."
```
