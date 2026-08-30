# One badge artifact: `renderBadgeSvg` consumes `BadgeConfig`

Date: 2026-08-30
Status: Accepted (direction); implementation tracked separately
Issue: #1191 (AR-S1)

## Context

The badge exists twice.

`renderBadgeSvg()` is the real one: a pure server-side function that returns an
SVG string. Seven surfaces consume it — the badge route, the share page, the OG
image route, the landing page, the archetype guides, and the warm-cache cron.

Creator Studio consumes none of it. `/studio` imports exactly two things from
`lib/render`: the demo fixtures and the theme constants. Its preview is
`components/badge/BadgeContent.tsx`, a parallel React DOM implementation. Every
visual element exists twice and is maintained twice — the heatmap alone is 105
lines in the SVG renderer against 344 in the DOM one.

The nine Studio customization categories live in `lib/effects/` (~1,689 lines)
and the SVG renderer cannot consume any of them. So a user who spends ten
minutes tuning nine categories is adjusting a lookalike, and the badge they
embed is unchanged. The Studio copy does say preview changes never affect the
public badge, so nothing is being misrepresented — but the product invites
customization that has no path to the artifact being customized.

## Decision

**One artifact.** `renderBadgeSvg` becomes the single renderer and learns to
consume `BadgeConfig`. `BadgeContent` retires to a thin preview wrapper over the
same output rather than a second implementation of it.

The principle this serves: *the badge is one thing.* Whatever is rendered —
in Studio, on the share page, in a README, in a social card — is the same
artifact produced by the same code from the same inputs. A preview that can
disagree with the shipped badge is a preview that will eventually be wrong.

## What can actually cross, and what cannot

This is the honest part, and it is narrower than a first look suggests. An SVG
can express gradients, filters and SMIL animation; it cannot express a pointer,
a scroll position, or a JavaScript loop.

| Category | Crosses to the SVG? | Why |
|---|---|---|
| `background` (solid, aurora, particles) | Yes | Gradients and `feTurbulence` |
| `border` (solid, rotating gradient, none) | Yes | SMIL can rotate a gradient transform |
| `scoreEffect` (7 values) | Yes | Gradients and filters |
| `heatmapAnimation` (6 values) | Yes | SMIL `begin` offsets; the badge already animates its heatmap |
| `tierTreatment` (standard, enhanced) | Yes | Static marks, or SMIL |
| `cardStyle` (flat, frost, smoke, crystal, aurora-glass) | **Partly** | The glass looks rely on backdrop blur, which SVG has no equivalent for. Approximations only, and they will not match the DOM version exactly |
| `interaction` (3D tilt, holographic hover) | **No** | Requires a pointer |
| `statsDisplay` (counting animations) | **No** | Requires a JS loop |
| `celebration` (confetti on load) | **No** | "On load" is meaningless for a cached image served to every viewer |

So five categories cross cleanly, one crosses partially, and three cannot cross
at all. The three that cannot are not failures to fix — they are on-page
enhancements, and Studio should label them as such rather than presenting them
beside categories that ship.

## Invariants that must survive

These are the reasons the two implementations diverged in the first place, and
none of them is negotiable:

1. **Purity and determinism.** `renderBadgeSvg` must stay a pure function.
   That is what makes the SVG cacheable per handle/day/locale and what lets
   `svg-to-png.ts` rasterize it. Adding `BadgeConfig` as an *input* preserves
   purity; reading it from a store inside the renderer would destroy it.
2. **The escaping boundary.** The SVG path escapes user-controlled text itself
   via `escapeXml`, because the result is injected through
   `dangerouslySetInnerHTML` at three sites (the landing page, the archetype
   guides, and the share page's inline render). React's auto-escaping does not
   apply there and cannot substitute for it.
3. **Always dark, no CSS custom properties.** The badge renders server-side
   before app CSS exists. Effects must compile to literal values, not tokens.
4. **Static rasterization.** The OG image route passes `disableAnimation: true`
   because SMIL never runs during rasterization. Every animated effect needs a
   defined static first frame, or social cards render blank elements.
5. **The default must not move.** `DEFAULT_BADGE_CONFIG` has to produce
   byte-identical output to today's renderer. Otherwise every existing cached
   badge and every embedded README image changes the day this ships. This is
   directly testable and should be the first test written.

## Versioning

The badge is a published artifact, so its design is versioned: **whenever an
element of the badge design changes, that is a new version of the badge
design.** Two axes, and both already have machinery:

- **Design version (global).** `BADGE_RENDER_VARIANT` in
  `lib/render/badge-svg-cache.ts`, already part of the badge cache key. It
  currently reads `"warm-amber-v3"` — a name inherited from a palette the app
  left two rebrands ago. It is the right hook and it needs a bump discipline:
  change a design element, bump the variant, in the same commit.
- **Config revision (per user).** `studio_config.revision`, a database-ordered
  monotonic counter added by migration `035` and validated by
  `dbGetStudioConfig`. Nothing outside that module consumes it today.

**Once config affects the render, the config revision MUST enter the badge
cache key.** Without it a user saves a change and keeps being served the badge
built from their previous config until the day rolls over. That single line is
the difference between this working and this being a bug report.

The verification seal is unaffected and should stay that way: it covers
`stats + impact + date`, never the rendering. The seal attests that the numbers
are real, not that the badge is pretty. Styling changes must not invalidate it.

## Known divergence, tracked separately

The badge still carries the pre-jade violet accent and archetype colours
(`lib/render/theme.ts`), which `lib/render/theme.test.ts` currently records as
intentional. Under "one artifact" that divergence stops being intentional and
becomes a defect: the same badge cannot be jade in Studio and violet when
embedded. Converging it is its own piece of work and is deliberately not part
of this decision.

## Consequences

- Studio stops being a lookalike and becomes a preview of the real thing.
- `lib/effects/` splits: the five-and-a-bit categories that cross become SVG
  effect builders consumed by the renderer; the three that cannot stay
  DOM-only and are labelled as on-page enhancements.
- `BadgeContent` shrinks to a wrapper. The duplicate heatmap, radar, tier and
  footer implementations go away, which is the maintenance win.
- The work is a project, not a change. It should be sequenced behind the
  byte-identical-default test, then category by category, so each step is
  independently verifiable against a real badge.
