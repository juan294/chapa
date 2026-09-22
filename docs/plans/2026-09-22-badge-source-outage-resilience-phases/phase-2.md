# Phase 2 — Durable stored-badge fallback and explicit degraded rendering

Parent plan: `../2026-09-22-badge-source-outage-resilience.md`. Depends on phase 1. Not batch-eligible because it consumes phase 1 freshness and publication rules.

## Goal

A known profile with no safe aggregate still gets a truthful badge from its committed receipt or snapshot. Missing live activity is disclosed instead of represented as zero, and the fallback cannot run normal profile side effects.

## Files

| file | change |
|---|---|
| `apps/web/lib/profile/stored-badge-profile.ts` | **new** — badge-only durable projection |
| `apps/web/lib/profile/stored-badge-profile.test.ts` | **new** — v6/v7 authority, policy ambiguity, no fabricated activity |
| `apps/web/app/api/profile/[handle]/route.ts` | reuse shared stored projection helpers where practical; preserve response contract |
| `apps/web/app/api/profile/[handle]/route.test.ts` | prove API output does not drift after extraction |
| `apps/web/lib/render/BadgeSvg.tsx` | degraded option, unavailable-activity presentation, machine state/freshness markers |
| `apps/web/lib/render/BadgeSvg.test.tsx` | visible/accessibility disclosure and no zero-activity claim |
| `apps/web/app/u/[handle]/badge.svg/route.ts` | consume stored fallback only after live materialization returns null |
| `apps/web/app/u/[handle]/badge.svg/route.test.ts` | exact incident regression, side-effect/cache/404 contracts, locale coverage |
| `apps/web/lib/i18n/dictionaries/en.ts` | stored-snapshot and unavailable-live-source copy |
| `apps/web/lib/i18n/dictionaries/es.ts` | equivalent Spanish copy |

## Steps

### 2.1 Red: reproduce the screenshot state at the route boundary

Extend the badge route test with this matrix:

| live materialization | durable authority | expected |
|---|---|---|
| `null` | v6 snapshot | rendered stale badge, 200 |
| `null` | current v7.2 receipt + snapshot context | rendered stale/current-receipt badge, 200 |
| `null` | none | existing localized load-error fallback, 200 |
| GitHub-not-found sentinel | any stale snapshot | 404; never resurrect the handle |
| throws | snapshot exists | existing render-error contract unless the failure is explicitly classified as materialization-unavailable |

The first test should assert the production-visible failure text is absent and `@juan294` plus stored score content is present.

### 2.2 Build a non-persistable stored projection

`readStoredBadgeProfile(handle, selection)` reads the captured scoring selection once and returns:

```ts
type StoredBadgeProfile =
  | { kind: "stored"; policyVersion: "v7.2"; observedAt: string; scoring: ScoreViewModel; context: SnapshotContext }
  | { kind: "stored"; policyVersion: "v6"; observedAt: string; scoring: ScoreViewModel; impact: ImpactV6Result; context: SnapshotContext }
  | null;
```

Rules:

- `selection.cacheable === false` returns null. Unknown policy authority is not a fallback opportunity.
- A current v7.2 receipt is the only scoring authority when enabled. Never combine v7 dimensions with a v6 headline.
- With v6 selected/missing receipt, copy stored snapshot dimensions, headline, tier, and archetype. Do not call `computeImpactV6` on reconstructed data.
- Snapshot context copies only fields that actually exist. `heatmapData` is not created.
- Returned score freshness is stale unless the committed receipt model already defines a stricter truthful state.
- The type deliberately omits `snapshot`, `statsComplete`, and every field accepted by profile persistence helpers.

If sharing code with the profile API, extract pure projection helpers. Do not make the API route depend on the badge renderer.

### 2.3 Render unavailable activity honestly

Add to `BadgeOptions`:

```ts
degraded?: {
  reason: "live_sources_unavailable";
  observedAt: string;
  activityAvailable: false;
};
```

Renderer behavior:

- root has `data-chapa-state="rendered"` and `data-chapa-freshness="stale"`;
- show the stored score/dimensions and snapshot-supported counts;
- omit the heatmap cells and replace their caption with localized stale/unavailable copy;
- include the disclosure in `<title>`/`<desc>` or the renderer's existing accessible description;
- do not label the missing heatmap as zero activity;
- current live badges receive `data-chapa-state="rendered"` and `data-chapa-freshness="current"` with otherwise unchanged bytes apart from the new attributes.

Update the generic fallback SVG helper to emit `data-chapa-state="fallback"` plus a stable reason. Pass reason codes separately from localized message keys.

### 2.4 Route the fallback without side effects

At `!materialized`:

```text
stored = await readStoredBadgeProfile(handle, scoringSelection)
if stored:
  svg = renderStoredBadge(stored, locale/config)
  return 200 with max-age=60 and Server-Timing materialize;desc=stored-fallback
else:
  return existing load-error SVG
```

Requirements:

- resolve Studio config using the same captured snapshot rules, but never write the rendered stored badge into the normal daily cache;
- do not call `resolveBadgeVerification` for v6 stored fallback;
- do not register `after()` profile side effects;
- do not call `runPublicProfileSideEffects`;
- emit bounded, sanitized telemetry with fallback kind/date only; no credential, provider body, token, or refresh-claim ID;
- retain 60-second client/edge cache headers and the handle purge tags;
- preserve current locale and request coalescing behavior.

For a phase-1 stale aggregate that still reaches normal finalization, require `freshness === "current"` for normal cache publication. Its response is also short-lived and side-effect-free.

## Verification

Run sequentially:

```sh
pnpm exec vitest run apps/web/lib/profile/stored-badge-profile.test.ts --no-file-parallelism
pnpm exec vitest run apps/web/lib/render/BadgeSvg.test.tsx --no-file-parallelism
pnpm exec vitest run 'apps/web/app/u/[handle]/badge.svg/route.test.ts' --no-file-parallelism
pnpm exec vitest run 'apps/web/app/api/profile/[handle]/route.test.ts' --no-file-parallelism
pnpm run typecheck
pnpm run lint
pnpm run check:circular
```

## Done when

- The screenshot scenario renders a real, explicitly stale badge.
- No test can route a stored projection into persistence, verification, or normal SVG cache publication.
- Missing activity is visible and accessible, never zero-filled.
- True cold/no-profile and 404 behavior remain distinct.
- English and Spanish degraded copy are covered.
- Commit is local on the isolated implementation branch; no push or deploy.
