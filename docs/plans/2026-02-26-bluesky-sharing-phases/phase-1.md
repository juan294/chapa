# Phase 1: Bluesky Share Button — Tests + Implementation

## Step 1: Write Failing Tests (RED)

**File:** `apps/web/components/BadgeToolbar.test.tsx`

Add a new `describe("bluesky share")` block inside the existing `describe("share dropdown")` block (after the `describe("linkedin share")` block at line 73–81):

```
describe("bluesky share", () => {
  it("links to Bluesky compose intent URL")
    → assert SOURCE contains "bsky.app/intent/compose"

  it("tracks share event with bluesky platform")
    → assert SOURCE contains 'platform: "bluesky"'
})
```

**Net new tests: 2** (Bluesky URL pattern + Bluesky analytics platform string).

Existing tests already cover `target="_blank"`, `rel="noopener noreferrer"`, and `role="menuitem"` for all `<a>` tags — no new tests needed for those.

## Step 2: Implement (GREEN)

**File:** `apps/web/components/BadgeToolbar.tsx`

### 2a. Add Bluesky share URL variable (after line 51, the linkedinUrl)

```pseudo
+ const blueskyUrl = `https://bsky.app/intent/compose?text=${encodeURIComponent(`Just decoded my developer impact on Chapa. Curious what yours looks like?\n\nDiscover your coding DNA → ${shareUrl}`)}`;
```

Note: This reuses the same share copy as the X/Twitter tweet for brand consistency. The Bluesky compose window lets users edit the text before posting.

### 2b. Add Bluesky menu item (after the LinkedIn `</a>` closing tag at line 249, before the Copy link `<button>` at line 250)

```pseudo
+ <a
+   href={blueskyUrl}
+   onClick={() => {
+     trackEvent("share_clicked", { platform: "bluesky" });
+     setShareOpen(false);
+   }}
+   target="_blank"
+   rel="noopener noreferrer"
+   role="menuitem"
+   className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-amber/10 hover:text-text-primary transition-colors"
+ >
+   Post on
+   <svg
+     className="w-3.5 h-3.5"
+     viewBox="0 0 360 320"
+     fill="currentColor"
+     aria-hidden="true"
+   >
+     <path d="M254.896 184.158C252.81 166.601 250.856 155.293 235.434 131.079C220.872 108.166 190.835 80.0884 180.137 72.3609C169.439 80.0884 139.402 108.166 124.84 131.079C109.418 155.293 107.464 166.601 105.378 184.158C103.007 204.236 109.985 228.883 130.418 233.751C147.255 237.737 162.419 227.215 174.654 210.803C175.988 208.958 180.137 202.59 180.137 202.59C180.137 202.59 184.286 208.958 185.62 210.803C197.855 227.215 213.019 237.737 229.856 233.751C250.289 228.883 257.267 204.236 254.896 184.158Z" />
+     <path d="M180.86 0.608013C136.772 36.9693 89.1498 95.3506 65.9156 136.53C54.5997 156.469 28.8577 202.645 33.6492 255.207C37.9015 301.762 60.9302 317.649 91.3786 318.987C133.674 320.832 160.432 290.132 180.86 257.876C201.288 290.132 228.046 320.832 270.342 318.987C300.79 317.649 323.819 301.762 328.071 255.207C332.862 202.645 307.12 156.469 295.805 136.53C272.57 95.3506 224.948 36.9693 180.86 0.608013Z" />
+   </svg>
+ </a>
```

The SVG uses the official Bluesky butterfly logo (two paths: inner butterfly + outer shape, 360x320 viewBox). It matches the other icons' pattern: `fill="currentColor"`, `aria-hidden="true"`.

## Step 3: Verify (REFACTOR)

Run automated verification:

```bash
cd <worktree> && pnpm run test 2>&1; pnpm run typecheck 2>&1; pnpm run lint 2>&1
```

All three must pass before committing.

## Commit

```
feat(share): add Bluesky to badge share dropdown

Adds "Post on Bluesky" as a new menu item in the BadgeToolbar
share dropdown, positioned between "Share on LinkedIn" and "Copy link".
Uses Bluesky's compose intent endpoint with curiosity-driven share text.
```
