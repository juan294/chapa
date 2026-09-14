# Phase 6 — Badge, fifth Craft axis and consistent human-facing breakdown

Depends on phase5. Sequential. Closes FE-B1 and UX-M1. This is a scoring-content correction, not another visual redesign.

## Files

`apps/web/lib/render/BadgeSvg.tsx`, badge renderer types/helpers and `badge-view-model.test.tsx`; `apps/web/components/SharePageOwnerContent.tsx`/Lazy; `components/dashboard/ImpactDashboard.tsx`, dimension row/cards, coaching, score/receipt explanation and activity labels; `apps/web/app/u/[handle]/page.tsx`; Studio client/preview/page; dashboard score-description/generate-insights/receipt-explanation; EN/ES dictionaries and current methodology/sample generators; associated render tests. The shared projection is established in phase5; extend it centrally if a missing presentation fact is found, never rederive in a component.

Current anchors: `apps/web/lib/render/BadgeSvg.tsx:226`, `apps/web/components/SharePageOwnerContent.tsx:187`, `apps/web/app/studio/StudioClient.tsx:764`, `apps/web/lib/i18n/dictionaries/en.ts:1233`.

## Changes / pseudocode

```text
model = project(resolved exact receipt)
axes = model.fourCoreDimensions
if model.craft.status == scored: axes += craftPoint // including zero
if model.craft.status == unlocked_unavailable: preserve labeled unavailable slot
badge(model, axes)
dashboard(model)
receiptExplanation(model.explanation)
StudioPreview(model, same renderer)
```

Core-weight keys remain a separate constant of exactly four. Remove the v6-only fifth-axis gate, not the Craft axis itself. Optional fifth card/axis is visually part of the same familiar badge, while copy explains it does not enter the core average. No report has four axes; valid zero-report result has five and a measured0 vertex. Expired/unavailable Craft is not plotted as fake0; display the policy's update/historical state without concealing prior unlock. Exercise resvg/OG rendering of these states.

Replace legacy `ImpactDashboard` score inputs with the shared policy projection. Data-source activity counts may remain descriptive stats, but any dimension/tier/archetype/points-to-next-tier/trend comparison must come from current policy/context. No legacy Builder, Craft83 or '5 points to Elite' is allowed beside the new owner46 receipt. Nullable archetype suppresses archetype-specific prose; do not decide a new eligibility rule here.

Coaching uses actual current inputs and point values. If a criterion has no credited observations, explain evidence contribution, not developer inadequacy. If a target's required observations cannot be computed under a supported pure simulation, omit that numeric promise rather than inventing one. Dates, report coverage and point precision match the receipt. A dimension's display rounding is not used to recompute the core; show exact trace when expanded.

Keep Craft's familiar visible name and optional fifth card. Its detail shows report outcome-credit math, report period and classified coverage; do not repopulate legacy proficiency/sophistication sub-scores with fabricated equivalents. No new archetype names or report-derived Master/Expert labels.

Correct Studio subtitle in EN/ES: edits preview locally until Save; Save updates public badge/share/OG. Demo mode must not imply publication. Preserve save snapshots, dirty-state race handling, Fit/50%/100% behavior, unsaved guard and proposal-confirmation UX.

Update current sample data/methodology descriptions to new policy, with explicit illustrative labels where not backed by a real receipt. Keep legacy historical explanations clearly identified. Avoid changing layout/palette/font tokens or the user's independent design-sync work.

## Automated acceptance

C02–C03, C07, C17–C18, C23–C24. Cross-surface render fixture has deliberately contradictory legacy fields (Builder,80,Craft83) alongside new receipt(core46, nullable archetype, Craft57); only receipt values appear as current. Core46 remains46 after Craft unlock while radar/card becomes five dimensions. Valid Craft0 still displays. New current UI prints no score range; historical verification retains old receipt interpretation.

```sh
pnpm exec vitest run apps/web/lib/render/badge-view-model.test.tsx apps/web/components/SharePageOwnerContent.render.test.tsx apps/web/components/dashboard/ImpactDashboard.test.tsx apps/web/app/studio/StudioClient.render.test.tsx apps/web/lib/i18n/dictionaries/parity.test.ts --no-file-parallelism
pnpm run typecheck
pnpm run lint
pnpm run test
```

Add the actual renderer/coaching/explanation tests needed for new states; tests must assert numeric content and identities, not only mounting or component count. Rasterize a representative four-axis badge, five-axis57 badge, five-axis0 badge, boundary decimal and expired Craft state locally.

## Manual acceptance / stop

Compare one page top-to-bottom with its receipt; then Studio and rasterized OG. Inspect Spanish320px and normal phone width, both themes, for score fit/Craft axis/card and neutral archetype state. Save one palette and restore it. Do not repeat the full previous visual matrix. Stop with screenshots and a short pass/fail table; production remains untouched.
