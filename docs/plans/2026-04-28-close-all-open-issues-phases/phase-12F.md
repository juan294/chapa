---
phase: 12F
release: v2.12.0
issues: ["#778"]
batch_eligible: true
depends_on: ["12A"]
effort: S
---

# Phase 12F — Tighten CSP `unsafe-inline` (`#778`)

## Goal

The current Content Security Policy includes `'unsafe-inline'` in the
`script-src` directive. This was a launch-time concession (Next.js
hydration scripts and inline JSON-LD use inline `<script>` blocks).

ESLint 10 + Next.js 16 ship with proper nonce-based CSP support. Migrate
to nonce-based inline scripts and drop `'unsafe-inline'`.

## Pseudocode

### Generate a nonce per request

```ts
// apps/web/middleware.ts (new or extended)
import { NextResponse } from "next/server";

export function middleware(request: Request) {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const response = NextResponse.next();
  response.headers.set("x-csp-nonce", nonce);

  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' https://eu-assets.i.posthog.com`,
    `style-src 'self' 'unsafe-inline'`,                  // Tailwind injects inline styles
    `img-src 'self' data: https://avatars.githubusercontent.com`,
    `connect-src 'self' https://*.posthog.com https://*.upstash.io https://*.supabase.co`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
  ].join("; ");
  response.headers.set("Content-Security-Policy", csp);
  return response;
}
```

### Use the nonce in inline scripts

```tsx
// apps/web/app/layout.tsx — JSON-LD blocks
import { headers } from "next/headers";

const nonce = headers().get("x-csp-nonce") ?? undefined;

<script
  type="application/ld+json"
  nonce={nonce}
  dangerouslySetInnerHTML={{ __html: renderJsonLd(jsonLd) }}
/>
```

Repeat for the share page JSON-LD block (uses the helper from #731).

### CSP report-only first

Ship Phase 12F initially with `Content-Security-Policy-Report-Only` and
a report endpoint, monitor for a week, then promote to enforced. This
lets us catch any inline script Next.js inserts that we missed.

## Files

- New or modified: `apps/web/middleware.ts`
- Modified: `apps/web/app/layout.tsx` (nonce on JSON-LD)
- Modified: `apps/web/app/u/[handle]/page.tsx` (nonce on JSON-LD)
- New: `apps/web/app/api/csp-report/route.ts` — capture violation reports
  via `withErrorCapture` + `captureServerEvent("csp_violation", ...)`

## Acceptance criteria

### Automated
- [ ] Production CSP header no longer contains `'unsafe-inline'` in
      `script-src` (verify via `curl -I https://chapa.thecreativetoken.com/`)
- [ ] All inline `<script>` blocks have a `nonce` attribute matching the
      header
- [ ] `pnpm run test`, `pnpm run typecheck`, `pnpm run lint` pass
- [ ] CSP-report endpoint exists and captures violations to PostHog

### Manual
- Open `/` in Chrome with DevTools console; no CSP violations
- Visit `/u/<handle>`; no CSP violations
- Trigger an experimental CSP violation locally; verify the report endpoint
  logs to PostHog

## Closing the issue

```bash
gh issue close 778 --comment "Fixed in <sha>. CSP migrated to nonce-based inline scripts; 'unsafe-inline' dropped from script-src; CSP-report endpoint captures any future violations."
```
