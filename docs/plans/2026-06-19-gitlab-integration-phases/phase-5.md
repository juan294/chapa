# Phase 5 — UI: UserMenu link/unlink + footer + i18n `[batch-eligible]`

> Parent: [GitLab integration plan](../2026-06-19-gitlab-integration.md) | Issue #855 | Depends on: Phase 2 (routes). Batch-eligible with Phase 6 (disjoint files).

## Goal

Add the GitLab link/unlink row to the User Menu, the GitLab logo to the landing footer, and all i18n strings (en + es parity). Enable-gating is **server-side** via the status route — the component renders the row whenever `glStatus` is non-null.

## Changes

### 1. `apps/web/components/UserMenu.tsx` (mirror every Codeberg touchpoint)
- Module-level status cache (`:18-33`): add `gitlab` field (init `null`, clear on logout).
- Component state (`:61-66`): `glStatus`/`setGlStatus`, `showGlUnlinkConfirm`/`setShowGlUnlinkConfirm`, `glUnlinkLoading`/`setGlUnlinkLoading`.
- `fetchPlatformStatus` union (`:186`): add `"gitlab"`.
- Status fetch effect (`:204`): `fetchPlatformStatus("gitlab", setGlStatus)`.
- Unlink handler (mirror `:225-228`):
  ```
  async function handleUnlinkGitlab() {
    setGlUnlinkLoading(true);
    await fetch("/api/auth/gitlab/disconnect", { method: "POST" });
    statusCache.gitlab = null; setGlStatus({ ...glStatus, linked: false });
    setShowGlUnlinkConfirm(false); setGlUnlinkLoading(false);
  }
  ```
- Rendered block (mirror `:442-472`), gated `{glStatus && (...)}`:
  - linked: avatar link `https://gitlab.com/${remoteLogin}`, `<GitlabIcon/>`, red "Unlink" button (`text-terminal-red`) opening `showGlUnlinkConfirm`.
  - unlinked: `href="/api/auth/gitlab/connect"`, `<GitlabIcon/>`, `t('userMenu.linkGitlab')`.
- Confirm dialog (mirror `:606-612`): `confirmUnlinkGitlabTitle`/`Body`, `onConfirm={handleUnlinkGitlab}`.
- `GitlabIcon` component (mirror `CodebergIcon` `:628`): inline tanuki SVG, `aria-hidden="true"`.

### 2. `apps/web/app/page.tsx` (landing footer)
- Add `GitlabIcon` inline component (mirror `CodebergIcon` `:31`).
- Add GitLab footer link to gitlab.com with the icon (mirror `:475-476`).

### 3. i18n — `apps/web/lib/i18n/dictionaries/en.ts` AND `es.ts` (identical key paths; parity test enforces)
| Key | en | es |
|-----|----|----|
| `aria.unlinkGitlab` | "Unlink GitLab" | "Desvincular GitLab" |
| `userMenu.linkGitlab` | "Link GitLab" | "Vincular GitLab" |
| `userMenu.confirmUnlinkGitlabTitle` | "Unlink GitLab?" | "¿Desvincular GitLab?" |
| `userMenu.confirmUnlinkGitlabBody` | (mirror codeberg body, GitLab) | (Spanish, mirror codeberg body) |

(Translate to match the tone/length of the existing codeberg strings; Spanish is the default locale.)

Optional consistency: append "GitLab" to the platform lists in privacy/terms/verification prose (en/es ~`:528, 544, 567, 571, 868`).

## Tests (write first)

- `apps/web/components/UserMenu.test.tsx` / `.render.test.tsx`: with `glStatus.linked=false` renders "Link GitLab" → `/api/auth/gitlab/connect`; with `linked=true` renders unlink + avatar link to gitlab.com; clicking unlink shows confirm; confirm POSTs disconnect. Mock the status fetch.
- `apps/web/lib/i18n/dictionaries/parity.test.ts`: passes (en/es keys identical) — no edit, just keep in sync.

## Success criteria — ✅ COMPLETE (2026-06-19)

**Automated:**
- [x] `pnpm run test` green — **454 files / 7736 tests passing**.
- [x] `pnpm run typecheck` green.
- [x] `pnpm run lint` green.
- [x] UserMenu GitLab block + aria test; render-test fetch count 2→3 with gitlab mock; en/es parity holds.

**Manual (requires user's GitLab app + env — user confirmed env set locally + on Vercel, glab CLI authed as juan2941):**
- [ ] User Menu shows "Link GitLab"; clicking completes OAuth and shows the connected GitLab handle. *(pending live test post-merge)*
- [ ] Unlink shows the confirm dialog and removes the row. *(pending live test post-merge)*

Implemented in worktree `gitlab-foundation`. Reviewer: PASS (11/11 UserMenu, 2/2 page.tsx, 8/8 i18n, 2/2 tests). Tanuki SVG path byte-identical across UserMenu/page/BadgeBranding/ImpactBreakdown (MD5 verified). Server-side gating via status route (no NEXT_PUBLIC check in component). `/simplify`: clean — noted per-platform UI-row componentization as deferred cross-platform refactor.
