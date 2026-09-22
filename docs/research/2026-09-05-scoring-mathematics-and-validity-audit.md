# Chapa scoring: mathematics, measurement validity, and reproducibility audit

Date: 2026-09-05. Audited local `develop` at `c1ce31cbf5969ee400c4cf232d67cf7dc1b1de0d` (three commits ahead of its local remote-tracking ref). English and Spanish live scoring pages were also inspected read-only. Local source findings are not assertions that every affected path is deployed or that a particular production user's score is wrong.

The user requested an assessment, including recommendations, not scoring changes. No application source was changed, no live scores were recalculated, and nothing was pushed or deployed. This report and its local reproduction script are the audit artifacts.

## Assessment

Chapa has a useful foundation for an explainable developer activity profile. Its logarithmic normalization, capped contributions, separate dimensions, and explicit formulas are reasonable building blocks. However, the current system does **not** yet justify the stronger claim of an accurate, fair, reproducible measure of individual engineering impact and quality. There are confirmed input-attribution errors, aggregation errors, missing scoring signals, and explanations that do not reconcile with implementation. Separately, many soundly calculated quantities measure activity or tool-use habits rather than demonstrated quality or value.

Three different standards matter:

1. **Arithmetic correctness:** does the implementation calculate the declared quantity correctly?
2. **Measurement validity:** does that quantity actually measure the quality or impact claimed?
3. **Reproducibility:** can someone obtain the exact inputs, algorithm, and reference time to reproduce the result?

A weighted index can be innovative and mathematically legitimate without being an empirically validated measure of ability. Choosing weights is not fraudulent; describing those choices as measured percentiles, probability, or demonstrated impact without supporting evidence is the problem.

## Current formula and what is mathematically sound

For nonnegative finite x and positive cap C, normalization is `N(x,C) = ln(1+min(x,C))/ln(1+C)`. It maps zero to zero and the cap to one, is increasing below the cap, and has diminishing marginal returns. This implementation is correct (`apps/web/lib/impact/utils.ts:44`). For x below C its derivative is `1/((1+x)ln(1+C))`, and its second derivative is negative.

Delivery weights sum to 100%: 70% PR weight, 20% issues, 10% commits, then the piecewise continuous 0.95–1.05 lead-time multiplier (`apps/web/lib/impact/v6.ts:40`, `:74`). Solo Quality weights also sum to 100%; collaborative Quality takes the maximum of its own weighted formula and solo hygiene (`:108`, `:153`). Consistency weights sum to 100% (`:186`). Craft averages three rounded subdimensions (`apps/web/lib/insights/scoring.ts:157`). Equal weighting is an explicit value judgment, not a mathematical derivation of importance.

The core composite averages Delivery, Consistency, and Breadth for solo profiles, adding Quality for collaborative profiles and Craft whenever supplied (`apps/web/lib/impact/v6.ts:366`). The recency multiplier simplifies to `0.98 + 0.08*r`, where r is recent heatmap activity divided by total heatmap activity. The engine rounds/clamps this result before multiplying by `0.85 + 0.0015*confidence` and rounding/clamping again (`apps/web/lib/impact/recency.ts:48`; `apps/web/lib/impact/utils.ts:238`). Consequently, a one-step formula with only final rounding need not match implementation exactly.

Confidence's 50–100 range gives a multiplier of 0.925–1.0: its maximum relative deduction is 7.5%, not 50%. That arithmetic is correct. The percentage is a heuristic penalty index, not a statistically estimated probability or confidence interval (`apps/web/lib/impact/utils.ts:119`).

## Priority 1: confirmed correctness and evidence problems

### 1. Several inputs are different events from the events their names claim

