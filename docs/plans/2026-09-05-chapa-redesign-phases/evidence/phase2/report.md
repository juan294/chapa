# Phase 2 — Ice Terminal evidence

Implemented on `feature/chapa-redesign` after foundation commit `64320185`.
The implementation commit containing this report records the reviewed state.
No push, deployment, remote service mutation or cache purge occurred.

## Local gates

All commands used a sanitized local environment with service credentials absent.
Final sequential gate logs are under ignored `logs/redesign/phase2-complete-*`.

| Gate | Result | Seconds |
| --- | --- | ---: |
| `pnpm run typecheck` | exit 0 | 3.3 |
| `pnpm run lint` | exit 0, no warnings | 11.2 |
| `pnpm run test` | exit 0; 513 files, 8,550 tests | 24.3 |
| `pnpm run build` | exit 0; EN/ES landing remains static | 4.9 |
| `pnpm run generate:badge-reference` | exit 0; real resvg PNG reviewed | — |
| Playwright `e2e/badge-overlay.spec.ts`, Chromium/mobile, one worker | exit 0; 4 tests | 3.4 |

The final browser check targeted the freshly built server at
`http://127.0.0.1:3001`, owned by this isolated worktree. No database fixture was
needed: Phase 2 exercises the local illustrative landing. The browser tests
compare actual SVG and hotspot rectangles after a shared -3° rotation in both
locales and retain all eleven non-tabbable descriptions. Unit tests additionally
check portal anchoring from actual hotspot viewport rectangles and scroll updates.

## Artifacts and review

- `manifest.json` contains complete hashes and sizes of plain/demo/static SVGs.
  Current locks and the historical Jade locks both pass. The version ADR is
  `docs/decisions/2026-09-05-ice-terminal-badge.md`.
- English/Spanish PNGs at 1200 and 600 pixels were reviewed alongside the
  approved archived layout. All six palette PNGs retain their intended colors.
- `matrix/manifest.json` inventories 45 actual renderer PNGs: all archetypes,
  every config option, layered effects, Craft zero, empty data, long/missing
  identity, high metrics, and a verification-shaped local fixture. No genuine
  seal is claimed for fixture exports. Existing platform/escaping tests cover
  combinations and identity attacks without backend activity.
- Eight locale/theme/width screenshots and `browser.json` record the real
  browser font checks, paired grounds and no horizontal overflow. The rotation
  is a browser-only Phase 2 probe; Phase 3 owns the actual angled composition.
- Actual raster tests detect name/score glyphs at both export sizes, missing
  fonts, and score100 containment within the ring. Default score82 remains
  unchanged until the separate Phase 3 landing-only fixture is introduced.

Compliance and reuse/quality/efficiency review approved after contrast fixes.
Archetype text measures at least4.75:1 on its actual opaque pill grounds across
all six palettes. Layered background effects exposed score and seal contrast
failures: existing ring/strip now have opaque palette grounds, custom score
paints stay opaque, and Gold Leaf's darkest stop was lightened. Three-digit
score48px fits its ring; two-digit52px remains. Six-palette regressions and
actual raster containment protect these changes. Decisions are recorded in
`2026-09-05-chapa-redesign-notes.md`.

Saved-config compatibility, seven-key strict validation, additive Ice options,
localized headings, cache version/revision fencing and static SVG completeness
all pass the full suite. Remote cache freshness and design sync are not claimed;
they are outside this local phase.
