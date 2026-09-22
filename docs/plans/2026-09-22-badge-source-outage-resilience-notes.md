# Notes: `2026-09-22-badge-source-outage-resilience`

## Deviations

### Phase 1

- **Inflight key day-scoping.** Plan said: remove `referenceDate` from the cache authorization binding. Found: the in-flight coalescing map used that binding as its key, so it lost its day scope, and two concurrent calls for one grant on different scoring days shared one fetch. Chose: append `window.referenceDate` to the in-flight key only. Why: the cache binding must match across a UTC-day rollover so stale data can be served, but one 365-day collection window must never be shared with a caller who scores a different window.
- **`freshUntil` kept as stored field.** The simplify pass suggested deriving it from `capturedAt`. Chose: keep it, because the plan specifies the envelope shape.
