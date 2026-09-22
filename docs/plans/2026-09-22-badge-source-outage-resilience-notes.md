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
