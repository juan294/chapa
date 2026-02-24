# Phase 1: Create ConfirmDialog Component

> Parent plan: `docs/plans/2026-02-24-bitbucket-unlink-ux.md`

## Goal

Create a reusable, accessible confirmation dialog component that can be used for the Bitbucket unlink action (and any future destructive actions).

## New file: `apps/web/components/ConfirmDialog.tsx`

### Props interface

```typescript
interface ConfirmDialogProps {
  open: boolean;
  title: string;                    // e.g., "Unlink Bitbucket?"
  description: string;              // e.g., "Your Bitbucket stats will no longer..."
  confirmLabel?: string;            // default: "Confirm"
  cancelLabel?: string;             // default: "Cancel"
  variant?: "destructive" | "default"; // default: "destructive"
  loading?: boolean;                // shows spinner on confirm button, disables both
  onConfirm: () => void;
  onCancel: () => void;
}
```

### Behavior

1. Renders nothing when `open` is `false`.
2. When `open` is `true`:
   - Renders a backdrop overlay (semi-transparent, click-to-dismiss).
   - Centers a dialog card with title, description, and two buttons.
   - Traps focus inside the dialog (Tab cycles between Cancel and Confirm only).
   - `Escape` key triggers `onCancel`.
   - Clicking backdrop triggers `onCancel`.
   - Auto-focuses the Cancel button on open (safe default — destructive action requires deliberate click).
3. When `loading` is `true`:
   - Confirm button shows a small spinner and is disabled.
   - Cancel button is also disabled.

### Implementation approach

Use the native `<dialog>` element for built-in accessibility:
- `<dialog>` provides modal behavior, backdrop, focus trapping, and `Escape` handling natively.
- Use `dialogRef.showModal()` / `dialogRef.close()` via `useEffect` synced to the `open` prop.
- Style the `::backdrop` pseudo-element for the overlay.
- Add `onClose` handler to call `onCancel` when dialog is dismissed (Escape key or backdrop).

### Styling (design system tokens)

```
Backdrop:  bg-black/50 (via ::backdrop)
Card:      bg-card border border-stroke rounded-2xl shadow-xl p-6 max-w-sm w-full
Title:     font-heading text-base font-semibold text-text-primary
Desc:      font-body text-sm text-text-secondary leading-relaxed mt-2
Buttons:   flex gap-3 justify-end mt-6
Cancel:    rounded-lg border border-stroke px-4 py-2 text-sm text-text-secondary
           hover:border-amber/20 hover:text-text-primary (ghost style)
Confirm:   rounded-lg px-4 py-2 text-sm font-semibold text-white
           variant="destructive": bg-terminal-red hover:bg-terminal-red/80
           variant="default": bg-amber hover:bg-amber-light
```

## New file: `apps/web/components/ConfirmDialog.test.tsx`

### Test cases (write FIRST)

1. **Does not render when `open` is `false`** — no `<dialog>` in DOM (or dialog not open).
2. **Renders dialog content when `open` is `true`** — title, description, both buttons visible.
3. **Calls `onCancel` when Cancel button is clicked**.
4. **Calls `onConfirm` when Confirm button is clicked**.
5. **Calls `onCancel` when Escape key is pressed** (native `<dialog>` behavior).
6. **Confirm button uses `confirmLabel` prop** (custom label).
7. **Cancel button uses `cancelLabel` prop** (custom label).
8. **Destructive variant styles confirm button with `terminal-red`** — check class.
9. **Loading state disables both buttons** — both have `disabled` attribute.
10. **Dialog has accessible role and labels** — `role="alertdialog"`, `aria-labelledby`, `aria-describedby`.

### Testing approach

Use `@testing-library/react` with `render`, `screen`, `fireEvent`. Mock `HTMLDialogElement.prototype.showModal` and `.close` since jsdom does not support `<dialog>` natively.

## Verification

```bash
# Automated
pnpm run test -- apps/web/components/ConfirmDialog.test.tsx
pnpm run typecheck
pnpm run lint
```

## Success criteria

- [x] All 10 test cases pass
- [x] `pnpm run typecheck` clean
- [x] `pnpm run lint` clean
- [ ] Component renders correctly (manual spot-check in dev server after Phase 2 integrates it)
