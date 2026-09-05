# Chapa conventions

Chapa is a developer-impact product with a terminal-first, developer-tool
aesthetic. Build with these conventions, not generic ones.

## Setup

No provider is required. Every component renders correctly on its own, because
the design language lives entirely in CSS custom properties in the shipped
stylesheet. Each is written once as `light-dark(<light>, <dark>)`; the root's
`color-scheme` decides which half resolves.

Themes use paper and warm-white panels in light mode, charcoal and ink in dark
mode, vermilion/coral emphasis and ice stages. With no attribute the page follows
the operating system. Set `data-theme="light"` or `data-theme="dark"` to force
one. Keep the single `light-dark()` token declarations and color-scheme wiring.

```jsx
<div data-theme="dark" className="bg-bg text-text-primary font-body">
  <StatusCallout variant="verification" title="Metrics verified"
    description="Signed with HMAC-SHA256." />
</div>
```

## Styling idiom: Tailwind v4 semantic utilities

Style with the semantic utility classes below. **Never write a raw hex value**
and never use Tailwind's stock palette (`bg-slate-900`, `text-gray-500`) — the
tokens are the design language, and raw colours break theming.

| Purpose | Classes |
|---|---|
| Surfaces | `bg-bg` (page), `bg-card` (panels), `bg-dark-section` (emphasis band) |
| Text | `text-text-primary`, `text-text-secondary`, `text-terminal-dim` (meta lines, prefixes, `$`/`>` glyphs) |
| Accent | `bg-amber` (fills/tints), `text-amber-text` (small accent text/icons) |
| Primary action | `bg-action text-action-text hover:bg-action-hover` |
| Narrative fields | `bg-identity-surface text-identity-text`, `bg-closing-surface text-closing-text` |
| Badge stage | `bg-hero-band` or `bg-purple-tint` |
| Borders | `border-stroke` (neutral divider), `border-stroke-strong` (strong rule) |
| Status | `text-terminal-green`, `text-terminal-red`, `text-complement-text` (slate-blue verification) |
| Type | `font-heading` and `font-terminal` (JetBrains Mono), `font-body` (Manrope), selective `font-display` (Barlow Condensed) |
| Depth | `shadow-card`, `hover:shadow-card-hover` (neutral solid offsets) |
| Fixed ink terminal | `bg-forest`, `bg-forest-card`, `border-forest-line`, `text-forest-text`, `text-forest-dim`, `text-forest-ok`, `text-forest-warn`, `text-forest-err` |

Use semantic roles for both foreground and background. Primary actions keep
`text-action-text` on normal and hover fills. Never put white text directly on
the brand fill. Small accent text uses `text-amber-text`; translucent fills need
contrast measured after compositing on their actual surface.

- Historical `amber`, `warm-*` and `forest-*` token names remain compatibility
  aliases; the brand accent is now vermilion/coral, and the fixed terminal is ink.
- Preserve green success, distinct error/warning, dimension and archetype roles.
  Verification on the website uses slate-blue complement tokens, with
  `text-complement-text` and `hover:text-complement-text-hover` for text.
- Status colors resolve per surface. Theme-aware `terminal-*` belongs on page
  surfaces; fixed ink terminals use the corresponding `forest-*` colors.
- Technical headings, commands and metadata stay monospace. Never italicize
  JetBrains Mono. Use Barlow only for expressive headings; content pages remain
  restrained. Manrope is body/UI, while SVG metrics retain Plus Jakarta Sans.
- Panels and text buttons use square or restrained 3px corners. Avatars, icon
  buttons and the animated author signature retain their round shapes.
- Interactive controls retain at least 44×44px hit areas. Content text has an
  11px floor; ordinary copy is 14–16px. Spanish must wrap naturally.
- Prefer flat fields, thin rules and 3px/5px offset shadows; no brand glow.

## Components

Fifteen components in four groups. Read each `.prompt.md` and `.d.ts` before
using one; they carry the real prop contract.

- **general** — `StatusCallout` (4 variants: success, error, warning,
  verification), `ConfirmDialog`, `LoginCtaButton`, `ClaudeCodeStar`,
  `LiteYouTubeEmbed`, `SectionHeader`
- **content** — `ContentPageHeader`, `OnThisPageIndex`
- **dashboard** — `InsightCard`, `Sparkline`
- **icons** — `GitHubIcon`, `GitlabIcon`, `BitbucketIcon`, `CodebergIcon`,
  `CopyIcon` (all take `className` for sizing, e.g. `className="w-5 h-5"`)

Two things to know:

- `ConfirmDialog` defaults to `variant="destructive"`, so a non-destructive
  dialog must pass `variant="default"` explicitly.
- `SectionHeader` and `ContentPageHeader` are the page-structure primitives.
  Both take a `command` **without** the `%` prefix — the component draws it.
  `OnThisPageIndex` takes its own `heading` string; it resolves the active item
  from the URL hash and the clicked link.

## Where the truth lives

`styles.css` and its import closure are authoritative for every token and
utility. Read them before inventing a style. Per-component contracts are in
`components/<group>/<Name>/<Name>.d.ts` and `.prompt.md`.

## Not in this system

The Chapa **badge** — the embeddable SVG showing a developer's Impact Profile —
is not a component here and must not be recreated. It is rendered server-side
before app CSS exists, so it cannot reference these tokens, it is always dark
regardless of theme, and it uses its own coral verification colour. Reference
it as an image if a design needs it; never rebuild it from these parts.
