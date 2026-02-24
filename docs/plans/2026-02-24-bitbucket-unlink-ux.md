# Plan: Improve Bitbucket Unlink UX

> Date: 2026-02-24
> Research: `docs/research/2026-02-24-bitbucket-unlink-ux.md`
> Branch: `feature/bitbucket-unlink-ux`
> Phases: 2

---

## Problem

The current Bitbucket "Unlink" action in the user menu dropdown has UX issues:

1. **Layout**: The linked Bitbucket row is a `<div>` with the username, and the "Unlink" button sits below it on a separate line — visually disconnected from the row and inconsistent with other menu items.
2. **Styling**: The "Unlink" button uses `text-xs text-terminal-red`, which is smaller (12px vs 14px) and stylistically different from every other menu item.
3. **No confirmation**: Clicking "Unlink" immediately disconnects with no confirmation dialog and no feedback on success/failure.
4. **Accessibility**: The "Unlink" button lacks `role="menuitem"`, unlike every other interactive item in the dropdown.

## Design Decision

Based on competitive research (11 services analyzed) and user preference:

- **Layout**: Single-row inline — the Bitbucket row becomes a proper menu item with the username left-aligned and an "Unlink" text action right-aligned, all on one line.
- **Confirmation**: Light confirmation dialog with explanation + Cancel/Confirm buttons. Confirm button styled as destructive (red). Follows the Notion/Linear pattern.
- **Terminology**: Keep "Unlink" (matches our semantics — removing a supplemental data source, not a full disconnect).

## Target visual

```
┌──────────────────────────────┐
│ [avatar] Juan González       │
│ @juan294                     │
├──────────────────────────────┤
│ [GH icon] Your Badge         │  ← menu item
│ [BB icon] juan294   Unlink   │  ← single row, "Unlink" right-aligned, muted
│ [star]    Creator Studio     │  ← menu item
├──────────────────────────────┤
│ ...                          │
└──────────────────────────────┘
```

When "Unlink" is clicked, a small confirmation dialog appears:

```
┌──────────────────────────────────────┐
│  Unlink Bitbucket?                   │
│                                      │
│  Your Bitbucket stats will no        │
│  longer be included in your          │
│  impact score. You can re-link       │
│  anytime.                            │
│                                      │
│              [Cancel]  [Unlink]      │
│                          ^^^red      │
└──────────────────────────────────────┘
```

## Files changed

| File | Change |
|------|--------|
| `apps/web/components/ConfirmDialog.tsx` | **New** — reusable confirmation dialog component |
| `apps/web/components/ConfirmDialog.test.tsx` | **New** — tests for dialog behavior |
| `apps/web/components/UserMenu.tsx` | **Modified** — redesign Bitbucket linked row + integrate dialog |
| `apps/web/components/UserMenu.test.tsx` | **Modified** — update tests for new layout + dialog |

## Phases

| Phase | Description | Files |
|-------|-------------|-------|
| 1 | Create `ConfirmDialog` component (TDD) | `ConfirmDialog.tsx`, `ConfirmDialog.test.tsx` |
| 2 | Redesign Bitbucket row in `UserMenu` + integrate dialog (TDD) | `UserMenu.tsx`, `UserMenu.test.tsx` |

## Out of scope

- Moving linked platforms to a dedicated settings page (no settings page exists yet)
- Adding toast/snackbar feedback for success/error (can be a follow-up)
- Changing the "Link Bitbucket" (unlinked state) — it already follows menu item patterns
