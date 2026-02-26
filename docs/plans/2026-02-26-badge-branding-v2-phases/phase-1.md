# Phase 1: Avatar Placeholder Swap

> **Scope:** Replace the GitHub Octocat fallback with the Chapa shield icon in the badge SVG

## Changes

### 1. `apps/web/lib/render/BadgeSvg.tsx` (lines 138-140)

**Current:** When `avatarDataUri` is undefined, renders a 28×28 GitHub Octocat SVG path.

**New:** Render the Chapa shield+chevron icon (from `icon.tsx`) adapted to fit the same space.

```pseudo
// Replace the Octocat fallback block (lines 138-140)
// OLD:
<g transform="translate(${avatarCX - 14}, ${avatarCY - 14})">
  <path d="M14 0C6.27 0 ... (Octocat path)" fill="${t.textSecondary}" opacity="0.6"/>
</g>

// NEW:
<g transform="translate(${avatarCX - 14}, ${avatarCY - 14})">
  <!-- Shield outline (adapted from icon.tsx viewBox 0 0 32 32 → scaled to 28×28) -->
  <path d="M14 0.875 L25.375 5.25 L25.375 13.125 C25.375 20.125 20.125 25.375 14 27.125 C7.875 25.375 2.625 20.125 2.625 13.125 L2.625 5.25 Z"
        fill="none" stroke="${t.textSecondary}" stroke-width="1.3" opacity="0.5"/>
  <!-- Chevron inside shield -->
  <path d="M8.75 17.5 L14 10.5 L19.25 17.5"
        fill="none" stroke="${t.accent}" stroke-width="2.5"
        stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/>
</g>
```

**Notes:**
- Scale the shield from 32×32 viewBox to fit within 28×28 pixel area (same as the Octocat was)
- Shield outline uses `t.textSecondary` with low opacity (subtle, not dominant)
- Chevron uses `t.accent` (purple) for brand recognition
- The exact path coordinates will be calculated by scaling the original `icon.tsx` paths by `28/32 = 0.875`

### 2. Tests

**Files to update:**
- Any test in `apps/web/lib/render/` that snapshots or asserts on the Octocat SVG path
- Search for: `M14 0C6.27` (the start of the Octocat path) in test files

**New test assertions:**
- Badge SVG without `avatarDataUri` contains the shield path (not Octocat)
- Badge SVG with `avatarDataUri` still renders the `<image>` element (no regression)

## Verification

```bash
pnpm run test --reporter=verbose 2>&1 | head -100
pnpm run typecheck 2>&1
pnpm run lint 2>&1
```

## Checklist

- [x] Octocat SVG path removed from `BadgeSvg.tsx`
- [x] Chapa shield+chevron renders in avatar circle when no photo
- [x] Tests updated and passing (3,654/3,654)
- [x] TypeScript compiles cleanly
- [x] Lint passes
