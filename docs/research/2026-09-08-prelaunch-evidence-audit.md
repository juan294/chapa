# Pre-launch evidence audit — redesign and scoring v7

Date: 2026-09-08. Candidate: `develop` at `a0fe9314` (application code equivalent to `04081dfd`). Review team: root plus three explicitly requested GPT-6 Astra agents covering scoring, frontend/UX/agent tools, and release/security/operations. Agent-facing surface reviewed: yes.

## Owner clarification after this audit — 2026-09-08

The owner clarified that v7 is intended to strengthen scoring calculation and independent reproducibility while preserving the existing dimension names/count/presentation, archetype vocabulary, 0–100 scale and badge scoring presentation. Production/hackathon remains v6. Updated formulas may change computed values; identical numeric results are not a requirement inferred from this clarification.

This supersedes the audit's assumption that the implemented range-first presentation, removal of Craft from the radar and suppression/reinterpretation of archetypes are the desired product contract. The policy/ADR's statements of past approval are repository assertions, not independent proof of the owner's intent. Do not use this report to authorize those product changes.

FE-B1 still establishes contradictory versions on one page, but its remedy must now reconcile the engine and receipts with the preserved product presentation, not propagate the current v7 presentation everywhere. The same qualification applies to AS-H1. Receipt recovery, semantic identity, cache rollback and evidence-gate findings remain relevant. Reproducibility does not require replacing a displayed score with an interval or removing archetypes; uncertainty can be disclosed separately if the score is precisely defined over recorded evidence. Reconciling that definition with current v7 bounds is substantive policy/implementation work, not merely a CSS change.

## Owner scoring preferences — subsequent clarification, 2026-09-08

- Display a single score, not a range. Define the point-score calculation explicitly over recorded evidence so independent replay produces exactly the displayed result; do not merely hide bounds, choose an arbitrary midpoint or present a completion bound as the score without a justified policy.
- Separate optional Craft is acceptable. Preserve the familiar CC insights report upload/unlock experience. This clarification supersedes the earlier assumption in this report that the owner requires Craft to remain a core/radar dimension. Whether an upload alone supplies sufficient inputs under the new rubric must be reconciled explicitly; do not silently introduce an unrelated evidence/reviewer prerequisite.
- Occasional absence of archetypes remains an open product question for later review, not an approved requirement to always assign one or to remove existing categories.
- Clear, reproducible calculation and correctness are the priorities. Badge, breakdown, explanations, API, tools, verification receipts and other scored consumers must agree on the same policy, revision and displayed values.
- These are local design/reconciliation requirements. No production change, release, flag mutation or deployment is authorized by this clarification.

## Final visual Craft clarification — 2026-09-08

The owner explicitly confirmed that the first correct CC report must visually unlock Craft as the fifth badge/radar dimension and a breakdown dimension. Separate means excluded from the four-core average, not excluded from the visualization. The implementation plan at `docs/plans/2026-09-08-v7-single-score-consistency.md` governs the proposed remediation; earlier diamond-only recommendations in this audit are superseded.

## 1. Executive assessment

**Ready for focused manual testing; NOT READY for the v7 reveal as currently implemented.** The core arithmetic and considerable local E2E work are credible. The significant remaining defects are in the connections between receipt, visible dashboard, verification, tools and caches. The existing v7 screenshot itself shows a ranged badge beside an incompatible legacy breakdown. This is a v7 launch blocker, not a reason to repeat the whole redesign test campaign.

The v6-only redesign is not shown broken by the v7 findings. Studio's misleading save copy applies independently of scoring version. This audit neither authorizes a release nor establishes the readiness of the final production artifact.

Three concrete strengths:

- The final application revision matches the reported last local test pass; subsequent commits only add documentation/screenshots.
- Independent offline replay reproduces the archived receipt, and 373 focused existing tests pass in this audit.
- The prior reports preserve real failures, follow-up commits, screenshots, and restoration details rather than presenting only a green summary.

Highest risks: conflicting v6/v7 content on one profile; failure to repair verification after partial publication; ineffective cached-image rollback; legacy math in current-profile tools; incomplete final release-gate evidence.

## 2. Scope and system model

