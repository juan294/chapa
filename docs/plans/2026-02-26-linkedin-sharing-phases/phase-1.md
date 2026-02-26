# Phase 1: LinkedIn Share Button — Tests + Implementation

## Step 1: Write Failing Tests (RED)

**File:** `apps/web/components/BadgeToolbar.test.tsx`

Add a new `describe("linkedin share")` block inside the existing `describe("share dropdown")` block:

```
describe("linkedin share", () => {
  it("links to LinkedIn share-offsite URL")
    → assert SOURCE contains "linkedin.com/sharing/share-offsite"

  it("tracks share event with linkedin platform")
    → assert SOURCE contains 'platform: "linkedin"'

  it("opens in new tab with security attributes")
    → already covered by existing test at line 68–71 (checks target="_blank" and rel="noopener noreferrer")
    → no new test needed since the existing assertion covers all <a> tags

  it("has role=menuitem for keyboard navigation")
    → already covered by existing test at line 48–49
    → no new test needed
})
```

**Net new tests: 2** (LinkedIn URL pattern + LinkedIn analytics platform string).

## Step 2: Implement (GREEN)

**File:** `apps/web/components/BadgeToolbar.tsx`

### 2a. Add LinkedIn share URL variable (after line 50)

```pseudo
+ const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
```

### 2b. Add LinkedIn menu item (after the X/Twitter `<a>` closing tag at line 227, before the Copy link `<button>` at line 228)

```pseudo
+ <a
+   href={linkedinUrl}
+   onClick={() => {
+     trackEvent("share_clicked", { platform: "linkedin" });
+     setShareOpen(false);
+   }}
+   target="_blank"
+   rel="noopener noreferrer"
+   role="menuitem"
+   className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-amber/10 hover:text-text-primary transition-colors"
+ >
+   Share on
+   <svg
+     className="w-3.5 h-3.5"
+     viewBox="0 0 24 24"
+     fill="currentColor"
+     aria-hidden="true"
+   >
+     <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
+   </svg>
+ </a>
```

The SVG path is the standard LinkedIn "in" logo (filled, 24x24 viewBox). It matches the X icon's pattern: `fill="currentColor"`, no stroke.

## Step 3: Verify (REFACTOR)

Run automated verification:

```bash
cd <worktree> && pnpm run test 2>&1; pnpm run typecheck 2>&1; pnpm run lint 2>&1
```

All three must pass before committing.

## Commit

```
feat(share): add LinkedIn to badge share dropdown

Adds "Share on LinkedIn" as a new menu item in the BadgeToolbar
share dropdown, positioned between "Post on X" and "Copy link".
Uses LinkedIn's share-offsite endpoint which auto-pulls OG metadata
for a rich preview card.

Refs #TBD
```
