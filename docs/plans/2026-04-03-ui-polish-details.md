# UI Polish: Details That Make Interfaces Feel Better

> **Date:** 2026-04-03
> **Source:** [jakub.kr — Details That Make Interfaces Feel Better](https://jakub.kr/writing/details-that-make-interfaces-feel-better)
> **Branch:** `feature/ui-polish-details` (worktree)
> **Status:** COMPLETE

## Summary

Apply 9 targeted UI polish improvements from the article to Chapa's web app. These are small, compounding details that individually are subtle but together significantly elevate perceived quality. No new features — pure visual/interaction refinement.

## Scope

All changes are CSS/className/component-level. No API changes, no data model changes, no new dependencies. Every phase touches only `apps/web/` files.

## Phase Overview

| Phase | Title | Files touched | Batch-eligible? |
|-------|-------|---------------|-----------------|
| 1 | Tabular numbers on public scores | 4 components | [batch-eligible] |
| 2 | Text wrap balance on headings | 5 pages + 1 component | [batch-eligible] |
| 3 | Avatar image outlines | globals.css + 2 components | [batch-eligible] |
| 4 | Layered shadow tokens | globals.css + design-system.md | No (foundation for P5) |
| 5 | Layered shadows on data cards | 6 components | No (depends on P4) |
| 6 | Icon transition animations | 4 components | [batch-eligible] |
| 7 | useAnimatedUnmount hook + exit animations | 1 hook + 4 components | No (hook first, then components) |
| 8 | QuickControls smooth expand/collapse | 1 component | [batch-eligible] |
| 9 | Optical icon+text button alignment | 3 files | [batch-eligible] |

**Batch groups:**
- **Batch A** (no interdependencies): Phases 1, 2, 3, 6, 8, 9
- **Sequential B**: Phase 4 → Phase 5
- **Sequential C**: Phase 7 (hook then consumers)

## Concentric Border Radius — Deferred

After auditing the codebase, concentric border radius adjustments are deferred from this plan. Reason: Chapa's nesting relationships are mostly single-level (card content inside card), and the existing `rounded-xl` (12px) + `rounded-lg` (8px) pairing already approximates the concentric formula for typical padding values (16px card padding: outer 12px ≈ inner 8px + padding 4px is close). The visual improvement would be marginal compared to effort, and enforcing the formula project-wide would add maintenance burden. If a future redesign introduces deeper nesting, revisit then.

## Design System Updates

Phase 4 adds new tokens to `globals.css` and documents them in `docs/design-system.md`:
- `--shadow-card` — layered transparent shadow for data cards
- `--shadow-card-hover` — elevated version for hover states
- `.img-outline` — utility class for avatar/image outlines

## Testing Strategy

Each phase adds tests to the existing test files for the modified components. Tests verify:
- CSS class presence (source-level assertions, matching existing test patterns)
- Accessibility attributes preserved
- Behavioral correctness (animation states, visibility toggles)

No new test files — all assertions go into existing `*.test.tsx` files.

## Risk Assessment

- **Low risk overall** — all changes are visual/CSS. No logic changes, no API changes.
- **Moderate risk in Phase 7** — the `useAnimatedUnmount` hook introduces a timing-based unmount delay. Must ensure components still respond correctly to rapid open/close toggles.
- **Exit animation timing** — 300ms delay before unmount means the component is briefly visible after state changes to "closed". Tests must account for this.

## Phase Files

- [Phase 1: Tabular numbers](2026-04-03-ui-polish-details-phases/phase-1.md)
- [Phase 2: Text wrap balance](2026-04-03-ui-polish-details-phases/phase-2.md)
- [Phase 3: Avatar image outlines](2026-04-03-ui-polish-details-phases/phase-3.md)
- [Phase 4: Layered shadow tokens](2026-04-03-ui-polish-details-phases/phase-4.md)
- [Phase 5: Layered shadows on data cards](2026-04-03-ui-polish-details-phases/phase-5.md)
- [Phase 6: Icon transition animations](2026-04-03-ui-polish-details-phases/phase-6.md)
- [Phase 7: Exit animations](2026-04-03-ui-polish-details-phases/phase-7.md)
- [Phase 8: QuickControls smooth expand](2026-04-03-ui-polish-details-phases/phase-8.md)
- [Phase 9: Optical icon+text alignment](2026-04-03-ui-polish-details-phases/phase-9.md)
