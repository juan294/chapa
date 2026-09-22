# Phase 2 — Ice Terminal SVG and compatibility

Parent: [implementation plan](../2026-09-05-chapa-redesign.md). Dependency: Phase 1. Not batch-eligible.

## Result

The one production SVG renderer expresses the approved clean-header Ice Terminal design, with an explicit new design version. Existing saved palettes remain valid. SVG, PNG, Studio preview and localized labels describe the same artifact.

## Files and evidence

- `packages/shared/src/types.ts:274`, `packages/shared/src/types.ts:314`, `packages/shared/src/types.ts:325`; `apps/web/lib/validation.ts:98`, `apps/web/lib/validation.ts:131`; `apps/web/lib/db/studio.ts:179`; `apps/web/lib/render/badge-config.ts:35`: palette/default compatibility.
- `apps/web/lib/render/BadgeSvg.tsx:84`, `apps/web/lib/render/theme.ts:86`, `apps/web/lib/render/badge-effects.ts:64`, `apps/web/lib/render/BadgeBranding.tsx:50`, `apps/web/lib/render/VerificationStrip.ts:46`, `apps/web/lib/render/badge-render-variant.ts:8`: renderer and version.
- `apps/web/lib/render/badge-i18n-strings.ts:26`, `apps/web/lib/render/badge-locale.ts:48`; EN/ES dictionaries; `apps/web/app/[locale]/page.tsx:40`: new labels and locale-specific landing render.
- `apps/web/app/studio/studio-options.ts:6`, `apps/web/app/studio/studio-config-string.ts:1`, `apps/web/app/studio/studio-command-config.ts:1`: additive option, command/schema consumers.
- `apps/web/lib/render/badge-svg-cache.ts:86`, `apps/web/lib/render/badge-svg-cache.ts:101`, `apps/web/lib/render/badge-svg-cache.ts:112`; SVG/OG route and metadata callers; `apps/web/components/BadgeOverlay.tsx:24`: integration.
- `apps/web/lib/render/font-files.ts:45`, `apps/web/lib/render/svg-to-png.raster.test.ts:89`, `apps/web/lib/render/badge-effects.test.ts:21`, `scripts/badge-reference.ts:27`: real raster output and historical locks.

## Changes (pseudocode)

```text
BadgePalette += "ice"; existing palette IDs and values stay valid
DEFAULT_BADGE_CONFIG.colorPalette = "ice"  // same seven categories
withDefaultBadgeConfigKeys(stored):
    missing colorPalette -> "jade"         // historical saved-row meaning
    other missing known keys -> existing behavior
    retain renameLegacyBadgeConfigKeys + retired-key stripping order
    explicit palette wins; unknown/extra/malformed values still rejected
no-row/new/reset default -> Ice; unavailable/invalid -> same fallback semantics

theme("ice"):
    bg #0C141B; card #14222D; accent #BAD9E8; accentLight #DFEDF4
    textPrimary #F1EEE7; textSecondary #ABBAC3; stroke tint(.22)
    accentRgb "186, 217, 232"; derive all heatmap/effect tints from it
    optional theme definition text/stroke fields use existing defaults for old palettes
badgeTheme default + historical WARM_AMBER default alias -> Ice consistently

renderBadgeSvg:
    apply approved geometry inside existing renderer/builders
    header Y80; mono name 32/700; no decorative + PROFILE header
    metric row Y173, radius3; outer plate/frame radius4/3
    heatmap origin (60,246), scale .86; keep 13x7 chronological cells
    radar center X930/Y310, radius68; score Y466/radius46
    numbered activity/impact headings + heatmap caption from strings
    footer/theme text and explicit reviewed opacities in builders
    stable data-element="score" regardless of animation
    direct layout/effect parameters, never post-render replaceAll adapters

BADGE_RENDER_VARIANT = "ice-terminal-v2"
SVG key continues using variant
OG key = og-image:v5:<handle>:<variant>:<date>:<locale>
OG metadata/version = <variant>-<date>-<default-or-revision>
retain revision fencing, locale separation and awaited handle-wide invalidation

BadgeI18nStrings += activityHeading, heatmapCaption, impactHeading
buildBadgeI18nStrings resolves all three from both dictionaries
landing route generates SVG inside Home from locale params + translated strings
overlay coordinates follow new geometry; same 11 descriptions/hotspot semantics
```

