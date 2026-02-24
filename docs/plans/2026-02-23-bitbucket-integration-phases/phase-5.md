# Phase 5: UI — User Menu "Link Bitbucket"

## Goal

Add a "Link Bitbucket" / "Unlink Bitbucket" item to the User Menu dropdown. Add a status API for the frontend to check Bitbucket link state. Show a subtle platform indicator when Bitbucket data is merged.

## Design

### User Menu State

```
When Bitbucket is NOT linked:
┌──────────────────────┐
│ 🟢 juan294           │
├──────────────────────┤
│ Your Badge           │
│ Creator Studio       │
│ Link Bitbucket    →  │  ← NEW: redirects to /api/auth/bitbucket/connect
├──────────────────────┤
│ About Chapa          │
│ Terms of Service     │
│ Privacy Policy       │
├──────────────────────┤
│ Sign out             │
└──────────────────────┘

When Bitbucket IS linked:
┌──────────────────────┐
│ 🟢 juan294           │
├──────────────────────┤
│ Your Badge           │
│ Creator Studio       │
│ ✓ Bitbucket linked   │  ← NEW: shows connected state
│   Unlink             │  ← NEW: calls POST /api/auth/bitbucket/disconnect
├──────────────────────┤
│ ...                  │
└──────────────────────┘
```

## New Files

### 1. `apps/web/app/api/auth/bitbucket/status/route.ts`

Lightweight endpoint for the frontend to check Bitbucket link status:

```typescript
import { requireSession } from "@/lib/auth/require-session";
import { dbGetLinkedPlatforms } from "@/lib/db/user-platforms";
import { isBitbucketEnabled } from "@/lib/feature-flags";

export async function GET(request: NextRequest) {
  // 1. Feature flag check
  if (!(await isBitbucketEnabled())) {
    return NextResponse.json({ enabled: false });
  }

  // 2. Require session
  const { session, error } = requireSession(request);
  if (error) return error;

  // 3. Get linked platforms
  const platforms = await dbGetLinkedPlatforms(session.login);
  const bitbucket = platforms.find(p => p.platform === "bitbucket");

  return NextResponse.json({
    enabled: true,
    linked: !!bitbucket,
    remoteLogin: bitbucket?.remoteLogin ?? null,
    connectedAt: bitbucket?.connectedAt ?? null,
  });
}
```

### 2. `apps/web/app/api/auth/bitbucket/status/route.test.ts`

```
describe("GET /api/auth/bitbucket/status")
  - returns { enabled: false } when feature flag disabled
  - returns 401 when not authenticated
  - returns { enabled: true, linked: false } when not linked
  - returns { enabled: true, linked: true, remoteLogin: "..." } when linked
```

## Modified Files

### 1. `apps/web/components/UserMenu.tsx`

Add Bitbucket link/unlink item:

```typescript
// New imports
import { isBitbucketEnabledSync } from "@/lib/feature-flags";

// Inside component — fetch Bitbucket status on mount (only when feature enabled)
const [bbStatus, setBbStatus] = useState<{
  linked: boolean;
  remoteLogin: string | null;
} | null>(null);

useEffect(() => {
  if (!isBitbucketEnabledSync()) return;
  fetch("/api/auth/bitbucket/status")
    .then(r => r.json())
    .then(data => {
      if (data.enabled) setBbStatus({ linked: data.linked, remoteLogin: data.remoteLogin });
    })
    .catch(() => {}); // Graceful — menu works without status
}, []);

// In the dropdown, after "Creator Studio" item:
{isBitbucketEnabledSync() && bbStatus && (
  bbStatus.linked ? (
    <div className="px-3 py-2">
      <div className="flex items-center gap-2 text-sm text-text-secondary">
        {/* Bitbucket icon (inline SVG) */}
        <svg ...>{/* Bitbucket logo */}</svg>
        <span className="text-text-primary">{bbStatus.remoteLogin}</span>
      </div>
      <button
        onClick={handleUnlinkBitbucket}
        className="mt-1 text-xs text-terminal-red hover:underline"
      >
        Unlink
      </button>
    </div>
  ) : (
    <a
      href="/api/auth/bitbucket/connect"
      className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-card"
    >
      {/* Bitbucket icon */}
      <svg ...>{/* Bitbucket logo */}</svg>
      Link Bitbucket
    </a>
  )
)}
```

**Unlink handler:**
```typescript
async function handleUnlinkBitbucket() {
  try {
    const res = await fetch("/api/auth/bitbucket/disconnect", { method: "POST" });
    if (res.ok) {
      setBbStatus({ linked: false, remoteLogin: null });
    }
  } catch {
    // Graceful failure — user can try again
  }
}
```

### 2. `apps/web/components/UserMenu.test.tsx` (if exists, or create)

```
describe("UserMenu — Bitbucket integration")
  - does not render Bitbucket item when feature flag disabled
  - renders "Link Bitbucket" when not linked
  - renders Bitbucket username and "Unlink" when linked
  - calls /api/auth/bitbucket/disconnect on unlink click
```

### 3. `apps/web/app/u/[handle]/page.tsx` (optional enhancement)

Add a subtle indicator when Bitbucket data is merged:

```typescript
// In the stats section or near the badge, when impact data includes linkedPlatforms:
{stats.linkedPlatforms?.includes("bitbucket") && (
  <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
    <svg ...>{/* Bitbucket icon, small */}</svg>
    + Bitbucket
  </span>
)}
```

This is purely informational — shows visitors that the badge includes cross-platform data.

## Bitbucket Logo SVG

Following the design system rules (inline SVG, no icon libraries):

```xml
<!-- Bitbucket logo — official mark, fill-based -->
<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
  <path d="M.778 1.211a.768.768 0 00-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 00.77-.646l3.27-20.03a.768.768 0 00-.768-.891zM14.52 15.53H9.522L8.17 8.466h7.561z"/>
</svg>
```

## Automated Verification

```bash
pnpm run typecheck 2>&1; pnpm run test -- --run apps/web/components/UserMenu.test.tsx apps/web/app/api/auth/bitbucket/status/ 2>&1; pnpm run lint 2>&1
```

## Manual Verification

1. Open `localhost:3001` → log in with GitHub
2. Open User Menu → verify "Link Bitbucket" appears
3. Click "Link Bitbucket" → verify redirect to bitbucket.org
4. Complete OAuth → verify redirect back with `?bitbucket=linked`
5. Open User Menu → verify shows Bitbucket username + "Unlink"
6. Visit `/u/{handle}` → verify badge shows Bitbucket data merged
7. Click "Unlink" → verify Bitbucket data is removed on next badge load

## Success Criteria

- [x] "Link Bitbucket" appears in User Menu when feature flag is enabled
- [x] "Link Bitbucket" does NOT appear when feature flag is disabled
- [x] Clicking "Link Bitbucket" initiates Bitbucket OAuth flow
- [x] After linking, User Menu shows Bitbucket username + "Unlink"
- [x] Clicking "Unlink" removes the Bitbucket connection
- [x] Share page shows subtle platform indicator when Bitbucket data is merged
- [x] Inline SVG for Bitbucket logo (no icon library)
- [x] All tests pass, typecheck clean
