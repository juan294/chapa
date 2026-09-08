# Implementation deviations

## Deviations

### Phase 1 — app-resolved contract runtime mocks

Plan said: repair the two known database contract files and local SQL inspection helper, then pass the complete local contract suite.

Found: after those repairs passed, the full suite had 164 passes and two failures in the generation contract. Its isolated run reproduced both failures: the real Next.js `after()` ran outside a request scope. The root contract setup declared Next mocks although Next is installed only under `apps/web/node_modules`; application imports therefore did not receive the intended root-resolved mock.

Chose: move the Next server/cache contract mocks into an app-local setup module loaded before the existing environment/database setup, with a regression asserting the application-resolved runtime uses the contract stubs. Preserve the original mock behavior and all local credential/target guards. Do not change the generation route or runtime dependencies.

Why: the complete phase gate must exercise direct handlers under the intended test request runtime. This is a bounded extension of the phase's harness repair in `2026-09-08-v7-single-score-consistency`, not a scoring or production behavior change.
