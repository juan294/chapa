# Chapa Scoring System — Full Explainer

> This document explains the complete logic behind Chapa's developer Impact Profile scoring system. It is designed to serve as source material for an explanatory video about how Chapa calculates developer impact scores.

---

## The Big Picture: What Is Chapa Measuring?

Chapa generates a **Developer Impact Profile** by analyzing the last 12 months of a developer's activity across platforms like GitHub, Bitbucket, and Codeberg. Instead of producing a single number that blends everything together, Chapa breaks impact down into **four core dimensions** — Delivery, Quality, Consistency, and Breadth — plus an optional fifth dimension called **Craft** that measures AI tool mastery.

Each dimension is scored independently on a 0-to-100 scale. The philosophy is simple: a developer who ships tons of code is doing something very different from a developer who reviews dozens of pull requests. Both are valuable. A single blended number would hide those differences. Four (or five) independent dimensions let each contribution style shine.

On top of the dimension scores, Chapa assigns a **developer archetype** (like Builder, Marathoner, or Quality Champion) that describes the shape of your contribution profile, a **composite score** that averages your dimensions, a **confidence rating** that measures how much signal the system had to work with, and a **tier** classification (Emerging, Solid, High, or Elite).

---

## Why Multi-Dimensional Scoring?

Traditional developer metrics — commit counts, lines of code, number of pull requests — are increasingly unreliable in the age of AI-assisted development. A developer using AI tools might generate 500 lines of code in an afternoon. Does that mean they had more impact than someone who spent the same time carefully reviewing three pull requests and catching critical bugs? Of course not.

Volume metrics are also trivially gameable. Someone could split one logical change into 20 micro-commits and suddenly look 20 times more "productive" by commit count. Chapa's multi-dimensional approach sidesteps this problem by measuring orthogonal qualities: not just "how much" but "how consistently," "how broadly," and "how carefully."

---

## The Raw Signals

Before any scoring happens, Chapa collects raw activity data. Here are the key signals:

- **Commits**: Total contributions in the 12-month window. This is a baseline activity measure.
- **Pull Request Weight**: Merged pull requests, weighted by size and complexity. A PR that changes 200 lines across 5 files counts more than a one-line typo fix.
- **Code Reviews**: Reviews submitted on other people's pull requests. This captures collaboration and mentorship.
- **Issues Closed**: Issues the developer resolved. This captures problem-solving beyond just writing code.
- **Active Days**: Days with at least one contribution. This measures consistency over time.
- **Repos Contributed To**: Distinct repositories with 3 or more commits (shallow drive-by contributions are excluded).
- **Stars and Forks**: Community recognition metrics from repositories the developer owns.
- **Heatmap Data**: The distribution of activity across weeks, used to measure rhythm and evenness.
- **Burst Activity**: Maximum commits in any 10-minute window, used as a confidence signal.
- **PR Metadata**: Description quality, branch naming, issue linkage — used for solo developer quality assessment.

Signals that Chapa deliberately ignores for scoring purposes include follower counts (a social metric, not an engineering one) and raw lines of code (too easily gamed — used only for confidence heuristics).

---

## Dimension 1: Delivery (Shipping Meaningful Changes)

Delivery measures how much meaningful code a developer ships. It is the "output" dimension — are you getting work done and getting it merged?

### The Formula

Delivery is calculated as a weighted combination of three signals:

- **70% — Pull Request Weight**: This is the dominant signal. PRs are weighted by size and complexity, not just counted. A PR that changes 200 lines counts more than a PR that changes 2 lines. In fact, PRs with fewer than 10 total changes (additions plus deletions) receive zero weight — they are considered trivial. The weight ramps up linearly from 0 to 1 as total changes go from 0 to 10.
- **20% — Issues Closed**: How many issues did you resolve? This captures problem-solving that goes beyond writing code.
- **10% — Commits**: Total commit count is the weakest signal because it is the easiest to game. It gets just 10% weight.

Each of these raw values is log-normalized before being combined. Log normalization means that your first few contributions count a lot, but each additional one counts a bit less. Going from 0 to 5 PRs is a big jump. Going from 50 to 55 PRs barely moves the needle. This prevents outliers — developers with enormous volumes — from dominating the scale.

### Normalization Caps

Each signal has a cap beyond which additional volume has zero effect:

- PR weight is capped at 60 (roughly 25 merged PRs per year reaches 83% of the maximum)
- Issues closed is capped at 40 (10 issues per year reaches 70%)
- Commits is capped at 300 (150 commits per year reaches 81%)

