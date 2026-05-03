# Plan: Language picker + full public-page i18n

**Date:** 2026-05-02
**Branch base:** `develop`
**Research:** [`docs/research/2026-05-02-language-picker-and-i18n-state.md`](../research/2026-05-02-language-picker-and-i18n-state.md)

---

## Goal

Give Chapa a language picker (English ↔ Spanish), persist the choice in the browser, and back it with proper i18n infrastructure so every public page renders in the chosen language. No hardcoded `SPANISH_PUBLIC_COPY` constant — both locales sit in proper translation tables, key-parity-tested.

---

## Decisions locked (from clarification)

| # | Decision | Choice |
|---|---|---|
| Q1 | Default when no cookie set | **Browser-detect via `Accept-Language` server-side**; pick `es` if user's preferred lang starts with `es`, else `en` |
| Q2 | LanguageSwitcher visuals | **Paisaxe behavior, Chapa skin** — same component structure (pill + listbox + keyboard nav + ARIA), restyled with Chapa terminal tokens (`font-heading`, `text-terminal-dim hover:text-amber`, `rounded-lg`, `bg-card border-stroke shadow-card`) |
| Q3 | Translation scope | **All public-facing pages** — landing, verify, generating, share-page, about + scoring + verification, all 7 archetype guides, privacy, terms, cli/authorize, coming-soon, error/loading boundaries, shared chrome (Navbar, MobileNav, UserMenu visible items, ThemeToggle aria, CopyButton, Toast aria, BadgeOverlay tooltips, BadgeSkeleton aria) |

## Forced calls (no clarification needed — consequences of Q1–Q3)

