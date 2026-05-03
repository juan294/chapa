# Phase 5 — Final QA & docs

**Status:** sequential after Phase 4a–4e all merged.
**Depends on:** Phases 1, 2, 3, 4a, 4b, 4c, 4d, 4e all merged to develop with green CI.
**Worktree:** `.worktrees/i18n-finalize` or `../chapa-i18n-finalize`.

---

## Goal

Lock everything down. Audit for missed strings, run the full local validation suite, do a manual visual sweep across every translated page in both locales, update internal docs, and ship.

---

## Tasks

### 5.1 — String coverage audit

Run a grep sweep to catch any hardcoded user-visible strings that slipped through. Patterns:

```bash
# JSX text nodes that look like English sentences (capital-first, period-end, multi-word)
rg -n '>\s*[A-Z][a-z]+(\s+[A-Za-z]+){2,}[.!?]\s*<' apps/web/app apps/web/components --type tsx \
  | rg -v '\.test\.' | rg -v '\.render\.test\.'

# Hardcoded aria-label
rg -n 'aria-label="[A-Z]' apps/web/app apps/web/components --type tsx \
  | rg -v '\.test\.' | rg -v 'aria-label=\{t\('

# Hardcoded alt
rg -n 'alt="[A-Z]' apps/web/app apps/web/components --type tsx \
  | rg -v '\.test\.'
```

For each hit on a public-route file, either:
- Wire it through `t()` (add a key, translate it).
- Confirm it's intentionally English-only (badge SVG, brand wordmark, JSON-LD) — add a comment justifying.

### 5.2 — Parity check + leaf audit

```bash
pnpm test apps/web/lib/i18n/dictionaries/parity.test.ts
```

Plus a custom audit script that:

- Lists every dotted path in `en.ts`.
- Asserts every path resolves to a non-empty leaf in both `en.ts` and `es.ts`.
- Prints a summary: total keys, total characters per locale.

Optionally commit this script under `scripts/i18n-audit.ts` so future PRs can run it.

### 5.3 — Full local validation

```bash
pnpm install
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run test:coverage             # ensure no regression in coverage
pnpm run build                     # production build must succeed
```

If any test count fell, investigate. Coverage delta should be net-positive (lots of new code, lots of new tests).

### 5.4 — Manual visual sweep

For **each public route**, in **each locale**, verify the page renders without untranslated strings, layout breakage, or missing keys (i.e., no literal `landing.hero.title` strings appearing).

Routes to walk (16 total):

- `/`
- `/verify`, `/verify/<test-hash>`
- `/generating/<your-handle>` (trigger from logged-in flow)
- `/u/<your-handle>` (logged-in owner view)
- `/u/<other-handle>` (logged-out visitor view)
- `/about`, `/about/scoring`, `/about/verification`
- `/archetypes/builder`, `/guardian`, `/marathoner`, `/polymath`, `/artificer`, `/balanced`, `/emerging`
- `/privacy`, `/terms`
- `/cli/authorize` (with and without session param)
- `/coming-soon`

For each: check `<html lang>`, page chrome (navbar + footer + picker), all visible body text, all aria labels (use a screen-reader pass on at least the landing page), and `generateMetadata` output (view source: `<title>`, `<meta name="description">`, OG tags).

### 5.5 — Lighthouse / a11y

Lighthouse a11y score on `/`, `/about`, `/u/<handle>`, `/archetypes/builder` in both locales. Threshold ≥ 95. The picker's listbox semantics must not regress the score.

### 5.6 — Performance check

The dynamic-rendering trade-off (F2) means TTFB on translated pages will be slightly worse than ISR. Measure on a deployed preview:

- Cold-start TTFB on `/` — target < 500 ms p95.
- Edge cache hit ratio after 5 minutes of traffic — should be > 80% if `Cache-Control: s-maxage=60, stale-while-revalidate=86400` is correctly set.

If TTFB regression is unacceptable, reopen F2 trade-off; otherwise document.

### 5.7 — Update internal docs

- `CLAUDE.md` — add a brief "i18n" section under Stack decisions or in a new top-level section. Mention: cookie-based locale, Accept-Language fallback, two `t()` surfaces, key-parity test guardrail. Link to `docs/research/2026-05-02-language-picker-and-i18n-state.md` and to this plan.
- `docs/accepted-risks.md` — add the "Public-page i18n requires dynamic rendering" entry (already added in Phase 2; reaffirm here).
- `CLAUDE.md` "Engineering rules" — add: "When adding user-visible text on a public page, route it through `t()` and add the key to both `en.ts` and `es.ts`. The key-parity test will fail otherwise."
- `docs/design-system.md` — note the `LanguageSwitcher` as part of the navbar widget set (next to ThemeToggle).

### 5.8 — GitHub issue cleanup

Close the parent issue created at the start of the plan with a summary comment listing all phase PRs. If there are TODOs found in 5.1 that we deliberately deferred (e.g., a lone English string in a low-priority component), file follow-up issues with `area: ux` + `type: enhancement`.

### 5.9 — Release-prep checklist

This phase ends on `develop`, not `main`. Per `CLAUDE.local.md` Production Safety, the user must explicitly authorize the develop → main release. Phase 5 prepares the release summary:

```bash
git log main..develop --oneline | grep -i 'i18n\|locale\|switcher'
gh run list --branch develop --limit 5
```

Prepare a release note draft (do not push, do not create the PR — wait for user authorization):

> **Language picker + full public-page i18n.** Chapa now supports English and Spanish across every public page. The new picker (next to the theme toggle) lets you choose; your choice is saved in a cookie. The default is detected from your browser's `Accept-Language` header. Trade-off: public pages are now server-dynamic instead of ISR-cached.

---

## Definition of done

### Automated

- Audit grep returns zero unjustified hits.
- All tests + typecheck + lint + build green.
- `i18n-audit.ts` reports all keys non-empty in both locales.
- Coverage delta net-positive.

### Manual

- All 16 public routes verified in both locales — no untranslated strings, no layout breakage.
- Lighthouse a11y ≥ 95 across the four checked pages in both locales.
- TTFB on `/` < 500 ms p95 on preview.
- Internal docs updated.
- Parent GitHub issue closed; follow-up issues filed for any deferred items.

### File checklist

- [ ] `scripts/i18n-audit.ts` (optional but recommended)
- [x] `CLAUDE.md` updated
- [x] `docs/accepted-risks.md` updated
- [x] `docs/design-system.md` updated
- [x] Parent GitHub issue closed with summary
- [x] Release notes drafted (not pushed) for user-authorized develop → main PR

---

## STOP. Plan complete. Wait for user to authorize the develop → main release.
