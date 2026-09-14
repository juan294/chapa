# Chapa Badge SVG Design

Implementation: `apps/web/lib/render/BadgeSvg.tsx`. One pure renderer produces the SVG used by Creator Studio, public badges, share pages and PNG rasterization. It returns an escaped, deterministic 1200×630 document; app CSS and page theme do not determine badge colors.

## Design versions

| Version | Contract |
| --- | --- |
| Historical v1/v2 | Four-axis radar; v2 added a standalone Craft footer pill. |
| Historical v3 | Five-axis radar when Craft is present; removed the standalone Craft pill. |
| `jade-v1` | Prior reviewed global layout; retained as a historical reference under `docs/design/chapa-redesign-reference/badge-lab/jade-v1.svg`. |
| `ice-terminal-v2` | Current global layout: clean monospace identity, numbered activity/impact sections, square metric treatment, divided two-column body and Ice default. |

`BADGE_RENDER_VARIANT` lives in `lib/render/badge-render-variant.ts` and is emitted as `data-badge-design`. This versions the layout for every palette. Choosing Jade preserves its colors within the current layout; it does not select a historical renderer.

## Configuration and palette compatibility

`BadgeConfig` has seven fields: `background`, `cardStyle`, `border`, `scoreEffect`, `heatmapAnimation`, `tierTreatment`, and `colorPalette`. Every field reaches the SVG. The six palette IDs are `ice`, `jade`, `indigo`, `amber`, `crimson`, and `mono`; `/set palette` is the command alias for `colorPalette`.

New, no-row and reset configurations use Ice. Persisted configurations missing `colorPalette` normalize to Jade, preserving their historical color choice. The database read path strips retired keys, renames the legacy `palette` key, fills missing known fields, then validates. Explicit saved colors survive; unknown keys and malformed values remain invalid. Unavailable/invalid reads use the current default without permitting cache publication. No database backfill is required.

Minimal follows the current default. Premium, Holographic and Maximum retain their explicitly authored Jade palette. The `WARM_AMBER` export is a historical name for the current Ice default, as is the default result of `badgeTheme()`.

## Layout

| Element | Current geometry |
| --- | --- |
| Outer plate and border | 1200×630; plate radius 4px, inset border radius 3px. Fill, card treatment and border follow config. |
| Identity | Header center Y80; avatar center (90,80), radius 30. Name starts X132 at baseline Y74. Wordmark aligns to X1140. |
| Header rule | (60,134) to (1120,134). |
| Metric row | Center Y173; 34px-high pills with radius 3. Archetype, repositories, watchers, forks and stars; widths follow labels/counts. |
| Section labels | Baseline Y230: activity at X60, heatmap caption ending X604, impact at X719. |
| Body divider | X681 from Y211 to Y540. |
| Heatmap | Origin (60,246), scale 0.86; 13 weeks × 7 days. Source cells are 44px with 5px gaps and radius 4. |
| Radar | Center (930,310), maximum radius 68. |
| Score | Ring center (930,466), radius 46; tier baseline Y536. |
| Footer | Divider Y560, platform/logo origin Y585, text baseline Y599. |
| Verification | Separator X1145; text rotates −90° around (1168,315). |

Long names retain the complete escaped identity, using SVG `textLength="820"` with `lengthAdjust="spacingAndGlyphs"` when their estimated monospace width exceeds the header allowance. There is no decorative `+ PROFILE` heading.

The heatmap has 91 chronological cells and five intensities derived from the selected palette. The radar has four axes when Craft is absent and five when present, including Craft=0. Guide polygons show 25%, 50%, 75% and 100%; all-zero data retains a center marker and a localized no-data label. The score displays `adjustedComposite`, with its existing tier; this renderer does not change scoring.

## Colors

`lib/render/theme.ts` owns palette definitions. Each defines one `accentRgb`; `theme.tint(alpha)` derives translucent accent uses. No app CSS variables or independent `rgba(...)` accent literals belong on the render path.

| Ice role | Value |
| --- | --- |
| Background | `#0C141B` |
| Card | `#14222D` |
| Primary text | `#F1EEE7` |
| Secondary text | `#ABBAC3` |
| Accent | `#BAD9E8` |
| Light accent | `#DFEDF4` |
| Stroke | `theme.tint(0.22)` |
| Heatmap levels 0–4 | `theme.tint(0.12 / 0.30 / 0.48 / 0.68 / 0.92)` |