These caps were calibrated so that a developer at the 50th to 75th percentile of activity lands in a meaningful scoring range — not bottomed out, not maxed out.

### What a High Delivery Score Looks Like

A developer with 25 merged PRs of moderate size, 5 issues closed, and 80 commits over the year would score around 74 in Delivery. That is a strong score — it says "this person is shipping consistently and solving real problems."

---

## Dimension 2: Quality (Engineering Discipline)

Quality measures how carefully and rigorously a developer works. But here is an important nuance: Quality is calculated differently depending on whether the developer works in a team or solo.

### Collaborative Profile (Has Code Reviews)

If a developer has submitted at least one code review, they are classified as a "collaborative" profile. For these developers, Quality is measured through:

- **60% — Reviews Submitted**: How many code reviews did you do? Reviewing other people's code is one of the strongest signals of engineering discipline. It means you care about code quality beyond your own contributions. This is log-normalized with a cap of 80.
- **25% — Review-to-PR Ratio**: How many reviews did you submit per PR you merged? A ratio of 3:1 (three reviews for every PR you merged) indicates strong collaborative habits. This is capped at a 5:1 ratio.
- **15% — Inverse Micro-Commit Ratio**: What fraction of your commits are meaningful versus trivially small? If 60% of your commits are micro-commits (very tiny changes), that is a yellow flag. This component rewards developers who make substantial, thoughtful commits.

### Solo Profile (No Code Reviews)

Many developers work solo — on personal projects, side projects, or as the sole developer on a codebase. They have no opportunity to review anyone else's code. Chapa does not penalize them for that. Instead, it looks at different quality signals:

- **40% — PR Description Rate**: What percentage of your merged PRs have non-empty descriptions? Writing good PR descriptions shows you care about documentation and communication, even when working alone.
- **25% — Feature Branch Rate**: What percentage of your merged PRs come from properly named feature branches? Using feature branches (instead of committing directly to main) shows disciplined workflow.
- **20% — Issue Linkage Rate**: What percentage of your merged PRs reference and close at least one issue? Linking PRs to issues shows structured project management.
- **15% — Inverse Micro-Commit Ratio**: Same as the collaborative profile — rewards meaningful commit sizes.

### The Solo Exception

Here is a crucial design decision: for solo developers, Quality is computed and displayed on the badge for informational purposes, but it is **excluded from the composite score calculation**. The composite score for solo developers averages only Delivery, Consistency, and Breadth (plus Craft if present).

Why? Because the Quality Champion archetype is fundamentally about peer review and collaboration. Measuring a solo developer's quality against a different rubric and then mixing it into their overall score would create an unfair comparison. So Chapa shows you your solo quality signals — you can see how disciplined your workflow is — but it does not let a lower or higher solo quality score skew your overall impact.

---

## Dimension 3: Consistency (Reliable, Sustained Contributions)

Consistency measures the rhythm and sustainability of your contributions. Are you coding every week, or did you do everything in one intense weekend?

### The Formula

Consistency combines three signals:

- **45% — Active Days**: How many days in the year did you make at least one contribution? This uses a square root curve instead of a linear one. Why? Because linear scaling would make 50 active days worth only 14% of the maximum — discouraging for anyone who does not code every single day. The square root curve gives 50 days a 37% score, and 120 days gets you to 57%. It rewards sustained activity without requiring obsessive daily commits.
- **40% — Heatmap Evenness**: This looks at your weekly activity totals across the year and measures how evenly distributed they are. If you contributed roughly the same amount each week, your evenness is high (close to 1.0). If all your activity happened in one explosive week, your evenness is low (around 0.2). The math uses the coefficient of variation (standard deviation divided by the mean) — low variation means high evenness. This is the most nuanced signal in the Consistency dimension because it rewards genuine sustained rhythm, not just "I was active on many different days."
- **15% — Inverse Burst Activity**: What is the maximum number of commits you made in any 10-minute window? If you once pushed 30 commits in 10 minutes, that looks like batch activity rather than organic development. This component gently penalizes burst patterns. Zero bursts gets you 100% on this signal; 30 or more bursts in a window gets you 0%.

### What Consistency Really Means

A developer with 150 active days, even weekly activity, and no burst patterns would score around 72 in Consistency. That says "this person shows up reliably and contributes at a sustainable pace." Compare that to someone with 300 commits but only 20 active days — they would score poorly in Consistency because all that work was crammed into a few sessions.

