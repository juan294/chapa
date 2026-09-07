# Chapa Scoring System — Full Explainer

> This document explains the complete logic behind Chapa's Impact v7 scoring system. It is designed to serve as source material for an explanatory video about how Chapa calculates a developer's score. It describes v7 only. The previous system, v6, is documented separately in `docs/impact-v6.md`; existing v6 records keep their own meaning and are never re-explained as v7 arithmetic. The technical specification this document follows is `docs/impact-v7.md`, and the policy that governs both is `docs/plans/2026-09-05-scoring-relaunch-phases/policy.md`.

---

## The Big Picture: What Is Chapa Measuring?

Chapa reports an **observed engineering activity and practices index**. It looks at the last 365 calendar days of a developer's activity across the platforms they have connected — GitHub, GitLab, Bitbucket and Codeberg — plus optional engineering evidence and an optional AI practice portfolio, and it reports four numbers instead of one:

- **Delivery** — on how many project-days did accepted work land?
- **Quality practices** — how often did the developer demonstrate good engineering practices?
- **Consistency** — in how many weeks of the year was the developer active?
- **Breadth** — across how many projects and kinds of work did that activity spread?

Each dimension is a number from 0 to 100. The four are averaged with fixed equal weights into a **core score**, which is the headline number on the badge. On top of the core, Chapa reports a **tier** (Emerging, Solid, High or Elite), a descriptive **archetype** (Builder, Quality Champion, Marathoner, Polymath or Balanced), and — separately, beside the core and never inside it — an optional **Craft** score describing AI-assisted practice.

The word **observed** matters. Every number in Chapa is derived from evidence the system could actually see. Chapa does not estimate what it could not see, and it never lowers a score because evidence was missing.

---

## What the Number Is Not

This is the most important framing in v7, and the video should say it plainly.

Chapa's score does **not** certify a developer's ability. It does not measure business impact, and it does not prove that someone writes scalable, reliable or secure software. It is an index of observed activity and observed practices, nothing more.

Every constant in the system — every cap, every tier boundary — is a **published product choice**. Chapa does not claim that a score of 70 is "the 70th percentile," does not publish a "confidence percentage" that pretends to be statistically calibrated, and does not claim that any threshold was externally validated as mastery.

"Complete" also has a precise meaning. A profile is complete **for its declared scope**: the sources the developer connected and consented to, the repositories that were accessible, the discovery strategy used, and the evidence that was registered — over the window named in the receipt. It never means "all the work this person has ever done." Private work the system could not see stays unknown, and Chapa never treats "I could not see it" as "it did not happen."

---

## Why v7 Replaced v6

The previous system, v6, blended many signals: pull-request size, commit counts, stars and forks, review ratios, PR descriptions, burst detection, "confidence penalties," a solo-developer mode, a recency multiplier and a set of AI mastery tiers. Each piece had a reason. Together they had three problems.

1. **They measured things a developer could not inspect or replay.** A score moved because of a hidden multiplier, and nobody could sit down with the published numbers and reproduce it.
2. **They treated missing evidence as bad evidence.** A developer whose work lived in repositories Chapa could not see was scored *lower*, as though the work did not exist. A "confidence penalty" reduced a number because a pattern looked unusual, and the developer had no way to prove otherwise.
3. **They rewarded proxies.** Lines changed, files touched, tokens spent, stars earned, speed of reply — none of these is engineering quality, and all of them are easy to inflate.

v7 answers each problem directly. Every score is arithmetic over published counts, and every count is in a public receipt anyone can replay offline. Missing evidence widens a **range** instead of lowering a number. And the raw proxies — lines, files, tokens, stars, forks, watchers, tool names, message counts, session counts — carry **zero weight** anywhere in the system.

---

## One Clock

Before any counting begins, Chapa fixes one reference time. That single timestamp is captured once, at the boundary of the scoring pipeline, and every downstream artifact — the API response, the receipt, the daily snapshot, the verification record, the trend key — carries that same reference.

The window is the reference date in UTC plus the 364 UTC dates before it: **365 calendar dates**, including a partial current day. It is deliberately not a trailing 8,760-hour interval, because calendar dates are what people can check for themselves. An event qualifies only if it happened inside that window and at or before the reference time, so an event stamped later the same day is rejected rather than counted early.

---

## The Evidence Model