The badge retains browser-loadable and bundled Plus Jakarta for metric/footer/tier text and JetBrains for identity/score. Do not remove those faces/files while replacing app body fonts; verify literal SVG family resolution independently of Next variables. Keep purity, XML escaping, static fully visible first frame, zero-Craft presence, empty radar marker, every effect option, canonical platform ordering, branding toggle, real seal link and sample disclosure.

Preserve the existing `jade-v1` byte/hash values and a reference SVG as historical artifacts before updating current-output tests. Add a design-version record at `docs/decisions/2026-09-05-ice-terminal-badge.md`, referencing the baseline commit and reviewed new plain/demo/static hashes. Do not introduce a second runtime renderer. Tests of old Jade palette values remain; tests of the old global layout move to historical reference assertions, not current-output expectations.

For the rotated landing wrapper, rotate SVG and hotspot layer together; use each actual hotspot element's viewport rectangle to position portal tooltips, rather than treating the rotated container's bounding box as an unrotated coordinate system. Keep pointer/touch behavior and the existing non-tabbable hotspots with always-present screen-reader descriptions.

## Automated success criteria

- [x] New/default Ice, explicit saved Jade/other palettes, old missing-palette rows and legacy `palette` alias produce the intended config without input mutation.
- [x] Schema remains seven keys; invalid/extra fields rejected; Studio options, `/set palette ice`, summaries, presets and WebMCP all recognize the additive palette.
- [x] Every existing badge effect/palette/data/escaping/motion test passes under the new explicit version; all six palettes render.
- [x] Source-level forbidden CSS variables/bare tint literals and same-input determinism guards remain.
- [x] English/Spanish new headings and tier strings reach actual SVG on landing and Studio; locale cache separation remains.
- [x] SVG+OG cache keys and metadata version include variant; revision fencing/invalidation tests pass.
- [x] Real PNG glyph-pixel tests still detect name/score text, using stable score marker; 1200px and 600px exports are complete.
- [x] Overlay tests preserve all 11 descriptions and interaction behavior; parent gate commands pass.

Focused commands (sequential):

```sh
pnpm exec vitest run packages/shared/src/badge-config.test.ts apps/web/lib/validation.test.ts apps/web/lib/db/studio.test.ts apps/web/lib/render/badge-config.test.ts apps/web/app/studio/studio-options.test.ts apps/web/app/studio/studio-config-string.test.ts apps/web/app/studio/studio-command-config.test.ts apps/web/app/studio/useStudioCommands.render.test.ts apps/web/app/studio/useStudioWebMcpTools.test.ts apps/web/app/api/studio/config/route.test.ts
pnpm exec vitest run apps/web/lib/render apps/web/components/BadgeOverlay.test.tsx apps/web/components/BadgeOverlay.render.test.tsx 'apps/web/app/u/[handle]/og-image/route.test.ts' 'apps/web/app/[locale]/page.render.test.tsx' apps/web/app/studio/BadgePreviewCard.render.test.tsx apps/web/lib/i18n/dictionaries/parity.test.ts
pnpm run generate:badge-reference
```

## Manual visual success criteria

- [x] Approved clean identity header, square metric treatment, divided data layout and readable footer match the reference.
- [x] All archetypes, 4/5 axes, Craft=0, empty data, long/missing names, verification/sample, platforms and effect options remain complete.
- [x] Ice on both page themes; explicit Jade remains Jade. Inspect all palette archetype/verification contrasts on actual pill grounds.
- [x] Inline and `<img>`/PNG paths remain complete at 1200px and 600px; rotated overlay targets and tooltip positions match the artifact.
- [x] Version record, current SVG hashes and regenerated reference image are reviewed together.

Stop after presenting badge/version/compatibility evidence. Phase 3 introduces the separate Elite landing fixture.

Implementation evidence: [Phase 2 report](evidence/phase2/report.md).
