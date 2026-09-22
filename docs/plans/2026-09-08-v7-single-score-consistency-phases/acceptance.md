# Executable acceptance matrix

This is the shared test contract for all phases. Implement named fixtures/tests rather than merely asserting prose or component existence. Each required row must link to a passing assertion and final candidate evidence before completion.

## Canonical fixtures

- **Historical v7.1:** untouched archived `docs/plans/2026-09-07-local-e2e-verification-phases/evidence/phase6/receipt-envelope.json`; original46–100 replay remains valid.
- **Observed owner:** synthetic new v7.2 receipt derived from the archived numeric inputs, exact core46.40250879691149, display46, same original unknown-coverage eligibility/no definitive archetype. Deliberately supply legacy props core80, Builder, D100/Q74/C67/B71/Craft83 beside it in integration tests.
- **Report57:** T10; fully4, mostly2, partially1, failed1, unknown1, unclassified1. Current Craft57, classified8/10, core identical to Observed owner. Report period wholly in window and explicit deterministic clock.
- **Report0:** T10, failed10. Craft scored0; five radar axes and fifth card, not a falsey absent state.
- **No outcome data:** valid shape/T10 but all outcomes unknown or missing, including fully_achieved:0 plus unclassified10. Insufficient data, not a scored0 or invented unlock. Existing valid Craft is not erased by this failed-to-score import.
- **Complete evidence:** include ordinary equal bounds and incomplete-source saturated bounds whose normalized score endpoints coincide; existing definitive archetype behavior retained. Include zero and caps.
- **Boundary:** exact core29.999/30,69.999/70,84.999/85 and nearest binary64 neighbors. Shared display+classification rule, no interval or inequality label.

## Assertions

| ID | Case | Required behavior | Primary test ownership |
|---|---|---|---|
| C01 | Observed point/zero/caps | Fixed formulas, exact four weights,0–100, no current range result | Phase2 observed calculator tests |
| C02 | Archived owner conversion | New exact46.40250879691149/display46; old receipt still46–100 | Phases2/4 replay fixtures |
| C03 | Tier precision | Every consumer uses identical numeric display; no70/Solid mismatch or `<70` | Phases2/6/7 boundary tests |
| C04 | Missing upper coverage | Changing only possible-completion upper counts leaves observed score unchanged; coverage remains truthful | Phase2 evidence tests |
| C05 | Monotonicity/dedup | Eligible observed additions cannot lower core; same work duplication has zero extra credit | Phase2 property tests |
| C06 | Report57/repetition | Formula57, coverage8/10; proportional duplicate-sized sample same score; no volume/tool/speed credit | Phase3 calculator tests |
| C07 | Visual Craft unlock | Before report four axes; successful valid report five axes/fifth card; measured0 also unlocks; core unchanged | Phases5/6/9 real upload/render |
| C08 | Invalid/unknown/empty | Impossible totals rejected; no recognized outcome => insufficient; never fabricate0 or overwrite good current report | Phases3/5 |
| C09 | Overlap/age/selection | Never sum overlapping aggregates or rejuvenate with upload time; older report cannot win even if current candidate history is incomplete; explicit same-period correction supports insufficient ancestors without erasing a good score | Phases3/5 DB race |
| C10 | Expiry/raw retention | Replay inputs survive raw-body purge; expiry retains exactly five labelled spokes in unlocked-but-unavailable state, no numeric Craft vertex; no stale current point/fake0 | Phases3/5/6 |
| C11 | Strict version replay | Historical digests preserved, new discriminant strict; reject tampering/extra fields/unknown policy/current score ranges | Phase4 schema+offline CLI |
| C12 | Semantic no-op | Exact same evidence/order-independent source sets preserve envelope; changed exclusion/provenance/report revises even with same score | Phase4 materializer+contract |
| C13 | Reference families | New clock-only same-day no-op reuses old; real observation/new day/policy new family; correction same exact reference; newer report/UTC rollover reprojects dated evidence or retains stale; concurrent identical observations converge | Phase4 real DB |
| C14 | Partial verifier repair | Persist receipt, fail verification once, unchanged retry repairs same revision; no duplicate row or public-read write | Phase4 real DB fault injection |
| C15 | Identity race | Materialized revisionA/latestB still verifiesA; digest/policy mismatch or missing issuance gives no strip | Phase4 verification tests |
| C16 | Consent/privacy | Cross-owner denied; first publication acknowledged inline; existing consent reused; private raw data absent publicly; withdrawal denies repair and returns410 | Phases4/5/9 contract |
| C17 | Current agreement | SVG/OG render source/Studio/dashboard/API/receipt agree on exact/display/policy/revision; legacy trap values cannot leak as current | Phases6/7 shared fixture+9 |
| C18 | Archetype deferred | Preserve eligibility/tie rules and names; original non-point dimension set remains null, never fallbackBuilder; incomplete-source saturation preserves eligible archetype; Craft never changes core archetype | Phases2/6/7 |
| C19 | History policy boundary | No v6/v7.1/v7.2 anchor blending or cross-policy improvement email; same-day EMA derives from preceding day | Phases4/7 |
| C20 | Flag-only rollback | Warm SVG/PNG with active consent, off/on, no withdrawal or receipt deletion; both locales and fallback keys; bounded freshness/purge failure | Phases5/9 |
| C21 | Save/cache races | Latest Studio/report revision wins; failed invalidation reported; old slow renderer cannot poison new-policy cache | Phases5/6/9 |
| C22 | Honest upload result | Persisted/publication/refreshed distinguishable; retry without reupload; no false core bump/undefined score/blocked repair cooldown | Phase5 hook+route contract |
| C23 | Agent semantics | Valid simulation uses policy+basis; comparisons retain policy, no mixed-policy deltas; verification current/revoked preserved; save proposal isn't successful save | Phase7/9 |
| C24 | Complete local evidence | Correct test selection, safe fixtures, no skipped-as-pass, exact local build/tree binding, schema2 proof; production gates remain distinct | Phases8/9 |

## Cross-surface assertion shape

```text
expected = receiptProjection(frozenNewEnvelope)
for currentSurface in badge, Studio, dashboard, profileAPI, insightsAPI, tools, leaderboard:
  actual = extractCurrentScoring(currentSurface)
  assert actual.policy == expected.policy
  assert actual.revision/hash == expected.revision/hash where publicly carried
  assert actual.displayedCore == expected.displayedCore
  assert actual.fourCoreDimensions == expected.fourCoreDimensions
  assert actual.CraftStatus/point == expected.CraftStatus/point
  assert actual.tier/archetype == expected.tier/archetype
  assert no unlabeled legacy scoring claims
```

An image need not print internal UUIDs: inspect renderer inputs/cache envelope/verification URL plus visible numbers. Pixel inspection complements semantic extraction; it cannot prove arithmetic alone. A historical chart, comparison side or hypothetical simulation must carry its own policy/context and is not asserted to equal current values.

Never test coherence by deriving both expected and actual from the same unchecked UI helper. Freeze independently computed scalar examples and use independent replay as the oracle. Mutation tests should demonstrate that a legacy fallback or altered core/Craft weight makes the matrix fail.
