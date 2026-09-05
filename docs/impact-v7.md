# Impact v7 — scoring policy and evidence contract

Status: approved for implementation on 2026-09-05; implementation and empirical validation remain in progress. The user explicitly approved four fixed core dimensions, optional separate Craft, and no penalty for AI usage, report disclosure or tool choice. Missing coverage uses the recommended explicit range policy; no midpoint is invented.

## Promise and limits

Chapa reports an **observed engineering activity and practices index**, four dimensions, a separate optional Craft practice portfolio, and attributable outcome evidence. It does not certify ability, causal business impact, scalable architecture, reliability or security from activity or AI logs alone. Evidence of those outcomes is recorded and attributed explicitly. No audit issue is deferred; the evidence ledger, rubric, calibration/validation work, replay and claim correction all ship before relaunch.

Each constant below is a published product choice. No percentile interpretation, statistically calibrated confidence percentage, or externally validated mastery threshold is claimed. Passing a pilot tests this rubric's feasibility and exposes problems; it does not prove universal fairness.

## One evidence and clock contract

Capture referenceTime once at the orchestrator boundary. The window contains the reference UTC date and preceding364 UTC dates: startInclusive=midnight(referenceDate−364), endExclusive=midnight(referenceDate+1). Only events with startInclusive <= occurredAt <= referenceTime qualify; future same-day events are rejected. These are365 calendar dates including a partial current day, not a trailing8760-hour interval. All API/receipt/snapshot/HMAC/trend keys receive this same context.

Normalized events carry stable provider, host, subjectId, repositoryId, actorId, eventId, kind, occurredAt, source data-through time, field-level measurements and coverage. Coverage distinguishes complete, partial, unavailable, stale, legacy; observations distinguish observed zero from absent. Credentials/principal access context stay private and are never treated as universally ordered scopes.

Actor identity is established per connected source. Repository aliases/mirrors require explicit canonical mapping; different hosts are distinct until a mapping is verified. Duplicate artifact references and overlapping uploads are deduplicated before scoring. Unknown alias relationships cannot be claimed as resolved duplicates or independent work; expose that limitation.

Each receipt names its scoring scope: connected/consented sources, accessible repositories, contribution discovery strategy and registered evidence ledger. Complete means complete for that declared scope and reference window, never all work a person has done. Unlinked/unobserved sources outside the declared scope are disclosed exclusions; linked inaccessible or unenumerated sources remain incomplete. Do not silently drop a connected source to obtain a point score.

An evidence claim has category, artifact/revision, claim, baseline and observed result where applicable, contributor role, observation period, evidence references, evaluator identity/version/rationale, rubricVersion, provenance, limitations, immutable revision and supersedes/retraction linkage. Source-observed facts, self-reports and independent assessments are separate. An automated extraction may propose a claim; semantic rubric acceptance must record an accountable evaluator and rationale. A claimant cannot self-label a claim independently corroborated. Automated assessments are labeled as such; their verdicts are not source facts or independent human review.

## Exact proposed core

Let N(x,c)=ln(1+min(x,c))/ln(1+c), for bounded finite nonnegative counts. Compute in full precision, keep four fixed weights of0.25, and round only displayed points. Receipt numeric serialization uses the frozen canonical JSON policy; cross-runtime floating comparisons allow1e−10 internal absolute tolerance and require identical displayed integers.

### Delivery: observed accepted-work cadence

Delivery units are distinct(canonicalProjectId, UTCdate) with at least one attributable accepted change: an authored merged change, a directly authored commit reaching the tracked default branch, attributable completed issue work with a linked accepted result, or an accepted documentation/design/maintenance artifact.

D=100*N(numberOfDeliveryUnits,120).

For accepted changes, occurredAt is the acceptance event time. A direct commit requires a reliable first-reachability/default-branch push or equivalent accepted-result event; author/committer timestamps cannot silently substitute. When that timestamp is unavailable, mark acceptance-time coverage unknown and retain authored-commit activity as a separate dated diagnostic. Link-equivalent PR/commit/closure/artifact references are deduplicated to one accepted work item and one acceptance event before bucketing, including links discovered on different dates. Closing an issue without a linked accepted result does not create a delivery unit. Generated changes receive the same eligibility as manual changes. Changed lines/files, PR count within the same project/day, tool usage and merge latency have zero effect on D.

This deliberately bounds same-project/same-day splitting; it does not claim immunity to distributing work across dates or projects. The adversarial validation report must measure that remaining incentive and retain the cadence label.

