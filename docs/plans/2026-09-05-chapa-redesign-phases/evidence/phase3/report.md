# Phase 3 — Landing and developer shell evidence

The commit containing this report records the reviewed implementation after
`b3523b12`. No push, deployment or remote service mutation occurred.

## Local checks

Final sequential checks in sanitized local environment (`logs/redesign/phase3-final-*`):

| Command | Result | Seconds |
| --- | --- | ---: |
| `pnpm run typecheck` | exit 0 | 3.2 |
| `pnpm run lint` | exit 0 | 10.4 |
| `pnpm run test` | exit 0, 519 files / 8,575 tests | 23.5 |
| `pnpm run build` | exit 0, EN/ES landing static | 5.2 |

Browser target: freshly built worktree server `http://127.0.0.1:3001`, no
production service credentials. Chromium and mobile, one worker: landing,
landing-shell, badge-overlay, navigation, theme and static-pages suites passed
82 cases in aggregate. Four initial failures were corrected test assumptions
(scroll padding and error capitalization); their targeted rerun passed all four.
The final reduced-motion regression passed two additional cases after a real
red→green check. An isolated anonymous Studio demo browser check confirmed one
terminal and working mod+K focus. Unit checks cover Studio shortcut ownership,
save/navigation contracts, command composition and localized history/output.

## Reviewed artifacts

Eight locale/theme/1440-or-390 combinations appear in `browser.json`, with
actual loaded font families, score92, theme and no overflow. Each has viewport
and full-page screenshots, refreshed after the final build. All eight layouts
were visually reviewed, including the full-page composition. Fixed dock location
in stitched full-page images reflects browser screenshot capture; browser checks
separately establish footer clearance and visible closing-action keyboard focus.
Phase 5 extends this to 768/320 widths, zoom and the integrated route matrix.

The real renderer supplies both hero and encoded static README image from one
independent 92/Elite/Balanced sample; the shared High82 fixture is unchanged.
Simulated values are disclosed. English/Spanish copy, all seven archetype tabs,
five dimension details, real tool names, preserved enterprise/trust/footer links,
copy success/failure and theme independence were checked. All eleven tooltip
hotspots follow the actual rotated badge geometry.

Plan-compliance and reuse/quality/efficiency reviews approved after fixes for
history/autocomplete interaction, footer spacing and closing-action focus.
Visual review also exposed SMIL heatmap reveal in reduced-motion mode; inline
activity cells now paint immediately and the score ring uses its resting state.
SVG byte contracts remain unchanged. Behavioral tests were observed failing
before implementing input fill/history/command/fixture changes and the motion fix.

No local DB fixture was necessary for this phase. Authenticated persistence and
all design-sync stages remain assigned to Phases 4–5; they are not claimed here.
