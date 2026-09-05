# Phase 5 — Local design-sync verification

The actual package entry passed **34 standalone browser cases: all 15 components
in light and dark, plus four focused InsightCard cases**. The three tracked contact sheets
were visually reviewed. No component import, font load, utility emission or
visible preview failure remains in this local handoff.

## Runtime and evidence

Verification used the final local build's semantic global stylesheet
`3uag-26sduzvh.css`, identified by its action tokens and `.font-display` utility.
Installed Vite/React served the ignored gallery on `http://127.0.0.1:4173`.
Chromium rendered existing preview stories through the real `.ds-entry.tsx`,
without application-provider mocks. CSP and capture-phase guards blocked
navigation, OAuth, third-party media and form activation. No remote requests
reached the network.

- [Manifest](evidence/phase5/design-sync/manifest.json): exact token declarations,
  utility/export names, source/handoff hashes, compiled/assembled CSS hashes and
  contact-sheet hashes.
- [Browser results](evidence/phase5/design-sync/verification.json): all 34 cases,
  actual resolved families, successful font-face loads and theme backgrounds.
- [Contact sheet 1](evidence/phase5/design-sync/contact-sheet-1.png): BitbucketIcon,
  ClaudeCodeStar, CodebergIcon, ConfirmDialog, ContentPageHeader.
- [Contact sheet 2](evidence/phase5/design-sync/contact-sheet-2.png): CopyIcon,
  GitHubIcon, GitlabIcon, InsightCard, LiteYouTubeEmbed.
- [Contact sheet 3](evidence/phase5/design-sync/contact-sheet-3.png): LoginCtaButton,
  OnThisPageIndex, SectionHeader, Sparkline, StatusCallout.

ConfirmDialog retains its native modal behavior inside an isolated iframe.
OnThisPageIndex uses its documented 1120px viewport and ActiveSection story;
its contact-sheet frames are stacked to preserve that width. Its initial
responsive-hidden narrow cell was a gallery-layout defect, fixed before the
final captures. Media previews show the actual component's offline fallback.
One existing primary story per component was reviewed. Four supplemental
InsightCard captures cover the existing Trend story and actual ArchetypeCard
props for Quality Champion in both themes; their exact props and screenshot
hashes are in the manifest. Both updated foregrounds remain readable while
dimension/archetype tints retain their identity. This is not a claim that every
exported preview variant was captured.

## Measured package checks

| Check | Result |
|---|---|
| Curated entry imports | All 15 preserved and imported |
| Token manifest | 73 exact declarations; 67 color tokens; no `--tw-*` |
| Convention-named utilities | 37 actual selectors, including `.font-display` |
| Compiled runtime CSS | Complete global chunk retained, including Tailwind engine declarations |
| Standalone font assets | 83 built font-face declarations rebased to local files |
| Loaded font families | Manrope, Barlow Condensed, JetBrains Mono, Plus Jakarta Sans, in every case |
| Resolved body/display/heading | Manrope / Barlow Condensed / JetBrains Mono |
| Theme backgrounds | Light `rgb(244, 240, 231)`; dark `rgb(20, 23, 25)` |
| Entry/config/manual props | Existing 15-export package identity and declared contracts preserved |

The assembled CSS SHA-256 is
`02f16eae77acb8a73c2ce8331cf949ccb2d1447d99898eddb0a7b7bf507d9bc6`.
The compiled global CSS SHA-256 is
`82b2794362086104aef95358f152cd9a7040bf3e739b292cb0bf10058f6cb37f`.
After merging current develop, integrated commit `72c376b3` rebuilt successfully;
its compiled/assembled CSS, entry and preview hashes exactly match the refreshed
gallery run. Source and preview hashes in the manifest identify the exact implementation
reviewed independently of later evidence/documentation commits. If a refreshed
build changes these CSS/source hashes, regenerate and re-review the affected
captures before claiming they represent that new build.

## Reproduction and sync boundary

The ignored `.ds-sync/local-gallery/` contains the temporary Vite config,
assembler, browser verifier, contact-sheet capture script and individual PNGs.
The local commands were:

```sh
node .ds-sync/local-gallery/assemble.mjs
pnpm exec vite --config .ds-sync/local-gallery/vite.config.mjs
node .ds-sync/local-gallery/verify.mjs
node .ds-sync/local-gallery/capture-sheets.mjs
```

The assembler combines `.design-sync/fonts.css`, `.design-sync/safelist.css`
and the discovered complete global CSS into ignored `apps/web/.ds-styles.css`.
Its gallery-only offline derivative replaces the Google import with equivalent
built font faces. The token emitter writes ignored `ds-bundle/tokens/`.
No generated bundle or temporary gallery source is part of the tracked package.

**Converter package build, Claude Design upload and remote readback were not
executed because that capability is unavailable.** The repository-side handoff
is verified; end-to-end remote synchronization is not claimed. The appended
[design-sync notes](../../../.design-sync/NOTES.md) retain the existing converter,
exact `upload.deletePaths` and receipt-readback recipe for the later external
handoff. No app gate, push, deployment or cache purge was run by this gallery
verification task.