### Quality practices: evidence of performed practices

Four criteria have equal weight. A distinct work item can qualify once per criterion; duplicate comments, approval clicks, reruns and reuploads add no credit.

Q=25*(N(rationaleCount,12)+N(verificationCount,12)+N(reviewOrCorrectionCount,12)+N(outcomeFollowupCount,12)).

- Rationale: specific problem, acceptance condition and reason the approach fits. Nonempty boilerplate is insufficient.
- Verification: relevant test/check/measurement and result tied to the delivered revision. CI success without a relevant check/rationale is insufficient.
- Review or correction: attributable feedback identifies a concrete concern and evidence demonstrates its resolution. A solo author's documented debugging/correction qualifies by the same rubric; an approval click does not.
- Outcome follow-up: relevant observed post-change result with an observation period and method, such as a reproduced defect resolved, an accessibility/performance change measured, or stakeholder acceptance against the stated condition. No observed incidents alone is insufficient.

These count demonstrated practices, not software correctness rates. Each accepted classification is replayable from its recorded rubric verdict. Provider facts and accountable assessments support eligibility; raw self-assertions remain self-reported/unassessed until rubric assessment. Independently corroborated is a stronger evidence designation and must not be inferred from OAuth or first-party automated assessment.

Absence of inspectable evidence is unknown. A inspected item that does not demonstrate a criterion supplies no qualifying observation, with rationale retained. Retracting an erroneous accepted claim may change a score; such a correction must be explained and versioned. AI provenance never changes the rubric.

### Consistency: observed annual cadence

C=100*N(numberOfActiveUtcIsoWeeks,40).

An active ISO week intersects the window and has at least one attributable contribution: delivery, substantive reviewing, documentation/design, maintenance/issue work, or qualifying practice evidence. Each week counts once. No weekend, burst or response-speed penalty. Forty observed active weeks saturate this dimension.

Zero-fill the same365 UTC dates before calendar display. ISO weeks are defined in UTC, including ISO week-year. The window remains annual, with no tenure normalization. Identical evidence with only account-createdAt changed scores identically. Short observation history is disclosed; C is not labeled sustainable behavior or ability.

### Breadth: diversity of observed work

Eligible projects have attributable work on at least3 distinct dates. Eligible categories also require at least3 distinct dates each. The four categories are implementation, verification/review, documentation/design, maintenance/support. Each category needs artifact support; titles or inferred skills alone do not qualify. An item may support multiple categories only with distinct category evidence.

B=50*N(numberOfEligibleProjects,4)+50*N(numberOfEligibleCategories,4).

Both terms can reach their full maximum; no reserved5% or uncollected15% remains. The documentation classifier must inspect a nonempty complete changed-file list against versioned documentation rules (README/CHANGELOG/LICENSE/CONTRIBUTING/CODE_OF_CONDUCT/SECURITY files, docs directories, and documentation extensions .md/.mdx/.rst/.adoc/.txt; a mixed code/document list is not docs-only). Partial file lists are unknown. Manually assessed non-code documentation/design artifacts can also qualify. Build-generated documentation is categorized by the attributable accepted artifact, not bulk file volume.

Stars/forks/watchers, inverse repository concentration, changed-line magnitude and nominal language counts have zero score weight. Correct concentration and popularity may remain labeled diagnostics/context; they do not masquerade as personal annual influence.

### Fixed composite, ranges and labels

For complete observed evidence, core=(D+Q+C+B)/4. No optional Craft, solo switch, confidence deduction or recency multiplier enters the formula.

For incomplete coverage, each monotone count has a lower bound from known qualifying observations and an upper bound from possible completions allowed by recorded coverage. Enumerated unknown items add at most their count; unknown discovery may saturate the affected component's cap. Derive bounds per component: Delivery upper counts distinct possible project/date buckets (bounded by eligible unknown accepted work items when enumerated), Consistency upper adds only presently inactive ISO weeks intersecting unknown temporal coverage, Quality upper adds each distinct eligible unassessed work item at most once per criterion, and Breadth upper counts a project/category only if observed plus possible distinct dates can meet the3-date threshold. When repository/date/eligibility discovery is unknown, use the affected component's full ceiling as a conservative upper bound. Do not add raw item counts directly to week/project/category totals. Compute conservative outer bounds through the same monotone formula; conservative maxima need not be jointly attainable, but must contain every admissible completion. Use floor(lower) and ceil(upper) for displayed ranges, retaining exact bounds in the receipt; do not collapse a nonzero exact interval merely because endpoints round alike. A point is displayed only when exact evidence bounds coincide.

