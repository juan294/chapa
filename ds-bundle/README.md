# Chapa conventions

Chapa is a developer-impact product with a terminal-first, developer-tool
aesthetic. Build with these conventions, not generic ones.

## Setup

No provider is required. Every component renders correctly on its own, because
the design language lives entirely in CSS custom properties defined on `:root`
and `[data-theme="dark"]` in the shipped stylesheet.

Themes: **light is the default** (a mint-cast surface family); dark is the
signature brand look (a deep forest ground). Switch by setting
`data-theme="dark"` on a root element. Both palettes are complete, so
never hand-write a dark variant of a colour.

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
| Text | `text-text-primary`, `text-text-secondary`, `text-terminal-dim` (decorative glyphs only) |
| Accent | `text-amber`, `bg-amber`, `bg-amber-dark` (white text on a solid fill) |
| Borders | `border-stroke` (purple-tinted, the default divider) |
| Status | `text-terminal-green`, `text-terminal-red`, `text-complement-text` (teal, verification) |
| Type | `font-heading` (JetBrains Mono), `font-body` (Plus Jakarta Sans), `font-terminal` |
| Depth | `shadow-card`, `bg-grid-warm` (faint 72px grid) |

Opacity modifiers are idiomatic: `bg-amber/10`, `border-amber/20`.

Rules worth obeying exactly:

- The accent is **jade** green, `oklch(.66 .15 163)` in light and
  `oklch(.76 .16 163)` in dark, exposed as `text-amber` / `bg-amber`. The token
  name is doubly inaccurate: it was amber, then violet, and is now green. It is
  kept deliberately so the palette change stayed a pure value swap. Use the
  accent sparingly, for calls to action, active states, and key data.
- **Success green is not the accent green.** The accent sits at hue 163;
  `text-terminal-green` sits at hue 145, leafier and darker. Do not collapse
  them, or every success state reads as a brand highlight.
- Headings use `font-heading`, which is monospace. **Never apply italic to it.**
- White text on solid `bg-amber` fails AA (4.06:1). Use `bg-amber-dark` for that
  case.
- Verification UI uses the complement family, which is a cool **slate blue**
  (hue 225-228), and for text specifically `text-complement-text`. It was teal
  until the jade rebrand; teal sat too close to the green accent to signal
  cryptographic trust as distinct from the brand.
- Buttons are `rounded-lg`, never `rounded-full`, except icon-only controls.
- Interactive controls need a 44x44px minimum hit area.

## Components

Twelve components in three groups. Read each `.prompt.md` and `.d.ts` before
using one; they carry the real prop contract.

- **general** — `StatusCallout` (4 variants: success, error, warning,
  verification), `ConfirmDialog`, `LoginCtaButton`, `ClaudeCodeStar`,
  `LiteYouTubeEmbed`
- **dashboard** — `InsightCard`, `Sparkline`
- **icons** — `GitHubIcon`, `GitlabIcon`, `BitbucketIcon`, `CodebergIcon`,
  `CopyIcon` (all take `className` for sizing, e.g. `className="w-5 h-5"`)

One API trap: `ConfirmDialog` defaults to `variant="destructive"`, so a
non-destructive dialog must pass `variant="default"` explicitly.

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

# Chapa (@chapa/web@2.24.1)

This design system is the published @chapa/web React library, bundled as a single
browser global. All 12 components are the real upstream code.

## Where things are

- `_ds_bundle.js` — the whole-DS bundle at the project root; loads every component to `window.Chapa`. First line is a `/* @ds-bundle: … */` metadata header.
- `styles.css` — the single stylesheet entry: it `@import`s the tokens, fonts, and component styles (`_ds_bundle.css`). Link this one file.
- `components/<group>/<Name>/<Name>.prompt.md` (example JSX + variants), `<Name>.d.ts` (types), `<Name>.html` (variant grid).
- `tokens/*.css` — CSS custom properties, names verbatim from upstream.
- `fonts/` — `@font-face` files + `fonts.css` (when the package ships fonts).

For a specific component, `read_file("components/<group>/<Name>/<Name>.prompt.md")`.

## Loading

Add these two lines to your page once (React must be on the page first):

```html
<link rel="stylesheet" href="styles.css">
<script src="_ds_bundle.js"></script>
```

Components are then available at `window.Chapa.*`. Mount into a dedicated child node (e.g. `<div id="ds-root">`), not the host page's own React root, so the two trees don't collide:

```jsx
const { BitbucketIcon } = window.Chapa;
ReactDOM.createRoot(document.getElementById('ds-root')).render(<BitbucketIcon />);
```

## Tokens

188 CSS custom properties from @chapa/web. Names are
preserved verbatim from upstream. They are declared inside `_ds_bundle.css` (this DS ships one compiled stylesheet rather than separate token files).

- **color** (76): `--tw-border-style`, `--tw-shadow-color`, `--tw-inset-shadow-color`, …
- **spacing** (5): `--tw-space-y-reverse`, `--tw-inset-shadow`, `--tw-inset-shadow-alpha`, …
- **typography** (19): `--font-heading`, `--font-terminal`, `--font-mono`, …
- **radius** (6): `--radius-sm`, `--radius-md`, `--radius-lg`, …
- **shadow** (9): `--tw-shadow`, `--tw-shadow-alpha`, `--tw-ring-shadow`, …
- **other** (73): `--tw-translate-x`, `--tw-translate-y`, `--tw-translate-z`, …

## Components

### icons
- `BitbucketIcon`
- `CodebergIcon`
- `CopyIcon`
- `GitHubIcon`
- `GitlabIcon`

### general
- `ClaudeCodeStar`
- `ConfirmDialog`
- `LiteYouTubeEmbed`
- `LoginCtaButton`
- `StatusCallout`

### dashboard
- `InsightCard`
- `Sparkline`
