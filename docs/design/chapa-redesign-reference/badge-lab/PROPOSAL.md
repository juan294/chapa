# Ice Terminal — actual SVG design proposal

Candidate: `ice-terminal-v2-proposal`. Baseline: `jade-v1`, locked in [badge-render-variant.ts](/Users/juan/code/chapa/apps/web/lib/render/badge-render-variant.ts:8). Exact source commit and export hashes: [version.json](version.json).

This proposes changing the badge design as a separately reviewed artifact. It does not change the published design version, its byte baselines, its cache keys, or any user configuration. The earlier landing-page credential was a placeholder and is retired from the current prototype.

## Design

- Navy `#0C141B` ground, ice `#BAD9E8` data accent, warm white `#F1EEE7` primary text, muted ice `#ABBAC3` metadata.
- Monospace identity with a clean avatar/name/status header, square metric pills and frame, numbered activity/impact labels, and a vertical divider.
- The activity cells keep their chronological layout and intensity thresholds. The radar and adjusted-score ring remain distinct visible elements.
- Archetype colors remain unchanged and palette-independent. Their solid navy pill puts the seven text contrasts between 4.75:1 and 5.46:1. Verification retains `#E05A47`, at full opacity (5.06:1 on navy). Footer opacity increases for legibility.
- The badge remains dark on either website theme. Page theme never enters badge configuration, cache keys, or verification. A future light badge would be a separate artifact decision with its own palette and semantic-color checks.

## Actual rendering, not an illustration

`ProposalSvg.ts` derives from the current [BadgeSvg.tsx](/Users/juan/code/chapa/apps/web/lib/render/BadgeSvg.tsx:84), retaining the same stats, impact and option inputs. It imports the existing heatmap, radar, branding, verification, escaping, metric formatting, and all SVG effect builders. The lab bundles those pure functions locally and regenerates both complete SVG documents when fixture controls change. Exported SVG needs neither page CSS nor JavaScript; like the current renderer it uses font-family fallbacks. The PNG check uses the production renderer's bundled font files.

Preserved input-driven content:

| Element | Preserved behavior |
| --- | --- |
| Identity | Display name/handle fallback; avatar data URI or shield fallback; Chapa mark |
| Metric row | Archetype, Repos, Watch, Fork, Star; compact numbers and missing-value defaults |
| Heatmap | Latest 91 days; 13 × 7; zero-filled short input; five intensity levels |
| Radar | Four core axes, optional fifth Craft; Craft=0 is present; all-zero empty marker |
| Score | `adjustedComposite`, proportional ring, tier and optional tier treatment |
| Platforms | GitHub plus linked platforms in canonical order; demo shows all four; branding toggle |
| Provenance | Public, simulated, or verified status; optional hash/date strip; sample disclosure |
| Studio | background, cardStyle, border, scoreEffect, heatmapAnimation, tierTreatment, colorPalette |
| Export | 1200×630 SVG; deterministic; escaped identity; localized inputs; static and animated render paths |

`jade` selects Ice only inside the candidate's private theme adapter. Other existing palettes still pass through unchanged. This is a comparison harness, not a proposed migration of stored `jade` configs. A production plan must explicitly decide how people opt into the new design and bump the global render variant when that published design changes.

The verification HMAC still covers data/date rather than styling. The candidate renderer retains real verification links. The lab's visibly labelled test seals disable those links because no real seal is minted. Default downloadable samples carry the actual SAMPLE disclosure.

## Review controls

Open `http://127.0.0.1:8768/badge-lab/` or use `/badge-lab` from the landing shell. Compare side by side, switch the seven archetypes, test absent or zero Craft, change provenance fixtures, remove data, toggle branding/platforms, or exercise all seven SVG config categories. `/inspect` shows the exact renderer input. The download link exports the selected SVG. Lab data comes from repository demo fixtures, not live account requests.

## Validation

- 63 automated comparisons preserve every baseline SVG text element and the expected data components across archetypes, Craft states, empty input, missing identity, escaped hostile identity, verification, connected platforms, branding, localization, motion, and config values.
- Both 1200px and 600px PNGs rendered with Chapa's real `svgToPng` pipeline. Resvg reports its existing unsupported `@media` warning; static exports still render completely.
- Existing focused suite: 205 tests across BadgeSvg, heatmap, RadarChart, badge-effects and badge-palette passed. Published byte locks remain intact.
- Browser: four/five-axis switching, zero-Craft semantics, empty radar, gradient IDs isolated per inline SVG, light/dark backgrounds and mobile layout checked.
- Production repository stays clean. No live user writes, pushes, hosted CI or deployments.

Rebuild from `/Users/juan/code/chapa`:

```sh
pnpm exec tsx --tsconfig apps/web/tsconfig.json ../chapa-redesign/badge-lab/export.ts
node_modules/.pnpm/esbuild@0.28.2/node_modules/esbuild/bin/esbuild ../chapa-redesign/badge-lab/lab.ts --bundle --platform=browser --format=iife --tsconfig=apps/web/tsconfig.json --outfile=../chapa-redesign/badge-lab/lab.js
pnpm exec tsx --tsconfig apps/web/tsconfig.json ../chapa-redesign/badge-lab/verify.ts
```

The checked-in production badge reference image was not regenerated. All candidate SVGs, PNGs, source and notes live outside the production repository.

## Revision 2

Removed the decorative plus and PROFILE / handle line. Restored the header to its original vertical position for a cleaner avatar/name/status grouping. Revision 1 SVG and its version manifest remain available locally for comparison; production `jade-v1` remains unchanged.
