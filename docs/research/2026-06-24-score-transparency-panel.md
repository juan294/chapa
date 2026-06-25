# Research: "How is my score calculated" transparency panel (#932)

> Date: 2026-06-24 · Branch: `develop` · Scope: share page (`/u/:handle`) Impact Breakdown
> Status: Research only — documents what exists. No implementation, no recommendations.

## Question

Issue #932 asks for a "How is my score calculated" section in the Impact Breakdown on the share page, explaining per-dimension inputs, weights, the composite roll-up, confidence/penalties, and per-platform data provenance. This document maps the existing code, data flow, formulas, i18n/design patterns, and the data each platform provides.

---

## 1. Where the Impact Breakdown renders (component chain)

The share page is `apps/web/app/u/[handle]/page.tsx` (ISR, `revalidate = 3600`).

Render chain for the score breakdown:

- `SharePage` (`page.tsx:81`) → `SharePageContent` (`page.tsx:107`, server component).
- `SharePageContent` renders the badge (`page.tsx:232`), `BadgeToolbar` (`page.tsx:259`), then the breakdown via **`SharePageOwnerContentLazy`** (`page.tsx:265`), passing `handle`, `stats`, `impact`.
- `SharePageOwnerContentLazy` (`apps/web/components/SharePageOwnerContentLazy.tsx`) — `"use client"`, `next/dynamic` wrapper with a `BadgeSkeleton` fallback. Forwards props verbatim.
- `SharePageOwnerContent` (`apps/web/components/SharePageOwnerContent.tsx:92`) — breakdown container. Renders:
  - `<DataSources stats={stats} handle={handle} />` (`SharePageOwnerContent.tsx:118`) — from `ImpactBreakdown.tsx:107`.
  - `"Impact breakdown"` `<h2>` (`SharePageOwnerContent.tsx:122`, key `shareOwner.impactBreakdown`).
  - `<ImpactDashboard impact={impact} stats={stats} handle={handle} />` (`SharePageOwnerContent.tsx:129`) when `impact && stats`, else `<EmptyImpactState>`.
  - Embed snippet + visitor CTA sections.
- `ImpactDashboard` (`apps/web/components/dashboard/ImpactDashboard.tsx:26`) renders, in order: archetype label + `getArchetypeProfile()` text (`:34,38-46`), `<DimensionCardsRow>` (`:48`), `<CoachingInsights>` (`:55`), `<ActivityHeatmap>` (`:57`), `<StatsGrid>` (`:63`).
- `DimensionCardsRow` → one `DimensionCard` per active dimension (core 4 + `craft` if present).

### Existing per-dimension transparency surface (closest precedent)

- `apps/web/components/dashboard/DimensionCard.tsx` (`:97`) already has an **expand/collapse disclosure** (`:210-237`) that opens `SubMetricPanel`.
- `apps/web/components/dashboard/SubMetricPanel.tsx` (`:211`) — `getSubMetrics()` (`:30`) returns per-dimension sub-metrics with `label`, `weight` (e.g. `"70%"`), `normalizedValue`, `rawLabel`, branching on `profileType` (solo vs collaborative quality at `:58-121`). It renders weighted progress bars + raw values (`:275-309`). **This is the existing weight/formula breakdown on the share page** — a "how is my score calculated" panel overlaps heavily with it.

### Canonical methodology text already written

- `apps/web/app/about/scoring/ScoringMethodologyClient.tsx` (410 lines) — full methodology explainer with reusable `SectionHeading` (`:12`), `SubHeading` (`:21`), and `Table` (`:35`) sub-components. Per-dimension weight tables, caps table, formula callout boxes. All copy from `about.scoring.*` i18n keys.
- The share-page dimension cards also carry short subtitles (`ImpactBreakdown.tsx:8-14`, `DIMENSION_SUBTITLES`) and longer hover tooltips (`DIMENSION_TOOLTIPS`, `:29-50`), with solo/collaborative variants (`:16-18, 52-57`).

> Note: `apps/web/components/ImpactBreakdown.tsx` exports `ImpactBreakdown()` (`:217`) but on the share page **only its `DataSources` and `getArchetypeProfile` exports are used** — the dashboard variant (`ImpactDashboard`) is the live breakdown path.

---

## 2. Data already available client-side (no new plumbing required)

The server page fetches via `materializePublicProfile(handle, { readOnly })` (`page.tsx:118`) → `materializeProfile(..., { policy: "public-display" })` (`apps/web/lib/profile/public-profile.ts:20-30`). It extracts:

- `stats = materialized.stats` → **full `StatsData`** (`page.tsx:119`)
- `impact = materialized.displayImpact` → **full `ImpactV6Result`** (`page.tsx:120`)