- **Commits:** `contributionCalendar.totalContributions` is assigned to `commitsTotal` (`packages/shared/src/stats-aggregation.ts:52`). GitHub contribution events include more than commits, so PR/issue/review activity can be counted again through the nominal commit component. Linked platforms also use different event definitions.
- **Closed issues:** GitHub `issueContributions` becomes `issuesClosedCount` (`packages/shared/src/github-query.ts:53`; `packages/shared/src/stats-aggregation.ts:128`). GitHub defines this connection as issues the user opened. Opening unresolved issues therefore earns nominal closed-issue Delivery credit.
- **Personal repository contribution:** the query lists owned/collaborator repositories and reads default-branch history without an author filter (`packages/shared/src/github-query.ts:57`, `:64`). The aggregator treats those whole-repository commits as the user's depth and concentration (`packages/shared/src/stats-aggregation.ts:132`). Teammates' work can increase a person's Breadth despite no change to that person's work. Conversely, contributions to repositories where the person is neither owner nor collaborator may be omitted.
- **Ten-minute bursts:** a daily contribution count is substituted for `maxCommitsIn10Min` (`packages/shared/src/stats-aggregation.ts:156`). A day with 100 events does not establish 100 commits within ten minutes.

These are semantic calculation errors, not debates about optimal weights. GitHub's [user contribution schema](https://docs.github.com/en/graphql/reference/users#contributionscollection) and [commit-history schema](https://docs.github.com/en/graphql/reference/commits#commit) establish the relevant event and author-filter semantics.

### 2. Breadth contains an uncollected signal and unused weight

Breadth's implemented weights sum to **95%**, with 5% explicitly reserved (`apps/web/lib/impact/v6.ts:199`, `:221`). Even theoretical inputs with every term at one produce 95, rather than 100. This reservation is intentional in source, but makes the dimensions' nominal scales unequal.

More seriously, **the 15% docs-only PR ratio is never produced by the normal collectors**. It is accepted as an optional field and consumed downstream, but `buildStatsFromRaw` never sets it; its returned fields omit it (`packages/shared/src/stats-aggregation.ts:173`). A repository-wide search found no ordinary collector assigning it. Supplemental clients could explicitly supply it, so it is not universally impossible to receive a value.

Normal collected profiles consequently have an algebraic Breadth ceiling of **80 before accounting for nonzero repository concentration**. Rounding can reach 80 near that bound. For twelve equally weighted repositories with maximum stars/forks, the score is 78. This affects composite comparisons and the chance of obtaining Polymath. Documentation work currently lacks the advertised direct credit.

### 3. Merged medians are not medians

`mergeStats` averages per-source median lead times using PR counts (`apps/web/lib/github/merge.ts:89`). A mean of medians cannot generally recover the pooled median.

Reproduction: account A has lead times `[1,1,1]` hours; B has `[2,100,100]`. The code returns **50.5 hours**. The six observations have median **1.5 hours**. That difference changes the Delivery modifier from the fast-flow bonus to slightly below neutral. Preserve observations or an explicitly approximate mergeable distribution; do not label a weighted mean of medians an exact median.

### 4. Merging missing quality measurements changes measured rates

Quality ratios are weighted by full merged-PR counts even though their source denominators are sampled development PRs (`apps/web/lib/github/merge.ts:85`; `packages/shared/src/stats-aggregation.ts:80`). Additionally, a platform with an undefined ratio preserves the preceding ratio while increasing its apparent sample count for subsequent merges.

Reproduction: source A has 3 measured PRs, rate 1; source B has 3, rate 0. Correct pooled observed rate: **0.5**. Insert 30 PRs with no measurement before B and the result becomes **0.9167**. Insert them after B and it remains **0.5**. This is an actual dependence on merge grouping and missing observations. Carry per-signal numerator and denominator, not only a ratio and the total profile PR count.

`microCommitRatio` and `docsOnlyPrRatio` instead use the maximum source ratio (`apps/web/lib/github/merge.ts:84`, `:93`). That is an extremum policy, not the pooled fraction of PRs; it should not be described as one.

### 5. “Last 365 days” is not one consistent event window

GitHub merged-PR search filters by **creation date**, not merge date (`apps/web/lib/github/queries.ts:40`). A PR opened 366 days ago and merged today is missed. The 100-node contribution sample also tracks created PR contributions rather than a complete window of merged events.

