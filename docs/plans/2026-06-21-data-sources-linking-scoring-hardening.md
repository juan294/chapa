# Data Sources Linking and Scoring Hardening Plan

Date: 2026-06-21

Research source: `docs/research/2026-06-21-data-sources-linking-scoring.md`

## Objective

Make data-source linking and unlinking deterministic from the user's point of view, and make linked-platform score changes flow through the existing dirty-input materialization path so same-day score snapshots are refreshed when link state changes.

## Current Understanding

- `UserMenu` owns the platform status cache, status fetches, connect links, unlink confirmation dialogs, and disconnect POSTs for Bitbucket, Codeberg, and GitLab. `apps/web/components/UserMenu.tsx:30`, `apps/web/components/UserMenu.tsx:226`, `apps/web/components/UserMenu.tsx:265`
- Shared platform OAuth handlers in `apps/web/lib/auth/platform-oauth.ts` implement callback/link, disconnect/unlink, and status for Bitbucket, Codeberg, and GitLab. `apps/web/lib/auth/platform-oauth.ts:150`, `apps/web/lib/auth/platform-oauth.ts:256`, `apps/web/lib/auth/platform-oauth.ts:300`
- Link success currently stores the platform row and invalidates merged/platform/SVG caches. `apps/web/lib/auth/platform-oauth.ts:221`, `apps/web/lib/auth/platform-oauth.ts:235`
- Disconnect currently returns HTTP 200 with `{ success }`, and the client currently treats any `res.ok` response as local unlink success. `apps/web/lib/auth/platform-oauth.ts:289`, `apps/web/components/UserMenu.tsx:275`
- `materializeProfile` already reads the dirty-stats marker and threads `inputsChanged` into the score policy. `apps/web/lib/profile/materialize-profile.ts:81`, `apps/web/lib/profile/materialize-profile.ts:103`
- Public side effects already replace today's snapshot and clear the dirty marker when `inputsChanged=true`. `apps/web/lib/profile/public-profile.ts:97`, `apps/web/lib/profile/public-profile.ts:102`

## Design Options

### Option A: Call `/api/recalculate` directly after platform link/unlink

This would reuse the explicit recalculation route and return immediate score data to the client. It would add a client-visible dependency on recalculation for unlink and is awkward for OAuth callback redirects, where the server is already in the right place to record the input change.

### Option B: Mark linked-platform changes dirty and let materialization replace snapshots

This reuses the existing `stats:dirty:{handle}` mechanism used by supplemental uploads. Link and successful unlink become input-change events; the next share/badge/profile materialization bypasses the same-day lock and replaces today's snapshot through existing side effects.

### Option C: Recompute inside platform OAuth handlers

This would make callbacks and disconnects do the full stats fetch, scoring, and snapshot write synchronously before redirect/JSON. It would duplicate orchestration responsibilities now centralized in profile materialization and would slow OAuth callback responses.

## Chosen Direction

Use Option B.

Rationale:

- It uses the existing dirty-marker, smoothing bypass, and snapshot replacement code paths.
- It keeps OAuth callbacks responsive.
- It keeps score materialization centralized.
- It avoids inventing a second score-write path.

## Phase Structure

1. Phase 1: Server-side link-state freshness contract.
2. Phase 2 `[batch-eligible]`: User-menu link/unlink UX determinism.
3. Phase 3 `[batch-eligible]`: Scoring regression coverage and confidence invariants.
4. Phase 4: Integrated validation gate.

Phase 2 is batch-eligible because it is scoped to `UserMenu` and component tests. Phase 3 is batch-eligible because it is scoped to scoring/materialization tests and does not depend on Phase 1's implementation. Phase 1 is not marked batch-eligible because it defines the server contract the final validation gate depends on.

## Detailed Plan

### Phase 1: Server-Side Link-State Freshness Contract

Phase file: `docs/plans/2026-06-21-data-sources-linking-scoring-hardening-phases/phase-1.md`

Intent:

- Mark scoring inputs dirty after a platform link is durably stored.
- Mark scoring inputs dirty only after a platform unlink actually succeeds.
- Clear per-platform negative cache on successful link so a recent "not linked" cache cannot suppress the newly linked platform.
- Await critical cache deletes before redirect/JSON response.

Primary files:

- `apps/web/lib/auth/platform-oauth.ts`
- `apps/web/lib/auth/platform-oauth.test.ts`
- Per-platform route tests under `apps/web/app/api/auth/{bitbucket,codeberg,gitlab}/`

Pseudocode:

