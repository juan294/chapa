# Plan: Add LinkedIn Share Button

> Created: 2026-02-26 | Branch: `develop` | Research: `docs/research/2026-02-26-linkedin-sharing.md`

## Summary

Add a "Share on LinkedIn" option to the existing share dropdown in the BadgeToolbar. This is a small, additive change — one new `<a>` menu item inserted between the existing "Post on X" and "Copy link" items.

## Scope

- **2 files modified**: `BadgeToolbar.tsx` (implementation) + `BadgeToolbar.test.tsx` (tests)
- **0 new files**
- **No backend changes** — LinkedIn share-offsite only needs a URL; OG metadata already exists
- **No hook changes** — `useDropdownMenu` auto-discovers `role="menuitem"` elements

## Design Decisions

1. **Menu order**: X → LinkedIn → Copy link. Social platforms grouped together, utility action (copy) last.
2. **LinkedIn URL format**: `https://www.linkedin.com/sharing/share-offsite/?url={encoded_url}`. Only the `url` parameter — LinkedIn's compose window lets the user write their own text, and LinkedIn auto-pulls OG metadata for the preview card.
3. **Icon**: Official LinkedIn "in" logo as inline SVG (`fill="currentColor"`, matching `w-3.5 h-3.5` pattern). Uses the standard LinkedIn brand path.
4. **Label text**: "Share on LinkedIn" (with LinkedIn icon) — matches the "Post on X" pattern of verb + platform name + icon.
5. **Analytics**: `trackEvent("share_clicked", { platform: "linkedin" })` — follows existing convention.

## Phases

| Phase | Description | Files |
|-------|-------------|-------|
| 1 | Tests + Implementation + Verification | `BadgeToolbar.test.tsx`, `BadgeToolbar.tsx` |

Single phase — the change is small enough to do in one atomic pass following TDD.

## Phase Details

See: [`docs/plans/2026-02-26-linkedin-sharing-phases/phase-1.md`](./2026-02-26-linkedin-sharing-phases/phase-1.md)

## Success Criteria

### Automated
- [x] `pnpm run test` — all tests pass (including new LinkedIn assertions) — 3509/3509 passed
- [x] `pnpm run typecheck` — no type errors
- [x] `pnpm run lint` — no lint errors (4 pre-existing warnings, unrelated)

### Manual
- [ ] Visit `/u/:handle` → click Share → see three items: "Post on X", "Share on LinkedIn", "Copy link"
- [ ] Click "Share on LinkedIn" → opens LinkedIn share-offsite URL in new tab with the correct share page URL
- [ ] LinkedIn compose window shows OG preview card with badge image
- [ ] Arrow key navigation works across all three menu items
