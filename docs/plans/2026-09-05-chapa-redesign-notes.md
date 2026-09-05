# Implementation deviations

Plan: `2026-09-05-chapa-redesign`.

## Deviations

- Plan said: stop after every implementation phase. Found: the user explicitly
  requested uninterrupted completion of all phases and a local merge into
  `develop`, with no push during code freeze. Chose: preserve sequential review
  and verification gates, continuing automatically after each. Why: current
  user authorization supersedes the plan's stop cadence.
- Workflow said: use Sonnet implementation and review agents. Found: the Codex
  session exposes no Sonnet model. Chose: available Codex agents with the same
  role separation. Why: preserve the workflow with supported tooling.
- Plan said: preserve semantic status/verification roles and measure on the new
  grounds. Found: prior light status values failed on the ice stage and alpha
  status fills. Chose: darker light status values and contrast-safe complement
  text while retaining their hue/meaning. Why: actual-surface 4.5:1 text contrast;
  final values are recorded in `docs/design-system.md` and executable tokens.
- Plan said: dark strong stroke `#EEEAE15C` and fixed terminal line `#F4F0E750`.
  Found: composited control boundaries measured below 3:1 on ice and terminal
  cards. Chose: alpha `66` for both colors. Why: meaningful outlined controls
  retain the approved neutral direction and now exceed 3:1.
- Plan said: add canonical browser TTF bindings only if Next does not expose
  the SVG's literal families. Found: Next 16.3.3 emits literal JetBrains Mono
  and Plus Jakarta Sans names with local WOFF2 assets. Chose: retain existing
  Next loaders and raster TTFs, remove the provisional duplicate browser TTFs.
  Why: compiled/browser evidence satisfies the contract without 671 KB of
  duplicate font assets.

- Phase 2: the plan retained every score treatment. Review found Gold Leaf's
  darkest stop and the shared opacity pulse reduced large score contrast below
  3:1 on the badge grounds. Changed only the darkest Gold Leaf stop from
  `#78350F` to `#9A5A16` and kept custom score paints fully opaque. Standard
  retains its pulse; gradient animations remain. Six palette regressions cover
  the darkest displayed score paints against their base grounds.
  Combined Aurora/Crystal surfaces still reduced contrast, so the existing ring
  track now fills with the palette's opaque ground. Actual font-isolated raster
  inspection found a 100 score pixel crossing the ring at 52px; three-digit
  scores use 48px, with all other scores retaining 52px.
  The same combined-effect review found verification/sample coral below 4.5:1;
  the existing right strip now uses an opaque palette ground behind its text.
  Archetype pills already had opaque grounds and pass all six palettes.