v7 does not score a platform's summary statistics. It scores **normalized events**. Each event records where it came from (provider and host), who it belongs to, which repository and work item it relates to, what kind of event it is, when it occurred, what was measured, and — crucially — how complete the system's view of it is.

Three ideas from the evidence model shape everything that follows.

**Coverage.** Every source and every event declares its coverage: complete, partial, unavailable, stale or legacy. The system distinguishes an *observed zero* ("we looked, and there was nothing") from *absent* ("we could not look"). Only the first is a zero. The second becomes a range.

**Attribution and identity.** Identity is established per connected source. Two hosts are two different identities until an explicit mapping says otherwise. Mirrors and forks of the same project need an explicit canonical mapping before they are treated as one project. Duplicate references to the same artifact — a PR, its merge commit, the issue it closed — are collapsed to **one accepted work item with one acceptance event** before anything is counted. When the system cannot tell whether two things are the same, it says so; it does not guess in either direction.

**Provenance.** Facts observed directly from a source are one thing. Self-reported claims are another. Assessments by an evaluator are a third. The receipt keeps these apart. A self-report never earns credit on its own, and an automated assessment is labelled as automated rather than passed off as a source fact or a human review.

---

## The Normalization Formula

Every count in v7 passes through one function before it becomes points:

**N(x, c) = ln(1 + min(x, c)) / ln(1 + c)**

It takes a count and a cap and returns a value between 0 and 1. Three properties matter for the video.

1. **Diminishing returns.** The first few units count a lot; each additional unit counts a little less.
2. **A hard ceiling.** At the cap, N is exactly 1. Beyond the cap, more volume changes nothing.
3. **Full precision.** All arithmetic runs unrounded. Only the displayed number is rounded, and the rounding is always the last step.

A few reference points, with the exact caps used below:

| Count | Delivery (cap 120) | Consistency (cap 40) |
|---|---|---|
| 10 | 50 | 65 |
| 20 | — | 82 |
| 30 | 72 | 93 |
| 60 | 86 | — |
| 90 | 94 | — |
| cap | 100 | 100 |

Halfway to the cap already earns the large majority of the points. Splitting the same work into more pieces buys very little, and past the cap it buys nothing.

---

## Dimension 1: Delivery — Observed Accepted-Work Cadence

**Formula:** D = 100 · N(deliveryUnits, 120)

A **delivery unit** is a distinct pair of (project, UTC date) on which at least one attributable piece of work was *accepted*. Accepted means one of:

- an authored change that was merged,
- a directly authored commit that reached the tracked default branch,
- completed issue work with a linked accepted result, or
- an accepted documentation, design or maintenance artifact.

The date of a unit is the **acceptance** date — when the change was merged, not when it was authored. If the system cannot trust the acceptance timestamp for a commit, it does not quietly substitute the author date; it marks acceptance-time coverage as unknown and keeps the authored activity as a separate diagnostic.

Two things make Delivery hard to game and easy to explain:

- **One project-day is one unit.** Ten PRs merged into the same project on the same day are one delivery unit. Splitting a change into smaller PRs on the same day gains nothing.
- **Size is invisible.** Changed lines, changed files, the number of PRs in a day, whether an AI tool was used, and how long the merge took all have **zero effect** on D. A one-line fix accepted on Tuesday and a thousand-line refactor accepted on Tuesday are the same unit.

Closing an issue without a linked accepted result does not create a unit. Generated changes are eligible on exactly the same terms as hand-written ones.

The cap is 120 project-days. Sixty accepted project-days in a year already scores about 86; thirty scores about 72.

Chapa is candid about the limit of this design: it bounds same-project, same-day splitting. It does not claim immunity to spreading work across many dates or many projects, and the validation work measures that remaining incentive rather than pretending it away.

---

## Dimension 2: Quality Practices — Evidence of Practices Performed

**Formula:** Q = 25 · [ N(rationale, 12) + N(verification, 12) + N(reviewOrCorrection, 12) + N(outcomeFollowup, 12) ]

Quality in v7 does not measure how correct someone's software is. It counts how many distinct pieces of work **demonstrated** each of four engineering practices. Each criterion is worth up to 25 points, and a single work item can satisfy each criterion at most once. Duplicate comments, repeated approvals, CI re-runs and re-uploads add nothing.

