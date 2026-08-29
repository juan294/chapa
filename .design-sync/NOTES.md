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
