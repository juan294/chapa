# Phase 3 — LanguageSwitcher component + nav mount

**Status:** [batch-eligible after Phase 1] — runs in parallel with Phase 2.
**Depends on:** Phase 1 fully merged. Does **not** require Phase 2 (different files).
**Worktree:** `.worktrees/i18n-switcher` or `../chapa-i18n-switcher`.
**Files affected:** new `LanguageSwitcher.tsx`, edits to `Navbar.tsx`, `NavbarClient.tsx`, `MobileNav.tsx`.

---

## Goal

Build the picker. Behaviorally identical to Paisaxe's `language-switcher.tsx` (full keyboard nav, click-outside, focus management, ARIA `listbox`/`option` semantics). Visually a Chapa-native nav widget — terminal aesthetic, sits alongside `ThemeToggle`. Mounts in both desktop navbars and inside the mobile drawer.

After this phase: clicking the picker writes the cookie via the Phase 1 server action and `router.refresh()`s. With Phase 2 also merged, the page re-renders in the new language with no flash. (Ordering: ship Phase 2 to develop first if running in parallel; the picker UI works the moment it lands but only meaningfully changes anything once Phase 2's consumers are all rewired.)

---

## Tasks

### 3.1 — Component scaffold (TDD: full Paisaxe test suite ported first)

Port `paisaxe/src/components/immersive/language-switcher.test.tsx` into `apps/web/components/LanguageSwitcher.test.tsx`, adapting:

- Drop the glassmorphism-specific class assertions.
- Adapt selectors for the new ARIA labels (use the `aria.languageSwitcher` key).
- Test that selecting a locale calls `setLocale` (which under the hood calls `setLocaleAction`).
- Test that the trigger label updates after selection.
- Keep all behavioral tests: open/close, arrow nav, Home/End, Enter, Escape, click-outside, focus return, `aria-expanded`, `aria-selected`, `role="listbox"`, `role="option"`.

Tests should **fail** before the component is implemented.

### 3.2 — Component implementation

**Pseudocode** — `apps/web/components/LanguageSwitcher.tsx`:

```tsx
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from '@/lib/i18n';
import type { Locale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const LANGUAGES: { code: Locale; label: string; fullName: string }[] = [
  { code: 'en', label: 'EN', fullName: 'English' },
  { code: 'es', label: 'ES', fullName: 'Español' },
];

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);

  const current = LANGUAGES.find(l => l.code === locale) ?? LANGUAGES[0];

  // Behavior — direct port from Paisaxe (paisaxe/src/components/immersive/language-switcher.tsx:28-99):
  //   - click-outside listener while open
  //   - Escape closes + returns focus to trigger
  //   - auto-focus first option on open
  //   - ArrowDown/Up wrap, Home/End jump, Enter selects
  //   - selecting calls setLocale(code) and closes

  return (
    <div ref={containerRef} role="group" aria-label={t('aria.languageSwitcher')} className="relative">
      <button
        ref={triggerRef}
        onClick={(e) => { e.stopPropagation(); setIsExpanded(v => !v); }}
        aria-expanded={isExpanded}
        aria-haspopup="listbox"
        // CHAPA SKIN — match ThemeToggle proportions and terminal tokens
        className={cn(
          'flex h-11 items-center gap-1.5 px-3 rounded-lg',
          'font-heading text-sm text-terminal-dim',
          'transition-colors hover:text-amber',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber/40',
        )}
      >
        <span>{current.label}</span>
        <ChevronIcon expanded={isExpanded} />
      </button>

      <div
        role="listbox"
        aria-label={t('aria.languageSwitcher')}
        ref={listboxRef}
        onKeyDown={handleListboxKeyDown}
        className={cn(
          'absolute top-full right-0 mt-2 p-1.5 min-w-[8rem] rounded-lg',
          'bg-card border border-stroke shadow-card',     // CHAPA SKIN
          'transition-all duration-200 ease-out',
          isExpanded ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
                     : 'opacity-0 -translate-y-2 scale-95 pointer-events-none',
        )}
      >
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            role="option"
            aria-selected={locale === lang.code}
            aria-label={lang.fullName}
            tabIndex={-1}
            onClick={(e) => { e.stopPropagation(); handleSelect(lang.code); }}
            className={cn(
              'w-full text-left px-3 py-1.5 rounded-md',
              'font-heading text-sm transition-colors',
              locale === lang.code
                ? 'bg-amber/10 text-amber'                 // active option = amber
                : 'text-terminal-dim hover:text-text-primary hover:bg-stroke/30',
            )}
          >
            {lang.label} <span className="text-terminal-dim/70">— {lang.fullName}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

Inline `ChevronIcon` follows the project's "no icon library — inline SVG" rule (see `docs/design-system.md` Icons section). 1.5 stroke width, `aria-hidden`.

### 3.3 — Mount in `Navbar.tsx` (server component navbar)

`Navbar.tsx` is a server component. The `LanguageSwitcher` is a client island — importable directly inside a server tree with no extra wrapper.

**Pseudocode** — `apps/web/components/Navbar.tsx`:

```diff
+ import { LanguageSwitcher } from './LanguageSwitcher';

  // ...
        <div className="flex items-center gap-1 sm:gap-2">
+         <LanguageSwitcher />
          <ThemeToggle />
          {session ? <UserMenu .../> : <a href="/api/auth/login">...</a>}
        </div>
```

### 3.4 — Mount in `NavbarClient.tsx` (client navbar)

Same change pattern as 3.3.

### 3.5 — Mount in `MobileNav.tsx` drawer

The mobile drawer should also expose the picker. Pseudocode:

```diff
  <div role="dialog" aria-label={t('aria.mobileNavigation')}>
    {/* nav links */}
+   <div className="border-t border-stroke pt-4 mt-4 flex items-center gap-2">
+     <LanguageSwitcher />
+     <ThemeToggle />
+   </div>
  </div>
```

(MobileNav already exists; adjust to match existing drawer layout. The exact placement is a small UX detail — verify visually.)

### 3.6 — Visual / a11y regression tests

- Update `Navbar.render.test.tsx` and `NavbarClient.render.test.tsx`: assert presence of the LanguageSwitcher, presence of correct ARIA labels in both locales (resolve fixture switches `<LanguageProvider initialLocale="es">` etc.).
- Add `MobileNav.render.test.tsx` assertion for the picker's presence in the drawer.

### 3.7 — Lighthouse-style a11y check

In a manual pass: run Chrome DevTools Lighthouse on `/` with the picker present. Score must stay ≥ 95 for accessibility. The picker's listbox semantics are the new risk surface.

---

## Definition of done

### Automated

- New `LanguageSwitcher.test.tsx` — port of Paisaxe's tests, all behaviors covered: render, expand/collapse, keyboard nav (arrows/Home/End/Enter/Escape), click-outside, focus return to trigger, `aria-selected` correctness, `setLocale` invocation, label updates after selection.
- Updated nav render tests assert switcher presence and locale-aware labels.
- Full test suite + typecheck + lint green.

### Manual

- Picker visible in desktop navbar (both `Navbar` and `NavbarClient` instances) and mobile drawer.
- Click → dropdown opens with smooth animation.
- Arrow keys cycle, Home/End jump, Enter selects, Escape closes + focus returns to trigger.
- Click-outside closes.
- Selecting EN ↔ ES flips `<html lang>`, sets cookie (visible in DevTools → Application), and (with Phase 2 merged) all visible copy switches.
- Visual style fits the navbar — no glassmorphism, no white-on-white. Hover state amber, active option amber-tinted.
- Lighthouse a11y ≥ 95 in both locales.

### File checklist

- [x] `apps/web/components/LanguageSwitcher.tsx`
- [x] `apps/web/components/LanguageSwitcher.test.tsx` (port from Paisaxe)
- [x] `apps/web/components/Navbar.tsx` updated
- [x] `apps/web/components/NavbarClient.tsx` updated
- [x] `apps/web/components/MobileNav.tsx` updated
- [x] Render tests updated for all three navs

---

## Notes for `/batch` execution

This phase touches:
- `apps/web/components/LanguageSwitcher.tsx` (new)
- `apps/web/components/Navbar.tsx`
- `apps/web/components/NavbarClient.tsx`
- `apps/web/components/MobileNav.tsx`

Phase 2 does NOT touch any of these files (Phase 2 only adds `aria.*` keys to dictionaries; the rewires happen in Phase 2 *for* these files only adding `useTranslation()` for existing strings — see file matrix in Phase 2.4). **There is overlap: Phase 2 rewires `Navbar.tsx`, `NavbarClient.tsx`, and `MobileNav.tsx` to read aria labels from `t()`.**

**Resolution:** despite the marker, in practice Phase 3 should be developed in a worktree that branches from a Phase-2-merged develop, not parallel. Updating the main plan to mark Phase 3 as **sequential after Phase 2** instead.

> **Correction to main plan:** Phase 3 is *not* batch-eligible. It is sequential after Phase 2. The four navbar files are touched by both. See "STOP" instruction below.

---

## STOP after this phase. Wait for user confirmation before Phase 4a–4e.