This is an evidence-led pre-launch audit adapted to the owner's instruction not to repeat recently completed localhost E2E. It consolidates the pre-launch specialist domains into three Astra review streams plus root evidence validation, rather than repeating the command's full nine-specialist/full-suite campaign. No implementation, push, PR, deployment, remote CI, live database mutation, or production HTTP probing was performed.

Source activity and consented evidence feed the pure v7 calculator and durable receipt. `ScoreViewModel` projects either that receipt or the legacy aggregate. Badge, Studio, share, API and tools should preserve that policy boundary. Studio configuration has separate persistence and image invalidation. Rendered SVG/PNG caches sit in front of materialization, an important distinction from the receipt cache itself. Relevant boundaries: `apps/web/lib/profile/score-receipt-v7.ts:180`, `apps/web/lib/profile/score-model.ts:1`, `apps/web/components/SharePageOwnerContent.tsx:187`, `apps/web/lib/render/badge-svg-cache.ts:86`.

The scoring review traced normalization, evidence deduplication, source scope, bounds, Craft, receipts and verification. The UI review traced saved screenshots to current component inputs and agent contracts. The release review traced flags, migrations, cache return paths, workflow triggers, consent checks and contract-test isolation. Root validated git ancestry, raw logs and targeted executable probes.

## 3. Evidence validation and freshness

Primary evidence: `docs/agents/local-e2e-report.md`, `docs/plans/2026-09-07-local-e2e-verification.md`, its phase files and evidence tree, `logs/local-e2e/`, and `docs/research/2026-09-06-v7-site-cutover-handoff.md`. Read the handoff chronologically: later sections explicitly supersede earlier unclosed findings.

| Claim | Validation | Limit |
|---|---|---|
| Final unit pass: 9,319 tests / 598 files | Corroborated by `logs/local-e2e/r2-test.log` | Plain test execution does not prove coverage thresholds |
| Final browser pass: 172 passed, 10 skipped | Corroborated by `logs/local-e2e/playwright-dev-r3.log` | Dev server; skipped redesign disposable-fixture cases are not passes |
| Final application code tested | `git diff 04081dfd HEAD` contains only plan text and screenshots | Uncommitted design-sync edits appeared during this audit and are outside the reviewed candidate |
| Production build and browser checks | Real build/crawl evidence exists for earlier post-fix revisions | Final round-two application changes postdate that production-build proof |
| Lighthouse accessibility 1.00 on five pages | All five post-fix JSON summaries corroborate it | Earlier build, measured pages/state only; not comprehensive accessibility certification |
| v7 receipt arithmetic reproduced | Independently replayed archived `phase6/receipt-envelope.json` | Reproduction of recorded inputs, not empirical fairness/source-truth validation |
| Withdrawal → revoked verification → v6 return | Recorded API/SVG evidence and code agree | Withdrawal purges images first; this does not prove flag-only rollback |
| WebMCP tools executed successfully | Registration/recovery and selected mutations are evidenced | Raw simulation/preset entries include invalid inputs; save entry is a proposal; no successful v7 simulation proof |
| All gates green | **Not supported** | Three contract failures; pending-migration CLI failed and used historical manual fallback; coverage/full CI selection not proved by this report |

The earlier report has a stale second `## Verdict` saying manual work is pending (`docs/agents/local-e2e-report.md:222`), despite the completed round-two section (`:210`). Several finding rows still say “uncommitted” although the closing commit list supersedes them. Preserve it as historical evidence; use this audit's qualified conclusions rather than its stale trailing paragraph.

## 4. Frontend / UI finding

#### FE-B1 v7 profile publishes a legacy breakdown and coaching beside its receipt
- **Severity:** launch-blocker
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/components/SharePageOwnerContent.tsx:187, apps/web/components/SharePageOwnerContent.tsx:206, apps/web/app/u/[handle]/page.tsx:522
- **What's happening:** The dashboard receives legacy `impact`, Craft, trend and diff even when the explanation panel switches to v7. The archived `evidence/phase6/share-v7-owner.png`, inspected again during this audit, visibly shows badge **46–100**, no archetype, then **Builder**, dimensions **100/74/67/71/Craft 83**, and **5 points to Elite**. Its receipt panel instead gives Quality **0–100**, no tier/archetype and Craft not observed. Current code retains that path; visitor content uses the same dashboard boundary.
- **Why it matters:** A single public profile contradicts its own scoring policy and replayable evidence. This blocks a reveal advertised as v7-correct.
- **Recommendation:** Make the dashboard and coaching policy-aware from the same receipt projection; preserve clearly identified historical v6 content where appropriate. Add a v7 ranged profile regression covering the entire content tree, not only the explanation panel.
- **Regression risk:** Do not delete useful historical v6 display or convert uncertain v7 dimensions to zero/points. Craft must stay separate and ranges must not acquire a tier/archetype through legacy coaching.
- **Expected impact:** Every current-profile scoring claim agrees with the badge and receipt.
- **Effort estimate:** M

