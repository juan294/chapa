# Phase 5 — Final local validation

Implementation is complete through all five phases. The reviewed integration
source is `87fd3258`, combining the redesign with local `develop` through
`d62c5d01`. The final evidence/documentation commit also contains the tested
reflow browser spec. [Source hashes](evidence/phase5/source-manifest.json)
bind every checked application/package/test input to this record.

## Local gates

All commands ran sequentially in the isolated worktree with sanitized local
environment values. No production credentials or remote services were used.

| Gate | Result | Seconds |
| --- | --- | ---: |
| Typecheck | pass | 8.0 |
| Lint, including scripts | pass | 10.3 |
| Full coverage + operational scripts | pass | 21.5 |
| Circular dependencies | pass | 2.3 |
| Migration validation | pass | 0.3 |
| Write registration | pass | 0.3 |
| Vercel configuration | pass | 0.3 |
| Dependency licenses | pass | 0.5 |
| Production build | pass | 8.5 |
| Real local database contracts | pass | 2.4 |

Coverage passed **531 files / 8,811 tests**, including the existing scoring
integrity and newly integrated v7 suites. Main statements/branches/functions/
lines: **95.27 / 90.93 / 95.22 / 97.32%**. The separate scripts gate passed
22 files / 264 tests and all its configured floors. Database contracts passed
**35 files / 79 tests**. Craft propagation and the 350KB chunk budget pass.
[Machine-readable gate results](evidence/phase5/gates.json) preserve the commands.

The largest JS chunk remains **233,200 bytes**, matching the observed baseline;
chunk count is 82 versus 77. The baseline was a pre-existing build observation
whose provenance was not independently reverified, so this is a bounded size
comparison, not a performance benchmark. EN and ES landing routes remain
statically generated; interactive code stays in the intended client leaves.
No dependency/font-package changes were introduced, so the conditional
vulnerability gate was not applicable.

## Browser and visual acceptance

The final full Chromium/mobile selection passed **176/176**, zero skips and
zero failures, in 2.2 minutes. Both real persistence journeys passed across
Craft/no-Craft/linked-platform shapes, with zero residue and restored feature
flags. [Browser record](evidence/phase5/browser.json) and
[journey receipts](evidence/phase5/journey/) identify the tested fixture scope.

That browser server was built at `72c376b3`. The later integration adds the
standalone v7 engine; no application route imports it yet. Final type/lint/
coverage/build/contracts were repeated at `87fd3258`. A
[byte comparison](evidence/phase5/build-comparison.json) shows all common built
JS/CSS/font files unchanged; only three build-ID manifest paths were replaced.
The application route/component inputs and the reviewed gallery sources are
unchanged by that last merge. This preserves the browser evidence without
claiming a second unexecuted browser run on a different build ID.

The completed rubric is supported by:

- Phase 3 landing matrix plus fresh final EN/ES × light/dark × 1440/390
  [production/reference comparisons](evidence/phase5/comparison/).
  [Reflow captures](evidence/phase5/reflow/) cover 768/320px on both projects;
  keyboard controls, CSS 200% zoom smoke, language/query/hash preservation,
  actual commands, denied clipboard, system theme and reduced motion pass.
- [Phase 4 product matrix](evidence/phase4/surfaces/): eight owner Studio,
  save/error/race/reset/zoom, visitor share, settings/admin, CLI, verification,
  anonymous demo and collapsed-control combinations. Final screenshots were
  refreshed by the successful integrated browser run, including the final
  readable archetype insight labels and bounded mobile admin table.
- [Public route matrix](evidence/phase4/public/browser.json): 96 combinations
  and fourteen all-archetype route checks; long-form bottoms reviewed.
  Eight [final scoring captures](evidence/phase5/scoring/) supersede the earlier
  thumbnail-failure evidence. Existing admin body terminology remains English;
  translated chrome and all newly introduced copy retain their paired locales.
- Eight actual-component [loading/global-error captures](evidence/phase4/standalone/),
  with supported locale behavior recorded honestly. These are SSR visual
  checks; existing tests separately cover reset/error behavior.
- Phase 2 real SVG/raster locks, all palette/options/geometry edge cases,
  1200/600px exports, existing-font negative glyph controls, and the final
  [proposal/production badge comparison](evidence/phase5/comparison/badge-comparison.png).
  Ice defaults, saved Jade/legacy semantics, seven config keys, renderer/cache
  revisions, redaction and HMAC inputs remain covered.

Plan-compliance and reuse/quality reviews approved the result. Measured
contrast, hidden-table overflow, pre-hydration thumbnail failure and SVG motion
findings were corrected with regressions; there are no unresolved known
implementation or visual findings.

## Disposable integration boundary and cleanup

Only project `chapa-redesign` (API55331, DB55332) was used for fixture writes.
Its original 38 migrations plus the newly integrated additive migration039
were applied locally. The contract CLI wrapper binds `supabase status` to
that workdir. The newly integrated direct-SQL contract originally read the
root config's default container; an ignored, read-only Docker command wrapper
binds those exact SELECT probes to the same disposable database. No test
assertion was weakened and the production/test source was not changed for
this environment adjustment.

The server-only preload replays only known fixture GitHub/platform/cache
requests, passes only loopback fetches, and audits/rejects unexpected external
calls. The final audit contains **zero unexpected calls**. The initial health
probe exposed missing local `DBSIZE` replay; it now reports actual cache size
with expiry/deletion regression coverage. No production route or auth bypass
was added. Fixture cleanup restores flags and verifies zero owned rows;
journey receipts independently prove their own cleanup. The dedicated server,
gallery/reference servers and disposable database are shut down after checks.
Other local worktrees, branches and service stacks were preserved.

## Design handoff and freeze boundary

[Standalone handoff report](phase-5-sync-report.md): all 15 exports in both
themes, plus four changed InsightCard variant cases, passed **34 checks**.
The actual CSS emits 37 convention utilities; the token output matches all
73 declarations / 67 colors, retains historical names and excludes engine
variables. Four actual local font families loaded. Runtime Tailwind variables
remain in compiled CSS. Current docs, font bindings, conventions, schema,
manual props and all fifteen imports are synchronized; generated outputs stay
ignored. Contact sheets and source/handoff hashes are tracked.

**Converter, Claude Design upload and remote readback were not executed:**
the capability is unavailable. The verified local package and exact existing
handoff recipe are ready; end-to-end remote synchronization is not claimed.

Remote triggers were inspected: pushes to develop/main and PRs can run hosted
CI, and deployment workflows are separate. This run performs only the user's
local merge into `develop`. **No push, PR, preview, production deployment,
remote CI execution or cache purge occurred during the code freeze.**
