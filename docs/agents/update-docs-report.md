# Documentation Update Report
> Generated on 2026-04-25 | Branch: `develop` | Changes since v2.7.2 (118 commits)

## Summary
- 5 documents updated
- 1 diagram node label corrected
- 0 version references updated (already current)
- 0 inline doc blocks updated (none targeted)
- 0 items flagged [NEEDS REVIEW]

## Changes by File

### CHANGELOG.md
Added two missing version entries that were never written after releases shipped:
- `[2.7.2] - 2026-04-04` — craft recompute on `/api/refresh` + correct craft passthrough to impact
- `[2.7.1] - 2026-04-04` — craft recompute from stored raw data on `/api/recalculate`
- Added compare links `[2.7.2]` and `[2.7.1]` at bottom of file

### CLAUDE.md
- Updated `/api/health` route description: added "GitHub API probe" to the parenthetical (was "Redis dbsize + Supabase query"; now "Redis dbsize + Supabase query + GitHub API probe")

### docs/how-it-works.md — Security Model section
Three targeted updates to reflect auth architecture changes shipped since v2.7.0:
- **Token handling table**: GitHub OAuth token storage updated from "Encrypted in session cookie (AES-256-GCM)" to "Supabase `user_platforms` table (server-side only)"
- **OAuth security bullets**: CSRF protection bullet updated to describe Redis-backed one-time-consumption state (with in-memory fallback); token storage bullet rewritten to clarify tokens live in Supabase, not cookies; cookie policy bullet updated to mention centralized `cookie-policy.ts` and localhost dev exception
- **Privacy Guarantees #2**: Updated from "OAuth tokens are encrypted in session cookies with a 24-hour expiry" to reflect server-side database storage

### docs/accepted-risks.md
- Added new entry: **Post-response side effects in badge route** — documents the intentional design of non-blocking side effects (snapshot, analytics, cache, verification record) scheduled via Next.js `after()` and run with `Promise.allSettled` in `runPublicProfileSideEffects`, silent failure behavior, the daily `sideeffects:done:{handle}:{date}` guard, and the current absence of PostHog instrumentation on this path. Severity: Low. Accepted: 2026-04-04.

### docs/chapa-architecture.drawio
- Fixed stale label on "Public Endpoints" cell: `/api/badge` → `/u/:handle/badge.svg` (the badge has never been served from `/api/badge`; correct route is the page-level SVG endpoint)

## Flagged for Review
None. All updates traced directly to code changes.

## Not Updated (checked and current)
- `README.md` — `/api/health` description already lists "Redis/Supabase/GitHub dependency probes"; no other stale content found
- `docs/user-manual.md` — Documents Creator Studio terminal interface (English); Spanish localization affects public-flow pages only (landing, generating, error, verify) which the user manual does not cover
- `docs/impact-v6.md`, `docs/svg-design.md` — No scoring or SVG rendering changes since v2.7.2
- `docs/accepted-risks.md` (existing entries) — All existing risks current; only addition made