---

## Dimension 4: Breadth (Cross-Project Influence)

Breadth measures how widely a developer's contributions span across projects and the open-source community.

### The Formula

Breadth combines five signals:

- **40% — Repos Contributed To**: How many distinct repositories did you contribute to? This is the dominant signal. It is measured linearly against a cap of 12 repositories. Five repos gets you to about 42% of the maximum. Importantly, a repo only counts if you have 3 or more commits in it. Single-commit drive-by contributions (fixing a typo in someone's README) do not count toward breadth. This "repo depth threshold" prevents gaming.
- **25% — Inverse Top-Repo Concentration**: What percentage of your activity is concentrated in your most active repository? If 95% of your work is in one repo, you score low here. If your activity is spread across multiple repos, you score high. The formula is simply 1 minus the percentage of activity in your top repo. Note that this concentration metric uses all repos (even those with 1 commit) to get an honest picture.
- **15% — Documentation PR Ratio**: What percentage of your PRs are documentation-only changes? Writing docs shows breadth of contribution beyond just code.
- **10% — Stars**: How many stars do your repositories have? This is a community recognition signal — it means people found your work useful. Log-normalized with a cap of 150.
- **5% — Forks**: How many forks do your repos have? Similar to stars but weighted less because forks are a weaker signal of quality. Log-normalized with a cap of 80.

### Why Breadth Matters

A developer who contributes meaningfully to 8 different repositories, with activity spread relatively evenly, demonstrates versatility and cross-project awareness. This is qualitatively different from someone who is deeply focused on a single project. Neither is "better" — they are just different dimensions of impact.

---

## Dimension 5: Craft (AI Tool Mastery) — Optional

Craft is the newest dimension, added in version 6 of the scoring system. It measures how effectively a developer uses AI coding tools — specifically, the sophistication, effectiveness, and proficiency of their AI-assisted workflow.

Craft is optional because it requires the developer to upload insights data from their AI tools (like Claude Code). Developers who do not use AI tools or choose not to share this data simply do not have a Craft score, and their profile remains a 4-dimension diamond instead of a 5-dimension pentagon.

### Three Sub-Dimensions

Craft is the average of three sub-dimensions:

#### Proficiency (Tool Mastery and Feature Adoption)

This measures how deeply a developer has learned their AI tools. It looks at:

- **Tool diversity (30%)**: Are you using a variety of tools within the AI assistant, or just one or two? This is measured using Shannon entropy — a mathematical measure of diversity from information theory.
- **Agent usage rate (25%)**: What percentage of your interactions involve agentic (autonomous) AI workflows? Higher agent usage suggests more advanced tool adoption.
- **Advanced features (25%)**: Are you using advanced capabilities like multi-clauding (running multiple AI sessions in parallel) and diverse session types?
- **Engagement depth (20%)**: How frequently and responsively do you interact with AI tools? Measured by messages per day and response time.

#### Effectiveness (Outcome Quality)

This measures whether the AI-assisted work actually produces good results:

- **Achievement rate (40%)**: What fraction of AI-assisted tasks were fully or mostly achieved? Fully achieved outcomes get full weight, mostly achieved get 70%, partially achieved get 30%.
- **Satisfaction rate (25%)**: Are you satisfied with the AI's output? Measured from explicit feedback signals.
- **Friction ratio (20%)**: How often does the AI produce buggy code, take wrong approaches, or misunderstand the task? Lower friction means higher effectiveness.
- **Error recovery (15%)**: What is the ratio of tool errors to total tool calls? Lower error rates indicate better tool utilization.

#### Sophistication (Workflow Complexity)

This measures the complexity and ambition of AI-assisted workflows:

- **Complex session rate (30%)**: What fraction of sessions involve multi-task or iterative workflows (as opposed to simple one-shot questions)?
- **Lines per session (25%)**: How much code is generated or modified per session? More lines suggest more ambitious tasks.
- **Multi-clauding intensity (25%)**: How intensively are you using parallel AI sessions? This captures advanced workflow patterns.
- **Files per session (20%)**: How many files are touched per session? More files suggest cross-cutting, architectural work.

### Craft Tier Mapping

- Master (80-100): Expert-level AI tool usage
- Expert (55-79): Strong, effective AI collaboration
- Practitioner (30-54): Growing proficiency with AI tools
- Novice (0-29): Early stages of AI tool adoption

---

## Composite Score: Bringing It All Together

The composite score is a simple average of all present dimensions:

- **With Craft**: (Delivery + Quality + Consistency + Breadth + Craft) / 5
- **Without Craft**: (Delivery + Quality + Consistency + Breadth) / 4
- **Solo developers**: Quality is excluded from the average (Delivery + Consistency + Breadth [+ Craft]) / 3 or 4

This equal weighting is deliberate. Chapa does not believe any one dimension is inherently more valuable than another. A world-class code reviewer (high Quality) contributes just as much as a prolific code shipper (high Delivery) — they just contribute differently.

---

## Recency Weighting: Rewarding Current Activity

After the composite score is calculated, Chapa applies a subtle recency adjustment. This accounts for the fact that GitHub activity rolls on a 365-day window, and contributions from 11 months ago are about to drop off.

The system calculates a "recency ratio" — what fraction of your total activity happened in the last 90 days? Then it applies a multiplier:

- If your recency ratio is 0% (all your activity is old): **0.98x multiplier** (tiny 2% penalty)
- If your recency ratio is 25% (proportionally distributed): **1.0x multiplier** (neutral)
- If your recency ratio is 100% (all recent): **1.06x multiplier** (modest 6% boost)

The range is intentionally narrow — 0.98x to 1.06x. This is not meant to dramatically change scores. It is a gentle cushion that acknowledges reality: if you were very active 10 months ago but have slowed down recently, your score should start softly declining rather than cliff-diving when that activity drops off the 365-day window.

---

## Confidence: How Much Signal Did We Have?

Confidence is one of the most thoughtful parts of the scoring system. It measures how much the system trusts its own scores — not whether the developer did anything wrong. This distinction is critical: confidence is about **signal clarity**, not morality.

### How It Works

Confidence starts at 100 and gets reduced by penalties when certain patterns are detected. Each penalty reduces confidence by a fixed amount, and the floor is 50 — confidence can never go below 50.

### The Penalty Table

| Pattern | Penalty | Why It Reduces Confidence |
|---------|---------|--------------------------|
| **Burst activity** | -15 | 20+ commits in a 10-minute window. Activity concentrated in short bursts gives the system less temporal signal to work with. |
| **Micro-commit pattern** | -10 | 60%+ of commits are micro-sized. Many tiny changes make it harder to assess the real substance of contributions. |
| **Generated change pattern** | -15 | 20,000+ lines changed with 2 or fewer reviews. Very large volumes with minimal peer review suggest possible automation, which reduces signal clarity. Only applies to collaborative profiles. |
| **Low collaboration signal** | -10 | 10+ PRs merged with 1 or fewer reviews. Significant output without peer interaction means less external validation signal. Only applies to collaborative profiles. |
| **Single repo concentration** | -5 | 95%+ of activity in a single repository with only 1 repo total. Less cross-project signal available. |
| **Supplemental unverified** | -5 | Includes data from linked accounts (like Bitbucket). These sources cannot be independently verified through the same OAuth flow. |
| **Low activity signal** | -10 | Fewer than 30 active days or fewer than 50 commits. Limited activity means less data for the system to base its assessment on. |
| **Review volume imbalance** | -10 | 50+ reviews with fewer than 3 PRs merged. Very high review volume with almost no shipping reduces confidence in the balanced nature of the profile. |

### Important Design Rules

- The "generated change pattern" and "low collaboration signal" penalties are **skipped for solo developers** — these patterns are expected when working alone.
- "Review volume imbalance" and "low collaboration signal" are **mutually exclusive** — if one applies, the other does not.
- Maximum possible penalties: 50 points (which brings confidence to its floor of 50).
- **Messaging is never accusatory**. The system says things like "Activity concentrated in short bursts reduces temporal signal" rather than "This looks like you're cheating." The confidence system describes patterns, not intent.

---

## Adjusted Score: Applying Confidence

The confidence rating feeds into the final adjusted score through a gentle formula:

**Adjusted Score = Recency-Weighted Composite x (0.85 + 0.15 x Confidence/100)**

At confidence 100, the multiplier is exactly 1.0 — no adjustment. At the minimum confidence of 50, the multiplier is about 0.925 — a mere 7.5% reduction. This is intentionally mild. Even with multiple confidence concerns, the impact on the final score is modest. The system is designed to be informative, not punitive.

---

## Score Smoothing: Preventing Jarring Changes

When scores appear on the badge and share page, one final transformation is applied: exponential moving average (EMA) smoothing.

**Smoothed Score = 0.15 x Today's Raw Score + 0.85 x Yesterday's Smoothed Score**

This means the displayed score changes gradually over time rather than jumping around. If your raw score drops by 10 points overnight (maybe a burst of old activity fell off the 365-day window), the displayed score will drift down by about 1.5 points per day over 4 days.

The half-life of this smoothing is about 4.3 days. A 10-point raw change takes roughly a week to fully manifest in the displayed score.

For first-time users with no historical data, there is nothing to smooth against, so the raw score passes through unchanged.

---

## Developer Archetypes: What Kind of Developer Are You?

Archetypes describe the **shape** of your contribution profile — what kind of developer you are, not how good you are. A Marathoner is not "better" than a Builder. They just have different strengths.

### How Archetypes Are Assigned

The system evaluates archetypes in a specific order:

1. **Emerging** (the fallback): If your average dimension score is below 25, or no single dimension reaches 40, you are classified as Emerging. This is not a negative label — it means you are getting started or had light activity in the scoring window.

2. **Balanced**: If all your dimensions are within 20 points of each other and your average is at least 50, you are Balanced. This means you contribute meaningfully across all areas without any single standout.

3. **Specific Archetypes**: If your highest dimension is at least 60, you are assigned the archetype that corresponds to that dimension:
   - **Builder** — Delivery is your strongest dimension. You ship a high volume of meaningful code.
   - **Quality Champion** — Quality is your strongest dimension. You are dedicated to engineering discipline, especially code review. (Not available for solo profiles, since it is fundamentally about peer review.)
   - **Marathoner** — Consistency is your strongest dimension. You show up reliably, week after week.
   - **Polymath** — Breadth is your strongest dimension. You contribute across many projects.
   - **Artificer** — Craft is your strongest dimension. You have mastered AI-assisted development workflows.

### Tie-Breaking

When two dimensions are tied at the top, the system uses a priority order: Polymath > Quality Champion > Marathoner > Builder > Artificer. This priority order favors rarer contribution patterns — being a Polymath (contributing broadly across many projects) is less common than being a Builder (shipping lots of code), so it gets higher priority in tie-breaks.

---

## Tier Classification

Tiers provide a simple, human-readable classification based on the adjusted composite score:

| Tier | Score Range | What It Means |
|------|-------------|---------------|
| **Emerging** | 0-29 | Getting started or light activity in the scoring window |
| **Solid** | 30-69 | Active hobbyists through consistent contributors |
| **High** | 70-84 | Strong impact across multiple dimensions |
| **Elite** | 85-100 | Exceptional breadth and depth of contribution |

---

## The Normalization Formula (Technical Detail)

Almost every raw metric in the scoring system passes through a logarithmic normalization function before being used:

**f(x, cap) = ln(1 + min(x, cap)) / ln(1 + cap)**

This function takes a raw value and a cap, and returns a number between 0 and 1. It has three key properties:

1. **Diminishing returns**: The first few contributions count a lot. Going from 0 to 5 PRs is a much bigger score jump than going from 50 to 55 PRs.
2. **Capped at a maximum**: Beyond the cap value, additional volume has zero effect. This prevents outliers from distorting the scale.
3. **Smooth curve**: The transition from high-impact (early) to low-impact (later) contributions is gradual, not abrupt.

This logarithmic approach is one of Chapa's key anti-gaming measures. Splitting one change into 10 commits gives you roughly 10% more normalized credit, not 10 times more. The incentive structure rewards genuine contribution over volume inflation.

---

## Anti-Gaming Measures

The scoring system includes several defenses against manipulation:

- **PR size multiplier**: Pull requests with fewer than 10 total line changes get zero weight. You cannot inflate your Delivery score with empty or trivial PRs.
- **Repo depth threshold**: Repositories with fewer than 3 commits do not count toward the Breadth dimension. Drive-by single-commit contributions to many repos will not boost your Breadth score.
- **Logarithmic normalization**: As described above, volume inflation has sharply diminishing returns.
- **Unknown micro-commit ratio default**: If the system cannot determine your micro-commit ratio (e.g., for cached data missing that metric), it defaults to 0.3 rather than 0. This prevents benefiting from data gaps.
- **Confidence penalties**: Patterns like burst commits, generated changes, and review imbalances are flagged and reduce the confidence rating, which in turn slightly reduces the adjusted score.

---

## Solo Developer Philosophy

Chapa has a strong opinion about solo developers: they should never be penalized for working alone. In the era of AI-assisted development, a solo developer with high line counts and AI-assisted pull requests represents the new normal, not an anomaly.

When Chapa detects a solo profile (zero code reviews submitted), it:

1. Switches to a PR-based quality rubric (description quality, branch naming, issue linkage) instead of review-based quality.
2. Excludes Quality from the composite score calculation.
3. Blocks the Quality Champion archetype (since it is fundamentally about peer review).
4. Skips review-related confidence penalties (like "generated change pattern" and "low collaboration signal").

The result is that solo developers are evaluated on the signals that are meaningful for their workflow, without being compared against a collaborative rubric that does not apply to them.

---

## Lifetime Metrics and History

Chapa captures a snapshot of each developer's metrics once per day. These snapshots are stored permanently and include all raw stats, dimension scores, archetype, composite score, confidence, and tier.

These historical snapshots serve two purposes:

1. **Score smoothing**: The EMA smoothing algorithm needs yesterday's score to calculate today's displayed score.
2. **Trend tracking**: Over time, developers can see how their profile evolves — whether their Consistency is improving, whether their Breadth is expanding, and so on.

One snapshot per user per day is enforced by a unique constraint. Multiple badge views or profile visits on the same day will not create duplicate snapshots.

---

## The Full Scoring Pipeline

Here is the complete journey from raw data to displayed score:

1. **Collect data**: Gather 365 days of activity from GitHub (and optionally Bitbucket, Codeberg).
2. **Detect profile type**: Solo (zero reviews) or Collaborative (at least one review).
3. **Compute 4 core dimensions**: Delivery, Quality, Consistency, Breadth — each 0 to 100.
4. **Optionally compute Craft**: If AI tool insights are available.
5. **Derive archetype**: Based on dimension shape and thresholds.
6. **Calculate composite score**: Dynamic average of relevant dimensions.
7. **Apply recency weighting**: Gentle 0.98x to 1.06x adjustment.
8. **Compute confidence**: Start at 100, apply penalties.
9. **Calculate adjusted score**: Composite x confidence factor.
10. **Assign tier**: Emerging, Solid, High, or Elite.
11. **Apply EMA smoothing**: Only for badge and share page display.

The entire pipeline is implemented as pure functions — given the same input, you will always get the same output. This makes the scoring system deterministic, testable, and transparent.

---

## Multi-Platform Integration

Chapa supports three code platforms:

- **GitHub**: The primary source. Connected via OAuth at login. Provides the most comprehensive data.
- **Bitbucket**: Optional. Connected via OAuth from the user menu. Supplements GitHub data with Bitbucket activity.
- **Codeberg**: Optional. Connected via OAuth from the user menu. Supplements GitHub data with Codeberg activity.

Data from linked platforms is merged into the same scoring pipeline. There is a minor confidence penalty (-5 points) for supplemental (non-GitHub) data because it cannot be verified through the same OAuth flow, but the penalty is minimal and the data fully contributes to all dimension calculations.

---

## Badge Verification

Every Chapa badge includes a verification hash — an HMAC-SHA256 signature that proves the badge data has not been tampered with. Anyone can visit the verification page and confirm that a badge's scores, archetype, and tier are genuine.

This matters because badges are embeddable anywhere — in GitHub READMEs, personal websites, resumes. Without verification, someone could create a fake badge with inflated scores. The HMAC signature makes that impossible without access to Chapa's secret key.

---

## Design Philosophy Summary

The Chapa scoring system is built on several core principles:

1. **Multi-dimensional over single-number**: Different contribution styles deserve separate measurement.
2. **Logarithmic normalization over linear**: Reward genuine contribution, not volume inflation.
3. **Non-accusatory confidence**: Describe patterns, never impute intent.
4. **Solo-friendly**: Adapt to the developer's actual workflow, do not force a collaborative rubric on a solo developer.
5. **Transparent**: Every weight, cap, and formula is documented. No black boxes.
6. **Deterministic**: Pure functions, same input produces same output, fully testable.
7. **Gently smoothed**: Score changes propagate gradually, no jarring day-to-day jumps.
8. **Anti-gaming by design**: Logarithmic curves, depth thresholds, and confidence penalties make manipulation impractical and unrewarding.

The goal is not to rank developers against each other. It is to give each developer a clear, honest, multi-dimensional picture of their own impact — and to make that picture beautiful enough to share.
