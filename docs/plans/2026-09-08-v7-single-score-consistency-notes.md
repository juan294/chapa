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

### Phase 5 — explicit report date admission and current consumer cutover

Plan said: preserve report periods, deterministic report selection, and first-upload publication without recalculating fixed core evidence.

Found: supported HTML reports declare inclusive calendar dates, including the capture day, while replay inputs require nonfuture observation instants. The client parser also preserves original outcome labels that the legacy DTO loses. Switching the common receipt reader exposes historical-only consumers before the later presentation phases.

Chose: use a strict browser-produced versioned numeric DTO with original labels and validate it again on the server. Canonical content deduplication is independent of capture time; persist the first server cutoff, bounded by the declared end, without rejuvenating retries. Rank effective periods and retain explicit same-declared-period correction. Add minimal current projection adapters at the reader cutover; finish presentation and all-consumer acceptance in phases 6–7.

Why: date-only reports need a reproducible admission rule, failure categories must survive parsing, and no intermediate runtime reader may interpret a current point receipt using the archived range contract. Full report HTML stays in the browser; the private canonical numeric import body follows the existing retention rule.

### Phase 5 — frozen core identity survives report-only publication

Plan said: a Craft-only update preserves fixed core evidence, and an unchanged retry or ordinary refresh reuses the same receipt.

Found: recomputing core from mutable retained stores could change a frozen baseline, while hashing the previous combined digest plus new Craft produced a different identity from the next ordinary refresh.

Chose: retain a private core semantic digest separately from the combined core/Craft digest. Report-only publication reuses the durable core payload and this private identity, with an atomic expected-current-revision fence. Ordinary publication uses the same combined digest construction, so unchanged evidence deduplicates while changed private provenance remains significant.

Why: public field equality alone cannot prove private evidence identity, and a report upload must not overwrite a concurrently published newer core. The metadata remains private and does not alter the public receipt schema or archived algorithm bytes.

### Phase 5 — no prior-day current-policy image fallback

Plan said: include policy identity in yesterday fallback and keep responses within a bounded rollback budget.

Found: a prior-day raw image cannot re-evaluate Craft eligibility after the annual window advances; it can show a now-expired point as current even when the underlying receipt has not changed.

Chose: retain prior-day fallback only for legacy policy. Current-policy images use the captured UTC context date; the central selection cache refreshes at midnight and current response freshness also ends at midnight. A late render cannot populate the new date's namespace or renew old eligibility.

Why: a bounded stale score is still a contradictory current Craft state. Redis hits remain available within the current day, while expiry requires a fresh projection. This accepts the origin-work trade without relaxing score correctness.

### Phase 6 — descriptive activity and explicit illustrative samples

Plan said: keep the visual design, project current scores everywhere, and preserve descriptive activity counts without inventing scoring attribution.

Found: the existing heatmap attaches seeded per-day dimension percentages unrelated to recorded criteria. Existing demos also carry intentionally curated legacy values that cannot explain current arithmetic.

Chose: keep the current heatmap and actual activity counts, omitting invented per-day dimension attribution only for current policy. Add clearly illustrative current samples calculated by the real core/report engines, without publication identity, and pass their same projection to both badge and dimension explorer. Preserve existing legacy demo and badge bytes when legacy policy is selected.

Why: every displayed attribution must have an evidence basis. Example profiles remain examples, while their arithmetic is now internally consistent. The public methodology resolves live policy rather than retaining an hour-old method; historical v7.1 content is explicitly archived. Landing's live leaderboard cache selection is completed in phase7.

### Phases 6 and 9 — focused browser acceptance on the completed candidate

Plan said: inspect changed scoring pages in Spanish/mobile/light/dark, Save and restore a palette, and repeat final acceptance on the completed production-mode local candidate.

Found: this owner requested continuous completion and explicitly asked to avoid repeating the recent end-to-end campaign. Renderer arithmetic/geometry can be qualified independently before the remaining API/tool work.

Chose: run phase6 component, policy/content, real-font raster and all local automated gates now; consolidate the focused interactive browser card with phase9's exact completed candidate. Preserve phase6 raster evidence as intermediate evidence, not final-build proof.

Why: the final browser acceptance must exercise the integrated API/tool behavior and exact candidate. This avoids a redundant intermediate manual campaign without dropping any acceptance case.