```ts
// platform-oauth.ts
import { markStatsDirty } from "@/lib/cache/dirty-stats";

async function invalidatePlatformReadModels(handle, platform, options) {
  const lower = handle.toLowerCase();
  await Promise.all([
    cacheDel(`stats:v2:merged:${lower}`),
    cacheDel(`stats:v2:${platform}:${lower}`),
    cacheDel(`stats:v2:${platform}:${lower}:neg`),
    options.clearSupplemental ? cacheDel(`supplemental:${lower}`) : Promise.resolve(),
  ]);
  invalidateBadgeSvgCache(handle);
}

// after successful dbUpsertLinkedPlatform(...)
await invalidatePlatformReadModels(handle, config.platform, { clearSupplemental: false });
await markStatsDirty(handle);

// after dbDeleteLinkedPlatform(...)
await invalidatePlatformReadModels(handle, config.platform, { clearSupplemental: true });
if (success) {
  await markStatsDirty(handle);
}
return NextResponse.json({ success });
```

Automated success criteria:

- Shared callback tests assert `markStatsDirty("testuser")` is called after successful storage.
- Shared callback tests assert dirty marker is not called on token/user/storage failure paths.
- Shared callback tests assert `stats:v2:{platform}:{handle}:neg` is deleted on successful link.
- Shared disconnect tests assert dirty marker is called only when `{ success: true }`.
- Shared disconnect tests assert dirty marker is not called when `dbDeleteLinkedPlatform` returns false.
- Existing Bitbucket, Codeberg, and GitLab route tests continue to pass with updated mocks.

Manual success criteria:

- With a real linked platform OAuth callback, the redirect lands on `/u/{handle}?{platform}=linked`.
- After link, the share page's next profile materialization includes the new linked platform when provider data is available.

### Phase 2: User-Menu Link/Unlink UX Determinism `[batch-eligible]`

Phase file: `docs/plans/2026-06-21-data-sources-linking-scoring-hardening-phases/phase-2.md`

Intent:

- Stop treating HTTP 200 `{ success: false }` as a successful unlink in the UI.
- Make the platform status cache track each platform independently instead of one global fetched flag.
- Add GitLab runtime parity coverage for link/unlink behavior.

Primary files:

- `apps/web/components/UserMenu.tsx`
- `apps/web/components/UserMenu.test.tsx`
- `apps/web/components/UserMenu.render.test.tsx`

Pseudocode:

```ts
interface PlatformStatusCache {
  bitbucket: PlatformStatusEntry;
  codeberg: PlatformStatusEntry;
  gitlab: PlatformStatusEntry;
}

interface PlatformStatusEntry {
  fetched: boolean;
  status: PlatformStatus | null;
}

function fetchPlatformStatus(platform, setter) {
  const cache = platformStatusStore.getSnapshot();
  if (cache[platform].fetched) return;

  fireAndForget(async () => {
    const data = await fetch(`/api/auth/${platform}/status`).then((r) => r.json());
    if (data.enabled) {
      const status = { linked: data.linked, remoteLogin: data.remoteLogin };
      platformStatusStore.set({
        ...platformStatusStore.getSnapshot(),
        [platform]: { fetched: true, status },
      });
      setter(status);
    } else {
      platformStatusStore.set({
        ...platformStatusStore.getSnapshot(),
        [platform]: { fetched: true, status: null },
      });
    }
  });
}

async function unlinkPlatform(config) {
  setLoading(true);
  try {
    const res = await fetch(endpoint, { method: "POST" });
    const body = await res.json().catch(() => null);
    if (res.ok && body?.success === true) {
      clearPlatformStatusCache();
      setStatus({ linked: false, remoteLogin: null });
      setShowConfirm(false);
      router.refresh();
      return;
    }
    setToast({ type: "error", message: t("userMenu.unlinkFailed") });
  } catch {
    setToast({ type: "error", message: t("userMenu.unlinkFailed") });
  } finally {
    setLoading(false);
  }
}
```

Automated success criteria:

- A disconnect response with status 200 and `{ success: false }` leaves the platform shown as linked and does not call `router.refresh()`.
- A disconnect response with status 200 and `{ success: true }` clears the dialog, updates local status to unlinked, clears cache, and calls `router.refresh()`.
- If one platform status fetch fails, later mounts can still fetch other platform statuses.
- GitLab has runtime tests mirroring Bitbucket/Codeberg linked, unlinked, confirm, success, loading, and failure behavior.
- Existing source-level tests for menu structure continue to pass.

Manual success criteria:

- Unlink failure leaves the user in a recoverable state with linked status still visible.
- Unlink success removes the platform row from the menu without a full page reload.

### Phase 3: Scoring Regression Coverage and Confidence Invariants `[batch-eligible]`