- **Rationale.** The work states the specific problem, the condition for calling it done, and why this approach fits. Non-empty boilerplate does not count.
- **Verification.** A relevant test, check or measurement, with its result, tied to the delivered revision. "CI was green" without a relevant check and a reason is not enough.
- **Review or correction.** Attributable feedback identified a concrete concern and the evidence shows it was resolved. A solo developer's documented debugging and correction qualifies under exactly the same rubric. An approval click, by itself, does not.
- **Outcome follow-up.** A relevant observed result after the change, with an observation period and a method: a reproduced defect confirmed fixed, a performance or accessibility change measured, a stakeholder accepting the result against the stated condition. "No incidents were reported" alone is not enough.

Twelve demonstrated items per criterion saturate it. Six already earn about 19 of the 25 points; three earn about 13.

**How a criterion is decided.** A rubric verdict is recorded per work item and per criterion. Facts observed from the platform and accountable assessments support eligibility. A raw self-assertion stays "self-reported, unassessed" until it is assessed. Every accepted verdict carries an evaluator identity, a rubric version and a rationale, and it is replayable. An automated tool may *propose* a claim, but acceptance under the rubric must record an accountable evaluator. A developer cannot label their own claim "independently corroborated."

**Unknown is not zero.** If an item was never inspected, the criterion is unknown for that item, and unknown widens the range. If an item *was* inspected and did not demonstrate the criterion, it simply supplies no qualifying observation, and the rationale is kept. Whether the code was written with AI provenance never changes the rubric.

---

## Dimension 3: Consistency — Observed Annual Cadence

**Formula:** C = 100 · N(activeIsoWeeks, 40)

An active week is an ISO week, in UTC, that intersects the window and contains at least one attributable contribution: a delivery, substantive reviewing, documentation or design work, maintenance or issue work, or qualifying practice evidence. Each week counts once, no matter how much happened in it.

There is **no weekend penalty, no burst penalty and no response-speed penalty**. Forty active weeks saturate the dimension; twenty active weeks already score about 82.

There is also **no tenure normalization**. Two developers with identical evidence score identically even if one account was created last month and the other ten years ago. A short observation history is disclosed, not scored. Consistency describes an observed cadence over one year. It is never labelled "sustainable behaviour" or "ability."

---

## Dimension 4: Breadth — Diversity of Observed Work

**Formula:** B = 50 · N(eligibleProjects, 4) + 50 · N(eligibleCategories, 4)

Breadth has two halves, each worth up to 50 points.

**Eligible projects.** A project counts only if it has attributable work on at least **three distinct dates**. A drive-by typo fix does not make a repository part of someone's breadth. Four eligible projects saturate this half; three earn about 43 of 50.

**Eligible categories.** The four categories of work are implementation, verification/review, documentation/design, and maintenance/support. A category counts only if it, too, has at least three distinct dates of artifact-supported work. A title or an inferred skill is not evidence; each category needs an artifact behind it. One item may support more than one category only when it carries distinct evidence for each.

Documentation is classified by inspecting a complete list of changed files against versioned rules — README, CHANGELOG, LICENSE, CONTRIBUTING and similar files, docs directories, and documentation extensions such as `.md`, `.mdx`, `.rst`, `.adoc` and `.txt`. A mixed code-and-docs change is not documentation-only. A partial file list is unknown, not a guess.

What has **zero weight** in Breadth: stars, forks, watchers, how concentrated activity is in one repository, how many lines were changed, and how many programming languages appear. Popularity and concentration may still be shown as labelled context on a profile. They are not personal annual influence and they never enter the score.

---

## The Core: Bringing Four Dimensions Together

**core = (D + Q + C + B) / 4**

The four weights are fixed at 0.25 each. Nothing else enters this formula. There is no optional fifth dimension inside it, no solo-developer switch, no confidence deduction, and no recency multiplier. What you see is the mean of the four published dimensions.

A worked example, using the real formulas:

| Dimension | Observed counts | Points |
|---|---|---|
| Delivery | 60 accepted project-days | 85.7 |
| Quality practices | rationale 6, verification 4, review/correction 3, outcome follow-up 1 | 54.9 |
| Consistency | 30 active weeks | 92.5 |
| Breadth | 3 eligible projects, 2 eligible categories | 77.2 |
| **Core** | (85.7 + 54.9 + 92.5 + 77.2) / 4 | **77.6 → High** |

Every one of those five numbers can be recomputed from the four counts with a calculator.

---

## Incomplete Evidence Produces a Range, Not a Lower Score

This is the single biggest change from v6, and it deserves its own segment in the video.

