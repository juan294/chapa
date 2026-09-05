# Phase 4 — Studio and remaining product surfaces

Parent: [implementation plan](../2026-09-05-chapa-redesign.md). Dependencies: Phases 1–3. Not batch-eligible.

## Result

The new identity continues through Creator Studio, share/profile, content, verification, settings/admin and transitional states. Brand assets match the page without changing existing user workflows.

## Files and evidence

- `apps/web/app/studio/StudioClient.tsx:669`, `apps/web/app/studio/QuickControls.tsx:1`, `apps/web/app/studio/BadgePreviewCard.tsx:61`, `apps/web/app/studio/studio-options.ts:6`, `apps/web/app/studio/studio-config-string.ts:1`: Studio preview/controls.
- `apps/web/app/u/[handle]/SharePageHeader.tsx:1`, `apps/web/components/dashboard/ImpactDashboard.tsx:1`, `apps/web/components/BadgeToolbar.tsx:1`, `apps/web/components/CommandBarHint.tsx:23`: profile and sharing.
- `apps/web/components/content/ContentPageHeader.tsx:1`, `apps/web/components/content/OnThisPageIndex.tsx:27`, locale-segmented About/scoring/verification/archetype/legal pages; `apps/web/proxy.ts:67` is the canonical route inventory.
- `apps/web/app/settings/SettingsClient.tsx:1`, `apps/web/components/UserMenu.tsx:1`, `apps/web/app/admin/AdminDashboardClient.tsx:1`; verify/generating/CLI authorize/coming-soon routes and existing `loading.tsx`/`error.tsx`/`not-found.tsx` surfaces.
- `apps/web/public/favicon.svg:1`, `apps/web/public/site.webmanifest:1`, `apps/web/app/icon.tsx:1`, `apps/web/app/apple-icon.tsx:1`, `apps/web/public/logo-512.png`, `apps/web/app/og-image/route.ts:33`: non-CSS brand assets.

## Changes (pseudocode)

```text
Studio presentation:
    apply shared paper/charcoal surfaces, neutral rules, sharp panel treatment
    keep badge stage full width; Fit/50%/100% + shrink-0 scrolling frame
    Quick Controls and session tools remain separate below preview
    preserve visible save/reset outside collapsed controls
    commands/metadata/labels remain monospace; body copy uses Manrope
    use actual Ice/Jade/etc swatches from badgeTheme
    preserve selection, dirty/persisted snapshot, unsaved guard, save races,
             locale/history state, human-confirmed WebMCP save and API contract

each remaining route:
    adopt shared tokens/components before adding any local styling
    inspect old hardcoded green/gradient/glow/corner treatments
    replace only visual brand remnants; retain semantic success/chart colors
    retain data, ownership/redaction, auth gates, forms, links and actions
    use restrained layout/type on dense settings/admin and long-form content
    keep sticky section index IDs and navigation behavior
    carry same styling to loading, error, empty and not-found views

brand assets:
    preserve existing Chapa mark geometry; recolor to approved ink/vermilion/ice
    update favicon, manifest colors, dynamic icon and apple icon
    regenerate logo-512 from reviewed vector source with existing raster tools
    app OG card uses approved static palette and existing bundled font families
    do not introduce font-family names absent from resvg's fontFiles
```

This phase restyles product presentation; it does not redesign scoring explanations, weaken confidence redaction, change account connections/import behavior, add an admin workflow or remove legal content. The signature pill stays where the global terminal is mounted; Studio retains its own terminal.

Use the route matrix in the rubric to document every surface. Token inheritance can satisfy a route when it is visually coherent; avoid mechanical replacement across every class occurrence. Scope a local override only to a visible mismatch, retaining shared components as the primary source.

## Automated success criteria

- [ ] Studio preview still equals real renderer output for config/locale; zoom never enters save JSON; save/reset/dirty/error/history behavior remains covered.
- [ ] Localized Ice option and existing palette labels/descriptions/swatches remain coherent; existing saved colors survive.
- [ ] Share visitor payload still redacts confidence; owner actions, verification links, clipboard/download and terminal hint work.
- [ ] Settings/admin/verify/content/transitional render tests pass; no feature/auth guards are removed to obtain screenshots.
- [ ] Icon and real OG raster tests pass with complete glyphs; no dependency/font-loader regressions.
- [ ] Parent gate commands pass sequentially.

Focused checks:

```sh
pnpm exec vitest run apps/web/app/studio apps/web/app/settings apps/web/app/admin apps/web/components/dashboard apps/web/components/UserMenu.render.test.tsx apps/web/components/content apps/web/components/CommandBarHint.shortcuts.test.tsx 'apps/web/app/u/[handle]/SharePageHeader.render.test.tsx' apps/web/app/verify apps/web/app/icons.render.test.tsx apps/web/lib/render/svg-to-png.raster.test.ts
```

Against the reviewed local server:

```sh
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001 pnpm --filter @chapa/web exec playwright test e2e/static-pages.spec.ts e2e/share-page.spec.ts e2e/verify-detail.spec.ts e2e/generating-locale.spec.ts --project=chromium --project=mobile --workers=1
```

Authenticated browser evidence uses local fixtures only. Create the reusable `apps/web/e2e/helpers/redesign-fixtures.ts` bootstrap and test-process-only `redesign-upstream.mjs` preload specified in Phase 5 before this phase's data-dependent browser matrix. They use existing fixture builders/local session setup, seed only disposable local data, replay known upstream responses and fail unexpected external requests. Required profile/Studio cases assert actual content; an early-return smoke test does not count. Phase 5 reuses this setup. Existing `journey.spec.ts` writes data and requires local Supabase; run its full persistence journey through the Phase 5 gate. Use render tests and a locally enabled anonymous Studio demo for early visual work, recording coverage boundaries.

## Manual visual success criteria

- [ ] Studio EN/ES × light/dark × desktop/mobile matrix passes, including expanded/collapsed controls, long command/config text, zoom and save-error state.
- [ ] Share/profile, verify, About/scoring/archetype, legal, settings/admin, loading/error/empty states form one coherent product.
- [ ] Dense product controls remain legible; content pages do not inherit oversized hero typography.
- [ ] Favicons/icons/manifest/default social card match the new brand; both website themes still frame the independently dark badge correctly.

Stop after presenting surface coverage and remaining integration evidence.
