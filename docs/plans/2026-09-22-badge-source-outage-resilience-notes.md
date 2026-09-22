# Notes: `2026-09-22-badge-source-outage-resilience`

## Deviations

### Phase 1

- **Inflight key day-scoping.** Plan said: remove `referenceDate` from the cache authorization binding. Found: the in-flight coalescing map used that binding as its key, so it lost its day scope, and two concurrent calls for one grant on different scoring days shared one fetch. Chose: append `window.referenceDate` to the in-flight key only. Why: the cache binding must match across a UTC-day rollover so stale data can be served, but one 365-day collection window must never be shared with a caller who scores a different window.
- **`freshUntil` kept as stored field.** The simplify pass suggested deriving it from `capturedAt`. Chose: keep it, because the plan specifies the envelope shape.

### Phase 2

- **One `StoredBadgeProfile` shape.** Plan said: a union of a v7.2 shape and a v6 shape with `impact`. Chose: one shape that always carries `legacyImpact`, copied from the durable snapshot. Why: the renderer takes positional `(stats, impact)` input, and `scoring` stays the only numeric authority. The v7.2 receipt still supplies every displayed number and the disclosed date (`identity.recordedAt`).
- **`confidencePenalties: []` in the stored legacy impact.** Found: snapshot penalties drop the `reason` string that `ImpactV6Result` requires. Chose: emit an empty list instead of inventing reasons. The badge renderer does not read this field.
- **Fallback telemetry uses `captureServerEvent("badge_stored_fallback")`.** The plan asked for bounded, sanitized telemetry. A 200-status `captureServerError` would record a success as an error, so the event helper is used.
- **Golden SVG hashes re-baselined.** The only change is the new root attributes (+59 bytes: ` data-chapa-state="rendered" data-chapa-freshness="current"`).

### Phase 3

- **Incident record location.** Plan said: `docs/incidents/2026-09-22-badge-load-error-linked-source-refresh.md`, with an explicit fallback to an existing convention if one exists. Found: no `docs/incidents/` directory exists; `docs/logs/2026-07-16-scoring-incident-and-cron-outage.md` is the repo's one existing incident record and its own established location. Chose: `docs/logs/2026-09-22-badge-load-error-linked-source-refresh.md`, following that convention instead of creating a new top-level directory for a single file.
- **No consumer changes needed for 3.2.** Every `renderBadgeSvg` call site (share page, badge route, OG image, Studio preview, warm-cache, landing/archetype demo badges) omits the new `degraded` option, so each defaults to `data-chapa-state="rendered"` with freshness derived from `scoring?.freshness` (already "current" for all non-badge-route demo/preview callers, since they pass no stale scoring). Only the badge route's stored-badge-fallback branch passes `degraded`. No file needed editing for this step.
- **No ADR drift found for 3.3.** `docs/decisions/2026-08-30-scoring-cache-seam-flag-combinations.md` already carries its 2026-09-22 addendum (the `readStats`/`readOnly` rows and the "combinations that actually bite" #4 entry) describing the exact-bound fresh/stale behavior implemented in phases 1-2; it matched `apps/web/lib/github/client.ts` and `apps/web/lib/cache/stats-cache.ts` as read, so no edit was needed there. The root `CLAUDE.md` "Caching rules" bullets had not been updated for this plan (still described the binding as day-scoped with a bare "6 h TTL"); those two bullets were corrected to describe the binding excluding the day, the 6h fresh / 7-day stale retention, the exact-authorization recheck required before serving stale, and that stale never publishes.
