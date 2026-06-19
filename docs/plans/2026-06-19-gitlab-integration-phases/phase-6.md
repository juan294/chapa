# Phase 6 — Docs `[batch-eligible]`

> Parent: [GitLab integration plan](../2026-06-19-gitlab-integration.md) | Issue #855 | Depends on: Phase 1. Batch-eligible with Phase 5 (disjoint files).

## Goal

Document the GitLab integration in project docs, env examples, SEO metadata, and the LLM-facing site summaries, mirroring the Bitbucket/Codeberg entries.

## Changes

### 1. `CLAUDE.md`
- After the Codeberg auth routes (`:63-66`), add the GitLab block:
  ```
  - GET `/api/auth/gitlab/callback` GitLab OAuth callback (token exchange)
  - GET `/api/auth/gitlab/connect` GitLab OAuth connect (link account)
  - POST `/api/auth/gitlab/disconnect` GitLab account unlink
  - GET `/api/auth/gitlab/status` GitLab connection status
  ```
- Badge branding section (`:136-141`): update "dynamic platform logos (GitHub, Bitbucket, Codeberg)" → add GitLab.
- Env Variables section (after the Codeberg block `:361-363`):
  ```
  CODEBERG ... (existing)
  GITLAB_CLIENT_ID=              # GitLab OAuth app client ID (optional — GitLab integration disabled without it)
  GITLAB_CLIENT_SECRET=          # GitLab OAuth app secret (optional — server-side only)
  NEXT_PUBLIC_GITLAB_ENABLED=    # Set to "true" to enable GitLab link/unlink in User Menu (optional, disabled by default)
  ```

### 2. `.env.example`
- Add `NEXT_PUBLIC_GITLAB_ENABLED=` (near `:38`) and `GITLAB_CLIENT_ID=` / `GITLAB_CLIENT_SECRET=` (near `:44-46`), mirroring the Codeberg lines.

### 3. `apps/web/app/layout.tsx:104` — add "GitLab" to the SEO `keywords` array (alongside Bitbucket/Codeberg).

### 4. `apps/web/app/llms.txt/route.ts` (`:7, 33, 48`) and `apps/web/app/llms-full.txt/route.ts` (`:9, 100`) — add GitLab to the platform mentions / data-source lists.

## Tests

No new automated tests (docs/copy only). If `llms.txt`/`llms-full.txt` have route tests asserting content, update them to include GitLab.

## Success criteria — ✅ COMPLETE (2026-06-19)

**Automated:**
- [x] `pnpm run lint` green; full suite (454 files / 7736 tests) green.
- [x] `pnpm run typecheck` green.

**Manual:**
- [x] CLAUDE.md GitLab route block + branding list + env block; `.env.example` GitLab lines; layout.tsx keyword; llms.txt + llms-full.txt platform mentions (incl. keyword lists).

Implemented in worktree `gitlab-foundation`. Reviewer: PASS (7/7 docs items). CLAUDE.md route block reads identically to the Bitbucket/Codeberg blocks.