Phase file: `docs/plans/2026-06-21-data-sources-linking-scoring-hardening-phases/phase-3.md`

Intent:

- Strengthen confidence that linked-platform data changes affect score materialization through existing code paths.
- Add explicit tests for dirty marker plus same-day snapshot behavior.
- Add explicit test coverage for platform-linked confidence metadata.

Primary files:

- `apps/web/lib/profile/materialize-profile.test.ts` or `apps/web/lib/profile/materialize-profile-parallel.test.ts`
- `apps/web/lib/impact/smoothing.test.ts`
- `apps/web/lib/impact/utils.test.ts`
- `apps/web/lib/impact/pipeline.test.ts`

Pseudocode:

```ts
it("uses dirty marker to bypass same-day snapshot lock", async () => {
  mockGetStats.mockResolvedValue(freshStatsWithLinkedPlatform);
  mockGetCachedLatestSnapshot.mockResolvedValue(todaySnapshotWithOldScore);
  mockIsStatsDirty.mockResolvedValue(true);

  const result = await materializeProfile("testuser", { today: "2026-06-21" });

  expect(result.inputsChanged).toBe(true);
  expect(result.displayImpact.adjustedComposite).not.toBe(todaySnapshotWithOldScore.adjustedComposite);
});

it("platform_linked is informational and does not reduce confidence", () => {
  const withoutPlatform = computeConfidence(baseStats);
  const withPlatform = computeConfidence({ ...baseStats, linkedPlatforms: ["gitlab"] });

  expect(withPlatform.confidence).toBe(withoutPlatform.confidence);
  expect(withPlatform.penalties).toContainEqual(expect.objectContaining({
    flag: "platform_linked",
    penalty: 0,
  }));
});
```

Automated success criteria:

- Dirty marker materialization test passes with a same-day snapshot.
- `platform_linked` confidence test proves no confidence reduction.
- Pipeline tests still prove merged stats survive through `computeImpactV6` and snapshot build.
- Existing smoothing and public-profile dirty-marker tests still pass.

Manual success criteria:

- None required beyond Phase 4 validation.

### Phase 4: Integrated Validation Gate

Phase file: `docs/plans/2026-06-21-data-sources-linking-scoring-hardening-phases/phase-4.md`

Intent:

- Run the focused automated suite that covers the changed surfaces.
- Run broader project checks after implementation phases are complete.
- Perform manual link/unlink smoke checks only where credentials are available.

Automated success criteria:

Run sequentially:

```bash
pnpm exec vitest run apps/web/lib/auth/platform-oauth.test.ts apps/web/app/api/auth/bitbucket/callback/route.test.ts apps/web/app/api/auth/bitbucket/disconnect/route.test.ts apps/web/app/api/auth/codeberg/callback/route.test.ts apps/web/app/api/auth/codeberg/disconnect/route.test.ts apps/web/app/api/auth/gitlab/callback/route.test.ts apps/web/app/api/auth/gitlab/disconnect/route.test.ts apps/web/components/UserMenu.test.tsx apps/web/components/UserMenu.render.test.tsx apps/web/lib/github/client.test.ts apps/web/lib/github/merge.test.ts apps/web/lib/impact/pipeline.test.ts apps/web/lib/impact/smoothing.test.ts apps/web/lib/impact/utils.test.ts apps/web/lib/profile/materialize-profile.test.ts apps/web/lib/profile/materialize-profile-parallel.test.ts apps/web/lib/profile/public-profile.test.ts
pnpm run typecheck
pnpm run lint
pnpm run test
```

Manual success criteria:

- On a local or preview environment with configured OAuth credentials, link one enabled platform and confirm the share page shows the platform as linked after callback.
- Unlink the same platform and confirm the menu keeps the linked state on simulated/server failure and changes to unlinked on server success.
- Confirm the next share page or badge render after link/unlink uses refreshed stats rather than the previous same-day snapshot.

## Out of Scope

- Building a full authenticated Playwright OAuth harness.
- Changing the Impact v6 scoring formulas.
- Adding new provider integrations.
- Refactoring `UserMenu` into separate platform row components unless the implementation needs it to keep tests readable.

## Risks and Constraints

- Cache deletes are graceful when Redis is unavailable, so awaiting them should not convert Redis outages into hard failures. `apps/web/lib/cache/redis.ts:91`
- Dirty markers should only be set after durable link-state changes to avoid replacing same-day snapshots for failed unlink attempts.
- Phase 2 changes must preserve existing feature-flag behavior: client-side flags avoid unnecessary status fetches, while server-side flags remain authoritative.
- This plan does not change branch or deployment workflow; implementation must happen through the existing RPI phase gates.

## Final Plan Status

No unresolved questions.

