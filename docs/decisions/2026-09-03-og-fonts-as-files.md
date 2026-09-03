# OG image fonts go to resvg as files, and the deployed function proves it can draw

Date: 2026-09-03
Status: accepted
Refs: #1275, PR #1276

## Context

`/u/:handle/og-image` rasterizes the badge SVG to PNG with resvg-js for social
previews. From v2.11.0 (2026-06-19) to v2.29.4 every production OG image
rendered with no text at all: no name, score, labels, wordmark or footer.
Shapes, icons, the heatmap and the radar rendered normally, so nothing looked
broken at a glance, and resvg drops a `<text>` node it has no font for without
logging. No alert, no error, no failed test, for eleven weeks.

Two defects stacked.

1. **2026-04-27 (v2.8.0).** `getFontPaths()` resolved the four bundled TTFs
   with `new URL(\`./fonts/${name}\`, import.meta.url)`. Turbopack cannot
   resolve a template literal statically and compiled the expression to a
   single traced asset (Plus Jakarta Sans Regular). Three of the four font
   assets were emitted and never referenced. Every family fell back to one
   face: degraded, but visible.
2. **2026-06-19 (v2.11.0).** A performance change read the fonts once at
   module scope and passed them to resvg as `fontBuffers`. The resvg-js 2.6.2
   binary for linux-x64, the platform a Vercel function runs on, ignores that
   option. The darwin-arm64 binary honours it. The option is absent from the
   package's own type definitions and only typechecked because it was never
   written as an object literal.

## Evidence

Measured inside the deployed function on 2026-09-03 (preview of PR #1276,
`platform: linux-x64`, all four fonts present and byte-identical to the
repository copies), rendering a two-word sample and counting glyph pixels:

| Font source | Glyph pixels |
| --- | --- |
| `fontBuffers`, async render (the production path) | 0 |
| `fontBuffers`, sync render | 0 |
| `fontFiles`, async or sync | 1118 |
| `fontDirs` | 1118 |
| system fonts | 0 |

The same sample on darwin-arm64 draws glyphs through every one of those
sources, which is why every local render, every mocked unit test and the
committed reference PNG looked fine throughout.

Ruled out on the way: font bundling (the function's file map carried all
eight copies), git checkout corruption (a fresh shallow clone is
byte-identical), and the Turbopack asset copies (present, valid sfnt
headers, correct sizes).

## Decision

- `svgToPng` hands resvg the four font **file paths**, never buffers. Files
  work on both binaries; buffers work on one. The per-render cost of resvg
  opening four files is milliseconds and only paid on an OG cache miss.
- `lib/render/font-files.ts` owns resolution. One static
  `new URL("<literal>", import.meta.url)` per file, plus two
  `process.cwd()`-anchored candidates. The verbatim source copies that
  `outputFileTracingIncludes` places in the function come first; the
  bundler's derived asset is the last resort. A candidate counts only if it
  is larger than a stub and starts with a TrueType/OpenType signature.
- A missing font is a reported state. `svgToPng` captures it once via
  `captureServerError` and runs resvg at `logLevel: "warn"`.
- `/api/health` renders the sample **inside the deployed function** and
  reports `rasterizer: ok | no_glyphs | error` with the glyph count. When
  the production path draws nothing it also reports the alternative render
  paths, so the next failure is diagnosed from one health call instead of a
  redeploy per guess. A failure raises the P2 `og_rasterizer_unhealthy`
  alert and logs the full probe. Health status is unaffected: a text-less
  social card is a defect to fix, not an outage to page for, and the
  deployment smoke asserts a 200.
- `svg-to-png.raster.test.ts` rasterizes with real resvg and counts glyph
  pixels for both families and weights, and inside the badge's score ring.
- The OG Redis key moved from `v3` to `v4` so no text-less PNG is served
  after the fix deploys.

## Consequences

- A test suite that mocks the rasterizer, and a developer machine that runs
  a different native binary than production, cannot catch this class of
  bug. The health probe is the gate that runs where the bug lives. Check it
  in the release playbook's post-deploy verification.
- `fontBuffers` must not come back for performance reasons until the
  linux-x64 binary is shown to honour it, by the health probe on a preview.
- Any future change to how fonts reach resvg is verified by reading
  `dependencies.rasterizer` from `/api/health` on the preview deployment,
  not by a local render.
