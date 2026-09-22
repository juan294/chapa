# Ice Terminal badge design version

Status: accepted for the local redesign implementation, 2026-09-05.

The production renderer now emits `ice-terminal-v2`. The approved clean
identity header, squared metric row and divided activity/impact layout replace
the global Jade layout. This is one renderer shared by public SVG, PNG and
Creator Studio. Existing scoring and verification semantics are unchanged.

## Compatibility and caching

New configurations and resets default to Ice. Explicit saved palettes retain
their values; an old stored row with no palette still resolves to Jade after
legacy aliases and retired keys are handled. The schema retains seven keys and
now accepts six palettes. Jade retains its palette values with the new geometry.

SVG cache keys retain the design variant; OG keys use
`og-image:v5:<handle>:<variant>:<date>:<locale>`. Metadata versions also carry the
variant and configuration revision. Locale separation, revision fencing and
awaited handle-wide invalidation remain in place.

## Reviewed artifacts

Baseline: `develop` at `c1ce31cbf5969ee400c4cf232d67cf7dc1b1de0d`.
The old SVGs and their original reference PNG remain under
`docs/design/chapa-redesign-reference/jade-v1-production/`. Their historical
character lengths and SHA-256 prefixes remain locked in tests:

| Output | Jade characters | Jade SHA-256 prefix | Ice characters | Ice SHA-256 prefix |
| --- | ---: | --- | ---: | --- |
| Plain | 30284 | `66c85c46c97e1d53` | 31474 | `4143f1e597290e31` |
| Demo | 30768 | `efc776305828e5e9` | 32018 | `1659164367794bde` |
| Static | 21891 | `35bdf419ee91e335` | 23003 | `195af3bda05a9233` |

The complete SHA-256 values and exact SVGs are in the Phase 2 evidence manifest.
Actual English/Spanish PNGs at 1200 and 600 pixels and all six palette PNGs
were inspected together. They retain the same identity, metrics, radar, score,
platform footer and explicit sample strip. Raster tests verify actual name and
score glyphs with bundled fonts and a missing-font negative control.

## Rendering constraints

JetBrains Mono remains the identity/score face and Plus Jakarta Sans remains
metric/footer/tier text. Browser font resolution and bundled raster font files
are separate checks. Static exports paint a complete resting frame. Long names
retain their text while fitting the header. Caller-supplied labels are escaped.
Custom score treatments stay fully opaque to preserve contrast; Standard keeps
its pulse. The ring has an opaque palette ground so background/card effects
cannot lower score contrast; three-digit scores use 48px to fit within the ring.
Verification/sample text also has an opaque palette-ground strip, preserving
its coral contrast over layered effects. Gold Leaf's darkest stop is `#9A5A16`.

## Rollback

Reverting the global layout requires reverting the implementation and cache
variant together. Ice configurations may already exist once released, so a
rollback must continue accepting Ice or explicitly migrate those rows. Never
silently reinterpret stored palettes or restore an old cache namespace while
serving changed geometry. No release, remote cache mutation or deployment was
performed by this local implementation.