When coverage is incomplete — a linked source that could not be enumerated, a stale sync, a paginated fetch that stopped early, an item nobody has assessed yet — v7 does not lower the score and it does not invent a midpoint. Each count gets a **lower bound** from what was actually observed and an **upper bound** from the completions the recorded coverage still allows. Both bounds pass through the same formula, and the result is an interval.

The bounds are derived per component, conservatively:

- Delivery's upper bound counts the distinct project-dates that unknown accepted work could still fill.
- Consistency's upper bound adds only the currently inactive weeks that overlap the unknown period.
- Quality's upper bound adds each unassessed work item at most once per criterion.
- Breadth's upper bound counts a project or category only if observed plus possible dates could still reach the three-date threshold.
- When discovery itself is unknown — the system does not even know which repositories exist — the affected component's upper bound is its full cap.

Raw item counts are never added directly to week, project or category totals. The interval must contain every admissible completion, even if its two ends could not both be true at once.

Displayed ranges use the floor of the lower bound and the ceiling of the upper bound, with the exact bounds preserved in the receipt. A **point** is displayed only when the exact bounds coincide.

Say this precisely on screen: the range is an **evidence-completion range**. It is not a statistical confidence interval, and it does not imply that a developer's "true ability" lies inside it. It means: "given everything we saw and everything we know we could not see, the score is somewhere in here."

**No source is ever dropped to obtain a point.** A connected source that cannot be read stays in the calculation as incompleteness. That is deliberate. A narrow point built by ignoring evidence would be a worse answer than an honest range.

---

## Tiers

| Tier | Core score | Meaning |
|---|---|---|
| **Emerging** | below 30 | Little observed activity in the window, or a truthful zero |
| **Solid** | 30 to below 70 | Regular observed activity and practices |
| **High** | 70 to below 85 | Strong observed activity across dimensions |
| **Elite** | 85 and above | Saturating several dimensions |

The thresholds are declared product choices, kept from earlier versions for familiarity. Two rules govern them.

**Tiers use the unrounded core.** A core of 69.9 displays as 70 but is Solid, not High. To avoid a surprising display, the UI shows one decimal, or writes "<70", whenever integer rounding would visually cross a boundary.

**A range gets a tier only if the whole interval sits inside one tier.** A profile whose range runs from 64 to 73 straddles the 70 boundary. It receives no tier. "Somewhere between Solid and High" is the honest answer; picking one would not be.

---

## Archetypes: The Shape of the Evidence

An archetype describes the **shape** of a profile, not its rank. A Marathoner is not better than a Builder; they have different strongest dimensions. Archetypes are evaluated on unrounded values, in this order:

1. **Emerging.** The mean of the four dimensions is below 25, or no dimension reaches 40.
2. **Balanced.** All four dimensions sit within 20 points of each other and the mean is at least 50.
3. **A specialist archetype.** The highest dimension is at least 60:
   - **Builder** — Delivery leads.
   - **Quality Champion** — Quality practices lead.
   - **Marathoner** — Consistency leads.
   - **Polymath** — Breadth leads.
4. Otherwise, **Emerging**.

Ties are broken in a fixed order: Breadth, then Quality practices, then Consistency, then Delivery — so a tie goes to the rarer shape.

Two v6 exclusions are gone. There is no "solo" profile type, so Quality Champion is available to everyone, including a developer who works alone and documents their own verification and corrections. And Craft is not an archetype dimension any more; the optional Artificer descriptor is explained below.

**No archetype for a range.** If any dimension is a range rather than a point, no archetype is assigned. The UI says "insufficient evidence" instead of guessing. This avoids a subtle failure where a label could flip depending on which corner of the interval you looked at.

---

## Craft: A Separate, Optional Practice Portfolio

**Formula:** K = 25 · [ N(framing, 8) + N(verificationDebugging, 8) + N(toolJudgment, 8) + N(acceptedOutcome, 8) ]

Craft is Chapa's description of AI-assisted engineering practice, and its most important property is where it lives: **beside the core, never inside it**. Adding, expiring or withdrawing a Craft portfolio changes Craft alone. The four core dimensions and the headline score do not move.

Craft is built from deduplicated **work-item episodes**. Each episode is assessed against four criteria, each worth up to 25 points and saturating at eight episodes:

