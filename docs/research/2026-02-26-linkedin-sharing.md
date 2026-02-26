# Research: Adding LinkedIn Sharing to Chapa Badge

> Generated: 2026-02-26 | Branch: `develop`

## Research Question

How does the current sharing system work, and what's needed to add LinkedIn as a native share option alongside X/Twitter and Copy Link?

---

## 1. Current Sharing Architecture

### Primary Component: `BadgeToolbar`

**File:** `apps/web/components/BadgeToolbar.tsx`

The share functionality lives in a dropdown menu inside the `BadgeToolbar` component. The toolbar renders on the share page (`/u/:handle`) and contains: Refresh (owner-only), **Share dropdown**, Download PNG, Customize (owner + studio enabled).

**Props** (lines 8–12):
```typescript
interface BadgeToolbarProps {
  handle: string;
  isOwner: boolean;
  studioEnabled: boolean;
}
```

### Share Dropdown Structure (lines 176–256)

The share dropdown is a `<div className="relative">` with:
1. A trigger button (lines 178–200): icon + "Share" text, `aria-expanded`, `aria-haspopup="true"`, `aria-label="Share badge"`
2. A menu panel (lines 202–255): `role="menu"`, animated with `animate-terminal-fade-in`, styled `bg-card border-stroke rounded-xl shadow-xl`

**Current menu items:**

| # | Action | Element | Lines | Analytics Event |
|---|--------|---------|-------|-----------------|
| 1 | Post on X | `<a>` link | 207–227 | `share_clicked` / `{ platform: "x" }` |
| 2 | Copy link | `<button>` | 228–253 | `share_clicked` / `{ platform: "copy_link" }` |

### Share URL Construction (line 47)