The linked-platform PR/review/issue collectors lack corresponding date filters: GitLab (`apps/web/lib/gitlab/queries.ts:298`, `:336`, `:392`), Bitbucket (`apps/web/lib/bitbucket/queries.ts:287`, `:309`, `:357`), and Codeberg (`apps/web/lib/codeberg/queries.ts:272`, `:276`, `:318`). Returned older events can continue to count even when heatmaps are window-filtered. Bitbucket also retrieves repository issues without attribution to the scoring user (`apps/web/lib/bitbucket/queries.ts:115`, `:351`).

Durable supplemental snapshots are reused without aging their counts out, and heatmap merging retains all dates (`apps/web/lib/github/client.ts:276`; `apps/web/lib/github/merge.ts:124`). Old Craft reports also remain eligible indefinitely: validation checks date order, the DB selects the latest upload, and scoring consumes only the resulting number (`apps/web/lib/insights/validation.ts:37`; `apps/web/lib/db/tool-insights.ts:125`; `apps/web/lib/profile/materialize-profile.ts:99`). Durable storage is useful; a stored annual aggregate cannot remain a current rolling-year total forever.

### 6. Integrity heuristics incorrectly rule out legitimate profiles

An account with zero merged PRs and any commits or issues is considered poisoned (`apps/web/lib/github/stats-integrity.ts:196`). The materialization layer consequently marks it incomplete and prevents normal persistence/verification (`apps/web/lib/profile/materialize-profile.ts:64`). Direct-push work and issue-only work are legitimate.

A last-known count of one PR dropping to zero is rejected whenever other activity remains, even at unchanged token scope (`apps/web/lib/github/stats-integrity.ts:83`). A final PR naturally leaving the year can therefore be mistaken for corruption. Another guard rejects a full 100-PR sample containing only open PRs when one merged PR exists outside the sample (`:158`). The sample is of all PR states, so this is possible without lost data.

These guards have valuable protective intent, but their asserted impossibility assumptions are not mathematical proofs of corruption. Distinguish missing/inaccessible observations from a valid zero.

### 7. Craft gives missing data credit and accepts arithmetic overflow

Missing response-time information defaults to zero in the parser, then zero receives maximum response-time credit (`apps/web/lib/insights/parser.ts:181`; `apps/web/lib/insights/scoring.ts:27`). This awards 10 Proficiency points, about 3.33 Craft points before nested rounding, for absent evidence. A measured 300-second response instead scores approximately 0.289 on that component.

Several numeric validators omit finite-number and magnitude checks (`apps/web/lib/insights/validation.ts:54`, `:176`). The local probe confirms that a JSON number `1e309` becomes Infinity, passes validation, and produces **NaN Craft**. Two finite tool counts of `1e308` also overflow their sum and produce NaN. Finite inputs alone are insufficient without safe ranges and stable arithmetic. The 0–100 guarantee fails for accepted uploads.

### 8. Rounded EMA can stop short forever

The trend recurrence stores a rounded integer after each step (`apps/web/lib/impact/smoothing.ts:38`). With a constant raw score 70 and prior 60, the sequence is `62,63,64,65,66,67,67,...`. Once at 67, `round(0.15*70 + 0.85*67) = 67` forever. This is not ordinary exponential convergence. Keep the internal state unrounded if convergence is intended.

This affects **persisted trends**, not the current headline, which uses fresh impact (`apps/web/lib/profile/materialize-profile.ts:95`, `:137`). Even ideal unrounded EMA with alpha 0.15 retains 52.2% of its initial gap after four observations; approximately 4.27 observations is its half-life, not time to reach the new level. Missing days further mean a per-observation EMA is not automatically a daily-time EMA.

### 9. Website arithmetic and explanations fail direct reproduction