**Server→client boundary** (`page.tsx:265`): `<SharePageOwnerContentLazy handle stats impact />`. Props are typed as the full objects (`SharePageOwnerContentLazy.tsx:12-16`) and forwarded unchanged through `SharePageOwnerContent` → `ImpactDashboard`.

**Conclusion:** the **entire `StatsData`** (all raw inputs: `prsMergedWeight`, `issuesClosedCount`, `commitsTotal`, `reposContributed`, `topRepoShare`, `batchSizeScore`, `medianPrLeadTimeHours`, `linesAdded/Deleted`, `heatmapData`, `linkedPlatforms`, `linkedPlatformLogins`, …) **and the entire `ImpactV6Result`** (`dimensions`, `compositeScore`, `confidence`, `confidencePenalties`, `adjustedComposite`, `archetype`, `tier`, `profileType`) are **already serialized to the browser** as props. A new panel can read all of it client-side with zero new data fetching.

### Type definitions (`packages/shared/src/types.ts`)

`ImpactV6Result` (`:88-99`): `handle`, `profileType` (`"solo"|"collaborative"`), `dimensions`, `archetype`, `compositeScore`, `confidence` (50–100), `confidencePenalties` (`ConfidencePenalty[]`), `adjustedComposite`, `tier`, `computedAt` — all required.
`DimensionScores` (`:69-75`): `delivery`, `quality`, `consistency`, `breadth` (required), `craft?` (optional).
`ConfidencePenalty` (`:56-60`): `{ flag: ConfidenceFlag; penalty: number; reason: string }`. Reason strings live in `CONFIDENCE_REASONS` (`apps/web/lib/impact/utils.ts:57-76`); built by `computeConfidence` (`utils.ts:119+`).
`StatsData` (`:10-41`): 30 fields; optional ones are `displayName`, `avatarUrl`, `primaryReviewsSubmittedCount`, `microCommitRatio`, `batchSizeScore`, `medianPrLeadTimeHours`, `docsOnlyPrRatio`, `prDescriptionRate`, `featureBranchRate`, `issueLinkageRate`, `hasSupplementalData`, `linkedPlatforms`, `linkedPlatformLogins`.

### Confidence: present but deliberately not rendered

Confidence reaches the client (inside `impact`) but **no visible component reads `impact.confidence` / `impact.confidencePenalties`** — it's omitted by the components simply never referencing it (not stripped at a boundary). The only production read is the non-visible JSON-LD SEO block (`page.tsx:195`, inside `<script type="application/ld+json">`). This matches CLAUDE.md's acceptance criterion: *"Confidence is computed internally but not shown to users."*

### Public API contract (narrower)

`GET /api/profile/[handle]` (`apps/web/app/api/profile/[handle]/route.ts`) returns only snapshot-derived `dimensions`, `compositeScore`, `adjustedComposite`, `archetype`, `tier`, `craft`, `snapshotDate`, `computedAt` (`route.ts:66-83`). **No** `confidence`, `confidencePenalties`, `profileType`, or raw `StatsData`. (Relevant only if the panel were ever fed from the public API rather than server props — currently it is not.)

---

## 3. Exact scoring formulas (for accurate panel copy)

Sources: `docs/impact-v6.md`, `apps/web/lib/impact/v6.ts`, `packages/shared/src/constants.ts`. Normalization is logarithmic: `f(x, cap) = ln(1+min(x,cap)) / ln(1+cap)` (`utils.ts:47-51`).

**Caps** (`constants.ts:12-21`): prWeight 60, issues 40, commits 300, reviews 80, repos 12, stars 150, forks 80, watchers 50.

**Delivery** (`v6.ts:74-82`): `100·(0.70·norm(prsMergedWeight,60) + 0.20·norm(issuesClosedCount,40) + 0.10·norm(commitsTotal,300))`, then ×lead-time modifier (±5%, `v6.ts:40-56`: ≤4h→1.05, 4–48h→1.05→1.0, 48–168h→1.0→0.95, >168h→0.95, undefined→1.0).

