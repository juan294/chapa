# Phase 7 — APIs, tools and every remaining scored consumer

Depends on phase6. Sequential. Closes AS-H1 and completes the agreement contract beyond human pages.

## Files

`apps/web/lib/webmcp/server-tools.ts`, `shared-tools.ts`, `catalog.ts`; Studio and share tool hooks/components; `apps/web/lib/impact/simulate.ts`; public profile/insights/history APIs; admin users API/table adapters; leaderboard; history/diff/trend/significant-change; scored email generators; current SEO/LLM snippets; `docs/scoring-consumer-inventory.md`, inventory checker/tests and `docs/webmcp.md`. Include command-bar and experimental/demo scored consumers from inventory, with explicitly identified fixtures rather than hidden legacy current values.

Anchors: `apps/web/lib/webmcp/server-tools.ts:428`, `apps/web/app/u/[handle]/SharePageWebMcpTools.tsx:191`, `apps/web/lib/impact/simulate.ts:27`, `docs/scoring-consumer-inventory.md:12`.

## Changes / pseudocode

```text
publicProfile = model.toPublicProjection()
publicInsights = model.craft // versioned report-derived result, not legacy tool_insights
compare(a,b):
  expose both machine policies, identities and exact/display values
  same compatible policy -> dimension differences from their projections
  mixed policy -> not_comparable(reason), no v6/v7 improvement delta
simulate(model, evidenceCountOverrides):
  use current pure policy calculator with fixed baseline/window
  return hypothetical:true, baselineRevision, policy, inputs, point results
verifyTool(token):
  preserve current/superseded/revoked/not_found + authentication + arithmetic status
```

Current simulation changes scoring inputs (e.g. qualifying delivery units or accepted criteria), not a list that adds Craft to the core average. If existing tool accepts direct dimension-score overrides, preserve an explicitly hypothetical dimension scenario branch with fixed four weights and clear scope; it cannot claim those dimensions are attained without evidence. Legacy simulation stays explicitly v6. Craft-only overrides cannot change core. No hypothetical result is published or used as the current profile identity.

Comparison returns the actual current dimensions, including optional report Craft, rather than mixing receipt headlines with legacy snapshot dimensions. Cross-policy/cross-period comparisons must state their limitation; do not calculate a misleading improvement across a version transition. All displayScore fields equal the canonical displayed number, including boundary decimals. Keep exactScore separately and never silently round a second time. Leaderboard ordering uses a declared stable current-value/tie rule and displays the same score on the linked badge; no smoothed legacy fallback for a current receipt.

Browser verify_badge must handle top-level versioned envelope and410 revoked distinctly. The remote/browser results retain revision, policy, issuance authentication and arithmetic status without raw private data. No fabricated legacy body.data shape. Register tool changes through the existing adapter/lifecycle map; no new unrelated tool catalog.

History and score-change notifications use machine-policy-segmented observations. A point-policy transition resets/segments EMA; no email declares the v6→v7 numerical difference a performance gain/loss. Email/cron code changes are verified with fixtures only; send nothing.

Upgrade consumer inventory proof: membership alone is insufficient. Map each consumer to a test that actually asserts its policy/value content. Cross-surface acceptance fixture must cover badge/Studio/dashboard/API/tools/leaderboard/receipt and negative legacy traps. Optional raw legacy fields retained for API compatibility must live in an explicitly named legacy projection; they cannot compete with current top-level scores.

## Automated acceptance

C17–C24. Valid simulate/preset requests and confirmed on-page save proposal are distinct from error/proposal-only evidence. Test mixed policy comparisons, Craft presence/zero, decimal boundaries, revoked verification, no report and unconsented legacy fallback. Privacy assertions inspect serialized payloads, not just visible text.

```sh
pnpm exec vitest run apps/web/app/studio/useStudioWebMcpTools.test.ts 'apps/web/app/u/[handle]/SharePageWebMcpTools.render.test.tsx' apps/web/lib/webmcp/server-tools.test.ts apps/web/lib/profile/scoring-consumer-inventory.test.ts apps/web/lib/impact/simulate.test.ts apps/web/lib/profile/leaderboard.test.ts --no-file-parallelism
pnpm run test:contract:local
pnpm run typecheck
pnpm run lint
pnpm run test
```

Run all changed API/history/admin/email tests too, then full unit gates. No live email/provider/tool invocation is needed to establish the contract.

## Manual / stop

On the isolated fixture, execute a valid current-policy simulation and inspect a same/mixed-policy comparison, current verification and revoked token. Confirm a proposed Studio save through the existing on-page control, check public result, restore. Stop with output captures and no remote mutations.
