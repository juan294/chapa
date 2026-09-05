# Phase 11: Offline replay, immutable history and verification

Prerequisites: phase 7, phase 9, phase 10.
Policy authority: [policy.md](policy.md). Parent: [scoring relaunch](../2026-09-05-scoring-relaunch.md).
This phase is mandatory before relaunch. Stop after verified completion unless the user authorizes continuation. All implementation/review agents for this work must use GPT-6 Astra.

## S12: Provide immutable score receipts and an independent offline calculator

GitHub: [#1307](https://github.com/juan294/chapa/issues/1307).

Worker role: backend. Depends on: S01, S06, S09, S10, S11.
Audit requirements: F27, F45, F48, F53.

Problem and resulting behavior:
Produce a versioned canonical receipt containing policy/algorithm digest, reference/window bounds, complete public calculation inputs and coverage, per-dimension contributions, rounding, result interval/point, independent Craft evidence, provenance classification and content hash. Supply a documented local CLI that recomputes without network, secrets or ambient time. Implement a genuinely independent reference calculation rather than a wrapper around the production function.

Exclusive implementation ownership (adjacent source tests included):
- packages/shared/src/score-receipt.ts (new)
- packages/shared/src/canonical-json.ts (new)
- scripts/scoring/reference-calculator.ts (new)
- scripts/scoring/reference-calculator.test.ts (new)
- docs/scoring-reproduction.md (new)

Pseudocode contract:
```text
read frozen v7 policy and prerequisite evidence/contracts
write failing fixtures for each acceptance criterion below
implement only S12's owned behavior against the shared contract
preserve immutable input identity, coverage and reference context
review; correct every finding; simplify; verify sequentially
record exact artifacts and stop; do not push or deploy
```

Automated/checkable acceptance:
- [x] Receipt replay is identical a year later and in another timezone, with network disabled.
- [x] Production and independently coded calculator match frozen fixtures and randomized valid inputs at final precision.
- [x] Public receipt includes every score-affecting input while excluding private names/URLs/raw reports/tokens; owner evidence exports remain protected.
- [x] Craft absent versus measured zero is preserved distinctly.
- [x] Canonicalization fixes sorting, UTF-8, date/number encoding and negative-zero handling; invalid values rejected.
- [x] All archive limitations are versioned; v6 snapshots missing evidence are marked non-replayable, never reconstructed by guessing.

Manual/domain acceptance:
- [x] An independent reviewer reconciles this task with policy.md and the cited audit cases.
- [x] Any semantic/data-source limitation is visible in evidence coverage and public claims.
- [x] No task criterion is moved past relaunch or closed with an unimplemented placeholder.


## S13: Persist replayable snapshots and correct trend smoothing

GitHub: [#1308](https://github.com/juan294/chapa/issues/1308).

Worker role: backend. Depends on: S12.
Audit requirements: F26, F45, F48.

Problem and resulting behavior:
Persist immutable receipt revisions and raw point/range outputs alongside separately identified unrounded trend state. Use elapsed-day-aware EMA and recompute same-day changes from the prior-day anchor rather than feeding each refresh back into itself. Do not smooth intervals as if they were point observations. Consume S01's already tested schema foundation; any contract/schema amendment returns to the foundation owner before dependent route work continues.

Exclusive implementation ownership (adjacent source tests included):
- apps/web/lib/impact/smoothing.ts:29
- apps/web/lib/history/snapshot.ts:18
- apps/web/lib/db/snapshots.ts
- apps/web/lib/cache/snapshot-cache.ts
- apps/web/lib/db/snapshots.contract.test.ts

Pseudocode contract:
```text
read frozen v7 policy and prerequisite evidence/contracts
write failing fixtures for each acceptance criterion below
implement only S13's owned behavior against the shared contract
preserve immutable input identity, coverage and reference context
review; correct every finding; simplify; verify sequentially
record exact artifacts and stop; do not push or deploy
```

Automated/checkable acceptance:
- [x] Constant raw70/prior60 converges toward70 without sticking at67; internal fractional state survives DB/cache round trips.
- [x] Repeated same-day reads and same-input writes cannot move trend.
- [x] Same-day input revision uses the same prior-day anchor; missing dates use the documented elapsed-time rule.
- [x] Different policy versions reset/segment trend rather than blending v6 and v7.
- [x] Local migrations cover existing rows, RLS, duplicate writes, receipt revision selection and failure semantics.
- [x] Public headline, archival raw score and trend series are distinguishable and carry receipt IDs.

Manual/domain acceptance:
- [x] An independent reviewer reconciles this task with policy.md and the cited audit cases.
- [x] Any semantic/data-source limitation is visible in evidence coverage and public claims.
- [x] No task criterion is moved past relaunch or closed with an unimplemented placeholder.


## S14: Verify the complete issued receipt without overstating authenticity

GitHub: [#1309](https://github.com/juan294/chapa/issues/1309).

Worker role: security. Depends on: S12, S13.
Audit requirements: F46, F47, F45.

Problem and resulting behavior:
Sign/store/reference the same canonical complete receipt, including Craft status/value, window, version and all public outputs. Distinguish issuance verification, arithmetic replay and independently corroborated source evidence. Keep legacy hashes readable with their original semantics. Support explicit submitted-payload comparison; do not imply an unchanged verification link detects an edited SVG automatically. Apply the policy's retention/deletion boundaries to public receipts, private report artifacts, evaluator records, logs and caches; extend the existing administrative deletion path, without adding an unrelated account-deletion product flow.

Exclusive implementation ownership (adjacent source tests included):
- apps/web/lib/verification/hmac.ts:19
- apps/web/lib/verification/types.ts
- apps/web/lib/verification/store.ts
- apps/web/lib/db/verification.ts:39
- apps/web/app/api/verify/[hash]/route.ts:49
- apps/web/app/verify/[hash]/page.tsx
- scripts/delete-user.ts

Pseudocode contract:
```text
read frozen v7 policy and prerequisite evidence/contracts
write failing fixtures for each acceptance criterion below
implement only S14's owned behavior against the shared contract
preserve immutable input identity, coverage and reference context
review; correct every finding; simplify; verify sequentially
record exact artifacts and stop; do not push or deploy
```

Automated/checkable acceptance:
- [ ] Changing any signed dimension, range, Craft presence, policy or date fails submitted-payload comparison.
- [ ] The original Craft dimension survives DB write/read and API presentation.
- [ ] A valid original URL on an edited badge verifies only the original receipt and exposes comparison instructions, never claims to inspect the SVG.
- [ ] Historical v6 records remain labeled legacy; no key/secret becomes public.
- [ ] Private evidence cannot leak through public receipt, verification, API, RSC or cache paths.
- [ ] Owner consent withdrawal removes public access and private backing data as specified, leaves only a content-free revocation tombstone, and never claims a revoked receipt is currently verified.

Manual/domain acceptance:
- [ ] An independent reviewer reconciles this task with policy.md and the cited audit cases.
- [ ] Any semantic/data-source limitation is visible in evidence coverage and public claims.
- [ ] No task criterion is moved past relaunch or closed with an unimplemented placeholder.


## Sequential local verification

Run the owned adjacent tests using `pnpm exec vitest run <explicit-owned-test-paths>`; record the exact paths in the implementation report. At phase integration run sequentially: `pnpm run typecheck`, `pnpm run lint`, `pnpm run test`, and `pnpm run build`. For schema/write changes also run `pnpm run validate:migrations`, `pnpm run check:write-registration` and `pnpm run test:contract:local` against disposable local Supabase before build. Scoring changes additionally run `pnpm run test:coverage`; import changes run `pnpm run check:circular`. Do not run checks concurrently.

Final readiness also requires repository license/vulnerability and SVG/PNG/browser verification. No hosted CI or preview is a test environment. Missing prerequisites, failed checks and policy contradictions return to their owner before completion.
