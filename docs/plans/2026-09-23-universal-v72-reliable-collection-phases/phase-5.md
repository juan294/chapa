# Phase 5: delete v6

Parent plan: `../2026-09-23-universal-v72-reliable-collection.md`. Depends on phase 4. Every surface must already render v7.2 states before its v6 branch is removed. Not batch-eligible: it touches almost every scoring consumer.

## Goal

After this phase:
- v6 scoring code no longer exists.
- v6 data (`metrics_snapshots`, `verification_records`, v6 HMAC) no longer exists.
- The policy selector no longer exists.
- Every consumer reads the v7.2 receipt, the scoring status, or raw `StatsData`.

Raw stats stay as display data:
- heatmap
- stars, forks, watchers
- repos contributed
- display name and avatar
- linked platforms

## Step order

Each step is TDD: first change or delete the tests that assert v6 behaviour and assert the v7.2 behaviour instead, then change the code.

### 5.1 Score model has one policy
- **`lib/profile/score-model.ts`.** `scoreModelFrom` returns one of:
  - the receipt view model
  - `{ kind: "status", status }` (from phase 4)
  - `unavailable` for a failed authority read (existing no-store semantics)
- **`legacyViewModel`** is deleted from `score-view-model.ts`.
- **`BadgeSvg.tsx:193`** stops defaulting to `legacyViewModel(impact)`. `renderBadgeSvg(stats, {scoring | status})` loses the `impact` parameter. All 5 call sites are updated:
  - `og-image/route.ts:155`
  - `badge.svg/route.ts:352`
  - `badge.svg/route.ts:733`
  - `page.tsx:343`
  - `page.tsx:367`
- **Tier-string fallbacks** `scoring?.tier ?? displayImpact.tier` are removed.

### 5.2 Retire the selector
- Delete `lib/scoring-render-selection.ts` and `isScoringV7RenderingEnabled`.
- Delete the `scoring_v7_rendering` special case in `app/api/admin/feature-flags/route.ts`. The global `scoring-images` purge stays available as a generic admin action if it is still referenced; otherwise it is removed.
- Every `machinePolicy` / `selection` parameter becomes the constant `SCORING_POLICY = "v7.2"` in `packages/shared`.
- **Cache key segments.** `lib/render/badge-svg-cache.ts` and the OG key builder keep the literal `v7.2` segment. The key format is unchanged, so no cache migration is needed. The `v6` key namespaces are left to expire.
- Migration 057 holds the flag `true` for the old code; the contract migration 058 deletes the flag row after the release.

### 5.3 Materialization
- `materialize-profile.ts`: remove `computeImpactV6` (`:125`), the EMA prior from snapshots (`:259`), `displayImpact`, `buildSnapshot`, and the snapshot side effects.
- `public-profile.ts`: remove `persistProfileSnapshot`, `storeVerificationRecord` and the v6 `getPublicProfileVerification`.
- `orchestrated-profile.ts`: remove `persistOrchestratedSnapshot`.
- `snapshot-write.ts`: delete the file.
- `app/api/generate/route.ts:112`: remove the discarded `computeImpactV6` call.
- `app/api/admin/users/route.ts`: v7.2 view only.

### 5.4 Stored-badge fallback
- `stored-badge-profile.ts` is rebuilt on the latest receipt plus the exact-bound stale `StatsData` envelope (2026-09-22 design). It no longer depends on snapshots.
- When no stats envelope exists, the counts render as unavailable, never as zero.
- Test: a receipt with no stats renders the score with the activity-unavailable disclosure.

### 5.5 Reads that used snapshots
| Consumer | New source |
|---|---|
| MCP `loadPublicProfile` (`server-tools.ts:104-171`) | the receipt; the `legacy` block is removed from the output. The tool descriptions are updated: remove "evidence range" and "legacy". |
| MCP `get_impact_history`, `/api/history` | observed history only |
| Share page trend (`get-trend-data.ts`) | `calculateTrendV7` over observed history (`lib/impact/smoothing.ts:135`), which moves to `lib/impact/trend-v7.ts` |
| `/api/profile` | the receipt, or `{ scoringStatus }` |
| `/api/insights/[handle]` | receipt Craft, or status |
| Leaderboard | the v7.2 branch only; delete `dbGetTopScoredProfiles` and `dbGetScoredCandidates` |
| Admin | `admin_users_observed` only |

### 5.6 Verification
- Delete `lib/verification/hmac-payload.ts`, the v6 half of `hmac.ts` (keep `signReceiptV7` / `authenticateReceiptV7`), `lib/db/verification.ts`, and `getVerificationRecord`.
- `/api/verify/[hash]`, `/verify/[hash]` and MCP `verify_badge`: a non-`v7.` token returns HTTP 410 `{ status: "retired_v6_code" }`, and the page shows the explanation from the parent plan's stuck-state table. `VerifyPageWebMcpTools` is updated the same way.
- Warm-cache: remove `dbCleanExpiredVerifications`.

### 5.7 Emails
- `notifyFirstBadge` gets a receipt-only body.
- Delete `notifyScoreBump`, the `SnapshotDiff` path and warm-cache `previousSnapshots` (`:187`, `:595-624`).
- Keep `notifyObservedScoreChange`.

### 5.8 Studio, landing, archetypes, dashboard
- `simulate_score` and `suggest_improvements`: v7.2 only (`simulateObservedScore`, `observedImprovementSuggestions`). Delete `simulateCoreScore` and `generateInsights(impact)` where it is v6-only.
- `DEMO_IMPACT`, `LANDING_IMPACT` and `archetypeDemoData.ts`: replace with v7.2 sample view models. `LANDING_OBSERVED_DEMO` and `STUDIO_OBSERVED_DEMO` already exist. Keep the curated sample values from CLAUDE.md (landing 92 Elite Balanced, Studio 82 High Balanced) as v7.2 view-model fixtures.
- Dashboard components, `DimensionCardsRow` and `SharePageOwnerContent:282`: v7.2 branch only.
- `score-description.ts` and `scoring-evidence-label.ts`: remove the v6 wording.

