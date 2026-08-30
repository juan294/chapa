# design-sync notes

## Repo shape (measured 2026-08-29, first sync)

Chapa is a Next.js application, not a published component library. There is no
Storybook (no `.storybook/` and no `*.stories.*` anywhere outside
`node_modules`), so `shape = "package"`. `packages/shared` is types-only
(`main: src/index.ts`) and holds no components.

The 59 non-test components live in `apps/web/components/`:

| Measure | Count |
|---|---|
| Components (non-test) | 59 |
| `"use client"` | 49 |
| Import `next/*` | 15 |
| Need app context (useTranslation / feature flags / session / router) | 38 |
| Purely presentational, no Next and no app hooks | 15 |

Roughly two thirds cannot bundle standalone without shimming Next plus
`LanguageProvider` plus the feature-flag context. Those shims are where
fidelity breaks, and a component that renders wrong in the sync renders wrong
in every design the agent later builds. First sync therefore scoped to the
presentational set plus the token layer, by explicit user decision.

## Scope decision (user, 2026-08-29)

In scope: all `--color-*` tokens (114 declarations across two `@theme` blocks,
both light and dark), fonts, a conventions header authored from
`docs/design-system.md`, and the components that bundle standalone.

Out of scope for now: the 38 app-context components. Revisit only if the
presentational components are extracted into a real `packages/ui` with its own
build, which was offered and deferred.

Excluded as infrastructure rather than design-system parts: `PostHogProvider`,
`ClientErrorReporter`. `ThemeProvider` is excluded as a card but may need to
ship inside the bundle, since `next-themes` drives `data-theme` and every
colour token resolves through it.

## Styling idiom (for the conventions header)

Tailwind v4 `@theme` in `apps/web/styles/globals.css`. Components use semantic
utilities (`bg-bg`, `bg-card`, `text-text-primary`, `text-text-secondary`,
`border-stroke`, `text-amber`), never raw hex. Both themes are defined: light
on bare `:root`, dark under `[data-theme="dark"]`.

Two rules from `docs/design-system.md` the design agent must not violate:

- The badge SVG is theme-independent and always renders dark. It cannot use
  CSS custom properties, because it is server-rendered before app CSS exists.