Read-only checks of [English scoring](https://chapa.thecreativetoken.com/en/about/scoring) and [Spanish scoring](https://chapa.thecreativetoken.com/es/about/scoring) confirmed the local copy mismatches.

| Example | Published approximation | Correct normalization |
|---|---:|---:|
| 150 commits, cap 300 | 81% | 87.91% |
| 25 PR weight, cap 60 | 83% | 79.26% |
| 10 issues, cap 40 | 70% | 64.57% |
| 10 stars, cap 150 | 49% | 47.79% |

References: `apps/web/lib/i18n/dictionaries/en.ts:853`; `apps/web/lib/i18n/dictionaries/es.ts:842`.

Other material mismatches:

- The collaborative Quality panel omits the maximum with solo hygiene (`apps/web/lib/dashboard/dimension-sub-metrics.ts:122`). With 100 PRs, 15 reviews, and all hygiene ratios at one, actual Quality is **100**, while the displayed collaborative formula rounds to **54**.
- Copy says lines of code are never used for dimension scoring (`apps/web/lib/i18n/dictionaries/en.ts:987`), but they affect PR weight, batch-size Quality, and Craft (`packages/shared/src/scoring.ts:11`; `packages/shared/src/stats-aggregation.ts:108`; `apps/web/lib/insights/scoring.ts:127`).
- Copy describes a smoothed headline and convergence in approximately four days (`apps/web/lib/i18n/dictionaries/en.ts:977`); neither matches current behavior.
- Solo Quality Champion eligibility is described positively in copy (`apps/web/lib/i18n/dictionaries/en.ts:936`) but explicitly excluded by code (`apps/web/lib/impact/v6.ts:331`).

## Priority 2: methodology, fairness, and missing evidence

### The solo boundary and optional Craft change the meaning of the total

The 0.15 review-to-PR boundary is an **already accepted design choice**, not a newly discovered implementation divergence (`docs/accepted-risks.md:247`). However, this audit specifically re-examines fairness, and the size of the discontinuity deserves explicit owner review.

Executed example with twenty PRs: Delivery 93, Consistency 96, Breadth 78, and no hygiene credit. Two reviews give a solo composite of **89**. A third review switches the profile to collaborative, adds Quality 20 to the average, and reduces the composite to **72**. Quality itself improves; the total falls 17 points. The existing max guard protects Quality, not the denominator of the composite. These are composite values before recency/confidence, not measured production-user changes.

Adding Craft has the same denominator issue. In that solo example, voluntarily disclosing Craft 40 changes 89 to **77**. Generally, for n existing dimensions with mean B, adding K changes the unrounded mean by `(K-B)/(n+1)`. Uploading below-average Craft is disadvantageous. Optional evidence consequently creates selection bias and incomparable four/five-axis or three/four-component totals.

Recommendation: maintain one clearly defined core index and show optional Craft as a separate evidence profile unless comparability across evidence sets has been explicitly solved. Revisit the solo boundary through examples of improved reviewing and shipping, rather than only moving the threshold.

### Quality currently measures process proxies, with little outcome evidence

PR descriptions, branch names, issue links, review quantity, and change size can be useful signals of workflow discipline. They do not establish defect avoidance, security, maintainability, useful review feedback, or correctness. A nonempty generated description earns the same description credit as a careful one (`packages/shared/src/stats-aggregation.ts:90`). Batch size gives zero credit below 20 changed lines, so a tiny high-value fix does not receive that component (`:108`).

The profile collects no direct delivered-benefit metric and does not connect a person's PRs to deployment outcomes, escaped regressions, reversions, user adoption, or maintained reliability (`apps/web/lib/impact/v6.ts:74`, `:108`). Stars/forks are lifetime owner-repository popularity totals, not within-window individual marginal impact (`packages/shared/src/stats-aggregation.ts:159`). They can be contextual evidence but are not interchangeable with delivered value.

Potential evidence worth exploring: shipped outcomes with attributable links; durability of a change and subsequent corrective work; tests that catch relevant failures rather than coverage percentage alone; substantive review and mentoring contributions; maintenance, incident recovery, documentation, and design decisions; and user-facing performance, accessibility, cost, or reliability improvements. These should carry context and attribution, since many are team outcomes and many valuable individual contributions are not visible in a git host.

### Craft rewards a particular style of using AI

Lines/session contribute 8.33% of Craft, files/session 6.67%, Agent calls/message 8.33%, parallel-message share appears twice for a combined 7.5%, and overlap-event count adds 5% (`apps/web/lib/insights/scoring.ts:46`, `:119`, `:157`). Fast human responses and messages/day also earn credit. These are not direct evidence that the produced software is useful, correct, simpler, or efficient to operate.

The system can award Craft **67 with Effectiveness zero** if Proficiency and Sophistication are 100. This can qualify for Artificer if it is the strongest eligible dimension (`apps/web/lib/impact/v6.ts:335`). Claims of maintained output quality or refusing raw-output rewards are therefore stronger than the algorithm (`apps/web/lib/i18n/dictionaries/en.ts:605`, `:613`).

Normalized Shannon entropy is correctly calculated, but measures evenness among observed categories. Two equally used tools and ten equally used tools both score one. Adding a rare third tool to counts `{A:50,B:50}` changes entropy from 1 to **0.6752** (`apps/web/lib/insights/scoring.ts:12`). This is not an error in Shannon's formula; it is a mismatch between evenness and a claim of broader mastery.

For an AI-era Craft profile, stronger candidate evidence would concern problem framing, verification, debugging, judgment about when to delegate, and accepted outcomes. More agents, tokens, files, or lines should not be treated as demonstrated mastery without validation against those outcomes. Efficiently avoiding unnecessary code should be compatible with a strong score.

### Confidence and availability should be distinguished from ability

The confidence index penalizes work patterns such as concentration and low volume, already represented elsewhere in the score (`apps/web/lib/impact/utils.ts:125`). It does not estimate uncertainty from sampled PRs, missing observations, report authenticity, or sample size. An uploaded report is client-supplied JSON; OAuth establishes the uploader's identity, not its truth (`apps/web/app/api/insights/route.ts:58`, `:64`, `:83`). A single favorable classified outcome can achieve the same rate as a thousand, with no uncertainty adjustment (`apps/web/lib/insights/scoring.ts:93`).

A server token with `repo` scope cannot access arbitrary users' private repositories. GitHub's [personal-token documentation](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) ties token access to the owner's permissions. Classifying every server-token fetch as a superior complete source (`apps/web/lib/github/client.ts:260`) does not prove completeness for every user. Narrow OAuth scopes are an accepted decision; the blanket private-inclusive completeness claim is not justified by those scopes.

Show evidence coverage, source, sample sizes, age, and uncertainty explicitly. Unknown quality is not poor quality, and absence of visible work is not proof of no work. The fixed 365-day tenure treatment is separately documented as intentional (`docs/accepted-risks.md:319`); this audit does not relabel it as a bug. It does mean the score measures observed annual activity rather than tenure-normalized capability.

### Research inspiration is not validation of these weights

No representative calibration dataset, percentile computation, validation cohort, or uncertainty analysis was located supporting the P50–P75 claim (`apps/web/lib/i18n/dictionaries/en.ts:850`; `docs/impact-v5.md:15`). This is a finding about the examined evidence, not proof that no external evidence exists.

[SPACE](https://www.microsoft.com/en-us/research/publication/the-space-of-developer-productivity-theres-more-to-it-than-you-think/) supports examining multiple dimensions and cautions against equating developer productivity with activity. It does not validate Chapa's weights. [DORA's metrics](https://dora.dev/guides/dora-metrics/) concern application/team delivery performance; its change lead time runs from commit to production. PR open-to-merge time is a different, useful workflow latency, not the DORA measure itself. DORA's small-batch guidance does not establish Chapa's precise 20–500-line acceptance interval or an individual score.

Before stronger empirical claims, define the intended construct and population, compare against independently assessed outcomes, inspect error and score behavior across roles/platforms/tenure, and perform sensitivity tests on caps and weights. Version the decisions and report uncertainty. Calling the current caps design choices is defensible now.

## Reproduction and verification gaps

Current full StatsData reaches the share-page client (`apps/web/app/u/[handle]/page.tsx:478`), so present-day inputs are not entirely secret. However, the documented profile API mainly exports outputs, can combine stored dimensions with a fresh display score, and lacks a complete replay contract (`apps/web/app/api/profile/[handle]/route.ts:109`).

Permanent snapshots omit the heatmap, batch-size score, lead-time median, primary-review count, supplemental marker, and Craft source evidence needed for complete recomputation (`apps/web/lib/history/snapshot.ts:18`). Recency reads the current wall clock, and `computeImpactV6` accepts no reference-time parameter (`apps/web/lib/impact/recency.ts:23`; `apps/web/lib/impact/v6.ts:361`). The same archived input can therefore yield a different score later. The displayed result is independent of EMA history, but replaying the trend additionally requires the prior unrounded state/policy and observation dates.

HMAC signs Craft (`apps/web/lib/verification/hmac.ts:30`), yet the durable verification record omits that dimension (`apps/web/lib/db/verification.ts:45`, `:123`). Verification returns a stored record rather than independently recalculating the score or checking a supplied SVG (`apps/web/app/api/verify/[hash]/route.ts:49`). HMAC is useful evidence of an issued payload; it does not establish source truth, mathematical validity, or automatic detection of an edited SVG that still links to the original valid record.

The practical target is a small **score receipt** containing an immutable algorithm revision, reference date/time and exact window bounds, source coverage and sample counts, all normalized inputs including zero-filled heatmap dates, applicable profile/Craft state, intermediate calculations and rounding, and final outputs. Pair it with a local pure reference calculator and worked fixtures. Sensitive raw contents need not be published; aggregate reproducibility and authenticity of underlying private events are separate promises.

## Verification performed and recommended ordering

Executed the existing focused suite: **19 files, 655 tests passed**. These cover impact, shared scoring/aggregation, platform stats, GitHub merge/query/integrity, Craft parsing/scoring/validation, and score explanations. Passing tests demonstrate regression coverage of current behavior; they do not validate the meaning of the score. No application build or remote CI was required for this read-only audit.

The accompanying `docs/research/2026-09-05-scoring-audit-probes.ts` executes the actual repository functions for threshold discontinuity, Craft disclosure, normalization, Breadth bound, integer EMA, sparse heatmaps, PR splitting, median pooling, missing-data merges, entropy, response-time defaults, and numeric overflow. Run:

```sh
pnpm exec tsx --tsconfig apps/web/tsconfig.json docs/research/2026-09-05-scoring-audit-probes.ts
```

The script uses fixed calendar inputs and reports pre-recency composites so those comparisons do not depend on the day it runs. The separate output artifact records this audit's results. The sparse/zero-padded probe demonstrates a representation contract: the same events produce coverage 1.0 with omitted empty weeks versus approximately 0.5094 when zero-filled. GitHub normally supplies a dense calendar; this is not a claim that every current profile uses sparse input. PR splitting similarly demonstrates an incentive, not proof of misconduct: one 1,000-line/ten-file PR earns weight 2.8267, while ten 100-line/one-file PRs earn 18.2707 for the same totals before aggregate saturation.

Recommended order, without implementing a new formula in this audit:

1. Correct event attribution, source windows, aggregation math, missing signals, numerical validation, and legitimate-zero handling.
2. Make the public explanation exactly match computation; correct examples and retire unsupported claims.
3. Define a stable replay receipt and reference calculator before calling past scores independently reproducible.
4. Decide explicitly what the core index promises, then revisit optional Craft, profile switching, evidence confidence, and outcome measurements with scenario-based fairness tests and empirical validation.

The defensible present description is a **transparent index of observed development activity and workflow signals**. A claim of measured individual impact, engineering quality, or AI mastery requires more evidence than the current inputs supply.
