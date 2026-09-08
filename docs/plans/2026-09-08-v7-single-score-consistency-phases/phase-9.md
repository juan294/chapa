# Phase 9 — Final local qualification and manual acceptance handoff

Depends on phase8. Sequential. Completes QA-M1 and all new-policy acceptance. No production release.

## Prepare exact local candidate

Integrate completed phase work locally, preserving all owner work and branch topology. Use a clean disposable validation worktree and local Supabase/Redis; no production-backed .env.local copy. Verify loopback targets before fixture/reset/upload/consent/rollback operations. Use production-mode Next start on an explicit local port, with synthetic public-safe owner data and real-format sanitized report fixtures. Do not attach to the owner's unrelated dev server or change its configuration.

The implemented launcher is `scripts/quality/local-scoring-qualification.ts --root ROOT --evidence-dir IGNORED_DIR --port 3217` (run with `pnpm exec tsx`). It requires the verified `RELEASE_BUILD_MANIFEST`, the explicit disposable acknowledgment and dedicated loopback Supabase55331/Redis REST56380 credentials supplied only to the process. It seeds synthetic owners, uses real Redis, denies unexpected provider fetches and records any remaining cache keys before the task-owned services are disposed. Existing local stacks are not qualification targets.

Record source commit/tree, dependency lock digest, migration head and local service identities without credentials. Read current workflows/package scripts to enumerate the exact required selection. Compare the original September7 evidence manifest with changed paths: reuse broad visual evidence where valid, but label it historical rather than claiming final-build proof.

## Automated gates — sequential, once per unchanged final candidate

Use the documented toolchain (current CI uses Node20 ordinary jobs and Node24 contracts); record the actual local version used and any remaining platform-specific limitation. Do not repeat gates after a pass without a code/config change or new failure.

```sh
pnpm run typecheck
pnpm run lint
pnpm run test:coverage
pnpm run test:contract:local
pnpm run check:circular
pnpm run validate:migrations
pnpm run check:write-registration
pnpm run check:vercel-config
pnpm run check:licenses
pnpm run check:vulnerabilities
pnpm run release:validate-docs
pnpm run build
bash scripts/check-bundle-size.sh
```

`test:coverage` already runs the full unit suite and operational-script coverage; no redundant plain unit run is needed here unless repository hooks independently require it. Include the Craft propagation guard and other required workflow selections not already covered by commands above. Dependency vulnerability tooling may read a public advisory feed, but must not upload private source/data or trigger hosted compute; prefer its supported local database. No test uses production secrets.

Run the full applicable local CI browser selection against the completed production-mode local build once, one worker, and the new `scoring-point-consistency.spec.ts`. Include local journey/disposable redesign fixtures safely; don't reproduce the prior manual40-page matrix. Configure the exact loopback `PLAYWRIGHT_BASE_URL` and phase8 local-candidate mode; record discovered test count and explicit skip reasons. Verify there is no hidden default dev-server launch. Release-required live-production smoke/migration admission remain pending, never relabeled local passes.

Independently replay the archived v7.1 envelope and frozen new v7.2 core/Craft receipts with network disabled, different timezone and clock. Capture all required acceptance matrix cases. Inject partial verifier failure, delayed older report, changed same-count evidence and flag-only rollback with active receipts. Assert receipt identities/DB rows/cache keys, not just HTTP200.

## Focused manual card

1. Sign in to the isolated fixture. Baseline badge and breakdown show four core dimensions, one matching score, same tier/archetype state, no Craft value.
2. Upload the valid CC report once through the real UI. Craft unlocks as the fifth radar dimension and fifth card; core stays identical for fixed evidence. Check57 fixture and legitimate0 fixture. No reviewer/form detour, false core-improvement toast or private report data in public payload.
3. Compare SVG, inline badge, Studio, PNG/OG, breakdown, expanded calculation, profile/insights API and tools to the exact same receipt. Check full page for legacy Builder/80/Craft83 trap values. Inspect69.999 boundary decimal.
4. Check Spanish320px and normal phone width, light/dark; fifth-axis labels and canonical numeric headline fit. Exercise one tooltip via keyboard. Keep existing visual design.
5. Save one palette, inspect public SVG/OG, restore captured config. Preview zoom must not change saved config. Confirm a valid agent save proposal using existing on-page control, not a direct hidden mutation.
6. Prewarm current images, switch scoring off locally with active consent, verify v6 consistency within documented bound; re-enable without changing evidence. Receipt verification remains available. Separately withdraw only the disposable subject and verify410/revocation and cache cleanup.
7. Show no-report/insufficient/expired states: no fabricated0, no lost visual unlock on mere expiry, truthful report date, no unexplained archetype fallback. Archetype availability remains a later product-review topic.

## Deliverables and exit

Write `docs/agents/v7-single-score-acceptance-report.md` (visibility/ignore policy applies) with exact candidate identity, command statuses/counts, test selection/skips, receipt hashes, screenshots and restoration checklist. Write validated schema2 local-candidate proof using phase8 tools and allowlisted build manifest. Keep final evidence in gitignored/local paths; do not commit a post-qualification plan/progress link that changes the qualified full tree. Report the paths in the handoff instead. Any later tracked change requires explicit requalification; never claim production readiness.

All local fixture writes cleaned up or explicitly retained as named manual-test fixtures; no production state touched. If app/schema/config changes during verification, requalify only invalidated evidence plus final required gates; do not push to learn failures remotely. Merge fully completed locally verified work into local develop. Stop with manual results and outstanding deployment-only checks. No push, remote PR, production merge, tag, migration, recompute or release.