Tier colors use the selected theme: Emerging uses secondary text, Solid primary text, High light accent, and Elite accent. The five preexisting palettes retain their authored background, card, accent and text values; Ice adds its own text/stroke fields.

Archetype colors remain semantic and independent of the palette. Archetype pills use the selected opaque background to preserve their contrast.

| Archetype | Color |
| --- | --- |
| Builder | `#009F6D` |
| Quality Champion | `#B464AE` |
| Marathoner | `#479C4D` |
| Polymath | `#8C8C00` |
| Balanced | `#0A8FD1` |
| Emerging | `#C7692C` |
| Artificer | `#B67700` |

Verification uses the separate `VERIFICATION_CORAL` value from `lib/badge-visual-metadata.ts`, regardless of palette. Contrast checks measure actual fills and text opacity, including the composited metric/platform treatments.

## Typography and localization

Fonts are referenced by literal family names in SVG, not embedded font data or CSS variables. Browser CSS loads canonical Plus Jakarta Sans and JetBrains Mono faces from public assets; resvg reads the corresponding bundled TTF files through `lib/render/font-files.ts`. App body Manrope and display Barlow Condensed do not replace badge typography.

| Text | Font and size |
| --- | --- |
| Identity | JetBrains Mono, 32px/700 |
| Status line | Plus Jakarta Sans, 19px |
| Wordmark | JetBrains Mono, 22px |
| Archetype | Plus Jakarta Sans, 17px/600 |
| Metric counts/labels | Plus Jakarta Sans, 14px |
| Activity/impact headings | JetBrains Mono, 14px |
| Heatmap caption | JetBrains Mono, 12px |
| Radar labels / empty label | Plus Jakarta Sans 13px / JetBrains Mono 11px |
| Score | JetBrains Mono, 52px (48px for three-digit scores)/700 |
| Tier / footer | Plus Jakarta Sans, 17px; footer domain uses JetBrains Mono 17px |
| Verification/sample strip | JetBrains Mono, 14px/500, full text opacity |

`buildBadgeI18nStrings` supplies English/Spanish headings, caption, metric status, radar labels, tier and verification/sample copy to both browser and server render callers. The numbered headings are `01 / ACTIVITY` / `01 / ACTIVIDAD` and `02 / IMPACT` / `02 / IMPACTO`; the caption is `13 WEEKS × 7 DAYS` / `13 SEMANAS × 7 DÍAS`. Missing optional strings fall back to English. The locale landing route renders its demo with its own translated bundle. Metric abbreviations, archetype values and the branding tagline retain their existing renderer text.

## Animation and static embedding

Heatmap animation retains six deterministic reveal orders. Default `fade-in` is the column sweep (60ms per week), while `cascade` is its slower 120ms-per-week counterpart; other values are diagonal, ripple, scatter and waterfall. Animated cells reveal over 0.4s. `disableAnimation: true` produces fully visible heatmap cells without SMIL and removes moving effect elements for static SVG/PNG paths.

The standard score has a three-second opacity pulse; the ring has a one-shot 1.2-second reveal after 0.5 seconds. Reduced motion disables the score pulse; the existing one-shot ring behavior remains. Other score, background, card, border and tier effects are compiled by pure builders in `badge-effects.ts`, with static alternatives. `data-element="score"` identifies the score independently of its effect or animation state.

## Branding, verification and accessibility

`includeBranding` controls the footer rendered by `BadgeBranding.tsx`. Personal badges show GitHub and linked platforms; demos show all four, always ordered GitHub, Bitbucket, Codeberg, GitLab. Platform metadata is shared with Studio rather than duplicated.

Real verification requires both hash and date, and the strip links to `/verify/<hash>` when used inline. A demo instead displays its sample disclosure without a verification link. Static output includes an image role, title and description. User-controlled identity, strings and verification values are XML-escaped. Inline consumers provide their surrounding accessible context; `BadgeOverlay` retains eleven always-present descriptions and non-tabbable hotspots. Its stable SVG markers locate rendered elements, and portal tooltips use each actual hotspot's viewport rectangle so a rotated badge keeps its tooltip alignment.

## Image identity and caching

SVG keys include the render variant and locale. PNG keys are `og-image:v5:<handle>:<variant>:<date>:<locale>`, with lowercased handles. OG metadata and stored PNG envelopes use `<variant>-<date>-<default-or-rN>`; unavailable metadata gets an uncached version. Revision fencing and awaited all-locale SVG/OG invalidation remain shared in `badge-svg-cache.ts`. Local rendering does not purge previously served remote image responses.
