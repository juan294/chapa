# light-dark() token layer, and no @supports fallback

Date: 2026-08-29
Status: Accepted
Issues: #1211, #1212

## Context

Every themed color in `apps/web/styles/globals.css` was written twice: once in
`:root` for light and once in `[data-theme="dark"]` for dark. Adding a token
meant remembering both blocks, and the design system had to carry a rule
telling authors to do it. Three tokens had already drifted or needed follow-up
fixes (#1189, #1189 follow-up, #1206) partly because of that duplication.

The v2 design handoff replaces this with one declaration per token:

    --color-bg: light-dark(#f7fbf8, #08170f);

`color-scheme` on the root element decides which half resolves. That gives
three modes with no class toggling: `color-scheme: light dark` follows the
operating system, and an explicit choice sets `light` or `dark` on the same
element. Native form controls, scrollbars and focus rings follow the same
signal for free.

## Decision

1. All themed colors move into the `@theme` block as `light-dark()` values.
   The `:root` and `[data-theme="dark"]` custom property blocks are deleted.
   `data-theme` now carries `color-scheme` only, and stays on the element
   because components still read it.
2. `ThemeToggle` cycles system, light and dark instead of toggling two states.
3. There is **no hand-written `@supports` fallback**. The build already emits
   one; see below.

## Why no hand-written fallback

`light-dark()` needs Chrome and Edge 123+, Safari 17.5+, Firefox 120+ to run
natively, so the handoff asked whether a `@supports` guard was needed.

It is not, and the reason is verified against the build output rather than
assumed. Next.js 16 minifies CSS with LightningCSS, which compiles
`light-dark()` down to a custom-property toggle that works anywhere custom
properties do. From `apps/web/.next/static/chunks/*.css` after
`pnpm run build`:

    :root { --lightningcss-light: initial; --lightningcss-dark: ; color-scheme: light dark }
    @media (prefers-color-scheme: dark) {
      :root { --lightningcss-light: ; --lightningcss-dark: initial }
    }
    [data-theme=light] { --lightningcss-light: initial; --lightningcss-dark: ; color-scheme: light }
    [data-theme=dark]  { --lightningcss-light: ; --lightningcss-dark: initial; color-scheme: dark }

    --color-bg: var(--lightningcss-light, #f7fbf8) var(--lightningcss-dark, #08170f);

LightningCSS reads `color-scheme` off the same selectors this file sets it on,
so all three modes survive the transform. The same treatment applies inside
`--shadow-card`, `.img-outline` and `.bg-grid-warm`, where `light-dark()` sits
in a nested position, and `color-mix(in oklab, ...)` is resolved to a literal
at build time.

A hand-written `@supports` block would therefore add nothing, while reinstating
exactly the paired-block duplication this change exists to delete.

## Consequences

- Adding a themed color is one line. The design system rule "always define both
  light and dark values" becomes "write one `light-dark()` value".
- Token tests read the `@theme` block and split `light-dark()` rather than
  comparing two selector blocks. The shared parsing and WCAG contrast math live
  in `apps/web/lib/test-helpers/css-tokens.ts`, replacing two copies of the
  same functions inside `globals.test.ts`.
- Users who never touch the toggle now follow their operating system, which was
  already true (`defaultTheme="system"`, #1173). What is new is that they can
  return to that state after making a choice.