1. **Framing.** The problem, its constraints and the acceptance condition were stated.
2. **Verification and debugging.** A debugging hypothesis was tested, or a relevant verification result was recorded.
3. **Tool judgment.** There was a stated reason to use, constrain, avoid or delegate to a tool, including review of its output.
4. **Accepted outcome.** An artifact was accepted against the stated acceptance condition.

Read criterion three carefully, because it is the point of the design. **Choosing not to use an AI tool, or deliberately constraining one, demonstrates judgment in exactly the same way that delegating does.** A developer who uses no AI tool at all can submit a full Craft portfolio and score fully on it.

What earns **zero** automatic credit in Craft: the tool's name, tokens consumed, lines generated, files touched, message counts, session counts, entropy or "diversity" of tool use, agent counts, parallel sessions and reply speed. A Claude Code insights report remains a supported optional import for descriptive diagnostics, but model-estimated outcomes and satisfaction are labelled as estimates and cannot by themselves prove a criterion. "Likely satisfied" is a distinct label from "satisfied."

**No portfolio means not observed, never zero.** A profile without eligible episodes shows Craft as `not_observed`. Missing criteria produce explicit ranges using the same completion logic as the core.

**The Artificer descriptor.** A profile may carry the descriptor "Artificer" when its Craft is a complete point of at least 60 **and** at least one episode satisfying all four criteria — including an accepted outcome — has been independently corroborated by a human evaluator who is not the developer. The descriptor accompanies the core archetype; it does not replace it. The old automatic Novice, Practitioner, Expert and Master labels are retired from v7 output; legacy receipts keep their historical labels.

Evidence across multiple uploads is unioned and deduplicated. A newer upload cannot overwrite better or differently dated evidence, and uploading an old report today does not make its evidence current.

---

## Attributable Outcome Evidence

Alongside the four dimensions, v7 keeps an **outcome ledger** for evidence of delivered benefit: correctness and security, performance and accessibility, reliability and cost, design and documentation, mentoring and review, maintenance and incident recovery.

Every claim in the ledger records what was observed, the method and time horizon, a baseline (or an explanation of why none exists), and its limitations or counter-evidence. Attribution is explicit: individual action, team participation, or unclear. A team's deployment win or reliability gain is never converted into an individual causal claim by assumption.

This ledger is where the honesty about "impact" lives. Chapa records outcome evidence and attributes it explicitly. It does not infer business impact from activity or AI logs.

---

## Receipts: Every Score Can Be Replayed

Each scored revision issues an **immutable public receipt**. The receipt carries every aggregate count, every coverage bound and every rubric result needed to redo the arithmetic — plus the full calculation trace: the count, the cap, the normalized value and the weighted points for every step of every dimension.

Anyone can take that receipt and replay the score **offline**, with no network, no secrets and no clock. An independent calculator must reconcile every public numeric output. The profile page's "how is my score calculated" explanation is itself read out of the receipt's trace rather than recomputed, so the explanation and the artifact can never disagree.

What the receipt **excludes**: private paths, repository names, report contents, tokens, and evaluator identities. Public criterion results expose a structured status, category, count and a safe reason code — never free-text rationale, quoted evidence or private URLs. Those stay in the owner's private view.

Three limits, stated plainly:

- Public replay validates **arithmetic over the issued aggregates**. It does not establish that the private sources were truthful, and issuing a receipt is not a claim about the accuracy of the platform's own data.
- A retraction or correction creates a **new immutable revision**. The old receipt keeps its historical arithmetic status and can show a redacted "superseded" or "retracted" state without revealing the private reason.
- Withdrawing consent revokes public access and deletes the private backing records, leaving only a content-free tombstone. Copies that others downloaded earlier cannot be recalled, and Chapa says so before publication.

The verification page distinguishes three separate checks — recorded issuance, signature authentication and arithmetic replay — and does not inspect an SVG image or prove the identity drawn on a badge. Legacy v6 records can still be looked up, but their complete signed inputs were never saved, so they cannot be replayed.

---

## Headline and Trend

The **headline** score — the number on the badge — is always fresh. It is the current receipt's core.

The **trend** line is smoothed separately, so a day-to-day wobble does not hide the direction of travel:

**s(t) = 0.85^Δdays · s(previous) + (1 − 0.85^Δdays) · raw(t)**

where Δdays is the number of days since the previous exact observation. Three honest caveats travel with it:

- The formula assumes the newly observed value applied across the unobserved gap. That is a labelled approximation, and it is never used to backfill missing history.
- Only exact **point** observations enter the trend. A range creates a gap; the next point resumes from the elapsed days.
- Repeated reads or uploads on the same day do not feed back into the state. A same-day revision recomputes from the previous day's immutable anchor. Different policy versions segment the trend rather than blending v6 and v7 numbers.

---

## Worked Figures From the Real Scorer

The table below is generated by the same function that scores a real profile, and a test fails if the published table and a fresh run disagree. Reference time: 2026-09-01T12:00:00Z.

| Case | Delivery | Quality | Consistency | Breadth | Core | Tier | Archetype |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Complete evidence | 61 | 54 | 73 | 68 | 64 | Solid | Balanced |
| One source incomplete | 61–80 | 54 | 72–81 | 68–78 | 64–73 | none | none |
| No observed evidence | 0 | 0 | 0 | 0 | 0 | Emerging | Emerging |

Read the middle row against the first. One incomplete source leaves every lower bound exactly where it was and raises the upper bounds. Missing coverage widens the interval; it never lowers the score. That row earns no tier and no archetype, because its interval straddles 70 and the whole interval must sit inside one tier before a label is assigned.

The last row is a truthful zero — a real result with a real tier, not a failure to compute.

---

## What Left the System, and Why

For viewers who knew v6, name the departures explicitly.

| Gone in v7 | Why |
|---|---|
| Confidence score and penalty table | Penalised patterns the developer could not disprove. Replaced by evidence-completion ranges. |
| Adjusted score (composite × confidence factor) | A hidden multiplier on the headline. The core is now the headline. |
| Solo vs collaborative profile switch | A second rubric for some people. One rubric now; a solo developer's own documented correction counts as review-or-correction. |
| Recency multiplier (0.98× to 1.06×) | Another hidden multiplier. Trend is shown separately instead. |
| PR size weight, batch-size sweet spot, micro-commit ratio | Lines and PR counts are proxies. A project-day of accepted work is the unit. |
| Stars, forks, watchers, top-repo concentration | Popularity is not personal annual work. May be shown as context; zero weight. |
| Burst detection, active-day square root, heatmap evenness | Replaced by active ISO weeks with no penalties. |
| Craft inside the composite; Novice/Expert/Master labels | Craft is separate and optional. Tokens, lines, tool names earn nothing. |
| Blended platform stats | Normalized events with coverage, attribution and provenance. |

---

## Design Philosophy Summary

1. **Observed, not inferred.** Every number traces to evidence the system saw. The receipt says what was in scope.
2. **Missing evidence widens, never lowers.** A range is an honest answer. A guessed midpoint is not.
3. **Practices, not proxies.** Rationale, verification, review, follow-up. Not lines, tokens, stars or speed.
4. **Four fixed weights, nothing hidden.** The core is the mean of four published dimensions. No multipliers.
5. **One rubric for everyone.** No solo mode, no penalty for AI use, no penalty for choosing not to use AI, no tenure adjustment.
6. **Craft beside the core.** Optional, separate, and impossible to inflate with volume.
7. **Replayable.** An immutable public receipt lets anyone redo the arithmetic offline.
8. **Private by construction.** Receipts carry aggregates and reason codes, never paths, names or rationale.
9. **Labels only when earned.** No tier across a boundary, no archetype for a range, no Artificer without corroboration.
10. **Limits stated out loud.** The index does not certify ability or impact, and its constants are product choices, not statistical claims.

---

## Validation Status

The v7 rubric is implemented and tested against fixtures covering the invariants above: AI-disclosure and tool invariance, matched pairs by role, tenure and visibility, duplicate and split work, unknown and zero evidence, range containment, receipt replay and same-day trend behaviour.

An empirical pilot is prespecified and is a relaunch blocker: 24 public or consenting profiles across six work-role groups, 144 sampled work items, two independent rubric assessments each, an independent human domain reviewer, published inter-rater agreement with confusion matrices, a usability gate on range width, and sensitivity analysis on every cap and weight. Until that pilot completes, Chapa describes v7 as a fully specified rubric whose feasibility has not yet been empirically demonstrated. Passing the pilot tests feasibility and exposes problems; it does not prove universal fairness, and no pilot result is generalized to population percentiles.

The goal has not changed from v6: not to rank developers against each other, but to give each developer a clear, honest, multi-dimensional picture of their own observed work — one they can check, replay and share.