- Verification UI on the site uses the teal `--color-complement*` family, and
  for text specifically `--color-complement-text`. The badge's own verified
  signal uses `VERIFICATION_CORAL` (#E05A47) and is deliberately badge-only.

## Known render warns (benign, triaged 2026-08-29)

- `[RENDER_THIN] Sparkline` — "mounts have no text and paint nothing". False
  positive: the check looks for text, and a sparkline is a bare SVG polyline by
  design. Confirmed painting on the contact sheet (Flat shows a zigzag, Rising a
  rising curve, both stroked). Do not "fix" by adding labels.

## Repo quirks the converter needed (2026-08-29)

- `@chapa/web` is a private workspace app, not a published package, so
  `apps/web/node_modules/@chapa/web` does not exist. A self-link is required:
  `ln -sfn ../.. apps/web/node_modules/@chapa/web`. Recreate it after a fresh
  install; it is inside node_modules so it is never committed.
- Every `cfg` path is resolved **package-relative** (against `apps/web`), not
  repo-root: `tsconfig.json`, `.ds-styles.css`, `components/...`. Only
  `--entry` is CWD-relative, and it must point INSIDE the package because the
  converter derives the package dir by walking up from it.
- `apps/web/.ds-entry.tsx` (committed) pins the bundle to the curated set. The
  synth-entry fallback `export *`s every file under `srcDir`, which drags in
  `lib/auth` and `node:crypto` and fails the esbuild pass.
- `apps/web/.ds-styles.css` (generated, gitignored) = the font bindings from
  `.design-sync/fonts.css` followed by the compiled Tailwind chunk from
  `.next/static/chunks/*.css`. Needed because Chapa binds brand faces through
  `var(--font-heading)`/`var(--font-body)`, which next/font injects at runtime
  and a design built from this system has no Next runtime to provide.
  Regenerate it after any `pnpm --filter @chapa/web build`; the chunk filename
  is content-hashed and will change.
- `.d.ts` extraction yields empty bodies in synth-entry mode, so every
  component's real props are hand-written in `cfg.dtsPropsFor`. Keep them in
  sync with the source when a component's props change.
- `ConfirmDialog` defaults to `variant="destructive"` (`ConfirmDialog.tsx:23`),
  so omitting `variant` yields the red confirm button. A prop value named
  "default" is therefore not the default. Previews pass `variant` explicitly so
  the two looks actually differ on the card. Worth revisiting in the component
  API, but out of scope for the sync.

## Re-sync risks (watch-list for the next run)

- **`cssEntry` filename is content-hashed and WILL change.** It points at
  `.next/static/chunks/<hash>.css` via the generated `apps/web/.ds-styles.css`.
  After any `pnpm --filter @chapa/web build`, regenerate `.ds-styles.css` (font
  bindings first, then the new chunk) or the build silently ships stale CSS.
  This is the single most likely thing to rot.
- **`cfg.dtsPropsFor` is hand-maintained.** Synth-entry mode extracts empty prop
  bodies, so all 12 contracts are written by hand from source. If a component's
  props change, the uploaded `.d.ts` lies to the design agent and nothing
  catches it. Re-read the source prop types on any re-sync that touches these
  components.
- **The self-link and the entry barrel are prerequisites**, not niceties:
  `apps/web/node_modules/@chapa/web -> ../..` (recreate after a fresh install)
  and `apps/web/.ds-entry.tsx` (committed). Without the barrel the synth entry
  drags in `lib/auth` and fails on `node:crypto`.
- **Only partially verified**: cards were graded from headless captures at the
  default light theme. The dark theme, which is Chapa's signature look, was not
  visually verified per-card. Worth a pass if dark becomes the primary surface.
- **Scope is deliberately narrow.** 12 of 59 components. The other 47 need Next
  plus LanguageProvider plus feature-flag context; adding them means shimming
  those, which is where fidelity breaks. Prefer extracting a real `packages/ui`
  over shimming.
- **Assumed toolchain**: node 24, playwright 1.60.0 against cached chromium
  build 1223 (they must agree, or the render check fails to launch). Converter
  deps are installed in `.ds-sync/` and isolated from the repo lockfile.

## Re-sync 2026-08-29 — Jade palette (#1206)

The `cssEntry` chunk-hash risk recorded above **fired on the first re-sync**:
`0x2j6c3_cxgwn.css` became `2du_gthg_lwp4.css`. Regenerating
`apps/web/.ds-styles.css` from the newest chunk (`ls -S .next/static/chunks/*.css
| head -1`) and repointing `cfg.cssEntry` is now a required step of every
re-sync, not an optional one. Consider deriving it at build time instead.

All 12 components re-graded: the palette change altered every render, so the
anchor's renderHashes all missed and nothing carried forward. That is correct
behaviour for a palette change, not a cache problem.

### `--tw-*` token registration — measured, no action needed

The handoff asked to exclude Tailwind's internal `--tw-*` engine variables from
token registration to clear "spurious token-classification warnings". Measured
on this run: `tokens: 188 defined, 134 referenced (3 missing, below threshold)`
and **no `[TOKENS_MISSING]` warning fires**. The `--tw-*` vars inflate both
counts but stay under the warn threshold, so there is nothing to clear.

Worth knowing if it ever does fire: the classification lives in
`package-validate.mjs`, which is NOT reachable by the `.design-sync/overrides/`
mechanism (that covers `lib/*` adapters only). Excluding `--tw-*` would be an
upstream change to the skill, not a repo-local override.

### Badge divergence now visible in the design system

`lib/render/theme.ts` keeps the pre-jade violet accent and archetype colors, so
the synced components are jade while a badge rendered next to them is violet.
This is deliberate and documented in `docs/design-system.md`; the conventions
header states it too, so the design agent does not try to reconcile them.

## Re-sync 2026-08-29 (second) — anchor semantics, learned the hard way

**`renderHashes` cover component markup, NOT styling.** The pre-Jade and
post-Jade anchors have byte-identical `renderHashes` for all 12 components; the
only field the palette moved was `styleSha`. So "renderHashes match" never means
"the cards look the same" — a full restyle leaves them untouched. Judge a
styling change by `styleSha`, and expect the driver to re-verify everything
anyway (it does, correctly, because `styleSha` feeds the verification partition).

**Verify the anchor after uploading it.** On the Jade sync a `get_file` of
`_ds_sync.json` came back with the pre-Jade `styleSha` even though the write had
returned success. Re-uploading and re-reading showed the correct value, so it
was either a stale read or a write that did not land. Either way the check is
cheap and the failure mode is expensive: an anchor that vouches for content the
project does not have makes the next sync skip components that actually need
re-uploading. **Always `get_file` the anchor after the final write and compare
`styleSha` against the local `ds-bundle/_ds_sync.json`.**

**A converter upgrade invalidates the anchor wholesale.** Moving the staged
scripts from skill 2.1.247 to 2.1.251 made the driver report all 12 components
as `added` rather than `unchanged`, so everything re-verified and re-uploaded.
That is correct and safe, just slow. Re-copy the staged scripts on every
re-sync (the skill says so) and expect a full pass whenever the skill version
moves.

**The chunk hash was stable this time.** Same source CSS produced the same
`2du_gthg_lwp4.css`, so the regeneration step is a no-op when nothing changed.
It still has to run: the step is cheap and the failure is silent.

## Palette-migration sweep: grep for decimal rgba, not only hex (#1206)

A palette migration leaves stale colour literals in app source. A hex-only
grep does not find all of them. Two gaps caused 63 missed values in the Jade
migration:

1. **Decimal `rgba()` form.** Tailwind arbitrary utilities carry the colour as
   a decimal triple, so `#1a1a2e` appears as `rgba(26,26,46,0.15)`. A grep for
   `1a1a2e` matches nothing. Convert every retired hex to its decimal triple
   and grep for both forms.
2. **The handoff's hex list is not the full token set.** The Jade handoff
   listed the surface and accent values only. It omitted every text and dim
   value (`#6b7280`, `#9ca3af`, `#e2e4e9`, `#8b8fa0`, `#4a4a5e`). Build the
   sweep list from the *previous* `globals.css`, not from the handoff.

Sweep recipe:

    # every value in the pre-migration globals.css, both notations
    git show <pre-migration-ref>:apps/web/styles/globals.css \
      | grep -oE '#[0-9a-fA-F]{6}' | sort -u

Then, for each hex, also grep the decimal triple: `(26,26,46)`, `(107,114,128)`.

Two exclusions when applying replacements:

- **`.test.` files.** Fix the source first, then read each failing assertion
  and update it deliberately. A blanket regex over test files rewrites
  expectations instead of code, which hides regressions.
- **Badge-owned paths** (`apps/web/lib/render/`, `apps/web/app/u/`,
  `apps/web/app/og-image/`). The badge SVG is a theme-independent asset on its
  own fixed `#0C0D14` canvas. Its literals are correct and must not move with
  the app palette.

Prefer a token over a corrected literal. `bg-[rgba(26,26,46,0.06)]` became
`bg-text-primary/[0.06]`, which fixes a latent bug: the hardcoded form did not
track the theme.

## Emit a token manifest so `--tw-*` engine variables stay out of registration

Claude Design reports that `--tw-*` Tailwind engine variables reach its token
registration, and that annotating them after each sync does not survive the
next sync. Measured on this side:

- `ds-bundle/tokens/` ships **empty**. The converter fills it only from
  `cfg.tokensPkg`, which reads a `node_modules` package. Chapa keeps its tokens
  inline in `apps/web/styles/globals.css`, so nothing is copied. The
  `src.tokensCss` fallback at `package-build.mjs:486` is never populated for
  the package shape.
- `styles.css` is one line: `@import "./_ds_bundle.css";`. That file holds
  **196** custom properties: **43** `--color-*` design tokens next to **71**
  `--tw-*` engine variables, each with its own `@property` block.

With no manifest, the only palette source in the upload is the file that mixes
both. That matches the symptom.

`--tw-*` cannot be stripped from `_ds_bundle.css`. Utilities dereference the
variables at runtime, and the 71 `@property` blocks set their initial values
and types. Removing them breaks rendering of every component.

`.design-sync/emit-tokens.mjs` writes `ds-bundle/tokens/chapa-tokens.css`
instead: `@theme`, `:root` and `[data-theme="dark"]` custom properties only,
126 declarations, zero `--tw-*`. Run it after the build, before upload:

    node .ds-sync/package-build.mjs
    node .design-sync/emit-tokens.mjs      # fills the otherwise-empty tokens/
    # then upload

The file regenerates from `globals.css`, so a later palette change carries
through with no hand editing.

Open with Claude Design: whether registration prefers `tokens/*.css` over
scraping `styles.css`'s import closure. If it does not, the exclusion has to
happen in registration, because the upload cannot separate the two sources any
further than this.

## Tailwind engine variables in the synced bundle (#1219)

The design-system validator flags about 70 unclassified `--tw-*` variables on
every sync. The handoff suggested excluding them "in the sync config".

There is no such option here, and the exclusion cannot happen at either end we
control:

- `.design-sync/config.json` describes the package, components and prop types.
  It has no token-registration section, and the converter that reads it is not
  in this repository.
- `_ds_bundle.css` must keep the engine variables. Utilities dereference them
  at runtime and their `@property` blocks set the initial values, so removing
  them breaks the bundle.

What this repo does instead: `emit-tokens.mjs` writes a separate manifest
holding the design tokens only, with `--tw-*` filtered out, and
`scripts/design-sync-emit-tokens.test.ts` fails if that filter or the block it
reads from ever regresses. A consumer that reads the manifest sees a clean
palette; one that scrapes `_ds_bundle.css` still sees the engine variables, and
silencing that needs a converter-side option that does not exist today.

## Re-sync 2026-08-30 — v2 redesign (#1211-#1221)

Synced from `develop` after the v2 redesign merged. Three components joined the
curated set, taking it from 12 to 15: `SectionHeader`, `ContentPageHeader` and
`OnThisPageIndex`. The first two are plain server components. `OnThisPageIndex`
is a client leaf, and it qualifies because its only context dependency is
`useTranslation`, which falls back to the English dictionary when no
`LanguageProvider` is mounted — that is the test to apply before adding any
other client component, not "is it small".

### Correction to the `cssEntry` risk note above

The earlier note said a chunk-hash change requires "repointing `cfg.cssEntry`".
It does not. `cfg.cssEntry` is `.ds-styles.css`, a stable filename; the
content-hashed chunk is **concatenated into** that file, never referenced by
name. So the required step is regeneration only:

    cd apps/web && cat ../../.design-sync/fonts.css "$(ls -S .next/static/chunks/*.css | head -1)" > .ds-styles.css

The hash did move again this run (`2du_gthg_lwp4` -> `27a8l76xqy4b5`), so the
step remains mandatory after every build — just not a config edit.

### The token layer is now `light-dark()`, and the chunk shows it polyfilled

#1211 replaced the paired `:root` / `[data-theme="dark"]` blocks with one
`light-dark(<light>, <dark>)` declaration per token inside `@theme`. Two
consequences for this pipeline:

- `.ds-styles.css` contains **no** literal `light-dark(` — LightningCSS
  compiles it to `var(--lightningcss-light,<a>)var(--lightningcss-dark,<b>)`
  keyed off the same `color-scheme` selectors. Grepping the built stylesheet
  for `light-dark(` to confirm the palette shipped returns zero and means
  nothing. Grep a token name instead (`--color-hero-band:`).
- `.design-sync/emit-tokens.mjs` now reads `@theme` only; the other two blocks
  carry `color-scheme` and nothing else. `scripts/design-sync-emit-tokens.test.ts`
  guards both that and the `--tw-*` filter.

### Always-dark surfaces need their own status colors

`--color-forest-ok/-warn/-err` were added because a fixed-dark block on a light
page resolved the theme-aware `terminal-green`/`-red` to their light values,
measuring 3.72:1 and 3.19:1 against the forest ground. The generalized rule now
lives in `docs/design-system.md`: status colors resolve per **surface**, not per
theme. Any future fixed-ground surface needs its own family.

### Adding one component can poison the entire bundle

`OnThisPageIndex` called `useTranslation` for one label. That import reaches
`@/lib/i18n`, whose barrel pulls `next/navigation` and friends, so Next
internals landed in the bundle (`process.env.__NEXT_DEV_SERVER`,
`NEXT_RUNTIME`). The bundle then threw `ReferenceError: process is not defined`
on load in headless chromium and **all 15 cards rendered empty** - including the
12 that have nothing to do with i18n. Node did not reproduce it, because node
has `process`.

The test before adding any component to `apps/web/.ds-entry.tsx` is not "is it
small" or "is it presentational". It is: **does its transitive import graph
reach `next/*`?** After the build, confirm with

    grep -c "process\.env" ds-bundle/_ds_bundle.js   # must be 0

The fix (#1222) was to give the component a `heading` prop, the same shape
`SiteFooter` and `NavbarShell` already use. Prefer that over shimming
`process`: a component that needs app context does not belong in the bundle,
and the shim would only hide the next one.

Symptom to recognize next time: `[BUNDLE_EXPORT] N/N not a component on
window.Chapa` together with every `[RENDER] root empty`. That pairing means the
bundle failed to LOAD, not that N components are individually broken. Read
`.render-check.json`'s `firstErr` before touching any component.

### The project holds files this sync does not produce - never hand-derive deletes

`list_files` on the project returns the design handoff material alongside the
synced bundle: `handoff-chapa-v2/`, `templates/`, `design_handoff_jade_palette/`,
`screenshots/`, `uploads/`, `github.md`, plus the app-generated
`_ds_manifest.json` and `_adherence.oxlintrc.json`.

The skill's "no anchor" branch says to review `list_files` for files this build
does not produce and delete them. **Do not apply that branch here.** With an
anchor present, `upload.deletePaths` is authoritative - it was `[]` this run -
and a hand-derived list would have deleted the designer's handoffs. Pass the
diff's list verbatim, empty included.

### `auxSha` covers only `guidelines/` and `README.md`

So `emit-tokens.mjs` can run AFTER the final driver run without desyncing the
anchor (`lib/sync-hashes.mjs:102`). It has to run after, because the driver's
build cleans the out dir.

### The anchor read back clean this time

The stale-read scare from the previous sync did not repeat: `styleSha`,
`auxSha` and `bundleSha12` all matched the local file on the post-upload
`get_file`. Keep doing the check - it is two calls and the failure it catches is
silent.