### 5.9 Supplemental (EMU) uploads
- `app/api/supplemental/route.ts:150` currently labels the upload `legacy_aggregate`. The v7 supplemental store (`scoring_v7_store_supplemental`, 042) remains the evidence path.
- Remove the v6 scalar composition from `getStats` supplemental handling.

### 5.10 Delete the code
- `lib/impact/{v6,utils,recency,heatmap-evenness}.ts`, the v6 parts of `smoothing.ts` and `simulate.ts`, and their tests (`v6.test`, `golden-profiles`, `pipeline`, `craft-propagation`, `craft-e2e-propagation`).
- `packages/shared`: remove the `ImpactV6Result`, `PublicImpactV6Result` and `ClientImpactV6Result` exports; the `{version:"v6"}` union member in `scoring-evidence.ts:259` (only if no archived v7 receipt parser needs it; the parser tests decide); and the v6 caps in `constants.ts:8`.
- `lib/validation.ts`: the v6 validators.
- Legacy scalar readers `lib/{bitbucket,codeberg,gitlab}/stats.ts` "Legacy v6 scalar reader": delete them if they are used only for v6 composition. `getStats` StatsData is kept.
- `redactImpactForVisitor` and the confidence types: delete.
- **CI and scripts:**
  - `scripts/check-craft-propagation.sh`, `scripts/lib/check-craft-propagation.py` and its `ci.yml:46` step: delete the step and the scripts (they scan for `computeImpactV6`).
  - `scripts/{recalculate-handles,heal-poisoned-stats,backfill-supabase,backfill-parsers,scoring/migrate-v7}.ts`: delete them, or reduce them to their v7 function (the implementer checks each one's `package.json` script entry and removes that too).
  - `clone-prod-db.ts` and `delete-user.ts`: remove the dropped tables from their lists.
  - `rls-deny-migration.test.ts`: remove the dropped tables.
- **`vitest.config.ts:77-82`:** the `lib/impact/**` floor stays and now covers v7 files only. Confirm that coverage still meets 95/90/95/95.
- **E2E:**
  - `e2e/helpers/redesign-fixtures.ts`: seed a receipt instead of `computeImpactV6` + snapshot + verification row.
  - `scoring-point-fixtures.ts:48,103`: drop the snapshot insert and `legacyImpact`.
  - `journey.spec.ts`: remove the snapshot assertions.
  - `lib/test-helpers/fixtures.ts`: delete `makeImpact` and `makeSnapshot`.

### 5.11 Migrations 057 (pre-release) and 058 (contract, post-release)

This is expand-migrate-contract (`docs/runbooks/migrations.md:203-215`). The running release reads and writes these objects until the new code is live, so nothing is dropped before the release.

- `057_retire_v6_selector.sql`: `UPDATE feature_flags SET enabled = true WHERE key = 'scoring_v7_rendering';`
  - This keeps the old code on v7.2 during the window between migration and deploy.
  - The new code never reads the row.
- `058_contract_v6_and_consent.sql`, applied only after production runs the new code (phase 7 step 7.5):
```sql
DELETE FROM feature_flags WHERE key = 'scoring_v7_rendering';
ALTER TABLE scoring_v7_subjects DROP CONSTRAINT <consent check name from 039>;
ALTER TABLE scoring_v7_subjects DROP COLUMN public_evidence_consent, DROP COLUMN consent_recorded_at;
DROP VIEW IF EXISTS admin_users;              -- v6 view (the observed view remains)
DROP VIEW IF EXISTS latest_snapshots;         -- 012/014
DROP FUNCTION IF EXISTS <snapshot RPCs, e.g. headline-score RPC from 047> ...;
DROP TABLE IF EXISTS metrics_snapshots;
DROP TABLE IF EXISTS verification_records;
-- archived machine v7 / algorithm v7.1 receipt tables and RPCs are NOT dropped (immutable replay, CLAUDE.md goal #2)
```
Before writing the migration, the implementer lists the dependent objects:

```bash
grep -nE "metrics_snapshots|verification_records|latest_snapshots|admin_users\b" supabase/migrations/*.sql
```

Every view, function and policy found must be dropped in dependency order. `supabase db reset` must apply 001-058 cleanly.

Compatibility contract test: run the phase-4 build's contract suite against a database migrated to 057. It proves that the running release keeps working between the migration and the deploy. Then run the new build's suite against 058.

### 5.12 Guard against regression
`lib/profile/scoring-consumer-inventory.test.ts` asserts that no file under `apps/web` or `packages/shared/src` contains any of these, allowing only `docs/`, migrations and the explicit 410 handler:
- `computeImpactV6`
- `ImpactV6Result`
- `legacyViewModel`
- `metrics_snapshots`
- `verification_records`
- `machinePolicy`
- `scoring_v7_rendering`
- `"v6"`

## Success criteria

**Automated**
- The inventory guard passes.
- Coverage floors pass.
- `supabase db reset` plus the contract suite pass.
- The full e2e spec set passes on chromium and mobile.
- Build and bundle-size checks pass.
- `check:circular` passes.
- The global verification list passes.

**Manual**
- In the local candidate, visually check a ready owner, a collecting owner and an unregistered handle across badge, OG, share, `/settings`, `/studio`, landing and `/verify/<retired hex>`.