## 5. Backend / receipt findings

#### BE-H1 Partial verification failure is not repaired by an unchanged refresh
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/profile/issue-receipt.ts:32, apps/web/lib/profile/issue-receipt.ts:41, apps/web/lib/profile/issue-receipt.ts:56, apps/web/lib/profile/score-receipt-v7.ts:221, supabase/migrations/044_scoring_v7_verification.sql:30
- **What's happening:** Receipt persistence succeeds before verification persistence. If verification fails, the wrapper returns failed, but the receipt remains. The next unchanged same-day materialization returns stored; only issued results attempt verification, so retry skips the missing record. A focused mock-based fault probe reproduced **one verification call where two are needed**.
- **Why it matters:** A badge can derive a token for a persisted receipt whose verification endpoint cannot resolve it, and the ordinary retry does not heal it.
- **Recommendation:** Repair/idempotently ensure verification for an existing consented receipt, or provide an equivalent transactional recovery contract. Add a real-persistence partial-failure regression when implementing.
- **Regression risk:** Preserve the unchanged-receipt no-op and revision chain; do not mint revisions merely to repair verification, bypass withdrawal, or issue artifacts from public reads.
- **Expected impact:** A transient verification-store failure has a reliable recovery path.
- **Effort estimate:** M

#### BE-M1 No-op receipt identity omits meaningful evidence metadata
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/profile/score-receipt-v7.ts:213, apps/web/lib/profile/score-receipt-v7.ts:221, apps/web/lib/profile/score-receipt-v7.ts:242
- **What's happening:** The equality predicate compares reference date, core counts and limited Craft identity, omitting published criteria, coverage, exclusions and limitations. A focused probe changed GitLab's exclusion from not_connected to not_consented with unchanged counts; the previous receipt was reused and publication ran zero times. Similar same-count provenance/assessment changes are a supported inference, not independently reproduced here.
- **Why it matters:** The current receipt can describe stale source scope even when arithmetic remains reproducible.
- **Recommendation:** Define semantic receipt identity that includes meaningful evidence changes while ignoring incidental per-call timestamps.
- **Regression risk:** Comparing entire timestamp-bearing inputs would reintroduce the earlier new-revision-on-every-refresh defect. Historical receipts must remain immutable.
- **Expected impact:** Genuine evidence changes revise the current receipt without destroying idempotency.
- **Effort estimate:** M

## 6. Performance and scalability

The existing report explicitly carries cold badge render latency above the 4,100 ms target and approximately 34-second consent issuance. Neither was remeasured here; no new production latency claim is made. Warm route timings and Lighthouse results support the tested local happy path, not cold-provider performance or CDN behavior (`docs/agents/local-e2e-report.md:29`, `:176`, `:178`). These are known limitations, not newly duplicated findings.

## 7. Reliability / release findings

#### DO-H1 v7 rollback can continue serving v7 cached images
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/api/admin/feature-flags/route.ts:67, apps/web/lib/render/badge-svg-cache.ts:86, apps/web/app/u/[handle]/badge.svg/route.ts:473, apps/web/app/u/[handle]/og-image/route.ts:101, docs/runbooks/scoring-v7-transition.md:66
- **What's happening:** Flag updates invalidate flag caches, not SVG/OG artifacts. SVG and versioned OG cache hits return before resolving the scoring flag/model. Image keys contain layout/date/locale/config identity rather than the scoring policy. The runbook claims stale v7 cache entries are ignored after read selection returns to v6; these image paths do not implement that claim.
- **Why it matters:** A flag/read-selection rollback can show v6 API/content beside cached v7 images. The earlier test withdrew consent first, purging images, so its v6 return does not validate rollback with an active receipt.
- **Recommendation:** Define and test a bounded image rollback mechanism covering Redis and edge caches. Rehearse with an active v7 receipt, prewarmed SVG and versioned PNG, and no withdrawal.
- **Regression risk:** Keep existing issued receipt links valid; do not delete evidence to emulate rollback. Preserve locale/config revision fencing and avoid an unbounded cold-render wave.
- **Expected impact:** Rollback restores coherent public output within a stated time bound.
- **Effort estimate:** M