**Quality** (`v6.ts:108-135`) — profile-dependent:
- Collaborative: `100·(0.60·norm(reviews,80) + 0.25·reviewRatio + 0.15·batchSizeScore)` where `reviewRatio = min(reviews/prsMerged, 5)/5`; `batchSizeScore` defaults to `0.3` (`BATCH_SIZE_DEFAULT`) when absent.
- Solo (`computeSoloQuality`, `:153-163`): `100·(0.40·prDescriptionRate + 0.25·featureBranchRate + 0.20·issueLinkageRate + 0.15·batchSizeScore)`; returns 0 if `prsMergedCount === 0`.
- **Cliff guard (#827)**: collaborative path returns `max(collaborative, solo)` (`:132-134`).

**Consistency** (`v6.ts:186-195`): `100·(0.45·√(min(activeDays,365)/365) + 0.40·heatmapEvenness + 0.15·weekCoverage)`; returns 0 when `activeDays === 0`.

**Breadth** (`v6.ts:212-223`): `100·(0.40·(min(repos,12)/12) + 0.25·(1−topRepoShare) + 0.10·norm(stars,150) + 0.05·norm(forks,80) + 0.15·docsOnlyPrRatio)`; returns 0 when `reposContributed === 0`. `docsOnlyPrRatio` is **not populated by any aggregator** (always 0 in practice).

**Profile type** (`v6.ts:268-277`): solo when `(primaryReviewsSubmittedCount ?? reviewsSubmittedCount) / max(prsMerged,1) < 0.15` (`SOLO_REVIEW_RATIO_THRESHOLD`).

**Composite** (`v6.ts:361-373`): collaborative = avg(delivery, quality, consistency, breadth [+craft]); **solo = avg(delivery, consistency, breadth [+craft]) — Quality excluded** (still displayed on radar/cards). Then recency weight ×0.98–1.06 (`recency.ts`), then `adjustedComposite = composite·(0.85 + 0.15·confidence/100)` (`utils.ts:238-244`), then tier (Emerging <30, Solid ≥30, High ≥70, Elite ≥85; `constants.ts:71-75`).

**Confidence penalties** (`utils.ts:119-219`, table at `:87-97`): burst_activity −15, micro_commit_pattern −10, generated_change_pattern −15 (collab only), low_collaboration_signal −10 (collab only), single_repo_concentration −5, supplemental_unverified −5, low_activity_signal −10, review_volume_imbalance −10, platform_linked 0 (informational). Floor 50.

The same content is already written in user-facing prose under `about.scoring.*` (`en.ts:665-833`) — including the solo-exclusion explanation (`en.ts:781-785`), the gentle-confidence note ("at minimum confidence 50, reduction is only 7.5%"), and the full penalty table (`en.ts:793-814`).

---

## 4. i18n pattern (parity-enforced)

- **Server**: `getServerT(locale)` (`apps/web/lib/i18n/server.ts:20-23`); locale via `getServerLocale()`.
- **Client**: `const { t } = useTranslation()` from `@/lib/i18n` (`use-translation.ts:9-32`); `LanguageProvider` is mounted in the root layout, so any client component under the share page has context.
- Leaf access: `t('section.key') as string`; for `aria-label` with interpolation: `interpolate(t('aria.x') as string, { ... })` (e.g. `DimensionCard.tsx:214`). Array leaves: `t('...') as string[]` / `as unknown as string[][]` (`ScoringMethodologyClient.tsx:169-170`).
- **Add keys to BOTH** `dictionaries/en.ts` and `es.ts` at the identical path. `parity.test.ts` enforces identical key trees (incl. array indices) and no empty-string leaves. The `about.scoring` block (`en.ts:665-833`) is the model for a nested explainer section (headings, `…Prefix/Highlight/Suffix` split paragraphs, formula strings, table arrays-of-arrays).

---

## 5. Design-system patterns to reuse

- **Card**: elevated `rounded-xl bg-card shadow-card` (+`hover:shadow-card-hover transition-shadow`) — no `border` (the shadow ring replaces it). E.g. `DimensionCard.tsx:157`, `ImpactBreakdown.tsx:247`. Sharp/terminal variant: `rounded-xl border border-stroke bg-card`.
- **Collapsible**: three in-repo patterns — (A) CSS grid-rows `.collapse-grid` accordion (`QuickControls.tsx:106-123` + `globals.css:520-534`); (B) `DimensionCard` chevron-rotate disclosure with full a11y (`aria-expanded`/`aria-controls`, Enter/Space, `DimensionCard.tsx:108-248`); (C) conditional-mount + Escape-close (`SubMetricPanel.tsx:214-232`).
- **Tooltip (mandatory pattern)**: `InfoTooltip` (`apps/web/components/InfoTooltip.tsx:14`) — `createPortal` to `document.body`, `position: fixed`, `z-[99999]`, `pointer-events-none`, top/bottom flip, outside-click + Escape. Reuse directly via `<InfoTooltip id content />`.
- **Dimension colors**: CSS tokens in a `from`/`to` gradient map (`ImpactBreakdown.tsx:20-26`, `DimensionCard.tsx:19-43`); applied to `role="progressbar"` bars on `bg-track` (`ImpactBreakdown.tsx:262-277`).
- **Section kicker heading**: `font-heading text-xs tracking-[0.2em] uppercase text-text-secondary` (`ImpactBreakdown.tsx:239`).
- **Formula callout box**: `rounded-lg border border-stroke bg-card p-4 font-heading text-sm text-text-primary` (`ScoringMethodologyClient.tsx:154-156`).
- **Weight table**: reusable `Table` (headers + string-matrix, design-system styled) driven by dictionary arrays (`ScoringMethodologyClient.tsx:28-68`).

---

## 6. Per-platform data provenance

All aggregators route through `normalizeStats()`, which copies optional fields only when `!== undefined` (`stats-aggregation.ts:266-271`). **Only GitHub computes the discipline/flow signals.**

| StatsData field | GitHub | GitLab | Bitbucket | Codeberg |
|---|---|---|---|---|
| core counts (commits, PRs, reviews, issues, lines, repos, topRepoShare, heatmap) | yes | yes | yes | yes |
| totalStars | yes | yes | **0** | yes |
| totalForks | yes | yes | yes | yes |
| totalWatchers | yes | **0** | **0** | yes |
| prDescriptionRate, featureBranchRate, issueLinkageRate, batchSizeScore, medianPrLeadTimeHours, microCommitRatio | yes | undefined | undefined | undefined |

Sources: GitHub `buildStatsFromRaw` (`packages/shared/src/stats-aggregation.ts:78-109`); GitLab `buildStatsFromGitlab` (`apps/web/lib/gitlab/stats-aggregation.ts:75-94`); Bitbucket (`apps/web/lib/bitbucket/stats-aggregation.ts:73-92`); Codeberg (`apps/web/lib/codeberg/stats-aggregation.ts:85-104`).

**Scoring consequence** (documented effect, observed live in the mdburgos audit 2026-06-24): for a GitLab/Bitbucket/Codeberg-primary user, the GitHub-only signals are undefined → Solo Quality collapses to ~`100·0.15·0.3 = 4.5` (only the `batchSizeScore` default survives), the Delivery lead-time modifier is neutral (×1.0), and the micro-commit penalty never fires. Quality is display-only for solo profiles, so this does not affect the composite — but it *is* shown on the radar/cards.

---

## 7. Open decisions for the planning phase (observations, not recommendations)

These are tensions the existing code surfaces; the plan must resolve them:

1. **Confidence visibility.** Confidence + penalties already reach the client but are deliberately not rendered (CLAUDE.md: "not shown to users"). The public `/about/scoring` page, however, documents the entire confidence model and penalty table (`en.ts:793-814`). A per-user panel that explains "how YOUR score was calculated" sits exactly on this line — showing the user's own penalties (e.g. `single_repo_concentration −5`) would be new surface area not currently exposed per-user.
2. **Overlap with `SubMetricPanel`.** A per-dimension weight/value breakdown already exists on the share page (`SubMetricPanel`). The new panel either extends/reuses it or duplicates it.
3. **Overlap with `/about/scoring`.** The methodology is already fully written and translated there. The new panel is the *personalized* instance of that generic content (user's actual values plugged into the documented formulas).
4. **Per-platform caveat copy.** No existing UI tells a GitLab-primary user "Quality reads low because GitLab doesn't expose PR-hygiene signals." There are no i18n keys for per-platform provenance yet, and no `accepted-risks.md` entry for the platform data gap (only the 0.15 threshold boundary is recorded, `accepted-risks.md:150-155`).

---

## Key file:line index

- Share page + boundary: `app/u/[handle]/page.tsx:118-123, 265`
- Breakdown chain: `SharePageOwnerContent.tsx:118,122,129` → `dashboard/ImpactDashboard.tsx:26-63` → `DimensionCard.tsx:97-248` → `SubMetricPanel.tsx:30-309`
- Methodology precedent: `app/about/scoring/ScoringMethodologyClient.tsx:12-68,154-156,168-240`
- Scoring core: `lib/impact/v6.ts:74-223,268-395`, `lib/impact/utils.ts:47-51,119-244`, `packages/shared/src/constants.ts:12-75`
- Spec: `docs/impact-v6.md:24-136,182-264`
- i18n: `lib/i18n/server.ts:20`, `lib/i18n/use-translation.ts:9`, `dictionaries/en.ts:665-833`, `dictionaries/parity.test.ts:44-48`
- Tooltip: `components/InfoTooltip.tsx:82-98`
- Provenance: `packages/shared/src/stats-aggregation.ts:78-109`, `lib/{gitlab,bitbucket,codeberg}/stats-aggregation.ts`
- Types: `packages/shared/src/types.ts:10-41,56-99`
