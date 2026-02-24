# Phase 2: Redesign Bitbucket Row + Integrate Confirmation Dialog

> Parent plan: `docs/plans/2026-02-24-bitbucket-unlink-ux.md`
> Depends on: Phase 1 (ConfirmDialog component)

## Goal

Redesign the Bitbucket linked-state row in `UserMenu.tsx` to be a single-line menu item with the "Unlink" action right-aligned, and wire it to the ConfirmDialog.

## Modified file: `apps/web/components/UserMenu.tsx`

### Changes

#### 1. Add state for confirmation dialog

```typescript
// Add to existing state declarations (near line 21)
const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);
const [unlinkLoading, setUnlinkLoading] = useState(false);
```

#### 2. Update `handleUnlinkBitbucket` to use dialog flow

```typescript
// Replace current handler (lines 36-45)
async function handleUnlinkBitbucket() {
  setUnlinkLoading(true);
  try {
    const res = await fetch("/api/auth/bitbucket/disconnect", { method: "POST" });
    if (res.ok) {
      setBbStatus({ linked: false, remoteLogin: null });
      setShowUnlinkConfirm(false);
    }
  } catch {
    // Graceful failure — user can try again
  } finally {
    setUnlinkLoading(false);
  }
}
```

#### 3. Redesign the linked Bitbucket row (lines 164-179)

Replace the current two-element layout with a single-row menu item:

```
BEFORE (current):
<div className="px-3 py-2">
  <div className="flex items-center gap-2 ...">
    <svg ...BB icon.../>
    <span>{bbStatus.remoteLogin}</span>
  </div>
  <button className="mt-1 text-xs text-terminal-red ...">Unlink</button>
</div>

AFTER (new):
<div className="flex items-center justify-between rounded-xl px-3 py-2.5">
  <div className="flex items-center gap-3">
    <svg ...BB icon (same)... className="h-4 w-4 text-text-secondary"/>
    <span className="text-sm text-text-primary">{bbStatus.remoteLogin}</span>
  </div>
  <button
    onClick={() => setShowUnlinkConfirm(true)}
    className="text-xs text-text-secondary hover:text-terminal-red transition-colors"
  >
    Unlink
  </button>
</div>
```

Key changes:
- Single row with `flex justify-between` instead of stacked elements.
- BB icon gets `h-4 w-4 text-text-secondary` to match GitHub icon style (gap-3 not gap-2).
- Username uses `text-sm text-text-primary` (matches other menu items).
- "Unlink" is right-aligned, `text-xs text-text-secondary` by default, turns red on hover (`hover:text-terminal-red`). It no longer has red as its resting color — it's muted until hovered, which reduces visual noise.
- Click opens the confirmation dialog instead of immediately unlinking.

#### 4. Add ConfirmDialog render (before closing `</div>` of the component)

```tsx
import { ConfirmDialog } from "./ConfirmDialog";

// Render at the end of the component, before the final </div>
<ConfirmDialog
  open={showUnlinkConfirm}
  title="Unlink Bitbucket?"
  description="Your Bitbucket stats will no longer be included in your impact score. You can re-link anytime."
  confirmLabel="Unlink"
  cancelLabel="Cancel"
  variant="destructive"
  loading={unlinkLoading}
  onConfirm={handleUnlinkBitbucket}
  onCancel={() => setShowUnlinkConfirm(false)}
/>
```

## Modified file: `apps/web/components/UserMenu.test.tsx`

### Updated test cases

The existing tests use source-code string matching (`SOURCE.toContain(...)`). Update the assertions to match the new layout:

1. **"renders Bitbucket linked state with remoteLogin and Unlink button"** — Update to check for new layout patterns:
   - `bbStatus.remoteLogin` still present
   - `"Unlink"` text still present
   - `showUnlinkConfirm` state variable exists
   - `ConfirmDialog` import exists

2. **"Bitbucket unlink opens confirmation dialog"** (new test) — Check that:
   - `setShowUnlinkConfirm(true)` is in the onClick handler
   - `ConfirmDialog` component is rendered with `open={showUnlinkConfirm}`

3. **"Bitbucket section appears after Creator Studio and before Admin Panel"** — Unchanged (ordering is the same).

4. **"Unlink action uses hover:text-terminal-red"** (new test) — Check that:
   - The "Unlink" button class includes `hover:text-terminal-red` (not permanent `text-terminal-red`)

5. **"ConfirmDialog has correct props for unlink"** (new test) — Check source contains:
   - `title="Unlink Bitbucket?"`
   - `confirmLabel="Unlink"`
   - `variant="destructive"`

## Verification

```bash
# Automated
pnpm run test -- apps/web/components/UserMenu.test.tsx
pnpm run test -- apps/web/components/ConfirmDialog.test.tsx
pnpm run typecheck
pnpm run lint
```

### Manual verification (dev server)

1. Log in with a linked Bitbucket account
2. Open user menu dropdown
3. Verify Bitbucket row is a single line: `[BB icon] username [Unlink]`
4. Verify "Unlink" text is muted (not red) at rest
5. Hover "Unlink" — verify it turns red
6. Click "Unlink" — verify confirmation dialog appears
7. Click "Cancel" — verify dialog closes, account still linked
8. Click "Unlink" again, then click "Unlink" in the dialog — verify:
   - Loading state shows briefly
   - Account is unlinked
   - Row changes to "Link Bitbucket"
9. Verify keyboard: Tab focuses Cancel first, then Confirm. Escape closes dialog.

## Success criteria

- [x] All UserMenu tests pass (updated + new) — 12/12
- [x] All ConfirmDialog tests still pass — 10/10
- [x] `pnpm run typecheck` clean
- [x] `pnpm run lint` clean (0 errors, 4 pre-existing warnings)
- [x] Manual spot-check on dev server passes all 9 verification steps
