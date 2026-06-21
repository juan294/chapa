# Phase 2: User-Menu Link/Unlink UX Determinism [batch-eligible]

Parent plan: `docs/plans/2026-06-21-data-sources-linking-scoring-hardening.md`

## Goal

Make User Menu link/unlink state transitions match the server result, and make status caching resilient per platform.

## Scope

Files expected to change:

- `apps/web/components/UserMenu.tsx`
- `apps/web/components/UserMenu.test.tsx`
- `apps/web/components/UserMenu.render.test.tsx`

## Implementation Notes

1. Change `PlatformStatusCache` from a single `fetched` flag to per-platform fetched/status entries.
2. Update state initializers to read each platform's cached status entry.
3. Update the mount effect so each platform independently decides whether it needs a status fetch.
4. In `unlinkPlatform`, parse the JSON response and require `body.success === true` before local unlink state changes.
5. Keep linked state visible and loading false when the server returns `{ success: false }`, non-OK, invalid JSON, or throws.
6. Reuse existing `Toast` support for a small error state if user-visible failure feedback is implemented.
7. Add GitLab runtime tests matching Bitbucket/Codeberg coverage.

## Pseudocode

```ts
const body = await res.json().catch(() => null);
if (res.ok && body?.success === true) {
  clearPlatformStatusCache();
  setStatus({ linked: false, remoteLogin: null });
  setShowConfirm(false);
  router.refresh();
} else {
  setToast({ type: "error", message: t("userMenu.unlinkFailed") });
}
```

## Automated Verification

Run:

```bash
pnpm exec vitest run apps/web/components/UserMenu.test.tsx apps/web/components/UserMenu.render.test.tsx
```

Expected:

- `{ success: true }` transitions to unlinked and refreshes.
- `{ success: false }` leaves linked state visible and does not refresh.
- Network failure leaves linked state visible and does not refresh.
- GitLab runtime link/unlink coverage matches Bitbucket/Codeberg.
- Per-platform status cache allows one platform status fetch failure without suppressing other platform status reads on later mounts.

## Manual Verification

- Open the User Menu with mocked or real linked status.
- Confirm failed unlink remains visibly linked.
- Confirm successful unlink closes the dialog and updates only the affected platform row.