#### DO-M1 Release packet incorrectly treats publication approval as permission for Preview compute
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** docs/release/scoring-v7-release-packet.md:68, docs/release/scoring-v7-release-packet.md:81, docs/release/release-playbook.md:95, .github/workflows/ci.yml:4
- **What's happening:** The packet says publication authorization lifts the no-Preview restriction, while the current owner instruction categorically prohibits Preview deployments. The playbook still requires a Preview proof. A develop push also triggers hosted workflows. A historical platform Ignored Build guard is documented, but its current remote setting was not rechecked here.
- **Why it matters:** Following the old release procedure literally would violate the current compute constraint. This is a procedure mismatch, not permission to weaken release proof.
- **Recommendation:** Reconcile the final artifact/proof procedure with the no-Preview policy before any push or release; inspect the actual remote build trigger guard read-only at that time.
- **Regression risk:** Retain exact-candidate binding and production verification; local passing tests cannot be relabeled as deployed proof.
- **Expected impact:** A concrete release path consistent with both evidence and compute requirements.
- **Effort estimate:** S

## 8. Security / privacy

The bounded review found current ownership checks before evidence writes, private no-store/error redaction, consent checks in publication SQL and revoked/content-free verification behavior. No auth bypass was established. References: `apps/web/app/api/evidence/route.ts:62`, `apps/web/app/api/evidence/route.ts:121`, `supabase/migrations/043_scoring_v7_receipt_history.sql:80`, `supabase/migrations/044_scoring_v7_verification.sql:19`.

Two browser-role denial assertions did not execute in the historical contract run because their disposable-project guards failed. This limits assurance; it is not evidence of exposed RPC privileges. The source migration revokes browser execution (`supabase/migrations/045_scoring_v7_source_context.sql:276`; the exact assertion queries are in the contract tests cited below). No live credentials were printed or remote services queried in this audit.

## 9. Architecture / review quality

The central model/calculator/receipt boundaries are useful and well tested. Their existence does not prove every consumer uses them: FE-B1 and AS-H1 show legacy values crossing a current-v7 display boundary. Consumer inventory membership and tests of individual panels need to be read alongside actual call-site inputs. This is the same integration shape described in the earlier handoff's module-without-caller observation (`docs/research/2026-09-06-v7-site-cutover-handoff.md:495`).

An additional **unreproduced concurrency concern**, not promoted to a confirmed finding: `apps/web/lib/profile/badge-verification.ts:25` rereads the latest receipt to derive verification after materialization has already selected a scoring model. A concurrent correction could pair an earlier displayed model with a newer token. A follow-up should pin the two identities in one focused test before deciding the fix; stable sequential happy-path tests do not establish concurrency safety.

## 10. QA findings and checks performed

#### QA-M1 Existing E2E completion does not establish complete release gates
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/db/platform-token-refresh.contract.test.ts:56, apps/web/lib/db/platform-token-refresh.contract.test.ts:120, apps/web/lib/db/source-context.contract.test.ts:27, supabase/config.toml:5, .github/workflows/ci.yml:157, docs/agents/local-e2e-report.md:212
- **What's happening:** Two contract checks require project_id chapa-scoring-v7 while the standard repo config is chapa. A third assertion expects a post-withdraw refresh claim error under semantics changed by migration 048. Historical logs show 160/163, not a green contract gate. Final round-two browser proof uses next dev; build proof predates those fixes. Plain unit logs do not prove CI coverage thresholds or operational script coverage.
- **Why it matters:** Pre-existing failures still leave mandatory gates unresolved; “E2E completed” must not be promoted to “all release checks passed.”
- **Recommendation:** Repair the disposable harness/expectation with its isolation invariant intact, then run the complete local release selection once on the completed candidate after remediation. Reuse prior browser evidence except where changed seams or final-artifact verification require focused follow-up.
- **Regression risk:** Never weaken the localhost/disposable guard to run destructive fixtures against production; do not suppress withdrawal-contract assertions merely for green output.
- **Expected impact:** Release approval can rely on an exact candidate with genuine gate results.
- **Effort estimate:** M

