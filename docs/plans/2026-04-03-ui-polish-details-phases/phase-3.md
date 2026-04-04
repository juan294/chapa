# Phase 3: Avatar Image Outlines [batch-eligible]

## Goal

Add a subtle `outline` to avatar images so they don't visually bleed into backgrounds. Define both light and dark mode variants.

## Why

User avatars appear in the nav bar (UserMenu), admin table, and share page badge. Light-colored avatars on light backgrounds, or dark avatars on dark backgrounds, can lose their edge. A 1px semi-transparent outline creates a consistent boundary and adds perceived depth — a detail commonly used in design systems (GitHub, Linear, etc.).

## Files to Modify

### 1. `apps/web/styles/globals.css` — Add utility class

After the scrollbar section (~line 468), add:

```css
/* ── Image outlines ────────────────────────────────────── */

.img-outline {
  outline: 1px solid rgba(0, 0, 0, 0.1);
  outline-offset: -1px;
}

[data-theme="dark"] .img-outline {
  outline-color: rgba(255, 255, 255, 0.1);
}
```

### 2. `apps/web/components/UserMenu.tsx` — Nav avatar

**Line 214** — trigger avatar:
```
BEFORE: className="h-8 w-8 rounded-full"
AFTER:  className="h-8 w-8 rounded-full img-outline"
```

**Line 251** — dropdown header avatar:
```
BEFORE: className="h-10 w-10 rounded-full"
AFTER:  className="h-10 w-10 rounded-full img-outline"
```

### 3. `apps/web/app/admin/AdminUserTable.tsx` — Admin table avatar

**Line 39** — table row avatar:
```
BEFORE: className="h-7 w-7 rounded-full"
AFTER:  className="h-7 w-7 rounded-full img-outline"
```

### 4. `docs/design-system.md` — Document the pattern

Add to the "Components" section under a new "Images" subsection:
```
### Images

All avatar and user-uploaded images use the `.img-outline` utility class:
- 1px semi-transparent outline (`rgba(0,0,0,0.1)` light / `rgba(255,255,255,0.1)` dark)
- `outline-offset: -1px` so the outline sits inside the image boundary
- Prevents avatars from visually bleeding into matching backgrounds
```

## Tests

### `apps/web/components/UserMenu.test.tsx` (or source-level assertion if no render test exists)
```
it("avatar images use img-outline class for visual boundary", () => {
  // Read UserMenu source
  expect(USER_MENU_SOURCE).toContain("img-outline");
});
```

### `apps/web/styles/globals.css` (source-level)
```
it("defines img-outline utility class", () => {
  expect(GLOBALS_CSS).toContain(".img-outline");
});
```

## Success Criteria

### Automated
- [ ] `pnpm run typecheck` passes
- [ ] `pnpm run test` passes
- [ ] `pnpm run lint` passes

### Manual
- [ ] In light mode: avatars with light-colored photos show a subtle border
- [ ] In dark mode: avatars with dark-colored photos show a subtle border
- [ ] Outline does not overlap or create double-border with existing styles
- [ ] Fallback letter avatars (no image) are unaffected (they use bg-amber/10 which is visible enough)