```typescript
const shareUrl = `https://chapa.thecreativetoken.com/u/${handle}`;
```

### X/Twitter Share Implementation (lines 47–50, 207–227)

Uses Twitter Web Intent:
```typescript
const tweetText = encodeURIComponent(
  `Just decoded my developer impact on Chapa. Curious what yours looks like?\n\nDiscover your coding DNA → ${shareUrl}`,
);
// URL: https://x.com/intent/tweet?text={tweetText}
```

The `<a>` tag opens in a new tab with `target="_blank" rel="noopener noreferrer"`. On click, it fires `trackEvent("share_clicked", { platform: "x" })` and closes the dropdown.

### Copy Link Implementation (lines 52–62, 228–253)

Uses `navigator.clipboard.writeText(shareUrl)` with a 2-second "Copied!" confirmation state.

### Dropdown Behavior

Managed by a custom hook `useDropdownMenu` imported from `@/hooks/useDropdownMenu` (line 5). This hook handles:
- Click-outside to close
- Arrow key navigation between `role="menuitem"` elements
- Escape key to close

The hook is instantiated at line 21–22 (approximately) and returns `{ shareOpen, setShareOpen, shareRef }`.

---

## 2. Menu Item Styling Pattern

Each menu item follows the same CSS class pattern (line 216, 231):

```
flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-secondary
hover:bg-amber/10 hover:text-text-primary transition-colors
```

For `<a>` links (X/Twitter): no `w-full` needed.
For `<button>` elements (Copy link): adds `w-full` for full-width click target.

### Icon Pattern

All icons are inline SVGs at `w-3.5 h-3.5` with `aria-hidden="true"`:
- X icon: `fill="currentColor"`, `viewBox="0 0 24 24"`, uses official X path (lines 219–226)
- Copy icon: `stroke="currentColor"`, `strokeWidth="1.5"`, `strokeLinecap="round"`, `strokeLinejoin="round"` (lines 234–252)

---

## 3. Analytics Tracking

**File:** `apps/web/lib/analytics/posthog.ts` (lines 1–26)

All share actions use `trackEvent(event, properties)`:

| Event | Properties | Trigger |
|-------|-----------|---------|
| `share_clicked` | `{ platform: "x" }` | X/Twitter link clicked |
| `share_clicked` | `{ platform: "copy_link" }` | Copy link clicked |
| `badge_downloaded` | `{ handle }` | Download PNG clicked |
| `embed_copied` | — | Embed snippet copied |

The `platform` property is a string — no enum or constant. Adding `"linkedin"` follows the same pattern.

---

## 4. Test Coverage

**File:** `apps/web/components/BadgeToolbar.test.tsx` (lines 1–129)

Tests use source-code string assertions (reading the `.tsx` file and matching against it). Relevant share tests:

- Line 52–54: Verifies `x.com/intent/tweet` URL exists in source
- Line 56–61: Verifies curiosity-driven tweet text (not self-promotional)
- Line 63–66: Verifies `trackEvent` and `share_clicked` are present
- Line 68–71: Verifies `target="_blank"` and `rel="noopener noreferrer"`
- Line 44–50: Verifies `role="menu"` and `role="menuitem"` exist

The tests verify source-code patterns, not rendered output. A new LinkedIn item would need similar assertions: LinkedIn URL pattern, analytics event, security attributes, and `role="menuitem"`.

---

## 5. LinkedIn Share URL Format

LinkedIn provides a sharing endpoint:

```
https://www.linkedin.com/sharing/share-offsite/?url={encoded_url}
```

Parameters:
- `url` (required): The URL to share (must be URL-encoded)

Unlike X/Twitter, LinkedIn's share-offsite endpoint only accepts a `url` parameter — the post text is entered by the user in the LinkedIn compose window. LinkedIn pulls OG metadata from the shared URL to generate a preview card.

### Chapa's OG Metadata (already in place)

**File:** `apps/web/app/u/[handle]/page.tsx` (lines 31–62)

The share page already generates rich OG metadata that LinkedIn will consume:

```typescript
openGraph: {
  title: `${handle}'s Developer Impact`,
  description: `See ${handle}'s coding DNA...`,
  type: "profile",
  url: pageUrl,
  images: [{ url: `${BASE_URL}/u/${handle}/og-image?v=${today}`, width: 1200, height: 630 }],
}
```

This means LinkedIn will render a rich preview card with the badge image automatically — no extra work needed on the OG side.

---

## 6. Existing LinkedIn References in Codebase

**File:** `docs/badge-embed-testing.md` (lines 18–19, 235–253)

LinkedIn is documented as a "low priority" embed target with two use cases:
- **LinkedIn Post**: Share the `/u/:handle` link → OG card preview auto-generates
- **LinkedIn Article**: Manual PNG upload needed (articles don't render OG cards the same way)

LinkedIn is NOT currently implemented as a native share button anywhere in the code.

---

## 7. OpenGraph Image Route

**File:** `apps/web/app/u/[handle]/og-image/route.ts` (lines 1–88)

The share page serves a dedicated OG image at `/u/:handle/og-image` that:
- Renders the actual badge SVG as a 1200×630 PNG
- Uses a daily cache key (updates once per day)
- Caches in Redis with 6h `s-maxage`, 7d `stale-while-revalidate`

This image is what LinkedIn (and X/Twitter) will display as the preview card when the share URL is posted.

---

## 8. Keyboard Shortcuts

**File:** `apps/web/components/SharePageShortcuts.tsx` (lines 1–59)
**File:** `apps/web/lib/keyboard/shortcuts.ts` (lines 89–110)

Current share page shortcuts: `copy-embed`, `download-svg`, `refresh-badge`. No shortcut exists for social sharing — social share actions open external URLs, so a keyboard shortcut would be unusual.

---

## 9. Files That Would Be Touched

Based on the current architecture, adding a LinkedIn share option involves:

| File | What Exists |
|------|-------------|
| `apps/web/components/BadgeToolbar.tsx` | Share dropdown with X + Copy Link items |
| `apps/web/components/BadgeToolbar.test.tsx` | Source-pattern tests for share dropdown |
| `apps/web/lib/analytics/posthog.ts` | `trackEvent` function (no changes needed — already accepts any string) |

No new files needed. The change is additive: one new `<a>` menu item in the existing dropdown.

---

## 10. Summary of Key Facts

1. **Single file owns all sharing UI**: `BadgeToolbar.tsx` (303 lines total)
2. **Dropdown menu uses `role="menu"` with `role="menuitem"` children** — new items must follow this pattern
3. **LinkedIn share URL format**: `https://www.linkedin.com/sharing/share-offsite/?url={encoded_url}` — only needs the URL, no custom text parameter
4. **OG metadata already exists** on the share page — LinkedIn will auto-generate a rich preview card
5. **Analytics pattern**: `trackEvent("share_clicked", { platform: "linkedin" })` — follows existing convention
6. **Icon**: Needs an inline SVG of the LinkedIn logo (filled, matching `w-3.5 h-3.5` pattern)
7. **Menu item styling**: Same classes as existing items — `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-amber/10 hover:text-text-primary transition-colors`
8. **Security**: `target="_blank" rel="noopener noreferrer"` required on the `<a>` tag
9. **Tests**: Add source-pattern assertions for LinkedIn URL, analytics event, security attributes, and `role="menuitem"`
10. **The `useDropdownMenu` hook handles arrow key navigation automatically** for any elements with `role="menuitem"` — no hook changes needed
