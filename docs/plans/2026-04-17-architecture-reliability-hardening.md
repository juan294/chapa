# Architecture Reliability Hardening

> Created: 2026-04-17
> Triggered by: codebase architecture review findings on score consistency, auth duplication, cache coherence, and deterministic data selection
> Scope: `apps/web/` and shared runtime behavior only

## Summary

Harden the codebase around one principle: the same developer profile should be computed, persisted, and served consistently regardless of which route executes first.

This plan addresses five confirmed issues:

1. Public score materialization is duplicated and inconsistent across badge, share page, OG image, warm-cache, refresh, recalculate, and bulk-recalculate routes.
2. OG image generation does not use the same craft-score and smoothing inputs as the badge/share experience.
3. `getStats()` deduplicates in-flight work by handle only, allowing public and authenticated fetches to collapse into the same weaker execution path.
4. Tool-insights reads are ambiguous when a handle has more than one uploaded tool report.
5. Server-side feature-flag reads are memoized in-process, but admin updates do not invalidate that in-memory cache.

## Chosen Design

### Option A: Patch each route locally

Keep the current structure and fix each route independently.

**Pros**
- Lowest short-term diff
- Minimal new abstractions

**Cons**
- Keeps the duplicated pipeline alive
- Makes future score-policy drift likely
- Does not give one testable source of truth

### Option B: Introduce a shared profile materialization layer

Create one server-side pipeline that owns stats fetch, craft selection, smoothing policy, snapshot payload construction, and public-side effects. Migrate routes to consume that layer.

**Pros**
- Fixes the architectural cause, not only the symptoms
- Makes public surfaces consistent by construction
- Gives one place to encode score-presentation policy
- Simplifies route tests and regression coverage

**Cons**
- Larger refactor than isolated patches
- Requires disciplined phase ordering

### Option C: Full domain rewrite around persisted read models

Introduce a dedicated “profile read model” in storage and make routes consume persisted snapshots only.

**Pros**
- Strong long-term separation between compute and serve paths

**Cons**
- Too large for the current issue set
- Higher migration and rollout risk
- Expands scope into data-model and operational redesign

### Decision

Choose **Option B**.

It fixes the confirmed correctness issues without forcing a full persistence redesign.

## Working Assumptions

1. The authoritative public score is the score Chapa displays to end users after its smoothing policy is applied.
2. A persisted “latest snapshot” must reflect that same public score so subsequent same-day reads stay stable.
3. `/api/recalculate` may still return raw score details for debugging or CLI use, but it must not persist a different public score policy than the rest of the app.
4. Until the product exposes explicit multi-tool selection, the **most recently uploaded tool-insights record** for a handle is the authoritative craft source.

## Phase Overview

| Phase | Title | Description | Batch |
|-------|-------|-------------|-------|
| 1 | Unified profile materialization foundation | Introduce the shared server-side pipeline and canonical score policy | No |
| 2 | Public route migration | Move badge, share page, and OG image to the shared pipeline and centralize public side effects | No |
| 3 | Orchestration route migration | Move warm-cache, refresh, recalculate, and bulk-recalculate to the shared pipeline | No |
| 4 | Auth and stats-fetch hardening | Remove repeated session parsing patterns and make `getStats()` request dedupe auth-aware | [batch-eligible] |
| 5 | Deterministic craft + flag cache coherence | Make craft-source selection deterministic and invalidate in-process flag cache on admin updates | [batch-eligible] |

## Implementation Status

- [x] Phase 1: Unified profile materialization foundation
- [x] Phase 2: Public route migration
- [x] Phase 3: Orchestration route migration
- [x] Phase 4: Auth and stats-fetch hardening
- [x] Phase 5: Deterministic craft + flag cache coherence

## Batch Groups

- **Sequential group A:** Phase 1 → Phase 2 → Phase 3
- **Batch group B:** Phase 4 and Phase 5 after Phase 3 lands

Phase 4 and Phase 5 are independent:
- They do not require overlapping write ownership.
- They improve correctness around adjacent infrastructure, not the shared materialization core.

## Detailed Phase Notes

See:

- [Phase 1](2026-04-17-architecture-reliability-hardening-phases/phase-1.md)
- [Phase 2](2026-04-17-architecture-reliability-hardening-phases/phase-2.md)
- [Phase 3](2026-04-17-architecture-reliability-hardening-phases/phase-3.md)
- [Phase 4](2026-04-17-architecture-reliability-hardening-phases/phase-4.md)
- [Phase 5](2026-04-17-architecture-reliability-hardening-phases/phase-5.md)

## Cross-Cutting Rules

### Canonical scoring policy

The new shared layer must expose explicit policies rather than letting routes improvise:

```text
policy = "public-display"
  stats = getStats(...)
  craft = getCraftSource(...)
  rawImpact = computeImpactV6(stats, craft)
  displayImpact = applySmoothingPolicy(rawImpact, latestSnapshot)
  snapshot = buildSnapshot(stats, displayImpact)
```

```text
policy = "explicit-recalculate"
  stats = getStats(...)
  craft = recomputeCraft(...)
  rawImpact = computeImpactV6(stats, craft)
  displayImpact = applySmoothingPolicy(rawImpact, latestSnapshot)
  response = { rawImpact, displayImpact }
  persistedSnapshot = buildSnapshot(stats, displayImpact)
```

### Canonical craft selection policy

```text
getCraftSource(handle):
  rows = tool_insights for handle ordered by uploaded_at desc
  return first row or null
```

### Canonical auth/session policy

```text
getServerSession():
  secret = NEXTAUTH_SECRET.trim()
  cookie = request-or-headers cookie header
  return parsed session or null
```

Routes and server components should stop re-implementing this pattern inline.

## Automated Success Criteria

- Badge SVG, share page, OG image, warm-cache, refresh, recalculate, and bulk-recalculate all consume the shared materialization path or shared policy helpers.
- Same-day score snapshots remain stable regardless of which public route executes first.
- OG image output uses the same craft-score and smoothing inputs as the badge/share paths.
- `getStats()` no longer deduplicates a public request and an authenticated request under the same inflight key.
- Tool-insights reads are deterministic under multiple rows for one handle.
- Admin feature-flag updates invalidate both storage-backed and in-process caches.
- Existing test suites stay green, and new regression coverage locks the corrected behavior.

## Manual Success Criteria

- Generate a profile via badge route, then visit share page and OG image: all three surfaces show the same tier and adjusted score for the same handle.
- Run refresh/recalculate flows for a handle on the same day: follow-up public reads remain consistent and do not flip between raw and smoothed variants.
- Toggle a feature flag in admin and confirm behavior changes immediately on the same running instance.
- Upload more than one tool-insights report for the same handle and confirm the selected craft score follows the documented rule.

## Verification Strategy

Automated:
- `pnpm run typecheck`
- `pnpm run lint`
- `pnpm run test`
- Targeted route tests for badge/share/OG/public profile/admin feature flags/tool insights

Manual:
- Public profile parity check across `/u/:handle`, `/u/:handle/badge.svg`, and `/u/:handle/og-image`
- Refresh/recalculate spot checks
- Admin feature-flag toggle smoke test

## Risks

- The biggest risk is changing score persistence semantics in a way that unintentionally shifts visible scores. That is why Phase 1 and Phase 2 must land before orchestration-route migration.
- The second risk is introducing overly broad helpers that hide distinct public vs. recalculation behavior. The shared layer must encode policy explicitly rather than flattening all flows into one opaque function.
- The craft-source rule is intentionally conservative: “latest uploaded row wins” is stable and testable now, but may need revisiting once the product offers tool-specific views.
