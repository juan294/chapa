# Phase 6: Documentation + Cleanup

> Depends on: Phases 1–5

## Objective

Write the Impact v6 spec document, update badge design spec, add deprecation notes to v4/v5 docs, and clean up any dead code flagged by Knip.

## Changes

### 6.1 — Create `docs/impact-v6.md`

New specification document covering:

- **Motivation:** Unified scoring that captures both code output (GitHub) and tool mastery (AI insights)
- **Changes from v5:** 5th dimension (Craft), dynamic composite (4 or 5 dims), Artificer archetype, badge v3 (pentagon radar)
- **Five dimensions:** Delivery, Quality, Consistency, Breadth, Craft — with full signal tables
- **Craft dimension detail:** Powered by `computeCraftScore()` — 3 sub-dimensions (Proficiency, Effectiveness, Sophistication)
- **Composite formula:** avg of active dimensions (4 without insights, 5 with)
- **Archetype updates:** Artificer added at lowest tie-break priority
- **Badge v3:** Pentagon radar, craft pill removed
- **Type compatibility:** `DimensionScores.craft` is optional — zero migration needed
- **Expected score distribution:** Table showing impact of craft on composite for various profiles
- **Future extensibility:** Adding Cursor/Copilot = new parser, same craft scoring engine

### 6.2 — Update `docs/svg-design.md`

Add badge version history section at the top:

```markdown
## Badge Version History

| Version | Changes | Date |
|---------|---------|------|
| v1 | Original: heatmap + diamond radar + score ring | Initial |
| v2 | Branding footer + verification strip + craft pill | 2026-02 |
| v3 | Pentagon radar (5 axes), craft pill removed, unified scoring | 2026-03 |

## Current Version: v3
```

Update radar chart section to reflect pentagon geometry and dual-mode rendering (4 or 5 axes).

### 6.3 — Deprecation notes in existing docs

**`docs/impact-v4.md`** — Add at top:

```markdown
> **Deprecated:** This document describes Impact v4/v5 scoring. The current scoring system
> is **Impact v6** — see `docs/impact-v6.md`. The function is still named `computeImpactV4`
> but implements v6 logic with 5 dimensions.
```

**`docs/impact-v5.md`** — Add at top:

```markdown
> **Superseded by v6:** Impact v5 recalibrations remain in effect. v6 adds the 5th "Craft"
> dimension on top of v5. See `docs/impact-v6.md` for the current spec.
```

### 6.4 — Update `docs/plans/2026-03-07-insights-integration.md`

Add note that Craft Score is now integrated as the 5th Impact dimension (not a parallel score):

```markdown
> **Update (2026-03-08):** The Craft Score is now integrated as the 5th Impact dimension
> in v6 (see `docs/plans/2026-03-08-impact-v6-unified-scoring.md`). It is no longer a
> parallel score — it directly affects the composite and appears as a radar axis on the badge.
```

### 6.5 — Dead code cleanup

Run `npx knip` and remove any unused exports, files, or types flagged after the v6 changes. Likely candidates:

- `BadgeCraft.tsx` and test (deleted in Phase 3)
- `CraftBreakdown.tsx` and test (deleted in Phase 4)
- `CraftTier` type if no longer used anywhere
- Any orphaned imports

### 6.6 — Update CLAUDE.md

Add Craft dimension to the "Acceptance criteria" section:

```markdown
- Badge shows: heatmap, radar chart (5 dimensions when craft data exists, 4 without),
  archetype label, stars/forks/watchers, Impact tier, adjusted score.
```

Add Artificer to archetype list where archetypes are mentioned.

## Tests

No new tests in this phase — documentation only + dead code removal.

Run full verification to ensure no regressions:

```bash
pnpm run typecheck 2>&1; pnpm run lint 2>&1; pnpm run test 2>&1
```

## Success Criteria

### Automated
- [ ] `pnpm run typecheck` passes
- [ ] `pnpm run lint` passes
- [ ] `pnpm run test` passes
- [ ] `npx knip` reports no dead code related to craft/badge changes
- [ ] No references to `BadgeCraft` or `CraftBreakdown` in codebase

### Manual
- [ ] `docs/impact-v6.md` exists and is comprehensive
- [ ] `docs/svg-design.md` has badge version history
- [ ] Deprecation notes visible in v4 and v5 docs