The range is an **evidence-completion range**, not a statistical confidence interval. It does not imply the developer's true ability lies there. Unobserved private work stays unknown; current source visibility cannot prove total absence of work.

Point tiers use the unrounded core and retain familiar thresholds30/70/85 as declared product choices: a core69.9 rounds to display70 but remains Solid, and the UI explains tier boundaries against the unrounded value. To avoid that surprising display, show one decimal alongside a tier whenever integer rounding crosses a boundary. Explicit fixtures cover29.999/30,69.999/70,84.999/85; the decimal presentation must expose enough digits to distinguish the boundary or show '<70' rather than round across it. A range gets a tier only if its entire conservative interval lies inside one tier; otherwise no tier. Four-dimension core archetypes use unrounded dimensions/core and retain the current descriptive threshold decision tree and deterministic tie order Breadth, Quality practices, Consistency, Delivery, but remove solo exclusions. For any non-point dimension, no definitive core archetype is assigned; display insufficient evidence rather than guessing. This conservative rule avoids non-monotone archetype errors at interval corners.

## Separate optional Craft

K=25*(N(framingEpisodes,8)+N(verificationDebuggingEpisodes,8)+N(toolJudgmentEpisodes,8)+N(acceptedOutcomeEpisodes,8)).

A deduplicated work-item episode is assessed for:
1. problem/constraints/acceptance framing;
2. tested debugging hypothesis or relevant verification result;
3. reason to use, constrain, avoid or delegate to a tool, including review of output;
4. accepted artifact against the stated acceptance condition.

Choosing no AI/no delegation can demonstrate good judgment equally. Tool name, tokens, lines, files, messages, entropy, agent count, parallel usage and reply speed receive zero automatic practice credit. Claude Code insights remain a supported optional descriptive import; model-estimated outcomes/satisfaction are identified as estimates and do not alone prove rubric criteria.

No eligible portfolio => not_observed, not zero. Missing criteria produce explicit ranges using the same completion logic. Usage diagnostics show known classifications, unknown labels, unclassified session counts and report periods; no silent failure-category exclusion. Likely-satisfied remains a distinct model-estimated label, not a proven satisfied outcome.

An optional Artificer portfolio descriptor requires a complete Craft point of at least60 and at least one independently corroborated episode satisfying all four criteria, including accepted outcome. It does not replace the core archetype. Retire automatic Novice/Expert/Master mastery labels from current v7 output; legacy receipts retain their historical labels. Zero outcome evidence cannot earn Artificer.

Union/deduplicate eligible evidence across uploads; latest upload cannot overwrite better or differently timed evidence. Fully old reports remain historical; a straddling aggregate without dated observations stays partial and cannot be prorated. Upload time cannot rejuvenate report period. Report absence/upload/expiry changes Craft alone, never core. Shared core evidence must be submitted/observed via the engineering-evidence path, not silently auto-added from an insights report.

## Outcome ledger and privacy

Implement outcome evidence now for delivered benefit; correctness/security; performance/accessibility; reliability/cost; design/documentation; mentoring/review; maintenance/incident recovery. The ledger records individual action, team participation or unclear attribution explicitly. A team deployment/reliability gain cannot become an individual causal claim by assumption. Each claim has observed result, method/time horizon, relevant baseline or explanation that none exists, and limitations/counterevidence.

Public receipts contain every scoring-sufficient aggregate, coverage bound and rubric result needed for arithmetic replay. They exclude private paths, repository names, report contents, tokens and personal evaluator identifiers. Stable opaque receipt-local identifiers and public rubric versions support replay. Public criterion results expose structured status/category/count and safe reason codes only, never free-text evaluator rationale, quoted evidence or private URLs; private rationale stays in the owner/authorized-reviewer projection. Private supporting artifacts and evaluator records remain owner/authorized-reviewer only. Explain that public replay validates arithmetic over issued aggregates, not private-source truth. Low-entropy hashes are not a substitute for redaction.

