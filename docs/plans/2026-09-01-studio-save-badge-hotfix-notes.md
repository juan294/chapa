# Notes: `2026-09-01-studio-save-badge-hotfix`

## Deviations

### Phase 2, step 2.4 (`e2e/journey.spec.ts`) — badge-marker content assertions replaced

**Plan said:** after the Studio save, fetch `/u/<handle>/badge.svg?after-save=<ts>`
and assert the body contains the saved config's rendered markers
(`id="badge-bg-aurora"`, `id="badge-card-sheen"`, `id="badge-score-paint"`),
and assert they are absent before the save.

**Found:** ran the spec locally against `supabase start` with the exact env
`ci.yml`'s `contract` job uses (dummy `UPSTASH_REDIS_REST_URL`, no
`GITHUB_TOKEN`). Every badge fetch for the fixture's synthetic handles
(`chapa-e2e-<runId>-...`) returned the `badge.loadError` fallback SVG — none
of the config markers, before or after the save. Traced to
`apps/web/lib/github/queries.ts:98`: `if (!json.data?.user) return null;` — a
GitHub GraphQL query for a login that doesn't exist on GitHub returns
`data.user: null` regardless of token validity, so `fetchContributionData`
always returns `null` for this fixture's handles. `apps/web/lib/github/stats.ts`
and `apps/web/lib/github/client.ts:516-527` propagate that to a fully null
`materialized` profile whenever no stale Redis baseline exists (guaranteed
here — `dummy.upstash.io` never resolves, and it's a first-ever fetch for
these handles regardless). Config resolution (`resolveBadgeConfig`) only runs
*inside* `finalizeMaterializedBadge`, which requires a non-null materialized
profile — so it's never reached. This is structural, not an artifact of my
local setup: `ci.yml`'s `contract` job (the one that runs `journey.spec.ts`)
configures the identical dummy Redis and never sets `GITHUB_TOKEN`, and the
fixture's session token (`ghp_e2e_fixture`, `journey.spec.ts`'s
`encryptedSessionValue`) is always invalid regardless. No combination of
credentials fixes it, because the handles themselves don't exist on GitHub.

**Chose:** kept the pre-save badge fetch as-is (status 200, `<svg>` structure
— unaffected by this, since it never checked content). After the save,
instead of asserting SVG markers, assert `typeof saveResult.body.badgeRefreshed
=== "boolean"` (extending `saveStudioConfigInBrowser` to return the parsed
response body) and that a follow-up badge fetch still returns 200 with the
correct `Content-Type` — proving the new response field and the real
invalidation call path (Redis delete attempts + `purgeEdgeCacheTag`, which
reports `"skipped"` outside Vercel) work end-to-end through the real server
and don't error, without asserting content this fixture cannot produce.
Verified: ran `playwright test e2e/journey.spec.ts --project=chromium
--project=mobile` against local Supabase — 2 passed.

**Why:** the marker assertions as specified would fail in CI, not just
locally — this is a plan defect rooted in a fixture design choice
(synthetic, non-existent GitHub handles) that predates this hotfix, not
something introduced by it. The revised assertions still prove the two things
this hotfix's E2E addition exists to prove (the field is live over a real
HTTP round-trip; the route survives a real invalidation pass) without
asserting something this test's fixture is incapable of producing. The
config-reaches-the-render property itself is proven elsewhere: the unit
tests for `invalidateBadgeSvgCacheForHandle`, `purgeEdgeCacheTag`, and the
studio config route's ordering/mapping tests (`route.test.ts`'s
`describe("badge cache invalidation (#1191 hotfix, v2.29.2)")`), plus the
manual preview-deployment verification in the parent plan's Success Criteria
(a real GitHub handle, a real Vercel edge, a real `x-vercel-cache` header).
