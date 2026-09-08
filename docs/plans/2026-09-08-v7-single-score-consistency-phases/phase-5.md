# Phase 5 — Upload publication, shared selection and bounded image rollback

Depends on phase4. Sequential. Closes DO-H1 and connects report-derived Craft to the familiar upload action.

## Files

`apps/web/lib/insights/parser.ts`, `report-v7.ts`, `use-insights-import.ts`; `apps/web/lib/db/craft-v7.ts`; `apps/web/app/api/insights/route.ts`; profile materialization/score-model/score-view-model/orchestration modules; authenticated generate/refresh/recalculate and warm-cache callers; `apps/web/lib/feature-flags.ts`; SVG/OG cache helpers and routes; `apps/web/lib/cache/edge-cache.ts`; admin feature-flag route; share/cron cache writers, public post-write invalidation and associated tests. Add a shared server `scoring-render-selection.ts`. Add `051_report_craft_publication.sql` for minimally retained report-calculation inputs/consent/selection if the existing diagnostics rows cannot represent the strict new contract; do not repurpose assessed-episode verdict rows.

Current anchors: `apps/web/app/api/insights/route.ts:65`, `apps/web/lib/insights/use-insights-import.ts:130`, `apps/web/lib/render/badge-svg-cache.ts:86`, `apps/web/app/api/admin/feature-flags/route.ts:67`.

## One-context runtime and one upload

```text
selection = readScoringRenderSelection() // enabled, machinePolicy, cacheable, capturedAt
materialize/read/issue/project with that same selection and captured evidence context
never mix enabled-policy images with a separately reread v6 model

upload:
  authenticate owner; validate strict current report payload
  get publication acknowledgment in the existing import action if needed
  persist canonical report + digest + minimal scoring inputs + period
  choose current eligible report deterministically
  retain fixed core evidence/context while updating Craft
  issue/repair exact receipt + verification
  await invalidate all affected representations
  return persisted/publication/refreshed states + published projection
```

No core refetch merely because Craft changed: isolate report-triggered publication from ordinary scheduled source refresh. If no baseline exists, initialize core once from a validated source read and make that explicit. If report observation time exceeds the baseline context, or the UTC day/window changes, create a new context/family and re-evaluate retained normalized core evidence for that window; expired observations may legitimately leave the core. If retained data consists only of old aggregates, refresh through the bounded normal source path or keep the prior receipt explicitly stale/unavailable; never relabel those aggregates with the new window. Do not force a new report into an older frozen context or attribute clock-driven changes to Craft. Tests compare unchanged core evidence, not timestamps/hashes that legitimately describe a new receipt.

Upload dispatch follows the same selected policy as the visible profile: with rendering disabled, keep the working legacy parser/import/result contract and v6 consumer coherence. With v7.2 enabled, use the versioned report parser and publication contract, including the inline acknowledgment if the subject is not yet consented. Preserve explicit legacy-client request support without relabeling its output. A new report stored privately or skipped by flag-off issuance must never be announced as publicly unlocked. Test actual flag-off UI upload and off→on transition. Avoid starting an upload under one policy and announcing results under another if the flag changes in flight. The UI must honor persisted:false, publication failure and refresh failure; no 'undefined' score/tier, no claimed core bump from uploading Craft, and no cooldown that blocks retry of a partially failed publication. First-time publication acknowledgment is inline and says derived numerical score/receipt becomes public; it does not grant reviewer access or publish raw HTML. Existing consent is reused. No external evaluator is invoked.

Persist a replay-sufficient numeric report summary separately from raw-body retention. Deduplicate by owner+canonical digest; older/overlapping aggregate reports do not accumulate credit. Atomic selection/publication admission prevents an older slow request overwriting the selected newer report. Preserve original report periods and explicit replacement lineage. Invalid/insufficient import does not erase a current valid scored Craft result. Existing report deletion/withdrawal paths invalidate the new selection and all related models.

## Cache correctness and rollback

One selection snapshot precedes SVG/OG cache reads and travels through materialization and cache publication. Add machine selection to Redis keys, OG version URLs/envelopes, coalescing locks, stale-day fallback and all writers/invalidation helpers. Do not key solely by layout or append only at one reader.

Add `scoring-images` edge tag beside per-handle badge/OG tags. A scoring-flag update invalidates that tag once, not a handle scan. Report flag persisted versus purge completed separately; a failed purge is observable and retryable.

Define a bounded fallback rather than claim instantaneous global rollback:

- Dedicated scoring selection lookup cache at most5 seconds, backed by an authoritative direct DB row lookup. Bypass the generic Map, Next cache AND dbGetFeatureFlag's ff:key: Redis cache (currently1 hour). Test a deliberately stale shared ff:key: entry; it must not control image selection.
- Mutable SVG and versioned OG browser/CDN freshness at most300 seconds, with no extra stale-while-revalidate/stale-if-error budget. Redis artifacts may retain longer TTL because policy keys isolate them.
- Recheck selection immediately before committing a newly rendered image; discard/retry or return non-cacheable on changed selection. An old slow render must not populate a current key or restart an unbounded old-policy freshness period. Cap response freshness by elapsed selection age where necessary.
- Flag lookup failure returns a non-cacheable explicitly identified fallback/unavailable response; it cannot populate the successful current-policy namespace.
- Document a nominal≤305-second online cache-convergence budget under successful bounded reads/header compliance; disconnected downloaded copies cannot be recalled. Unit clocks prove the origin/inflight budget; actual provider CDN purge remains later production proof.

This changes the six-hour edge-cache efficiency tradeoff. Measure warm origin latency and verify retained Redis hits avoid provider recomputation; document that trade instead of silently relaxing the rollback invariant. Never disable cache correctness to hit a performance number.

## Automated acceptance

C07–C16, C20–C22. Route/DB tests assert actual report/receipt rows and same core before/after; owner authorization; missing acknowledgment; existing consent; raw privacy; same-period correction; same-day report newer than baseline and UTC rollover; stale aggregate-only fallback; upload/verification/invalidation failure retry; digest duplicate; older slow writer versus newer current selection.

Origin cache tests prewarm v7.2 SVG/versioned OG, switch flag off **without withdrawal**, assert v6 selection, then re-enable and recover current artifacts with original receipt intact. Test both locales, yesterday fallback, Studio revisions, in-flight old worker, flag timeout and failed edge purge. No user/Redis key enumeration. Legacy stats and layouts stay separate.

```sh
pnpm exec vitest run apps/web/lib/insights/use-insights-import.test.tsx apps/web/app/api/insights/route-v7.test.ts apps/web/lib/profile/score-model.test.ts apps/web/lib/profile/materialize-profile.test.ts apps/web/lib/feature-flags.test.ts --no-file-parallelism
pnpm run test:contract:local
pnpm run check:write-registration
pnpm run validate:migrations
pnpm run typecheck
pnpm run lint
pnpm run test
```

Run changed SVG/OG cache and admin-flag test files explicitly as part of targeted regression selection. New helper tests must verify every key family/producer, not simply the key string function.

## Manual / stop

On disposable local data, one real-format report upload returns a publishable Craft result and leaves fixed core unchanged. Inspect private/public payload separation and status on injected purge failure. UI fifth-axis acceptance waits for phase6. Stop with evidence; no production env, flag or migration action.
