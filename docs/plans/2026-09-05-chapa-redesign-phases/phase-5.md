# Phase 5 — Integrated local verification and design-sync handoff

Parent: [implementation plan](../2026-09-05-chapa-redesign.md). Dependencies: Phases 1–4. Not batch-eligible.

## Result

A complete, locally checked implementation with visual evidence, versioned badge references, synchronized repository documentation and a precise statement of which design-sync stages ran. No hosted deployment or remote CI loop.

## Files and evidence

- `.design-sync/config.json:2`, `.design-sync/fonts.css:1`, `.design-sync/safelist.css:1`, `.design-sync/emit-tokens.mjs:53`, `.design-sync/conventions.md:1`, `.design-sync/NOTES.md:375`; `apps/web/.ds-entry.tsx:11`: existing sync package.
- `docs/design-system.md:1`, `docs/svg-design.md:1`, `CLAUDE.md:135`, the new badge ADR and current badge reference: update current guidance without rewriting historical decisions.
- `package.json:6`, `apps/web/playwright.config.ts:4`, `.github/workflows/ci.yml:3`: local gates and remote-trigger boundary.
- This phase directory: implementation evidence, screenshot index, token/component manifest and final validation report (create these with measured results, not placeholder pass labels).

## Integrated verification (pseudocode)

```text
inspect final diff and actual current branch
run plan-compliance + reuse/quality/efficiency reviews; fix findings
run all final local gates sequentially (commands below)
run local-only DB contract/journey with disposable fixtures
run full route/theme/locale visual rubric and keyboard journeys
record command, exit status, scope, runtime target and evidence paths
verify all local screenshots/exports correspond to this final commit or diff hash
update docs to actual values, fonts, commands, default/legacy palette semantics
```

Run these from the isolated implementation worktree, sequentially:

```sh
pnpm run typecheck
pnpm run lint
pnpm run test:coverage
pnpm run check:circular
pnpm run validate:migrations
bash scripts/check-craft-propagation.sh
pnpm run check:write-registration
pnpm run check:vercel-config
pnpm run check:licenses
pnpm run build
```

Coverage is the full test gate here; do not immediately repeat `pnpm test` on the same state. Because shared types changed, confirm the existing scoring-integrity suites remain included and green. Inspect the largest built JS chunk against the existing 350KB budget (`CLAUDE.md:401`); compare landing hydration/build output to the baseline and preserve static locale generation. Run the repository vulnerability gate if dependency/font-package changes were introduced; this plan does not call for framework or dependency upgrades.

Local DB integration: inspect the installed local Supabase tooling and `scripts/test-contract-local.ts` before use; start a disposable local stack and run `pnpm run test:contract:local`. For `e2e/journey.spec.ts`, follow the existing local environment/bootstrap in `.github/workflows/ci.yml`'s contract job, substituting only loopback service endpoints and local fixture credentials. Never read/export a production service-role secret for tests, never use a linked remote database, and never claim skipped journey cases passed. If the local stack is unavailable, record this required gate as incomplete until it can run; do not fall back to hosted CI.

Reuse the test-only fixture/bootstrap artifact created in Phase 4 at `apps/web/e2e/helpers/redesign-fixtures.ts`, using existing fixture builders and the local DB/session setup from `journey.spec.ts`. It owns expected `octocat`/`juan294` local test data plus synthetic owner/visitor, saved Jade/legacy/Ice configs and valid/invalid verification states; validates loopback endpoints before writes; and restores/cleans fixture rows and flags. Required redesign cases assert the actual profile/badge/controls unconditionally. `__chapa_smoke` is read-only routing, not fixture seeding, and an early-return smoke case cannot count as visual coverage.

For server-side upstream reads needed by those fixtures, use a test-process-only preload at `apps/web/e2e/helpers/redesign-upstream.mjs`: serve deterministic GitHub/platform/cache responses for the known fixture handles via the existing fetch interface, pass through only loopback local services, and fail unexpected external calls. Load it only into the locally started test server; no production route, environment bypass or app import is added. Keep setup tied to actual current upstream request shapes through focused tests. Browser `page.route` alone cannot intercept Next's server fetches. These upstream stubs prove UI/render integration; the real local DB contract/journey still separately proves persistence.

Start the locally built application on loopback port 3001 in an environment containing local-only fixtures/feature flags, then run the configured Chromium and mobile suite:

```sh
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001 pnpm --filter @chapa/web exec playwright test --project=chromium --project=mobile --workers=1
```

The Playwright config excludes deployed release-required tests outside their explicit environment (`apps/web/playwright.config.ts:11`). Do not set a preview/production environment to bypass that boundary. Add meaningful new browser cases to the existing suites or a colocated redesign spec for the rubric; do not rely exclusively on source-string or screenshot assertions.

## Design-sync sequence and acceptance

```text
finalize conventions + standalone font bindings before final build
preserve projectId/package/globalName/shape/cssEntry/config keys +15exports
identify actual current global CSS output from local build
assemble apps/web/.ds-styles.css:
    fonts.css + safelist.css + compiled global CSS in documented order
check current emitted classes for every convention-named utility
buildTokenCss(globals.css) -> exact token manifest (all names/values, no --tw-*)
verify standalone importability/props and render all15components with actual CSS/fonts
```

Use the existing recipe at `.design-sync/NOTES.md:416` but inspect build output rather than trusting an old hashed filename or assuming the largest chunk always contains all required utilities. The existing emitter CLI is `node .design-sync/emit-tokens.mjs`; its generated output belongs under ignored `ds-bundle/tokens/`. Preserve runtime Tailwind engine variables in compiled CSS. Verify export completeness, not a fixed count of 58 tokens.

When the converter is absent, build an ignored local gallery under `.ds-sync/local-gallery/` with the already installed Vite/React tooling. Its temporary Vite config aliases `@chapa/web` to `apps/web/.ds-entry.tsx` and `@` to `apps/web`; it renders the existing `.design-sync/previews/` with the assembled CSS/font bindings on loopback only. This is verification scaffolding, not a new production route or an app-provider mock. Intercept navigation/media activation in the gallery so review cannot initiate OAuth or third-party actions. Verify all 15 imports and light/dark states, actual `.font-display` rule emission, loaded Barlow/Manrope/JetBrains family resolution, and preserved SVG-specific fonts. Rebase/copy compiled font assets into the gallery's local asset tree when CSS relative URLs require it; missing fonts fail the gate.

If the existing converter is available in the implementation session, run its documented local package build, then run the token emitter **after** converter cleanup. Inspect fresh light/dark contact sheets for all fifteen components even if the converter says “unchanged”: grading is keyed to `sourceKeys`, not style changes (`.design-sync/NOTES.md:381`). Do not guess converter flags or replace the protocol.

Actual Claude Design upload/readback is the final external verification step when the existing capability is available and authorized in context. Use exactly the converter's `upload.deletePaths`, preserve designer-authored content, and compare style/auxiliary/bundle receipt hashes by readback (`.design-sync/NOTES.md:452`). If unavailable, deliver the verified repo-side package and exact existing handoff recipe, and mark **remote sync not executed**. This does not prevent documenting local implementation completion; it does prevent claiming end-to-end synchronization complete.

## Automated success criteria

- [ ] All applicable local type/lint/coverage/build/structural/security checks pass; no unresolved known failures.
- [ ] Local contract and journey checks pass without remote service writes; browser cases are executed rather than silently skipped.
- [ ] SVG/PNG version/cache/legacy-config/raster tests pass; current reference hashes/images are reviewed and tracked deliberately.
- [ ] Both locale landing variants remain statically generated; responsive and keyboard tests pass on Chromium/mobile.
- [ ] Token export exactly reflects current `@theme`, retains every historical token name, includes additive roles and excludes engine tokens.
- [ ] Existing sync config schema/15 imports/manual props/fonts/utilities pass local checks; generated artifacts remain ignored.
- [ ] Documentation and plan status reflect measured results and distinguish local sync verification from converter/upload/readback status.

## Manual visual success criteria

- [ ] Every required rubric cell passes or remains explicitly incomplete; no unreviewed inaccessible control/overlap/translation truncation.
- [ ] User-facing landing, Studio, badge and signature match the accepted design plus later copy/Elite/Studio corrections.
- [ ] Standalone component gallery/contact sheets match actual code in light and dark; no fonts missing outside Next.
- [ ] Final review includes side-by-side approved/prod-local page and real badge exports, not only implementation screenshots.

Present the final local validation report and sync status, then stop. A later `/validate` or release workflow remains separately invoked. No push, PR, Vercel preview, production deployment or cache purge is part of this phase.