Fresh execution logs: `logs/astra-prelaunch-2026-09-08/`.

| Check | Result |
|---|---|
| v7 math/evidence/fairness, receipt, view model, leaderboard, public profile, model and issuance: 9 files | 179 passed |
| Studio/tool contracts: 4 files | 171 passed |
| Share content and badge verification: 2 files | 23 passed |
| Archived independent receipt replay | arithmetic_reproduced, receipt 11aa6ce5-f977-449e-aebd-4207685aa7f5 |
| Two new adversarial assertions on copied mocked suites | Both reproduced defects; 25 inherited tests passed, two new expectations failed |

The copied probe files were removed from the application tree after execution; exact copies are preserved as `.probe.txt` beside the logs. Existing source/test files were not edited. Full E2E, full unit/coverage, build, external vulnerability scans and contract suite were intentionally not repeated for this audit.

## 11. UX finding

#### UX-M1 Studio denies the public effect its Save action actually has
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/i18n/dictionaries/en.ts:1233, apps/web/lib/i18n/dictionaries/es.ts:1222, apps/web/app/studio/StudioClient.tsx:831, apps/web/app/api/studio/config/route.ts:150
- **What's happening:** The subtitle says changes never affect the public badge or share page, in both locales. Actual Save persists configuration and refreshes those surfaces. The saved v7 Studio screenshot visibly contains the contradictory promise.
- **Why it matters:** Owners receive incorrect information about a consequential visible action.
- **Recommendation:** Distinguish unsaved preview from published saved configuration; keep demo wording accurate.
- **Regression risk:** Copy must reflect actual persistence and partial cache-refresh outcomes, without implying demo mode publishes.
- **Expected impact:** Owners understand what Save changes.
- **Effort estimate:** S

## 11a. Agent-facing finding

#### AS-H1 Current-profile tools lose v7 semantics despite corrected headlines
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/studio/StudioClient.tsx:558, apps/web/app/studio/StudioClient.tsx:764, apps/web/app/studio/useStudioWebMcpTools.ts:276, apps/web/lib/impact/simulate.ts:33, apps/web/lib/webmcp/server-tools.ts:428, apps/web/app/u/[handle]/SharePageWebMcpTools.tsx:191, apps/web/app/u/[handle]/SharePageWebMcpTools.tsx:257
- **What's happening:** Studio preview receives scoring, but tools receive legacy impact. Simulation applies legacy dimension membership, Craft, confidence and recency without identifying its legacy baseline. Comparison corrects headline values but still supplies legacy dimensions/deltas; the remote result drops the interval/policy carrier. Browser verification expects legacy body.data, dropping v7 attestation detail and treating revoked 410 as generic unavailability. The report's intentional v6-only explanation scope is not an adequate label for every current-profile tool result.
- **Why it matters:** Agents can recommend changes and describe numbers that do not belong to the visible receipt, or lose the distinction between missing and revoked verification.
- **Recommendation:** Preserve explicit policy/receipt identity and interval semantics end-to-end; label or scope any intentionally retained legacy simulator. Test successful v7 tool invocations, mixed-version comparisons, and current/revoked verification.
- **Regression risk:** Do not fabricate point comparisons from ranges or silently remove valid legacy tools. Agent Save must remain a proposal followed by the existing on-page confirmation.
- **Expected impact:** Agent-visible claims match human-visible scoring and verification.
- **Effort estimate:** M

## 12. Prioritized action plan

| ID | Domain | Title | Severity | Time horizon | Effort | Impact |
|---|---|---|---|---|---|---|
| FE-B1 | Frontend | Mixed v6/v7 profile | launch-blocker | Before launch | M | Public scoring truth |
| BE-H1 | Backend | Verification repair | high | Before launch | M | Resolvable receipts |
| DO-H1 | Operations | Image rollback | high | Before launch | M | Coherent rollback |
| AS-H1 | Agent tools | v7 semantics | high | Before launch | M | Correct tool guidance |
| UX-M1 | UX | Save consequence copy | medium | Before launch | S | Owner understanding |
| DO-M1 | Release | No-Preview procedure | medium | Before launch | S | Authorized release path |
| BE-M1 | Backend | Semantic receipt identity | medium | Before launch | M | Current evidence attribution |
| QA-M1 | QA | Remaining exact-candidate gates | medium | Before launch | M | Trustworthy final evidence |