Retractions create new immutable revisions. Existing issued receipts retain historical arithmetic status but can expose a redacted superseded/retracted status without leaking the private reason. Receipt storage must be durable before claiming an issued retrievable verification link. Raw imported reports and temporary fetched artifact bodies expire after30 days; extracted dated scoring evidence and private assessment records remain until owner deletion/withdrawal, with access checks. Issued public aggregate receipts are retained for historical replay until owner withdrawal of public evidence consent or deletion; then revoke public access, delete private backing records and cached copies through the existing administrative deletion path, and retain only a content-free revocation tombstone. Do not introduce an unrelated self-service account-deletion flow. Logs must never contain report/evidence contents, tokens or private URLs. Historical independent downloads cannot be recalled; describe that publication consequence before owner publication consent.

## Trend and version transition

Headline is fresh. Trend uses separately persisted unrounded state: s(t)=0.85^deltaDays*s(previous)+(1−0.85^deltaDays)*raw(t). This explicitly assumes the newly observed raw value applies across the unobserved elapsed interval (backward fill for smoothing), not that its historical value was actually measured. Label this an approximation; never populate missing raw history from it. Recompute any same-day revision from the preceding day's immutable anchor. Repeated reads/uploads do not feed back into today's state. Only exact point observations enter numeric EMA; a missing/range observation creates a gap. The next exact point uses elapsed days and the disclosed assumption. Different policy versions reset/segment trend.

Keep v6 records/version semantics, including non-replayable legacy status where inputs were never saved. Never fabricate missing historical data. Use additive schema and new cache namespaces; rehearse idempotent dry-run migration/recompute locally. Production access/migrations/recompute/release need distinct explicit authorization. No Vercel preview deployment is permitted.

## Bounded validation protocol

- Unit/property/contract fixtures cover all F01–F53 cases, provider identity/window limits, algebra permutations, numeric boundaries, full-scale reachability, AI disclosure/tool invariance, role/tenure/visibility matched pairs, duplicate/split work, unknown/zero evidence, range containment, reference replay and same-day trend behavior.
- Prespecify a retrospective convenience pilot of24 public or consenting profiles across six primary work-role groups (implementation, verification/review, documentation/design, maintenance, incident/reliability, mixed/solo), four per group. Represent every supported provider with at least4 profiles (profiles may use multiple providers). Use at least6 paired visibility-redaction cases; these are explicitly synthetic missingness interventions, not evidence about real private populations.
- Select six work items per profile by a frozen deterministic sampling rule independent of score/AI labels: four development items and two locked held-out items,144 items total. All receive two independent rubric assessments blinded to AI labels where feasible. Record reviewer type/human-or-model, identity/version, conflicts and limitations. At least one independent human domain reviewer participates in final rubric assessment/adjudication; no fabricated rater agreement. Require at least85% pre-adjudication agreement and at least80% positive-specific and negative-specific agreement per criterion on the locked held-out set as declared feasibility gates; publish confusion matrices and positive/negative counts. All-negative/all-positive or zero-denominator agreement cannot satisfy the gate. Adjudicate every disagreement; after any rubric revision, use a fresh locked held-out sample rather than reporting agreement on previously adjudicated cases as independent validation. This target is not a claim of statistical power.
- Do not contact/recruit anyone automatically. Public data can be reviewed read-only; consenting private evidence and any external outreach require the user's authorization. If a provider/role sample or human reviewer cannot be secured, pilot completion remains a relaunch blocker. Synthetic fixtures cannot substitute for empirical pilot cases.
- Usability gate: in the declared scoped evidence pilot, median core interval width must be at most25 points and at least18 of24 profiles must have width at most40. These are product feasibility choices, not statistical accuracy claims. Report point-score/tier/archetype availability. Failure requires better collection/evidence review or a reviewed product-policy revision; never hide unknown evidence or drop sources to narrow ranges.
- Freeze the selection manifest, exclusions, rubric and gates before viewing comparative scores. Publish redacted inputs/results, inter-rater agreement, sample sizes, coverage and failure resolutions.
- Sensitivity: each normalization cap±20%; each core weight±5 percentage points with remainder redistributed equally. Publish point/range/tier/archetype changes and cap saturation by role/provider. Any reversal contradicting a required invariant blocks relaunch; ordinary changes quantify sensitivity to normative choices.
- Independent calculator must reconcile every public numeric output without network, secrets or clock. Review all EN/ES/API/SEO/LLM/badge claims against actual evidence. No pilot result is generalized to population percentiles or proof of universal fairness.

This is the implementation policy. If tests/pilot invalidate the policy, revise and review the policy before completing S18; do not waive the failed requirement or defer it past relaunch.