| # | Call | Why |
|---|---|---|
| F1 | Persistence = **cookie** (`chapa-locale`), not localStorage | Server-rendered pages need to know the locale at first byte. localStorage forces a Spanish-flash-then-English on every load. |
| F2 | Translated public pages become **server-dynamic** (`export const dynamic = 'force-dynamic'`) | Next.js ISR caches by URL only; cookie variants cannot share a cache entry. Per-locale URL routing (`/en/...`) would be a much larger refactor. Documented as accepted risk. Badge SVG endpoint stays ISR/cached (not translated). |
| F3 | All static `metadata` exports → `generateMetadata` | So titles/descriptions/OG/Twitter respect the cookie. |
| F4 | `?lang=es\|en` URL override (precedence: query > cookie > Accept-Language > `en`) | ~5 LOC of cost; big QA / shareability payoff. Sets the cookie if the override is "sticky" (we'll use sticky). |
| F5 | Two `t()` surfaces: `getServerT(locale)` for server, `useTranslation()` hook for client | Both back the same dictionaries. |
| F6 | Rich text via segmented keys (`.before` / `.linkLabel` / `.after`), no ICU library | Matches existing pattern in `SPANISH_PUBLIC_COPY` (`measure.descriptionBefore`, `archetypes.descriptionBefore/After`). No new dep. |
| F7 | Languages = `en` + `es` only; types and folder layout extensible to add more later | Scope hygiene; user only flagged es/en. |

---

## Out of scope (explicit)

- Badge SVG (`apps/web/lib/render/*`, `/u/:handle/badge.svg`) — embeddable asset, English only, stays as-is.
- OG image renderers (`/og-image`, `/u/:handle/og-image`) — shared images, English only.
- Auth/admin/studio/experiments routes — `/admin/*`, `/studio`, `/experiments/*`, `/api/*`.
- The `llms.txt` / `llms-full.txt` files.
- JSON-LD structured-data blocks (search-engine consumed; remain English).
- URL-based locale routing (`/en/about`) — possible follow-up.
- Per-locale ISR caching — possible follow-up after Phase 5.
- Email content (Resend templates) — separate i18n surface; not in this plan.

---

## Architecture overview

```
apps/web/lib/i18n/
├── types.ts                      # Locale union, Translations type
├── dictionaries/
│   ├── en.ts                     # Full English translation tree
│   └── es.ts                     # Full Spanish translation tree (recovered from current SPANISH_PUBLIC_COPY)
├── resolve.ts                    # Dot-notation key resolver, key-fallback safe (port from Paisaxe)
├── detect.ts                     # parseAcceptLanguage(), browser detection helpers
├── cookie.ts                     # readLocaleCookie(), writeLocaleCookie() — name "chapa-locale"
├── server.ts                     # getServerLocale(), getServerT(locale)
├── provider.tsx                  # LanguageProvider — React Context, hydration-safe, takes initialLocale
├── use-translation.ts            # useTranslation() client hook
├── lang-sync.tsx                 # client component: keeps document.documentElement.lang in sync
├── set-locale-action.ts          # "use server" action: write cookie + revalidatePath
└── index.ts                      # re-exports

apps/web/components/
└── LanguageSwitcher.tsx          # The picker (Chapa-skinned)

apps/web/app/
├── layout.tsx                    # reads server locale, sets <html lang>, mounts LanguageProvider
└── (public pages)                # all converted to server t()
```

**Default resolution order** (server-side, on every request to a translated page):

1. `?lang=es|en` query param (sticky — sets cookie)
2. `chapa-locale` cookie value (if `en` or `es`)
3. `Accept-Language` header — first preferred tag whose primary subtag is `es` → `es`, else `en`
4. Hard default: `en`

---

## Phase map

| Phase | Title | Depends on | Batch-eligible |
|---|---|---|---|
| 1 | i18n core infrastructure (types, resolve, detect, cookie, server, provider, hook, layout integration) | — | No — foundation |
| 2 | Restructure `SPANISH_PUBLIC_COPY` into dictionaries + add common chrome keys + rewire current consumers | 1 | No |
| 3 | `LanguageSwitcher` component + mount in Navbar / NavbarClient / MobileNav | 2 | No — overlaps Navbar/MobileNav files with Phase 2 |
| 4a | Translate `/about`, `/about/scoring`, `/about/verification` | 2 | **Yes** |
| 4b | Translate 7 archetype guide pages | 2 | **Yes** |
| 4c | Translate `/privacy`, `/terms` | 2 | **Yes** |
| 4d | Translate share-page interior (`/u/[handle]/page.tsx` + `SharePageOwnerContent.tsx` owner block + loading) | 2 | **Yes** |
| 4e | Translate `/cli/authorize`, `/coming-soon`, route-level `error.tsx` / `loading.tsx` (about, archetypes, privacy, terms, cli/authorize, coming-soon) | 2 | **Yes** |
| 5 | Final QA: parity audit, full test/typecheck/lint, manual visual review, accepted-risks doc update, CLAUDE.md update | 4a–4e | No |

---

## Phase files

- [Phase 1 — i18n core infrastructure](2026-05-02-language-picker-i18n-phases/phase-1.md)
- [Phase 2 — Dictionary restructure + current consumers](2026-05-02-language-picker-i18n-phases/phase-2.md)
- [Phase 3 — LanguageSwitcher component + nav mount](2026-05-02-language-picker-i18n-phases/phase-3.md)
- [Phase 4a — About family](2026-05-02-language-picker-i18n-phases/phase-4a.md)
- [Phase 4b — Archetype guides](2026-05-02-language-picker-i18n-phases/phase-4b.md)
- [Phase 4c — Legal pages](2026-05-02-language-picker-i18n-phases/phase-4c.md)
- [Phase 4d — Share page interior](2026-05-02-language-picker-i18n-phases/phase-4d.md)
- [Phase 4e — CLI authorize, coming-soon, error/loading boundaries](2026-05-02-language-picker-i18n-phases/phase-4e.md)
- [Phase 5 — Final QA & docs](2026-05-02-language-picker-i18n-phases/phase-5.md)

---

## Global success criteria (whole plan)

### Automated (must pass before plan is considered complete)

- `pnpm run test` — all suites green; new test counts: ≥12 in `lib/i18n/*` (resolve, detect, cookie, server, provider, key-parity).
- `pnpm run typecheck` — green; `Locale` is a strict union, `Translations` recursive shape inferred from `en` and `es`.
- `pnpm run lint` — green.
- **Key-parity test**: `dictionaries/en.ts` and `dictionaries/es.ts` produce structurally identical key trees (same nested paths, all leaves are strings or arrays of strings/objects of identical shape). Test file: `lib/i18n/dictionaries/parity.test.ts`.
- **No-regression test**: every page that previously rendered now renders in both locales without throwing missing-key warnings.
- `apps/web/lib/copy/public-flow.ts` is **deleted**; no surviving references.
- No file under `apps/web/app` (excluding the items listed in "Out of scope") contains hardcoded user-visible English or Spanish strings on a public route — every such string flows through `t()` / `getServerT()`.

### Manual

- Land on `/` from a fresh browser with `Accept-Language: es-ES,es;q=0.9` → page renders in Spanish, `<html lang="es">`, no flash.
- Land on `/` from a fresh browser with `Accept-Language: en-US,en;q=0.9` → page renders in English, `<html lang="en">`.
- Click the picker, select the other language → page reloads in that language, `<html lang>` flips, cookie is set, picker label updates. Reload — choice persists.
- Visit `/about?lang=es` from an English-cookied browser → Spanish renders; cookie now `es`. Remove `?lang=` and reload → still Spanish.
- All 7 archetype guides, `/about/scoring`, `/about/verification`, `/privacy`, `/terms`, `/verify`, `/verify/<hash>` (use any test hash), `/u/<handle>` (logged out and logged in), `/cli/authorize` render in both locales without untranslated strings or layout breakage.
- Lighthouse a11y on `/` and `/about` ≥ 95 in both locales (LanguageSwitcher must not regress).
- Picker UX matches Paisaxe behavior: arrow keys, Home/End, Enter, Escape, click-outside, focus return to trigger.

---

## Risks & accepted trade-offs

1. **Server-dynamic rendering of public pages** (F2) — first-byte time goes from ISR-cached to per-request render. Mitigations: short edge-cache via `Cache-Control: s-maxage=60, stale-while-revalidate=86400` per page; the most-cached endpoint (`/u/:handle/badge.svg`) is unaffected. Document in `docs/accepted-risks.md`.
2. **`generateMetadata` runs per request** — same trade-off; same mitigation.
3. **Two more locales' worth of bundle on the client** if we ever serve both eagerly — handled by static-imports of `en` + `es` only (under ~30KB combined, well below the 500KB First Load JS budget per `pre-launch-report.md` thresholds). Future locales would lazy-load (Paisaxe pattern).
4. **Translation drift** — addressed by the parity test (Phase 1 scaffold; populated through Phase 4).
5. **Rich-text segmentation can read awkwardly in source** — accepted; matches existing `SPANISH_PUBLIC_COPY` pattern.

---

## Implementation rules (apply to every phase)

1. TDD: failing tests first per `CLAUDE.local.md`.
2. Worktree per phase (or per batch group). Background agents use `.worktrees/<short-name>/`.
3. Issue-driven: open a parent GitHub issue for "Language picker + i18n" with sub-tasks for each phase, label `type: feature`, `priority: medium`, `area: ux` + `area: infra`.
4. Conventional commits, `Refs #<parent>` on each PR.
5. After every push to `develop`, spawn the background CI-watcher.
6. `pnpm install` inside each worktree.
7. Don't touch `main` — release happens at the end via separate user-authorized PR.
