# Phase 9: Optical Icon+Text Button Alignment [batch-eligible]

## Goal

Adjust padding on buttons that combine an icon with text so the icon side has slightly less padding, achieving optical (perceived) balance rather than geometric (measured) balance.

## Why

When a button has text + icon, equal padding on both sides makes the icon side look like it has more space because the icon occupies less visual weight than text. Reducing the icon-side padding by 2-4px creates perceived symmetry. This is a detail that "often goes unnoticed" per the article but contributes to the compounding sense of quality.

## Scope

Only buttons where icon and text are adjacent horizontally. This does NOT apply to:
- Icon-only buttons (already symmetric)
- Buttons where the icon is purely decorative and visually separated from text
- Menu items where the icon + text are in a `gap-3` flex layout (the gap already handles spacing)

## Files to Modify

### 1. `apps/web/app/page.tsx` — Hero CTA buttons

**Line 153-159** — "Get Your Badge" button:
```
BEFORE: className="group inline-flex items-center gap-2.5 rounded-lg bg-amber px-6 py-3 text-sm font-semibold text-white ..."
AFTER:  className="group inline-flex items-center gap-2.5 rounded-lg bg-amber pl-6 pr-5 py-3 text-sm font-semibold text-white ..."
```

The arrow icon is on the right, so `pr` (right padding) is reduced by 1 unit (6→5). The GitHub icon on the left is text-integrated (its weight matches the text), so left padding stays.

**Line 161-168** — "Verify a Badge" button:
```
BEFORE: className="group inline-flex items-center gap-2.5 rounded-lg bg-complement px-6 py-3 text-sm font-semibold text-white ..."
AFTER:  className="group inline-flex items-center gap-2.5 rounded-lg bg-complement pl-6 pr-5 py-3 text-sm font-semibold text-white ..."
```

Same rationale — trailing arrow icon.

**Line 427-434** — Bottom CTA "Get Your Badge":
```
BEFORE: className="group inline-flex items-center gap-2.5 rounded-lg bg-amber px-8 py-3.5 text-base font-semibold text-white ..."
AFTER:  className="group inline-flex items-center gap-2.5 rounded-lg bg-amber pl-8 pr-7 py-3.5 text-base font-semibold text-white ..."
```

### 2. `apps/web/components/SharePageOwnerContent.tsx` — Visitor CTA

**Line 57-64** — "Discover your impact" button:
```
BEFORE: className="inline-flex items-center gap-2 rounded-lg bg-amber px-6 py-3 text-sm font-semibold text-white ..."
AFTER:  className="inline-flex items-center gap-2 rounded-lg bg-amber pl-6 pr-5 py-3 text-sm font-semibold text-white ..."
```

### 3. `apps/web/components/BadgeToolbar.tsx` — Toolbar buttons

The toolbar buttons use a shared `btnClass` variable (line 131-132):
```
BEFORE: "inline-flex items-center justify-center gap-1.5 rounded-lg min-h-[44px] min-w-[44px] px-2 sm:px-3 py-2 text-xs ..."
```

These buttons have small icons (3.5w) next to short text ("Share", "Refresh", "Download"). The `gap-1.5` is already small. At `px-2 sm:px-3` the padding is tight — adjusting by 1px would require custom values like `pl-2 pr-1.5 sm:pl-3 sm:pr-2.5`. This is too fiddly for the visual improvement gained.

**Decision:** Leave BadgeToolbar buttons unchanged. The `px-2 sm:px-3` padding is already tight enough that optical alignment isn't an issue at this size.

## Tests

### Source-level assertion on `apps/web/app/page.tsx`
```
it("CTA buttons use asymmetric padding for optical icon alignment", () => {
  // Hero buttons should have pl-6 pr-5 (not symmetric px-6)
  expect(SOURCE).toContain("pl-6 pr-5");
});
```

## Success Criteria

### Automated
- [ ] `pnpm run typecheck` passes
- [ ] `pnpm run test` passes
- [ ] `pnpm run lint` passes

### Manual
- [ ] "Get Your Badge" button on landing page looks optically centered
- [ ] "Verify a Badge" button on landing page looks optically centered
- [ ] Bottom CTA "Get Your Badge" looks optically centered
- [ ] "Discover your impact" CTA on visitor share page looks optically centered
- [ ] Compare before/after screenshots — the trailing arrow no longer makes the right side look heavier
- [ ] No visual regression on mobile (buttons still look correct at small widths)
