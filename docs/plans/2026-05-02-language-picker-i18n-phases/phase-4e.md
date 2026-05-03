# Phase 4e — CLI authorize, coming-soon, route boundaries

**Status:** [batch-eligible after Phase 2]
**Depends on:** Phase 2 merged.
**Worktree:** `.worktrees/i18n-misc` or `../chapa-i18n-misc`.
**Files affected:** `apps/web/app/cli/authorize/**`, `apps/web/app/coming-soon/**`, route-level `error.tsx` and `loading.tsx` files for `about`, `archetypes`, `privacy`, `terms`, `cli/authorize`, `coming-soon`. No overlap with Phase 4a–4d (each Phase 4* phase touches its own page family; the route boundaries here are for routes whose page bodies are in 4a/4b/4c — but the boundary files themselves only live here).

---

## Goal

Pick up the long tail: the CLI authorize flow, the coming-soon placeholder, and every route-level `error.tsx` / `loading.tsx` across translated public routes. Most of these reuse the chrome keys added in Phase 2 (`common.tryAgain`, `common.goHome`, `errors.general.title`, etc.); only `cli/authorize/AuthorizeClient.tsx` needs a new namespace.

---

## Tasks

### 4e.1 — Dictionary keys

Add to `en.ts` (parity-matched in `es.ts`):

```ts
cliAuthorize: {
  metadataTitle: 'Authorize Chapa CLI',
  h1: 'Authorize Chapa CLI',
  description: 'The Chapa CLI is requesting access to upload supplemental stats for your account.',
  loggedInAs: 'Logged in as',
  bodyExplainer: 'This will allow the CLI to upload supplemental stats (e.g. EMU contributions) to your account.',
  authorizeButton: 'Authorize CLI',
  authorizing: 'Authorizing...',
  authorized: 'Authorized! You can close this tab and return to your terminal.',
  errorMissingSession: 'Missing session parameter. Run "chapa login" in your terminal first.',
  errorGeneric: 'Failed to authorize. Please try again.',
  errorBoundaryHeading: 'Authorization error',
  errorBoundaryBody: 'Something went wrong during CLI authorization. Please try again.',
},
comingSoon: {
  metadataTitle: 'Coming soon',
  brand: 'Chapa',
  terminalCommand: '$ chapa --status',
  message: '> Coming soon.',
  tagline: 'Developer impact badges, powered by your code.',
},
```

Reuse Phase 2 chrome keys for the boundary files:

- `errors.general.title`, `errors.general.description`, `common.tryAgain`, `common.goHome` (already added in Phase 2)
- `aria.loadingBadge`, `common.loading` (already added)

### 4e.2 — Convert `cli/authorize`

- `app/cli/authorize/page.tsx` (server) — `getServerT`, `generateMetadata`, `dynamic = 'force-dynamic'`.
- `app/cli/authorize/AuthorizeClient.tsx` (client) — `useTranslation`, replace ~7 hardcoded English strings.
- `app/cli/authorize/error.tsx` — uses CLI-specific error keys (`cliAuthorize.errorBoundaryHeading`/`Body` + `common.tryAgain`/`goHome`).

### 4e.3 — Convert `coming-soon`

- `app/coming-soon/page.tsx` — `getServerT`, `generateMetadata`, `dynamic = 'force-dynamic'`.
- `app/coming-soon/error.tsx` — generic error keys.

### 4e.4 — Convert remaining route-level boundaries

For each of these (all client components — they're React error boundaries / Next.js loading components):

```
apps/web/app/about/error.tsx
apps/web/app/about/loading.tsx
apps/web/app/archetypes/error.tsx
apps/web/app/archetypes/loading.tsx
apps/web/app/privacy/error.tsx
apps/web/app/privacy/loading.tsx
apps/web/app/terms/error.tsx
apps/web/app/terms/loading.tsx
apps/web/app/cli/authorize/loading.tsx
apps/web/app/coming-soon/loading.tsx
```

Pattern (all share the same shape):

```tsx
'use client';
import { useTranslation } from '@/lib/i18n';

export default function ErrorBoundary({ error, reset }) {
  const { t } = useTranslation();
  return (
    <div>
      <h2>{t('errors.general.title')}</h2>
      <p>{t('errors.general.description')}</p>
      <button onClick={reset}>{t('common.tryAgain')}</button>
      <a href="/">{t('common.goHome')}</a>
    </div>
  );
}
```

If any of these don't exist yet (some may be missing), create them with the standard pattern. If they exist with custom copy beyond the generic keys, keep that custom copy in a per-route key (e.g., `cliAuthorize.errorBoundaryHeading` is specific).

### 4e.5 — Tests

- Render `cli/authorize` page + AuthorizeClient in both locales — assert correct strings.
- Render `coming-soon` in both locales.
- For each route boundary, render the error state in both locales.

---

## Definition of done

### Automated

- All converted files have render tests in both locales — green.
- Parity test green for `cliAuthorize` and `comingSoon` namespaces.
- Typecheck/lint green.

### Manual

- `/cli/authorize?lang=es` and `?lang=en` render correctly in both states (with handle / without).
- `/coming-soon?lang=es` and `?lang=en` render correctly.
- Force an error on `/about` (e.g., temporarily throw in a child) — boundary renders in correct locale.
- Same for archetype, privacy, terms boundaries.
- Loading skeletons have correct `aria-label`s in both locales.

### File checklist

- [ ] `apps/web/lib/i18n/dictionaries/en.ts` — cliAuthorize + comingSoon namespaces
- [ ] `apps/web/lib/i18n/dictionaries/es.ts` — same keys translated
- [ ] `apps/web/app/cli/authorize/page.tsx`
- [ ] `apps/web/app/cli/authorize/AuthorizeClient.tsx`
- [ ] `apps/web/app/cli/authorize/error.tsx`
- [ ] `apps/web/app/coming-soon/page.tsx`
- [ ] `apps/web/app/coming-soon/error.tsx`
- [ ] All listed route-level `error.tsx` / `loading.tsx` files
- [ ] Render tests for all of the above

---

## STOP after this phase if running solo.
