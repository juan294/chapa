# Phase 5: UI

> Parent: [Codeberg Integration Plan](../2026-02-26-codeberg-integration.md)
> Depends on: Phase 4
> Estimated new files: 0
> Estimated modified files: 1

## Goal

Add Codeberg link/unlink UI to the User Menu dropdown, following the exact Bitbucket pattern. Users see "Link Codeberg" when not linked, and "[Codeberg icon] username / Unlink" when linked.

## Changes

### 1. Modify `apps/web/components/UserMenu.tsx`

**Add Codeberg state and status fetch (mirroring Bitbucket):**

```typescript
// At top — add import
import { isCodebergEnabledSync } from "@/lib/feature-flags";

// In component state (after bbStatus):
const [cbStatus, setCbStatus] = useState<{
  linked: boolean;
  remoteLogin: string | null;
} | null>(null);
const [showCbUnlinkConfirm, setShowCbUnlinkConfirm] = useState(false);
const [cbUnlinkLoading, setCbUnlinkLoading] = useState(false);

// In useEffect (after Bitbucket status fetch):
if (isCodebergEnabledSync()) {
  fetch("/api/auth/codeberg/status")
    .then((r) => r.json())
    .then((data) => {
      if (data.enabled) setCbStatus({ linked: data.linked, remoteLogin: data.remoteLogin });
    })
    .catch(() => {}); // Graceful
}

// Unlink handler:
async function handleUnlinkCodeberg() {
  setCbUnlinkLoading(true);
  try {
    const res = await fetch("/api/auth/codeberg/disconnect", { method: "POST" });
    if (res.ok) {
      setCbStatus({ linked: false, remoteLogin: null });
      setShowCbUnlinkConfirm(false);
    }
  } catch {
    // Graceful failure
  } finally {
    setCbUnlinkLoading(false);
  }
}
```

**Add Codeberg row in dropdown (after Bitbucket row, before Admin Panel):**

```tsx
{isCodebergEnabledSync() && cbStatus && (
  cbStatus.linked ? (
    <div className="flex items-center justify-between rounded-xl px-3 py-2.5">
      <div className="flex items-center gap-3">
        <CodebergIcon />
        <span className="text-sm text-text-primary">{cbStatus.remoteLogin}</span>
      </div>
      <button
        onClick={() => setShowCbUnlinkConfirm(true)}
        className="text-xs text-text-secondary transition-colors hover:text-terminal-red"
      >
        Unlink
      </button>
    </div>
  ) : (
    <a
      href="/api/auth/codeberg/connect"
      className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-text-secondary transition-colors hover:bg-amber/[0.06] hover:text-text-primary"
    >
      <CodebergIcon />
      Link Codeberg
    </a>
  )
)}
```

**Add Codeberg ConfirmDialog (after Bitbucket dialog):**

```tsx
<ConfirmDialog
  open={showCbUnlinkConfirm}
  title="Unlink Codeberg?"
  description="Your Codeberg stats will no longer be included in your impact score. You can re-link anytime."
  confirmLabel="Unlink"
  cancelLabel="Cancel"
  variant="destructive"
  loading={cbUnlinkLoading}
  onConfirm={handleUnlinkCodeberg}
  onCancel={() => setShowCbUnlinkConfirm(false)}
/>
```

**Add Codeberg icon (inline SVG):**

The Codeberg logo is a mountain/tent shape. Use the official SVG path:

```tsx
function CodebergIcon() {
  return (
    <svg className="h-4 w-4 text-text-secondary" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M11.955.49A12 12 0 0 0 0 12.49a12 12 0 0 0 1.832 6.373L11.838 5.928a.187.187 0 0 1 .324 0l10.006 12.935A12 12 0 0 0 24 12.49a12 12 0 0 0-12-12 12 12 0 0 0-.045 0zm.375 6.467l4.416 5.774-4.416 3.252-4.416-3.252z" />
    </svg>
  );
}
```

## Visual Layout

```
User Menu Dropdown:
┌─────────────────────────────────┐
│ [Avatar] username               │
│ @login                          │
├─────────────────────────────────┤
│ [GH icon]  Your Badge           │
│ [★ icon]   Creator Studio       │
│ [BB icon]  bitbucket_user Unlink│  ← Bitbucket (if linked)
│ [CB icon]  codeberg_user Unlink │  ← Codeberg (if linked)
│ [🔒 icon]  Admin Panel          │  ← Admin only
├─────────────────────────────────┤
│ About Chapa                     │
│ Terms of Service                │
│ Privacy Policy                  │
├─────────────────────────────────┤
│ Sign out                        │
└─────────────────────────────────┘
```

## Success Criteria

### Automated
- [x] `pnpm run typecheck` passes
- [x] `pnpm run lint` passes

### Manual
- [ ] With `NEXT_PUBLIC_CODEBERG_ENABLED=true` and no Codeberg linked:
  - User Menu shows "Link Codeberg" with Codeberg icon
  - Clicking it redirects to Codeberg OAuth
- [ ] With Codeberg linked:
  - User Menu shows "[CB icon] codeberg_username ... Unlink"
  - Clicking Unlink opens confirmation dialog
  - Confirming unlink calls disconnect endpoint and updates UI
- [ ] With `NEXT_PUBLIC_CODEBERG_ENABLED=false`:
  - No Codeberg row appears in User Menu
- [ ] With both Bitbucket and Codeberg linked:
  - Both rows appear in the dropdown, each with their own unlink button
  - Badge at `/u/{handle}/badge.svg` reflects merged data from both platforms

## Documentation Updates

After Phase 5 is complete and all tests pass:

1. Add to `CLAUDE.md` environment variables section:
   ```
   CODEBERG_CLIENT_ID=              # Codeberg OAuth app client ID (optional — Codeberg integration disabled without it)
   CODEBERG_CLIENT_SECRET=          # Codeberg OAuth app secret (optional — server-side only)
   NEXT_PUBLIC_CODEBERG_ENABLED=    # Set to "true" to enable Codeberg link/unlink in User Menu (optional, disabled by default)
   ```

2. Add `"codeberg"` to the Platform type docs and code ownership areas.

3. Update `.env.example` with the new variables.
