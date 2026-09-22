# Phase 1 — Policy, shared foundation and local contract harness

Depends on: none. Sequential. Scope: make the policy and safe baseline checkable; do not switch the running scorer.

## Read and own

Read main plan, policy.md, acceptance.md, audit and current CLAUDE/rules. Current anchors: `packages/shared/src/scoring-evidence.ts:1`, `packages/shared/src/score-receipt.ts:8`, `apps/web/lib/db/platform-token-refresh.contract.test.ts:56`, `apps/web/lib/db/source-context.contract.test.ts:27`, `scripts/test-contract-local.ts:91`.

Own new `packages/shared/src/scoring-observed.ts` and its tests; additive exports from `packages/shared/src/index.ts`; new machine-readable `packages/shared/src/__fixtures__/scoring-observed-policy.json`; the two failing contract files and a shared local SQL inspection helper if needed. Record the accepted policy in new `docs/decisions/2026-09-08-scoring-v7-observed-point-policy.md` during implementation. Do not edit the historically hashed September 5 policy or engines.

## Changes / pseudocode

1. Pin named machine revision v7.2, four core weights/caps, display algorithm, outcome mapping/weights, no-report versus scored-zero Craft, and nullable unchanged archetype eligibility. Define new types without replacing existing historical types or enabling the runtime.
2. Define `PointResult(exact,displayValue,displayLabel)`, scalar trace with original input bounds and selected observed count, `ReportCraftResult`, explicit insufficient/expired/unavailable states, and exact score identity. The radar axis list is presentation metadata, not a weight list.
3. Freeze pure input/output contracts consumed by phases2/3. They must not need to edit shared exports concurrently. Existing v7.1 publication remains the only active parser until phase4.
4. Repair the disposable-project test guards using the existing local SQL pattern, not a removed guard:

```text
assert SUPABASE_URL is loopback
read safe project_id from local config
query only docker container supabase_db_<that project>
use local wrapper credentials; never .env.local
```

5. Update the migration048 expectation: missing subject is the intentional legacy state; after withdrawal an existing ambiguous token-refresh attempt remains busy. Assert explicit false-consent rejection, absent-subject legacy renewal, reconsent preserving the ambiguous attempt, and no repeated provider refresh. Do not change production SQL merely to satisfy an outdated test.
6. Create the initial fixture inventory (C01–C24 in acceptance.md). Preserve archived envelopes as inputs; don't mutate them into new receipts. Policy/golden fixtures contain synthetic/public aggregates only.

## Automated acceptance

- Shared type/policy fixtures assert fixed four weights, separate report Craft, display boundary examples and discriminator strictness.
- Existing local contract file selection passes with both role-privilege assertions actually executed; all expected RPCs appear with anon/authenticated false and service_role true.
- Local helper rejects non-loopback endpoints, invalid project identifiers and ambiguous containers before SQL execution.
- Full ordinary typecheck/lint/unit suite remains green and old receipt digest tests still pass.

```sh
pnpm run test:contract:local apps/web/lib/db/platform-token-refresh.contract.test.ts apps/web/lib/db/source-context.contract.test.ts
pnpm exec vitest run packages/shared/src/scoring-observed.test.ts
pnpm run typecheck
pnpm run lint
pnpm run test
```

Only use an established disposable local Supabase; inspect target first. Creating/resetting production or copying production credentials is outside scope. If a local prerequisite is unavailable, report the exact blocker rather than interpreting failed/skipped contracts as green.

## Manual acceptance / stop

Present the numerical policy examples (owner46 versus historical80, Craft57 example, Craft fifth axis, nullable archetype). No browser rerun is needed for this phase. Stop after local review and verified phase completion. User authorization to implement the plan accepts these explicit defaults; no claim of empirical calibration is added.

## Completion — 2026-09-08

- [x] Additive shared policy/types, canonical display, fixture inventory and ADR.
- [x] Local target guards and migration048 contract expectations repaired.
- [x] Independent Astra compliance review and separate simplification review.
- [x] Targeted tests, full unit suite (9,365), full local contracts (168), typecheck, lint and local production build passed. Bundle budget passed.
- [x] Historical policy/engine/parser SHA-256 unchanged.

The full contract gate also exposed app-local Next mock resolution; the bounded harness fix and its red/green regression are recorded in `2026-09-08-v7-single-score-consistency-notes.md`. No migration or runtime scorer was changed. Coverage and final browser/release qualification remain phase9 gates. Work remains isolated and local; stop before phase2.
