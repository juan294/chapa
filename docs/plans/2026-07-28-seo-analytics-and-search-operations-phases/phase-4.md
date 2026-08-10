# Phase 4 — Unified Consent, GA4, Clarity, and Typed Events

**Status:** Planned
**Batch eligibility:** Not batch-eligible
**Depends on:** Phase 2

## Objective

Implement one privacy-safe client analytics system that preserves PostHog operational behavior, adds GA4 and Clarity, and keeps replay away from personal/authenticated surfaces.

## Files

Create:

- `apps/web/lib/analytics/consent.ts`
- `apps/web/lib/analytics/consent.test.ts`
- `apps/web/lib/analytics/events.ts`
- `apps/web/lib/analytics/events.test.ts`
- `apps/web/lib/analytics/clarity.ts`
- `apps/web/lib/analytics/custom-dimensions.test.ts`
- `apps/web/components/analytics/CookieConsentBanner.tsx`
- `apps/web/components/analytics/CookieConsentBanner.test.tsx`
- `apps/web/components/analytics/AnalyticsSettingsLink.tsx`
- `apps/web/components/analytics/GoogleAnalyticsBootstrap.tsx`
- `apps/web/components/analytics/GoogleAnalytics.tsx`
- `apps/web/components/analytics/MicrosoftClarity.tsx`
- `apps/web/components/analytics/GoogleAnalytics.test.tsx`
- `apps/web/components/analytics/MicrosoftClarity.test.tsx`
- `apps/web/components/analytics/ClientAnalyticsConsent.test.tsx`

Modify:

- `apps/web/app/layout.tsx`
- `apps/web/components/ClientInstrumentation.tsx`
- `apps/web/components/ClientAnalytics.tsx`
- `apps/web/components/PostHogProvider.tsx`
- `apps/web/lib/analytics/posthog.ts`
- `apps/web/components/BadgeToolbar.tsx`
- `apps/web/components/CopyButton.tsx`
- `apps/web/components/ClientErrorReporter.tsx`
- `apps/web/app/studio/StudioClient.tsx`
- `apps/web/hooks/useSession.ts`
- `apps/web/hooks/useOwnerCacheWarm.ts`
- `apps/web/components/LoginCtaButton.tsx`
- `apps/web/components/GlobalCommandBar.tsx`
- `apps/web/app/generating/[handle]/GeneratingProgress.tsx`
- `apps/web/next.config.ts`
- `apps/web/next.config.test.ts`
- `apps/web/lib/i18n/dictionaries/en.ts`
- `apps/web/lib/i18n/dictionaries/es.ts`
- privacy and terms page tests
- `.env.example`

## Implementation

1. Add a versioned consent store with `unknown`, `accepted`, and `rejected`.
2. Mount an accessible bilingual banner for `unknown` and a persistent footer/settings control for later changes.
3. Bootstrap GA Consent Mode as denied before the first GA configuration call.
4. Load GA only when a syntactically valid `NEXT_PUBLIC_GA_MEASUREMENT_ID` exists; set locale before the first page view.
5. Prevent PostHog’s interaction/five-second loader from running until consent is accepted.
6. Gate Vercel Analytics and Speed Insights through the same consent state.
7. Add Clarity only when:
   - consent is accepted;
   - `NEXT_PUBLIC_CLARITY_PROJECT_ID` is valid;
   - the current pathname exactly matches the positive allowlist.
8. Do not implement Clarity Identify.
9. Replace the generic PostHog-only wrapper with a typed event catalogue that fans out to configured, consented providers.
10. Migrate the listed call sites to the event vocabulary in the main plan. The PostHog destination maps a canonical event to one historical PostHog name where dashboard continuity requires it; it never dual-emits.
11. Add a source-scanning test that strips comments before verifying every registered GA parameter is actually emitted.
12. Update CSP for the minimum official GA and Clarity script/connect/image hosts. Do not broaden `default-src`.
13. Update bilingual privacy/terms copy to name Google Analytics, Microsoft Clarity, PostHog, Vercel Analytics, consent behavior, replay scope, masking, and the absence of user-authored/profile content from replay.

## Pseudocode

```text
ClientInstrumentation:
  consent = useConsent()
  always mount error reporter
  mount banner/settings
  if consent == accepted:
    mount PostHog
    mount GA
    mount Vercel analytics/speed
    if clarityAllowlist(pathname):
      mount Clarity

track(event, typedProperties):
  reject unknown properties in development/tests
  strip undefined values
  assert no forbidden PII-like keys
  dispatch to loaded PostHog
  dispatch to gtag
  dispatch selected allowlisted marketing events to Clarity
```

## Automated success criteria

- RED-proven tests show the current PostHog fallback loads without consent, then prove no client analytics loader runs for `unknown` or `rejected`.
- Accept/reject/change-decision tests cover storage, vendor APIs, cleanup, and one reload.
- Clarity tests enumerate every allowed and excluded route, including misleading prefix cases.
- CSP tests pin only the required hosts.
- Event tests cover every vocabulary entry, provider no-op behavior, destination-name mappings, forbidden property keys, and parameter typing.
- The dimension-name ratchet fails when a real emission is removed and does not match comments.
- Dictionary parity and privacy/terms render tests pass.
- Typecheck, lint, test, public-surface check, and build pass sequentially.

## Manual success criteria

- Before consent: no GA, PostHog, Clarity, or Vercel analytics network/storage activity.
- With local syntactically valid test IDs and intercepted network requests: accepted consent inserts only the expected scripts/config calls and correctly named event parameters.
- After reject: client analytics remain absent.
- After accept then reject: Chapa-owned analytics storage is cleared and no further events send.
- With the Clarity request intercepted locally, the loader runs on an allowlisted resource page and does not run on a profile, Studio, admin, generation, verification, CLI, API, or experiment route.
- Banner/settings behavior works in English/Spanish, light/dark, keyboard-only, and screen-reader navigation.

## Stop gate

Commit and stop. Vendor property creation, dashboard configuration, Vercel variables, and deployment remain unauthorized until Phase 5.
