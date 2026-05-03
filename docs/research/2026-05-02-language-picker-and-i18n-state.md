# Research: Chapa language state vs. Paisaxe language switcher

**Date:** 2026-05-02
**Branch:** `develop`
**Scope:** What exists today, in both codebases. No prescriptions.

---

## TL;DR (what is, not what should be)

- Chapa has **no i18n infrastructure**: no library, no middleware, no locale files, no detection, no persistence. The HTML root is `lang="en"`.
- Chapa's public-flow pages render Spanish text because the copy is **hardcoded as a single constant** named `SPANISH_PUBLIC_COPY`. There is no English variant of that copy anywhere in the repo.
- This means every visitor sees Spanish on those pages regardless of geo-IP, `Accept-Language`, browser locale, or any prior choice — there is nothing in the code that varies by user.
- Paisaxe has a **bespoke React-Context i18n system** under `src/lib/i18n/` with 6 locales (es default, en, fr, de, pt, ast), `localStorage` persistence (`paisaxe-locale`), and `navigator.languages`-based detection. The picker UI lives at `src/components/immersive/language-switcher.tsx`.

---

## 1. Chapa — current state

### 1.1 No i18n library or middleware

- `apps/web/package.json` and root `package.json` contain **no** entries for `next-intl`, `react-intl`, `i18next`, or any locale library (`grep` over both files returned nothing).
- There is **no `middleware.ts`** in `apps/web/` or repo root (verified: `ls .../middleware.ts` → `No such file or directory`).
- `vercel.json` defines only cron jobs; there is no rewrites/locales/geo block.
- `apps/web/next.config.ts:1-60` contains no `i18n` config and no Next.js `i18n.locales` block.

### 1.2 HTML root locale is hardcoded English

- `apps/web/app/layout.tsx:76` — `<html lang="en" ...>`. The attribute is a string literal; nothing rewrites it client- or server-side.
- The only places matching `Accept-Language`, `navigator.language`, or `geo.` in `apps/web` source are zero results — confirmed by `grep -rE "Accept-Language|navigator.language|geo\." apps/web --include "*.ts" --include "*.tsx"`.

### 1.3 Spanish text is a hardcoded copy constant

- `apps/web/lib/copy/public-flow.ts:1` — `export const SPANISH_PUBLIC_COPY = { ... }` (file is 228 lines). Contents include landing hero, CTAs, embed snippet labels, generation steps, verify form, error boundaries, share-visitor copy. Sample at `public-flow.ts:1-40` shows entries like:
  - `landing.hero.title: "Impacto de desarrollador,"`
  - `landing.hero.primaryCta: "Consigue tu insignia"`
  - `landing.embed.comment: "Añade esto a tu README"`
- A grep for `ENGLISH_PUBLIC_COPY` / `ENGLISH_COPY` returned zero hits — there is **no English counterpart constant** in the repo. The site has only one set of strings, and they are in Spanish.

### 1.4 Where `SPANISH_PUBLIC_COPY` is consumed

Confirmed via `grep -rn "SPANISH_PUBLIC_COPY" apps/web`:

- `apps/web/app/page.tsx:8,20` — landing page (`/`)
- `apps/web/app/error.tsx:5,7` — global error boundary
- `apps/web/app/u/[handle]/error.tsx:5,7` — share-page error boundary
- `apps/web/app/generating/[handle]/page.tsx:3,16` — generating route metadata
- `apps/web/app/generating/[handle]/GeneratingProgress.tsx:5,12,53,65,100,194,202` — generation progress UI
- `apps/web/app/verify/page.tsx:3,7,8,27,29,33` — verify landing
- `apps/web/app/verify/[hash]/page.tsx:4,8` — verify detail
- `apps/web/app/verify/VerifyForm.tsx:5,18,31,56` — verify form
- `apps/web/components/SharePageOwnerContent.tsx:11,27` — share visitor copy block

### 1.5 Provenance

- Commit `b0758831 fix: localize launch copy (#819)` (2026-04-24) introduced the Spanish copy refactor across landing, verify, generating, and share-visitor surfaces (`git log -- apps/web/lib/copy/public-flow.ts`; `git show --stat b0758831`). The follow-up commit `594f2aa3 fix: resolve Apr 24 triage open items` also touches the file.
- The project root `CLAUDE.md` includes a note (under "Language & Tone"): *"All user-facing content for the Asturias project must be in Spanish unless explicitly stated otherwise."* That instruction's literal subject is "the Asturias project" (Paisaxe), but the Chapa public-flow refactor in PR #819 applied a Spanish-only treatment to Chapa.

### 1.6 Anything else translated, gated, or detection-driven? No.

- No cookies, headers, or storage keys related to locale exist in Chapa source (verified by the greps above and by the absence of `i18n` / `locale` / `translation` directories under `apps/web`).
- Other Spanish-looking text in Chapa source (heatmap labels, dashboard insights) flagged by an initial grep was a false positive — those files matched on the literal word "language" only (e.g. programming-language detection in `lib/github/merge.ts`), not on locale logic.

