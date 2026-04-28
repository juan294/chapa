---
phase: 9E
release: v2.9.0
issues: ["#726", "#731", "#766", "#767", "#768"]
batch_eligible: true
effort: S
---

# Phase 9E — One-line correctness fixes (`#726`, `#731`, `#766`, `#767`, `#768`)

Five tiny, independent fixes. Each is a few-line change with a regression
test. Bundle into one phase to keep the v2.9.0 commit log focused.

## #726 — E2E badge endpoint accepts 5xx

**File:** `apps/web/e2e/badge-endpoint.spec.ts:9-16, 28-36`

```ts
// Before:
if (response.ok()) {
  expect(response.headers()["content-type"]).toContain("svg");
}

// After:
expect(response.status()).toBe(200);
expect(response.headers()["content-type"]).toContain("image/svg+xml");
const body = await response.text();
expect(body).toMatch(/^<svg /);
```

## #731 — JSON-LD escaping helper

**Files:** `apps/web/app/layout.tsx:87-118`, `apps/web/app/u/[handle]/page.tsx:170-175`

Extract a single helper, replace both call sites:

```ts
// apps/web/lib/jsonld.ts (new)
export function renderJsonLd(obj: object): string {
  // Replace JSON.stringify output's </ to escape the closing script tag
  return JSON.stringify(obj)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}
```

Both layout and share page use it identically.

## #766 — Unsubscribe URL handle encoding

**File:** `apps/web/lib/email/templates/announcement.ts:60-62`

```ts
// Before:
const url = `${baseUrl}/api/notifications/unsubscribe?handle=${data.handle}`;
// After:
const url = `${baseUrl}/api/notifications/unsubscribe?handle=${encodeURIComponent(data.handle)}`;
```

Audit the rest of the file for other interpolations of user-controlled
strings into URLs while there.

## #767 — Bulk recalculate handle validation

**File:** `apps/web/app/api/admin/bulk-recalculate/route.ts:47-60`

```ts
import { isValidHandle } from "@/lib/handle";

// Before:
const handles = (body.handles ?? []).filter((h: unknown) => typeof h === "string");

// After:
const handles = (body.handles ?? [])
  .filter((h: unknown): h is string => typeof h === "string")
  .map((h) => h.trim())
  .filter((h) => isValidHandle(h));
```

Verify `isValidHandle` exists in `apps/web/lib/handle.ts` (it does — used
by other admin routes). Add a test case for invalid-shape rejection.

## #768 — `BadgeToolbar` refresh uses `router.refresh()`

**File:** `apps/web/components/BadgeToolbar.tsx:39`

```tsx
// Before:
import { useState } from "react";
// ...
async function handleRefresh() {
  // ...
  window.location.reload();
}

// After:
import { useRouter } from "next/navigation";
const router = useRouter();
async function handleRefresh() {
  // ...
  router.refresh();
}
```

Update `BadgeToolbar.test.tsx` to mock `useRouter().refresh` instead of
asserting on `window.location.reload`.

## Acceptance criteria

### Automated
- [ ] All five test files updated with regression tests
- [ ] `pnpm run typecheck && pnpm run test && pnpm run lint` all pass
- [ ] E2E suite passes (`pnpm run test:e2e`) — `#726` test now fails on a
      seeded 500 from the badge route

### Manual (#726 only)
- Force a local 500 from `/u/<handle>/badge.svg`; verify E2E spec fails
  (then revert)

## Closing the issues

```bash
gh issue close 726 --comment "Fixed in <sha>. E2E now asserts status=200 and SVG content-type unconditionally."
gh issue close 731 --comment "Fixed in <sha>. lib/jsonld.ts shared by layout.tsx and share page."
gh issue close 766 --comment "Fixed in <sha>. encodeURIComponent on handle in unsubscribe URL."
gh issue close 767 --comment "Fixed in <sha>. bulk-recalculate now filters with isValidHandle()."
gh issue close 768 --comment "Fixed in <sha>. BadgeToolbar refresh uses router.refresh() (SPA-friendly)."
```