## 13. Highest-value follow-ups

1. FE-B1: the problem is already visible in saved evidence and directly contradicts the reveal's central claim.
2. BE-H1: deterministic failure probe, narrow recovery boundary.
3. DO-H1: rollback needs to work before v7 is enabled.
4. AS-H1: complete the policy boundary rather than another headline-only correction.
5. UX-M1: small, user-visible accuracy correction.
6. BE-M1: preserve accurate evidence identity without breaking the no-op fix.
7. QA-M1 and DO-M1: close verification/procedure gaps on the final candidate, once.

## 14. Before launch / after launch / later

Before launch: FE-B1, BE-H1, DO-H1, AS-H1, UX-M1, DO-M1, BE-M1, QA-M1.

No new findings were invented for later waves. Previously accepted latency, soft-404, preview-hash and residue-cleanup items remain in the original report for their existing disposition. No issues were filed during the freeze.

## 15. Assumptions, limits and manual acceptance card

The S18 human pilot is unperformed. The handoff records an explicit owner decision to proceed without it (`docs/research/2026-09-06-v7-site-cutover-handoff.md:57`); this audit does not reintroduce it as an authorization blocker. Mathematical replay is not empirical evidence of fairness, usefulness across work roles or informativeness of range widths. Release documents still disagree about the pilot's status as a gate and should preserve that decision accurately.

The Sept 7 plan explicitly used production-backed localhost by a historical owner decision, so it was not a fully isolated run. This audit did not repeat that access. Before manual v7 mutations, use an established disposable local environment; do not infer safety from the word localhost. Migration 049 seeds a false DB flag, which takes precedence over an env fallback. Historical production schema/flag counts were not revalidated today.

Freeze remains through the documented September 21 judging boundary; expiration alone is not release authorization. No preview deployments at any point under current instructions.

**Manual testing now — narrow acceptance, not a repeated matrix:**

1. **Scoring coherence:** On a consented ranged v7 fixture, compare badge, breakdown, coaching, receipt, API and Studio on one revision. Expect no invented tier/archetype and no current v6 Craft axis. FE-B1 is currently expected to fail; do not treat rediscovering it as new evidence of readiness.
2. **Owner journey and save:** Generate once, confirm one badge/breakdown and usable refresh; change one palette in Studio, save, check public SVG/share/versioned OG, then restore captured configuration. Fit/50%/100% must not change saved config. Confirm a visitor has no private owner confidence payload.
3. **Small-screen review:** Check Spanish at 320 px and the normal phone width, both themes: navbar controls, dock/footer clearance, save/reset access, readable range and tooltips. Prior broad screenshot/Lighthouse work need not be repeated.
4. **Agent journey:** Use valid simulation/preset inputs, inspect v7 and mixed-policy comparison output, and follow a save proposal through the actual confirmation. Check current and revoked receipt responses retain their meaning. AS-H1 is currently expected to fail.
5. **Rollback after correction:** With active consent and prewarmed v7 SVG/PNG, turn rendering off on the disposable fixture without withdrawal. Compare public artifacts against API/Studio; then restore the fixture. Withdrawal must be a separate destructive-local test, not a substitute for rollback.

Verification failure/retry and same-count evidence changes belong to targeted automated regressions, not repeated manual clicks. Final production build, full required local CI selection/coverage and exact-candidate release proof remain future release work after the identified changes.

## 16. Final verdict

**NOT READY for v7 reveal; ready for focused manual acceptance and bounded remediation.** Confidence comes from real retained E2E artifacts, fresh arithmetic replay, passing targeted tests and reproducible failure hypotheses. The main concern is not the logarithmic formula; it is different consumers describing different scoring realities for the same profile.

Next actions: resolve FE-B1; repair receipt verification and semantic identity; establish image rollback; finish policy-aware tools and accurate Studio copy; run the final applicable local gates once and perform the short manual acceptance above. No application fixes were made during this audit.