---

## 2. Paisaxe — language switcher reference

### 2.1 Module layout (`/Users/juan/code/paisaxe/src/lib/i18n/`)

Files (verified by `ls`):

```
ast.ts     de.ts      detect-language.ts      en.ts
es.ts      fr.ts      index.ts                pt.ts
provider.tsx           resolve.ts             types.ts
use-translation.ts
+ tests: detect-language.test.ts, provider.test.tsx, resolve.test.ts, translations.test.ts
```

`index.ts:1-3` re-exports `LanguageProvider`, `useTranslation`, and `Locale`. No third-party i18n dependency is involved.

### 2.2 Locale shape

- `types.ts:1` — `export type Locale = 'es' | 'en' | 'fr' | 'de' | 'pt' | 'ast';`
- `types.ts:3-5` — `Translations` is a recursive `{ [key: string]: string | Translations }` (dot-notation keys).
- Translation files: `es.ts` and `en.ts` are 514 lines each (`wc -l`); `fr/de/pt/ast` are siblings of similar shape.

### 2.3 Detection + persistence (`detect-language.ts`)

- Lines 3-5 — supported locales array, `DEFAULT_LOCALE = 'es'`, `STORAGE_KEY = 'paisaxe-locale'`.
- `mapLanguageTag(tag)` (`detect-language.ts:11-17`) — splits on `-`, lowercases the primary subtag, returns the matching `Locale` or `null`.
- `detectBrowserLanguage()` (`:25-46`) — iterates `navigator.languages` (in user-preference order) first; falls back to `navigator.language`; finally returns `DEFAULT_LOCALE` (`'es'`). Server-side returns `'es'` immediately.
- `getStoredLocale()` (`:52-65`) — reads `localStorage[STORAGE_KEY]`, validates against `SUPPORTED_LOCALES`, swallows `try/catch` errors (private-mode safe).
- `storeLocale(locale)` (`:70-78`) — writes `localStorage[STORAGE_KEY]`; SSR no-op; swallows errors.
- `resolveLocale()` (`:86-91`) — **stored preference wins** over browser detection; default last.

### 2.4 React provider (`provider.tsx`)

- `provider.tsx:19-31` — module-level `Map<Locale, Translations>` cache; `es` and `en` are statically imported and pre-seeded; `fr/de/pt/ast` are dynamic-imported on demand (`~14KB each` per the comment at line 23).
- `provider.tsx:48` — `LanguageContext` created via `createContext`.
- `provider.tsx:56-69` — initial state is always `'es'` (SSR-safe), then `useEffect` calls `resolveLocale()` after hydration to flip to the browser/stored value. Comment at lines 57-58 explicitly cites hydration-mismatch prevention.
- `provider.tsx:72-81` — second `useEffect` lazy-loads the bundle for any locale not in the cache, then bumps `loadGeneration` to retrigger the memoized `t`.
- `provider.tsx:83-86` — `setLocale` updates state **and** calls `storeLocale(newLocale)` so the choice persists.
- `provider.tsx:88-95` — `t(key)` uses `resolveTranslation` against the cached locale, falling back to `es`.
- Mounted in `paisaxe/src/app/providers.tsx:37` inside the global client provider tree (above `FeatureFlagsProvider` and `AuthProvider`).

### 2.5 `<html lang>` sync

- `paisaxe/src/components/a11y/lang-sync.tsx` (full file, ~14 lines): `"use client"` component that calls `useTranslation()`, then in `useEffect` sets `document.documentElement.lang = locale`. Returns `null`. Mounted in `paisaxe/src/app/providers.tsx:41`.

### 2.6 The picker component (`src/components/immersive/language-switcher.tsx`)

Read in full (185 lines). Key facts:

- **Languages list** (`:9-16`) — six entries `{ code, label, fullName }`:
  `ES / Español (ES)`, `AST / Asturianu (AST)`, `EN / English (EN)`, `FR / Français (FR)`, `DE / Deutsch (DE)`, `PT / Português (PT)`.
- **State / refs** (`:19-23`) — `useTranslation()` for `locale, setLocale, t`; `isExpanded` boolean; refs for the container, trigger button, and listbox.
- **Behaviors:**
  - Click-outside closes the dropdown (`:28-39`).
  - `Escape` closes and returns focus to trigger (`:42-54`).
  - Auto-focuses first option when opened (`:57-62`).
  - Arrow up/down/Home/End move focus among options; Enter selects (`:70-99`).
  - Selecting an option calls `setLocale(code)` (which writes localStorage via the provider) and closes the dropdown (`:64-67`).
