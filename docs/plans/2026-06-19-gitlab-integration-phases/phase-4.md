# Phase 4 — Merge wiring + demo data

> Parent: [GitLab integration plan](../2026-06-19-gitlab-integration.md) | Issue #855 | Depends on: Phase 3

## Goal

Wire GitLab into the stats pipeline so linked GitLab data merges into `StatsData` and surfaces in `linkedPlatforms`, and show the GitLab logo on demo badges. This is the **most delicate edit** — `github/client.ts` currently hardcodes exactly two extra platforms.

## Changes

### 1. `apps/web/lib/github/client.ts` — extend the 2-platform pattern to 3

Imports (`:6-9`):
```
import { isBitbucketEnabled, isCodebergEnabled, isGitlabEnabled } from "@/lib/feature-flags";
import { fetchGitlabIfLinked } from "@/lib/gitlab/client";
```

Parallel fetch (`:139-142` → add 3rd):
```
const [bbResult, cbResult, glResult] = await Promise.allSettled([
  fetchBitbucketIfLinked(handle, lowerHandle),
  fetchCodebergIfLinked(handle, lowerHandle),
  fetchGitlabIfLinked(handle, lowerHandle),
]);
const glStats = glResult.status === "fulfilled" ? glResult.value : null;
```

Sequential merge (after the codeberg merge `:152-155`):
```
if (glStats) {
  stats = mergeStats(stats, glStats, { markAsSupplemental: false });
}
```

`linkedPlatforms` resolution (`:181-209` — extend the DB-link block):
```
const [bbDbLink, cbDbLink, glDbLink] = await Promise.all([
  bbStats ? null : isBitbucketEnabled().then((ok) => ok ? dbGetLinkedPlatform(handle, "bitbucket") : null),
  cbStats ? null : isCodebergEnabled().then((ok) => ok ? dbGetLinkedPlatform(handle, "codeberg") : null),
  glStats ? null : isGitlabEnabled().then((ok) => ok ? dbGetLinkedPlatform(handle, "gitlab") : null),
]);
// ...
if (bbStats || bbDbLink) linkedPlatforms.push("bitbucket");
if (cbStats || cbDbLink) linkedPlatforms.push("codeberg");
if (glStats || glDbLink) linkedPlatforms.push("gitlab");
// ...login resolution: add glLogin (glDbLink ?? (glStats ? dbGetLinkedPlatform(handle,"gitlab") : null)), set linkedPlatformLogins.gitlab
```

Update the function-level doc comment (`:35-45`) to mention GitLab alongside Bitbucket/Codeberg.

### 2. `apps/web/lib/render/BadgeSvg.tsx:115-117` — demo list
```
const brandingPlatforms: Platform[] = demoMode
  ? ["github", "bitbucket", "codeberg", "gitlab"]
  : ["github", ...(stats.linkedPlatforms?.filter(p => p !== "github") ?? [])];
```

### 3. `apps/web/lib/render/demoData.ts:69-70`
```
linkedPlatforms: ["bitbucket", "codeberg", "gitlab"],
linkedPlatformLogins: { ..., gitlab: "developer" },
```

## Tests (write first)

- `apps/web/lib/github/client.test.ts`: when `fetchGitlabIfLinked` returns stats, the merged result includes summed GitLab metrics and `linkedPlatforms` contains `"gitlab"`; when only a DB link exists (stats fetch null), `"gitlab"` still appears in `linkedPlatforms` (fixes-#632 parity); `linkedPlatformLogins.gitlab` populated. Mock `fetchGitlabIfLinked`, `isGitlabEnabled`, `dbGetLinkedPlatform`.
- `apps/web/lib/render/BadgeSvg.test.tsx`: demo badge branding includes all 4 platforms.
- `apps/web/lib/render/demoData.test.ts`: demo `linkedPlatforms` includes `"gitlab"` with a login.

## Success criteria — ✅ COMPLETE (2026-06-19)

**Automated:**
- [x] `pnpm run test` green — **454 files / 7727 tests passing** (+6).
- [x] `pnpm run typecheck` green.
- [x] `pnpm run lint` green.
- [x] GitLab merge tests (sums, solo, #632 DB-link-only, all-three, error-isolation) + BadgeSvg 4-logo + demoData. Existing bitbucket/codeberg merge tests still pass (no 2-platform regression).

**Manual:** none.

Implemented in worktree `gitlab-foundation` (stacked on Phases 1–3). Reviewer (five-spot completeness): PASS — GitLab threaded through all 5 spots (imports, parallel fetch, merge, DB-link resolution, login map); merge order GitHub→BB→CB→GL deterministic; `markAsSupplemental:false`; no double-count. `/simplify`: clean — noted that 3 hardcoded platforms make the `PlatformQuery`/`PlatformAuth` registry-loop abstraction attractive, but it's the plan's explicitly-deferred decision (not applied).

## Risk note

The `glResult`/`glStats` additions must thread through **every** spot the 2-platform pattern appears (parallel fetch, merge, DB-link array, push, login map). Missing one silently drops GitLab from a code path. The `client.test.ts` assertions above are the guard.
