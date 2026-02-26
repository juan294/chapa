# Plan: Add Bluesky Share Button

> Created: 2026-02-26 | Branch: `develop` | Pattern: identical to LinkedIn share (same session)

## Summary

Add a "Post on Bluesky" option to the share dropdown in the BadgeToolbar. This follows the exact same pattern as the LinkedIn and X/Twitter items — one new `<a>` menu item inserted between LinkedIn and Copy link.

## Scope

- **2 files modified**: `BadgeToolbar.tsx` (implementation) + `BadgeToolbar.test.tsx` (tests)
- **0 new files**
- **No backend changes** — Bluesky share intent only needs a URL + text; OG metadata already exists
- **No hook changes** — `useDropdownMenu` auto-discovers `role="menuitem"` elements

## Design Decisions

1. **Menu order**: X → LinkedIn → Bluesky → Copy link. Social platforms grouped together (chronological by platform age), utility action (copy) last.
2. **Bluesky URL format**: `https://bsky.app/intent/compose?text={encoded_text}`. Unlike LinkedIn (URL-only), Bluesky accepts a `text` parameter similar to X/Twitter. We'll include the share URL in the compose text so users can add their own message around it.
3. **Compose text**: Same pattern as X/Twitter — curiosity-driven, includes the share URL. Short enough that users can add their own text: `"Just decoded my developer impact on Chapa. Curious what yours looks like?\n\nDiscover your coding DNA → {shareUrl}"` (reuses existing `tweetText` wording for consistency).
4. **Icon**: Official Bluesky butterfly logo as inline SVG (`fill="currentColor"`, matching `w-3.5 h-3.5` pattern). Uses the standard Bluesky brand path.
5. **Label text**: "Post on" (with Bluesky icon) — matches the X/Twitter pattern exactly ("Post on [icon]").
6. **Analytics**: `trackEvent("share_clicked", { platform: "bluesky" })` — follows existing convention.

## Phases

| Phase | Description | Files |
|-------|-------------|-------|
| 1 | Tests + Implementation + Verification | `BadgeToolbar.test.tsx`, `BadgeToolbar.tsx` |

Single phase — identical pattern to LinkedIn, one atomic pass following TDD.

## Phase Details

See: [`docs/plans/2026-02-26-bluesky-sharing-phases/phase-1.md`](./2026-02-26-bluesky-sharing-phases/phase-1.md)

## Success Criteria

### Automated
- [x] `pnpm run test` — all tests pass (including new Bluesky assertions) — 3511/3511 passed
- [x] `pnpm run typecheck` — no type errors
- [x] `pnpm run lint` — no lint errors (4 pre-existing warnings, unrelated)

### Manual
- [ ] Visit `/u/:handle` → click Share → see four items: "Post on X", "Share on LinkedIn", "Post on Bluesky", "Copy link"
- [ ] Click "Post on Bluesky" → opens Bluesky compose intent in new tab with the correct share URL
- [ ] Arrow key navigation works across all four menu items
