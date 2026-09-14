# Phase 1 — Shared design system and shell foundation

Parent: [implementation plan](../2026-09-05-chapa-redesign.md). Dependency: none. Not batch-eligible.

## Result

Existing Chapa routes use the approved paper/charcoal, vermilion/ice, neutral-rule system and font hierarchy through the existing token architecture. Shared controls, navigation and signature are coherent before composing the new landing.

## Files and evidence

- `apps/web/styles/globals.css:23` and `apps/web/app/layout.tsx:31`: token definitions and runtime fonts.
- `apps/web/components/StatusCallout.tsx:1`, `apps/web/components/ConfirmDialog.tsx:84`, `apps/web/components/LoginCtaButton.tsx:99`, `apps/web/components/SectionHeader.tsx:1`, `apps/web/components/content/ContentPageHeader.tsx:1`, `apps/web/components/content/OnThisPageIndex.tsx:27`, `apps/web/components/dashboard/InsightCard.tsx:1`, `apps/web/components/LiteYouTubeEmbed.tsx:1`: restyle existing exported components; preserve props/behavior.
- `apps/web/components/NavbarShell.tsx:41`, `apps/web/components/MobileNav.tsx:1`, `apps/web/components/LanguageSwitcher.tsx:7`, `apps/web/components/ThemeToggle.tsx:11`, `apps/web/components/GlobalCommandBar.tsx:161`, `apps/web/components/AuthorTypewriter.tsx:184`, `apps/web/components/SiteFooter.tsx:51` and `apps/web/components/terminal/TerminalInput.tsx:149`, `apps/web/components/terminal/TerminalOutput.tsx:1`, `apps/web/components/terminal/AutocompleteDropdown.tsx:115`: shared presentation.
- `.design-sync/config.json:2`, `.design-sync/fonts.css:1`, `.design-sync/conventions.md:1`, `apps/web/.ds-entry.tsx:11`, `docs/design-system.md:1`, `CLAUDE.md:135`: source/export documentation.
- Existing tests: `apps/web/styles/tokens.test.ts:62`, `apps/web/styles/globals.test.ts:145`, `apps/web/lib/test-helpers/css-tokens.ts:80`, `scripts/design-sync-emit-tokens.test.ts:49`.

## Changes (pseudocode)

```text
verify approved source files against reference-manifest.json
archive exact approved HTML/CSS/JS and badge reference sources under
    docs/design/chapa-redesign-reference/ (review assets only; no app imports)
record source baseline/hash and preserve proposal's sample/version labels

@theme:
    update existing families to parent plan target table
    retain warm-* / amber* / forest* names and single paired declarations
    add identity/closing/action semantic roles and font-display
    keep fixed dark status roles distinct from theme-aware status roles
    replace green-tinted grid/glow/shadow values with neutral rules/offsets

Next fonts:
    retain JetBrains Mono -> heading + terminal
    Manrope -> body
    Barlow Condensed -> display (selected expressive headings only)
    keep existing bundled SVG fonts independent of Next font imports
    retain browser-loadable Plus Jakarta for SVG metrics/footer/tier alongside Manrope
    verify SVG literal family names resolve to loaded faces, not only Next variables

shared controls:
    primary action -> bg-action text-action-text hover:bg-action-hover
    outline -> current semantic surface/text/border/focus roles
    technical headings/wordmark/prompts remain monospace
    panels/CTA corners square or restrained 3px
    keep avatars/icon buttons round; AuthorTypewriter remains a pill
    reserve command-bar width for pill and page bottom space for bar
    retain all event handlers, mounted providers, feature/session gates

sync:
    same config schema/project/package/cssEntry/barrel/15 exports
    fonts.css binds all four semantic font roles without Next runtime
    correct OnThisPageIndex manual props to include heading:string
    update conventions and design-system rules to actual new tokens
    add safelist rules only for utilities named in conventions and absent in CSS
```

Use a scoped fixed-dark presentation context for terminal child text/status/selection so light page mode does not put light-theme status text on the dark dock. Do not introduce a second token system or globally override theme tokens in the dock.

Preserve the existing browser Plus Jakarta loader until literal-family delivery is verified. If the installed Next font output does not expose the literal SVG names, bind canonical `Plus Jakarta Sans` and `JetBrains Mono` faces in browser CSS to the existing bundled TTF assets through static asset URLs; do not change the pure SVG to rely on CSS variables. Keep font loading explicit in the standalone sync bindings too. Browser SVG and resvg typography are separate checks (`apps/web/lib/render/font-files.ts:45`).

Revise obsolete assertions rather than deleting guards: derive contrast test surfaces from current page/card/stage tokens, replace Jade-hue-specific assertions with new accent/status/verification distinctions, and compare emitted paired values to source. Token count may grow from 58 through additive roles; every source token must still export once. Verify normal, hover, focus, selected, disabled and destructive actions, including the root skip link (`apps/web/app/layout.tsx:169`).

## Automated success criteria

- [x] Token structure, actual-surface contrast and emitter preservation pass; text-bearing alpha fills are composited before contrast evaluation.
- [x] Existing navbar, mobile navigation, theme, signature, dialog, CTA and exported component behavior tests pass with unchanged semantics.
- [x] All 15 exports still import through the existing entry; manual prop metadata agrees with source.
- [x] Browser SVG text uses loaded Plus Jakarta/JetBrains faces; the body uses Manrope. `font-display` has a compiled utility and a loaded Barlow Condensed face.
- [x] System/light/dark preference and hydration tests pass; no duplicate theme persistence.
- [x] Parent gate commands pass sequentially.

Focused check:

```sh
pnpm exec vitest run apps/web/styles/tokens.test.ts apps/web/styles/globals.test.ts scripts/design-sync-emit-tokens.test.ts apps/web/components/ThemeProvider.render.test.tsx apps/web/components/ThemeToggle.test.tsx apps/web/components/NavbarShell.render.test.tsx apps/web/components/MobileNav.render.test.tsx apps/web/components/AuthorTypewriter.test.tsx
```

After starting the reviewed local app on port 3001:

```sh
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001 pnpm --filter @chapa/web exec playwright test e2e/theme.spec.ts --project=chromium --project=mobile --workers=1
```

## Manual visual success criteria

- [x] Both themes visibly express the approved grounds/type/rules, with technical UI still monospace.
- [x] EN/ES navbar controls fit at 390px; language and theme pickers remain visible and usable.
- [x] Desktop signature pill keeps shape, location, message cycle and social popover; dock does not overlap content or pill.
- [x] Shared component states, including verification and error, remain legible and distinct; no white-on-coral carryover.
- [x] Screenshots and any contrast-driven target adjustments are recorded against the rubric.

Stop after presenting this phase's local evidence. Badge version, landing composition and new command behavior belong to later phases.

Implementation evidence: [Phase 1 report](evidence/phase1/report.md).
