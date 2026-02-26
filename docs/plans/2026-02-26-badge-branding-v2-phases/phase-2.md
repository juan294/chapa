# Phase 2: Footer Branding Rewrite

> **Scope:** Replace "Powered by GitHub" footer with "Built from your commitment" + dynamic platform logos

## Changes

### 1. Rename `GithubBranding.tsx` → `BadgeBranding.tsx`

**File:** `apps/web/lib/render/GithubBranding.tsx` → `apps/web/lib/render/BadgeBranding.tsx`

**New function signature:**

```pseudo
export function renderBadgeBranding(
  x: number,           // Left edge x position
  y: number,           // Baseline y position
  rightX: number,      // Right edge x position (for domain text-anchor end)
  platforms: Platform[] // Connected platforms (e.g., ["github"] or ["github", "bitbucket", "codeberg"])
): string
```

**New rendering layout:**

```
Left side:                                                Right side:
[text: "Built from your commitment"]  [GH] [BB] [CB]     chapa.thecreativetoken.com
```

**Pseudocode:**

```pseudo
function renderBadgeBranding(x, y, rightX, platforms):
  // Platform logo SVG paths (same paths from ImpactBreakdown PLATFORM_DISPLAY)
  LOGOS = {
    github: { path: "M12 0C5.37...", viewBox: "0 0 24 24" },
    bitbucket: { path: "M.778 1.211...", viewBox: "0 0 24 24" },
    codeberg: { path: "M11.955.49...", viewBox: "0 0 24 24" },
  }

  // 1. Render "Built from your commitment" text (left-aligned at x)
  text = <text x="${x}" y="${y + 12}" ...>"Built from your commitment"</text>

  // 2. Render platform logos (right of text, before domain)
  //    Each logo is ~14px wide with 8px gap between them
  //    Position them between the text and the domain
  logoSize = 14
  logoGap = 8
  totalLogosWidth = platforms.length * logoSize + (platforms.length - 1) * logoGap

  // Logos positioned to the right of the text
  // Calculate start position: after "Built from your commitment" text (~275px wide at font-size 17)
  textWidth = 275  // approximate width of the branding text
  logosStartX = x + textWidth + 16  // 16px gap after text

  for (i, platform) in enumerate(platforms):
    logoX = logosStartX + i * (logoSize + logoGap)
    render <g transform="translate(${logoX}, ${y - 2})">
      <path d="${LOGOS[platform].path}" fill="#9AA4B2" opacity="0.6" transform="scale(${logoSize / 24})"/>
    </g>

  // 3. Domain text (right-aligned, unchanged)
  domain = <text x="${rightX}" y="${y + 12}" ... text-anchor="end">chapa.thecreativetoken.com</text>

  return text + logos + domain
```

**Design details:**
- Text: "Built from your commitment" in Plus Jakarta Sans, 17px, `#9AA4B2` at 0.8 opacity (same as current)
- Logos: 14px tall, `#9AA4B2` fill at 0.6 opacity (subtle, matches footer aesthetic)
- Logo order: GitHub first, then Bitbucket, then Codeberg (alphabetical after primary)
- Gap: 8px between logos, 16px between text and first logo
- Domain: unchanged (right-aligned, JetBrains Mono)

### 2. Rename `includeGithubBranding` → `includeBranding`

**Files to update:**

| File | Line | Change |
|------|------|--------|
| `apps/web/lib/render/BadgeSvg.tsx` | 11 | `includeGithubBranding?` → `includeBranding?` |
| `apps/web/lib/render/BadgeSvg.tsx` | 24 | Destructure `includeBranding` instead of `includeGithubBranding` |
| `apps/web/lib/render/BadgeSvg.tsx` | 5 | Import from `./BadgeBranding` instead of `./GithubBranding` |
| `apps/web/lib/render/BadgeSvg.tsx` | ~101 | Call `renderBadgeBranding(PAD, footerY, W - PAD, platforms)` |
| `apps/web/app/u/[handle]/badge.svg/route.ts` | Where options are built | Use `includeBranding` |
| `apps/web/app/page.tsx` | Demo badge call | Use `includeBranding` |

### 3. Pass `linkedPlatforms` into the branding function

**In `BadgeSvg.tsx`:**

```pseudo
// Extract platforms from stats (GitHub always included)
const platforms: Platform[] = ["github", ...(stats.linkedPlatforms?.filter(p => p !== "github") ?? [])];

// In demo mode, show all platforms
const brandingPlatforms = demoMode
  ? ["github", "bitbucket", "codeberg"]
  : platforms;

const brandingSvg = includeBranding
  ? renderBadgeBranding(PAD, footerY, W - PAD, brandingPlatforms)
  : "";
```

### 4. Update `demoData.ts`

**File:** `apps/web/lib/render/demoData.ts`

```pseudo
export const DEMO_STATS: StatsData = {
  ...existing fields,
  linkedPlatforms: ["github", "bitbucket", "codeberg"],  // ADD: show all in demo
  linkedPlatformLogins: {                                  // ADD: demo usernames
    bitbucket: "developer",
    codeberg: "developer",
  },
};
```

### 5. Delete old file

Remove `apps/web/lib/render/GithubBranding.tsx` after the new `BadgeBranding.tsx` is in place and all imports updated.

### 6. Tests

**Tests to update:**
- Any test asserting "Powered by GitHub" in badge output → assert "Built from your commitment"
- Any test importing from `GithubBranding` → import from `BadgeBranding`
- Any test using `includeGithubBranding` option → use `includeBranding`

**New test cases:**
- Badge with `linkedPlatforms: undefined` → shows only GitHub logo
- Badge with `linkedPlatforms: ["bitbucket"]` → shows GitHub + Bitbucket logos
- Badge with `linkedPlatforms: ["bitbucket", "codeberg"]` → shows all 3 logos
- Badge with `demoMode: true` → shows all 3 logos regardless of `linkedPlatforms`
- Badge with `includeBranding: false` → no footer branding at all

## Verification

```bash
pnpm run test --reporter=verbose 2>&1 | head -100
pnpm run typecheck 2>&1
pnpm run lint 2>&1
```

## Checklist

- [x] `GithubBranding.tsx` deleted
- [x] `BadgeBranding.tsx` created with new function
- [x] Footer renders "Built from your commitment" + dynamic platform logos
- [x] `includeGithubBranding` renamed to `includeBranding` everywhere (9 files)
- [x] Demo badge shows all 3 platform logos (demoMode overrides)
- [x] Personal badge shows only connected platform logos
- [x] GitHub logo always appears (primary platform)
- [x] Tests updated and passing (3,662 tests, 211 files)
- [x] TypeScript compiles cleanly
- [x] Lint passes
