# Scored-consumer inventory

Every file that reads a score — a dimension, a composite, a tier, an archetype
or a receipt — is listed here with a named owner and the regression that proves
it renders the shared model rather than deriving numbers of its own.

`apps/web/lib/profile/scoring-consumer-inventory.test.ts` enforces this table in
both directions: every row must point at a file and a test that exist, and every
file the scanner finds reading a scored symbol must appear in a row. A new
consumer therefore cannot ship unregistered, which is the failure this inventory
exists to prevent — the badge already taught that lesson once (#1191), and a
score has far more surfaces than a badge does.

## The contract

- **One projection.** `apps/web/lib/profile/score-view-model.ts` turns an issued
  v7.2 receipt (or an explicitly archived v7.1 / legacy v6 aggregate) into `ScoreViewModel`. A consumer reads
  that model; it does not recompute a dimension, composite, tier or archetype.
- **One materializer.** `apps/web/lib/profile/score-receipt-observed.ts` captures the
  reference time once and issues one receipt per revision. A read-only caller
  observes durable state and publishes nothing. Archived issuance remains in
  `apps/web/lib/profile/score-receipt-v7.ts`.
- **One what-if calculator.** `apps/web/lib/impact/simulate.ts`. A simulation
  surface calls it instead of restating the pipeline.
- **`policyVersion` is load-bearing.** A `v6` model carries legacy aggregate
  semantics and must never be labelled or explained as v7 arithmetic.

## Registered consumers

### AI tool insights

| Consumer | Shared-receipt regression |
| --- | --- |
| `apps/web/lib/insights/use-insights-import.ts` | `apps/web/lib/insights/use-insights-import.test.tsx` |

### Creator Studio

| Consumer | Shared-receipt regression |
| --- | --- |
| `apps/web/app/studio/BadgePreviewCard.tsx` | `apps/web/lib/render/badge-view-model.test.tsx` |
| `apps/web/app/studio/StudioClient.tsx` | `apps/web/app/studio/StudioClient.render.test.tsx` |
| `apps/web/app/studio/page.tsx` | `apps/web/lib/render/badge-view-model.test.tsx` |

### SEO/LLM surfaces

| Consumer | Shared-receipt regression |
| --- | --- |
| `apps/web/app/LandingContent.tsx` | `apps/web/app/LandingContent.render.test.tsx` |
| `apps/web/app/[locale]/archetypes/_components/ArchetypePage.tsx` | `apps/web/lib/render/archetypeDemoData.test.ts` |
| `apps/web/app/llms-full.txt/route.ts` | `apps/web/app/llms-full.txt/route.test.ts` |

### SVG rendering

| Consumer | Shared-receipt regression |
| --- | --- |
| `apps/web/components/badge/BadgeContent.tsx` | `apps/web/lib/render/badge-view-model.test.tsx` |
| `apps/web/lib/render/BadgeSvg.tsx` | `apps/web/lib/render/badge-observed.test.tsx` |
| `apps/web/lib/render/archetypeDemoData.ts` | `apps/web/lib/render/badge-view-model.test.tsx` |
| `apps/web/lib/render/demoData.ts` | `apps/web/lib/render/badge-view-model.test.tsx` |
| `apps/web/lib/render/landing-demo-data.ts` | `apps/web/lib/render/badge-view-model.test.tsx` |
| `apps/web/lib/render/observed-demo-data.ts` | `apps/web/lib/render/observed-demo-data.test.ts` |
| `apps/web/lib/render/scoring-evidence-label.ts` | `apps/web/lib/render/scoring-evidence-label.test.ts` |

### WebMCP

| Consumer | Shared-receipt regression |
| --- | --- |
| `apps/web/app/studio/useStudioWebMcpTools.ts` | `apps/web/app/studio/useStudioWebMcpTools.test.ts` |
| `apps/web/app/u/[handle]/SharePageWebMcpTools.tsx` | `apps/web/app/u/[handle]/SharePageWebMcpTools.render.test.tsx` |
| `apps/web/lib/webmcp/server-tools.ts` | `apps/web/lib/webmcp/server-tools.test.ts` |
| `apps/web/lib/webmcp/shared-tools.ts` | `apps/web/lib/webmcp/shared-tools.test.ts` |

### admin API

| Consumer | Shared-receipt regression |
| --- | --- |
| `apps/web/app/api/admin/bulk-recalculate/route.ts` | `apps/web/app/api/admin/bulk-recalculate/route.test.ts` |
| `apps/web/app/api/admin/users/route.ts` | `apps/web/app/api/admin/users/route.test.ts` |

### admin dashboard

| Consumer | Shared-receipt regression |
| --- | --- |
| `apps/web/app/admin/AdminUserTable.tsx` | `apps/web/lib/db/admin-users.test.ts` |
| `apps/web/app/admin/admin-types.ts` | `apps/web/lib/db/admin-users.test.ts` |
| `apps/web/app/admin/useAdminDashboard.ts` | `apps/web/lib/db/admin-users.test.ts` |
| `apps/web/lib/db/admin-users.ts` | `apps/web/lib/db/admin-users.test.ts` |

### authenticated API

| Consumer | Shared-receipt regression |
| --- | --- |
| `apps/web/app/api/recalculate/route.ts` | `apps/web/app/api/recalculate/route.test.ts` |
| `apps/web/app/api/refresh/route.ts` | `apps/web/app/api/refresh/route.test.ts` |

### badge verification

| Consumer | Shared-receipt regression |
| --- | --- |
| `apps/web/app/verify/[hash]/page.tsx` | `apps/web/lib/verification/store.test.ts` |
| `apps/web/lib/db/verification.ts` | `apps/web/lib/db/verification.test.ts` |
| `apps/web/lib/verification/hmac-payload.ts` | `apps/web/lib/verification/hmac.test.ts` |
| `apps/web/lib/verification/hmac.ts` | `apps/web/lib/verification/hmac.test.ts` |
| `apps/web/lib/verification/types.ts` | `apps/web/lib/verification/store.test.ts` |

### cron

| Consumer | Shared-receipt regression |
| --- | --- |
| `apps/web/app/api/cron/warm-cache/route.ts` | `apps/web/app/api/cron/warm-cache/route.test.ts` |

### dashboard

| Consumer | Shared-receipt regression |
| --- | --- |
| `apps/web/components/dashboard/CoachingInsights.tsx` | `apps/web/lib/dashboard/generate-insights.test.ts` |
| `apps/web/components/dashboard/DimensionCardsRow.tsx` | `apps/web/lib/dashboard/score-explanation.test.ts` |
| `apps/web/components/dashboard/ImpactDashboard.tsx` | `apps/web/components/dashboard/ImpactDashboard.observed.test.tsx` |
| `apps/web/components/dashboard/ScoreBoldNumber.tsx` | `apps/web/lib/dashboard/score-explanation.test.ts` |
| `apps/web/components/dashboard/ReceiptExplanationPanel.tsx` | `apps/web/lib/dashboard/receipt-explanation.test.ts` |
| `apps/web/components/dashboard/ScoreExplanationPanel.tsx` | `apps/web/lib/dashboard/score-explanation.test.ts` |
| `apps/web/lib/dashboard/generate-insights.ts` | `apps/web/lib/dashboard/generate-insights.test.ts` |
| `apps/web/lib/dashboard/receipt-explanation.ts` | `apps/web/lib/dashboard/receipt-explanation.test.ts` |
| `apps/web/lib/dashboard/score-explanation.ts` | `apps/web/lib/dashboard/score-explanation.test.ts` |

### email

| Consumer | Shared-receipt regression |
| --- | --- |
| `apps/web/lib/email/notifications.ts` | `apps/web/lib/email/notifications.test.ts` |
| `apps/web/lib/email/score-bump.ts` | `apps/web/lib/email/score-bump.test.ts` |

### experiments (flag-gated)

| Consumer | Shared-receipt regression |
| --- | --- |
| `apps/web/app/experiments/number-counters/page.tsx` | `apps/web/lib/profile/score-view-model.test.ts` |
| `apps/web/app/experiments/tier-visuals/_components/tier-data.ts` | `apps/web/app/experiments/tier-visuals/_components/tier-data.test.ts` |

### feature flags

| Consumer | Shared-receipt regression |
| --- | --- |

### global command bar

| Consumer | Shared-receipt regression |
| --- | --- |
| `apps/web/components/terminal/command-registry.ts` | `apps/web/components/terminal/command-registry.test.ts` |

### impact scoring

| Consumer | Shared-receipt regression |
| --- | --- |
| `apps/web/lib/impact/simulate.ts` | `apps/web/lib/impact/simulate.test.ts` |
| `apps/web/lib/impact/smoothing.ts` | `apps/web/lib/impact/smoothing.test.ts` |
| `apps/web/lib/impact/v6.ts` | `apps/web/lib/impact/v6.test.ts` |

### lifetime history

| Consumer | Shared-receipt regression |
| --- | --- |
| `apps/web/lib/db/snapshots.ts` | `apps/web/lib/db/snapshots.test.ts` |
| `apps/web/lib/history/diff.ts` | `apps/web/lib/history/diff.test.ts` |
| `apps/web/lib/history/significant-change.ts` | `apps/web/lib/history/significant-change.test.ts` |
| `apps/web/lib/history/snapshot.ts` | `apps/web/lib/history/snapshot.test.ts` |
| `apps/web/lib/history/trend.ts` | `apps/web/lib/history/trend.test.ts` |

### maintenance scripts

| Consumer | Shared-receipt regression |
| --- | --- |
| `scripts/backfill-parsers.ts` | `scripts/backfill-parsers.test.ts` |
| `scripts/recalculate-handles.ts` | `scripts/recalculate-handles.test.ts` |

### collection (#1335 phase 4)

| Consumer | Shared-receipt regression |
| --- | --- |
| `apps/web/lib/collection/fan-in.ts` | `apps/web/lib/collection/fan-in.test.ts` |
| `apps/web/lib/collection/read-scoring-status.ts` | `apps/web/lib/collection/read-scoring-status.test.ts` |

### profile materialization

| Consumer | Shared-receipt regression |
| --- | --- |
| `apps/web/lib/profile/leaderboard.ts` | `apps/web/lib/profile/leaderboard.test.ts` |
| `apps/web/lib/profile/materialize-profile.ts` | `apps/web/lib/profile/materialize-profile.test.ts` |
| `apps/web/lib/profile/orchestrated-profile.ts` | `apps/web/lib/profile/orchestrated-profile.test.ts` |
| `apps/web/lib/profile/public-profile.ts` | `apps/web/lib/profile/public-profile.test.ts` |
| `apps/web/lib/profile/stored-badge-profile.ts` | `apps/web/lib/profile/stored-badge-profile.test.ts` |

### public API

| Consumer | Shared-receipt regression |
| --- | --- |
| `apps/web/app/api/profile/[handle]/route.ts` | `apps/web/app/api/profile/[handle]/route.observed.test.ts` |

### scoring view model

| Consumer | Shared-receipt regression |
| --- | --- |
| `apps/web/lib/profile/issue-receipt.ts` | `apps/web/lib/profile/issue-receipt.test.ts` |
| `apps/web/lib/profile/badge-verification.ts` | `apps/web/lib/profile/badge-verification.test.ts` |
| `apps/web/lib/profile/score-description.ts` | `apps/web/lib/profile/score-description.test.ts` |
| `apps/web/lib/profile/score-model.ts` | `apps/web/lib/profile/score-model.test.ts` |
| `apps/web/lib/profile/score-receipt-v7.ts` | `apps/web/lib/profile/score-receipt-v7.test.ts` |
| `apps/web/lib/profile/score-view-model.ts` | `apps/web/lib/profile/score-view-model-observed.test.ts` |

### share page

| Consumer | Shared-receipt regression |
| --- | --- |
| `apps/web/app/u/[handle]/page.tsx` | `apps/web/lib/render/badge-view-model.test.tsx` |
| `apps/web/components/ImpactBreakdown.tsx` | `apps/web/lib/profile/score-view-model.test.ts` |
| `apps/web/components/SharePageOwnerContent.tsx` | `apps/web/components/SharePageOwnerContent.render.test.tsx` |
| `apps/web/components/SharePageOwnerContentLazy.tsx` | `apps/web/components/SharePageOwnerContentLazy.render.test.tsx` |

## Adding a consumer

1. Read the score through `ScoreViewModel`; do not import the raw receipt or
   recompute a value.
2. Add a row above with the owning area and the test that covers it.
3. Run `pnpm exec vitest run apps/web/lib/profile/scoring-consumer-inventory.test.ts`.

If the scanner flags a file that only *mentions* a scored symbol without
consuming one — a type re-export, say — the honest fix is to register it anyway.
A row costs one line; an unregistered consumer costs a silent second answer.

### Current receipt infrastructure and independent replay

| Consumer | Shared-receipt regression |
| --- | --- |
| `apps/web/app/api/insights/route.ts` | `apps/web/app/api/insights/route.observed.test.ts` |
| `apps/web/lib/cache/snapshot-cache-observed.ts` | `apps/web/lib/cache/snapshot-cache-observed.test.ts` |
| `apps/web/lib/db/report-craft.ts` | `apps/web/lib/db/report-craft.contract.test.ts` |
| `apps/web/lib/db/score-receipts-observed.ts` | `apps/web/lib/db/score-receipts-observed.test.ts` |
| `apps/web/lib/history/scoring-observations.ts` | `apps/web/lib/history/scoring-observations.test.ts` |
| `apps/web/lib/profile/post-write-score.ts` | `apps/web/lib/profile/post-write-score.test.ts` |
| `apps/web/lib/profile/public-score-projection.ts` | `apps/web/lib/profile/public-score-projection.test.ts` |
| `apps/web/lib/profile/receipt-semantic-identity.ts` | `apps/web/lib/profile/receipt-semantic-identity.test.ts` |
| `apps/web/lib/profile/score-receipt-observed.ts` | `apps/web/lib/profile/score-receipt-observed.test.ts` |
| `scripts/scoring/reference-calculator-v7-observed.ts` | `scripts/scoring/reference-calculator-v7-observed.test.ts` |
| `apps/web/app/api/history/[handle]/route.ts` | `apps/web/app/api/history/[handle]/route.test.ts` |

| `apps/web/lib/history/observed-history.ts` | `apps/web/lib/webmcp/server-tools.test.ts` |

## Value and policy proof

The file inventory is necessary but does not prove value agreement. The following
executed regressions exercise the shared synthetic receipt beside conflicting
legacy core80, Builder and Craft83. Normal current core is46, valid report Craft
is57 or0, and the boundary case displays69.99/Solid. The inventory suite also
executes a cross-surface assertion over the actual SVG, metadata, public
projection and history observation, comparing them with the sealed receipt.

| Surface | Numeric / policy regression |
| --- | --- |
| SVG / radar / accessibility text | `apps/web/lib/render/badge-observed.test.tsx` |
| Studio model handoff | `apps/web/app/studio/StudioClient.render.test.tsx` |
| Owner dashboard and report recovery | `apps/web/components/dashboard/ImpactDashboard.observed.test.tsx` |
| Profile and public insights | `apps/web/app/api/profile/[handle]/route.observed.test.ts` |
| Post-write API | `apps/web/app/api/recalculate/route.observed.test.ts` |
| Browser tools | `apps/web/app/u/[handle]/SharePageWebMcpTools.render.test.tsx` |
| Studio simulation tools | `apps/web/app/studio/useStudioWebMcpTools.test.ts` |
| Remote tools | `apps/web/lib/webmcp/server-tools.test.ts` |
| Current standings | `apps/web/lib/profile/leaderboard.test.ts` |
| History and window compatibility | `apps/web/lib/history/scoring-observations.test.ts` |
| Admin ordering before pagination | `apps/web/lib/db/admin-users.test.ts` |
| Notification contents (mocked transport) | `apps/web/lib/email/notifications.test.ts` |
| Offline receipt replay | `scripts/scoring/reference-calculator-v7-observed.test.ts` |

Legacy calculators, archived receipt schemas, snapshot persistence and legacy
explanation components remain explicitly v6 or archived v7.1; their tests prove
those historical semantics, not current receipt presentation. Static experiments
are visibly labelled illustrative fixtures. The command bar's `/sort score`
alias selects the admin adapter's canonical projected score column; it does not
calculate a separate number. Current demos use the pure policy calculator and
carry illustrative=true with no issued identity. Infrastructure rows test
publication, privacy, consent, selection and cache fences rather than rendering.
