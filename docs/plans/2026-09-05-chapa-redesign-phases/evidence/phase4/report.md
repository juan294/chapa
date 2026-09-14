# Phase 4 — Product surfaces and brand assets

The commit containing this report records the reviewed Phase 4 changes after
`8409aee0`. Implementation and tests ran in the isolated local worktree; no
remote service writes, push, CI trigger or deployment occurred.

## Verification

After the final InsightCard contrast correction, the exact source passed
sequential typecheck (3.1s), lint (10.0s), full tests (22.6s) and build (5.2s).
The earlier coverage/structural/browser selection below is supplemented by
26 focused InsightCard tests (13 demonstrated failures before the fix), and
Phase 5 repeats integrated coverage and browser checks after the local merge.

Sequential local gates passed: typecheck (3.4s), lint (11.8s), full coverage
(26.5s), circular dependency check (2.9s), migrations (0.3s), write registration
(0.3s), Vercel configuration (0.3s), licenses (0.5s), and build (5.2s).
Coverage executed 522 files / 8,602 tests plus the operational-scripts selection
of 22 files / 261 tests. Main statements/branches/functions/lines measured
94.72% / 91.07% / 93.65% / 96.12%; all configured global and scoped floors pass.
Both locale landing routes remain static. Craft propagation and the 350KB
chunk budget pass (largest chunk 227KB). A later isolated replay addition
(`DBSIZE`) passed its six focused boundary regressions.

The final Chromium/mobile selection executed 176 cases: 174 passed initially;
two new language/hash cases passed their corrected local-network-boundary
rerun. All Phase 4 data-dependent cases passed unconditionally, including
all eight owner Studio/theme/locale/device combinations, visitor profiles,
real seven-key persistence, save errors, edits during save, reset, preview
zoom, valid stored verification, settings, admin and CLI authorization.
The full persistence journey also passed for both projects; Phase 5 records
its real local DB cleanup receipts. No required redesign case was skipped.

## Visual evidence and fixes

- `surfaces/`: eight EN/ES × light/dark × 1440/390 combinations, viewport and
  full-page images for Studio owner, save error, save race, route error,
  anonymous demo, collapsed controls, visitor share, settings, admin, CLI and
  valid verification. Actual badge content and auth/feature gates were asserted.
- `public/browser.json`: 96 public route/theme/locale/device cases and all seven
  archetypes in both locales. Content/legal long-page bottoms were reviewed.
  The eight scoring screenshots here preserve the pre-hydration failure found
  during review; final corrected captures supersede them in
  `../phase5/scoring/`. All other public combinations passed visual review.
- `brand/`: six actual raster/icon outputs, preserving mark geometry and using
  the existing bundled raster fonts. Glyph-negative tests remain effective.
- Shared terminal/mod+K ownership, copied/serialized config boundaries,
  owner/visitor confidence redaction and existing actions remain covered by
  unit and browser checks. Admin body labels retain their existing English
  vocabulary; the supported locale-aware chrome remains coherent.

Visual review found and resolved actual failures: a screen-reader-only activity
TABLE created 950px of blank space below the footer; a hidden Actions header
expanded mobile admin to 482px; raw archetype/Elite label colors failed contrast;
and a thumbnail could fail before hydration attached its error handler.
The fixes retain all accessible rows, table scrolling, semantic labels and lazy
playback. Tests check the requested viewport width, accessible 91-day data,
actual color contrast, and pre-hydration image failure. Inline real SVG motion
is paused under reduced motion without changing renderer bytes.

Plan-compliance and reuse/quality review approved the final changes without
remaining findings. Studio retains its full-width stage and separate controls,
69px navigation clearance, 44px controls and existing persistence safeguards.
Phase 5 records final integrated checks, transitional-state review, reference
comparisons, documentation and the separate design-sync capability boundary.