- **Trigger button** (`:109-134`) — pill, displays current language code (e.g. `ES`) plus animated `ChevronDown` from `lucide-react`. Tailwind classes: `flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-white bg-white/10 backdrop-blur-sm border border-white/10 hover:bg-white/15 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70`.
- **Dropdown panel** (`:136-181`) — absolute-positioned, glassmorphism: `absolute top-full right-0 mt-2 p-1.5 rounded-xl bg-white/10 backdrop-blur-xl border border-white/20`. Uses `opacity/translate-y/scale` transitions on open/close, `cubic-bezier(0.65,0,0.35,1)`. Each option is a button with `role="option"`, `aria-selected`, staggered `animationDelay: 50 + index*30 ms`, and `animate-fade-in-up`. The active option flips to `bg-white text-black`; inactive options are `bg-white/10 text-white/80 hover:text-white hover:bg-white/15`.
- **Accessibility** (`:104-105, 116-117, 147-148, 156-157`) — `role="group"` + `aria-label={t("accessibility.language_switcher")}` on the wrapper, `aria-expanded`/`aria-haspopup="listbox"` on the trigger, `role="listbox"` on the panel, `role="option"` + `aria-selected` + per-option `aria-label` (full name) on each entry, `tabIndex={-1}` so arrow-key navigation owns focus.
- **Used at:** only `paisaxe/src/components/immersive/story-viewer.tsx:322` — placed in the absolute-positioned controls cluster `top-16 right-4 md:right-6 z-20` (`story-viewer.tsx:312-322`). It is not part of a global navbar.

### 2.7 Hook for consumers (`use-translation.ts`)

- `use-translation.ts:19-37` — returns `{ locale, setLocale, t }`. If called outside a `LanguageProvider`, returns a memoized fallback that resolves keys against `es` and warns once via `console.warn`.

---

## 3. Cross-codebase observations (factual only)

| Aspect | Chapa (`apps/web`) | Paisaxe (`src`) |
|---|---|---|
| i18n library | none | bespoke (no dep) |
| Locales supported | n/a (single Spanish copy constant) | 6: es, en, fr, de, pt, ast |
| Translation storage | `lib/copy/public-flow.ts` constant | `lib/i18n/{locale}.ts`, dot-notation keys |
| Detection input | none | `navigator.languages` → `navigator.language` → default `es` |
| Persistence | none | `localStorage["paisaxe-locale"]` |
| `<html lang>` | static `"en"` (`layout.tsx:76`) | synced via `LangSync` component |
| Picker UI | does not exist | `components/immersive/language-switcher.tsx` |
| Picker mount | n/a | inside immersive `story-viewer` controls only |
| Provider mount | n/a | `app/providers.tsx:37` |
| Hook | n/a | `useTranslation()` returns `{ locale, setLocale, t }` |

---

## 4. What "the page loads in Spanish" maps to in code

For Chapa specifically (the user's reported behavior):

- The landing page `/` (`apps/web/app/page.tsx:20`) renders `SPANISH_PUBLIC_COPY.landing` directly. There is no conditional, no detection, no fallback. Every visitor — Spain, US, anywhere — receives the same Spanish strings.
- No code in `apps/web` consults geo-IP, `Accept-Language`, `navigator.language`, cookies, or storage to vary copy.
- The only signal that *could* explain a Spanish-looking page beyond the hardcoded copy is browser-level auto-translation (e.g. Chrome's "Translate this page"), but there is no application-side mechanism in Chapa source that would do this.

---

## 5. File index (for follow-up)

**Chapa (current state):**
- `apps/web/app/layout.tsx:76` — `<html lang="en">`
- `apps/web/lib/copy/public-flow.ts:1-228` — `SPANISH_PUBLIC_COPY`
- `apps/web/app/page.tsx:8,20` — landing consumes Spanish copy
- `apps/web/app/verify/{page,VerifyForm,[hash]/page}.tsx` — verify flow consumes Spanish copy
- `apps/web/app/generating/[handle]/{page,GeneratingProgress}.tsx` — generation flow consumes Spanish copy
- `apps/web/app/{error,u/[handle]/error}.tsx` — error boundaries consume Spanish copy
- `apps/web/components/SharePageOwnerContent.tsx:11,27` — share visitor copy

**Paisaxe (reference implementation):**
- `src/lib/i18n/index.ts` — public exports
- `src/lib/i18n/types.ts` — `Locale` union and `Translations` recursive type
- `src/lib/i18n/detect-language.ts` — detection + `localStorage` persistence (key `paisaxe-locale`)
- `src/lib/i18n/resolve.ts` — dot-notation resolver with key fallback
- `src/lib/i18n/provider.tsx` — Context provider, static + lazy locale loading
- `src/lib/i18n/use-translation.ts` — consumer hook with safe fallback
- `src/lib/i18n/{es,en,fr,de,pt,ast}.ts` — translation tables (es and en static, others lazy)
- `src/components/a11y/lang-sync.tsx` — syncs `<html lang>` to current locale
- `src/components/immersive/language-switcher.tsx` — picker component (185 lines)
- `src/components/immersive/story-viewer.tsx:322` — picker mount point
- `src/app/providers.tsx:37,41` — `LanguageProvider` + `LangSync` mounted in the global client provider tree
