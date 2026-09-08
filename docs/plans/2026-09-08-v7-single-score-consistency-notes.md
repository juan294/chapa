# Implementation deviations

## Deviations

### Phase 1 — app-resolved contract runtime mocks

Plan said: repair the two known database contract files and local SQL inspection helper, then pass the complete local contract suite.

Found: after those repairs passed, the full suite had 164 passes and two failures in the generation contract. Its isolated run reproduced both failures: the real Next.js `after()` ran outside a request scope. The root contract setup declared Next mocks although Next is installed only under `apps/web/node_modules`; application imports therefore did not receive the intended root-resolved mock.

Chose: move the Next server/cache contract mocks into an app-local setup module loaded before the existing environment/database setup, with a regression asserting the application-resolved runtime uses the contract stubs. Preserve the original mock behavior and all local credential/target guards. Do not change the generation route or runtime dependencies.

Why: the complete phase gate must exercise direct handlers under the intended test request runtime. This is a bounded extension of the phase's harness repair in `2026-09-08-v7-single-score-consistency`, not a scoring or production behavior change.

### Phases 2–4 — combined local integration gate

Plan said: run combined broad gates after the two independent calculator phases, then implement receipt integration.

Found: the calculators passed their targeted regressions and independent reviews, while the additive receipt modules were ready to consume the new contracts. The owner explicitly requested continuous execution through all phases.

Chose: retain separate calculator and receipt regression evidence and reviews, then run the full typecheck, lint, unit/script, contract and build gates over their combined local tree before activating any runtime path.

Why: this verifies the exact integrated contract used by the next phase, without claiming that incomplete intermediate files passed a broad gate. Production selection remains unchanged.

### Phase 4 — preserve historical engines while resolving public criteria

Plan said: keep historical algorithm bytes unchanged and make all public receipt elements agree with the observed calculation.

Found: the existing public projection emits historical assessment-chain rows individually, which duplicates public work/criterion identities after corrections. The pinned core's private verdict resolver correctly resolves those chains but is not exported.

Chose: add a bounded public-metadata resolver that follows the pinned verdict rules and enforce qualifying-count parity against the actual calculator before sealing. Keep full revision chains in private scoring evidence and semantic identity. Preserve the historical engine bytes.

Why: corrected or retracted assessments must remain publishable without inventing credit, while archived receipts retain their exact algorithm identity.
