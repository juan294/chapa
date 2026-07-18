# Documentation Report
> Generated: 2026-07-17 | Branch: `develop` | HEAD: `74bbcff0` | Health status: **yellow**

## Executive Summary

Every mechanical check is perfect — **90/90 routes**, **35/35 env vars**, and **38/38 design tokens** match the code bidirectionally, with zero drift in either direction. The problem is narrative, not structural: **CLAUDE.md was last updated 2026-07-15, one day before the #1045–#1054 incident batch landed**, so its scoring/caching sections still teach the two false premises that caused the five-month cron outage and the user-visible score collapse — including a sentence that asserts the exact opposite of shipped behavior. Four of the eight findings are stale text that actively describes the system backwards.

## Route Documentation

All **90 filesystem routes** (34 `page.tsx` + 56 `route.ts`) are documented in CLAUDE.md. Verified bidirectionally — no undocumented routes, no documented-but-missing routes.

| Route group | Count | Documented in CLAUDE.md | Has API docs | Status |
|-------------|-------|------------------------|-------------|--------|
| Pages — locale-segmented (`app/[locale]/*`) | 13 | Yes (canonical unprefixed URLs) | n/a | GREEN |
| Pages — experiments (`/experiments/*`) | 13 | Yes (wildcard entry) | n/a | GREEN |
| Pages — other (`/admin`, `/studio`, `/u/:handle`, `/verify`, `/verify/:hash`, `/cli/authorize`, `/generating/:handle`, `/coming-soon`) | 8 | Yes | n/a | GREEN |
| Auth API (`/api/auth/*`) | 16 | Yes | Yes | GREEN |
| Admin API (`/api/admin/*`) | 12 | Yes | Yes | GREEN |
| Public + authenticated API | 18 | Yes | Yes | GREEN |
| Cron + webhooks (`/api/cron/*`, `/api/webhooks/resend`, `/api/telemetry`) | 6 | Yes | Yes | YELLOW — see S5/S6 |
| Static/meta (`llms.txt`, `llms-full.txt`, `og-image`, `badge.svg`, `security.txt`, `u/:handle/og-image`) | 6 | Yes | Yes | GREEN |

Required docs — all present and non-empty: `impact-v4.md` (131), `impact-v5.md` (152), `impact-v6.md` (318, current truth), `svg-design.md` (173), `design-system.md` (240), `README.md` (230, Quick Start at L75 with `pnpm install`), `accepted-risks.md` (287), `shared-context.md` (519, fresh through 2026-07-17).

## Stale Documentation

**S1 — CLAUDE.md:157 states the inverse of shipped behavior (highest severity).**
The #1002 section ends: *"Only the user's own OAuth token can repopulate private-repo PRs (cron/bulk-recalculate use the server token and cannot)."* Shipped code establishes the opposite. `client.ts:302-341` (#1050) documents that `OAUTH_SCOPES` omits `repo`, so the **user's session token is the blinded one** (140 merged PRs), while the tokenless path falls back to the `repo`-scoped server `GITHUB_TOKEN` (987). The same line's parenthetical — naming *"the warm-cache cron's server `GITHUB_TOKEN`, or an anonymous badge hit"* as the degraded fetches — is backwards for the same reason. `accepted-risks.md:262-266` records the corrected model; CLAUDE.md never received it. This is the precise premise that made a user's own Refresh click the poisoning event.

**S2 — CLAUDE.md:158 propagates the disproven "authoritative search" premise.**
It describes the #1004 fetch boundary as *"an authoritative `search(is:merged)` merged-PR count."* `stats-integrity.ts:114-116` says of that exact premise: **"That premise is false."** Search only returns what the authenticating token can see, so a blinded fetch under-reports both sides and the cross-check silently agrees with itself. Per the postmortem this false premise disarmed the guard, the persist gate, and the heal script simultaneously.

**S3 — `queries.ts:34-36` contradicts `stats-integrity.ts:114-120` in the same subsystem.**
The comment above the query builder still reads: *"Authoritative merged-PR search window — `search(is:merged)` is not token-scoped/capped the way `pullRequestContributions` is."* This is the disproven premise, sitting in the file that actually constructs the query, directly contradicted by `stats-integrity.ts`. Comment-only (no behavior change) but maximally misleading in context.

**S4 — `client.ts:345-349` contradicts the corrected block 40 lines above it.**
The `#1002` comment still names *"server GITHUB_TOKEN in the warm-cache cron, or an anonymous badge request"* as the tokens that cannot see private merges — while the #1050 block at `client.ts:302-341` in the same file establishes those are the private-inclusive ones. One file, two opposing models of the same mechanism.

**S5 — `warm-cache/route.ts:46` GitHub-budget figure doesn't reconcile.**
Comment claims 1,200 calls/day is *"~4% of GitHub's 5,000/hr authenticated budget"* — comparing a daily total against an hourly budget. At 1 GraphQL call per handle, the real figure is 50/hr ÷ 5,000/hr ≈ **1%**. Confirms cost-analyst's 2026-07-17 P3 by independent measurement.

**S6 — CLAUDE.md:113 warm-cache ceiling is not the real ceiling.**
Documented as *"the 50-handle/run ceiling."* `warm-cache/route.ts:120-128` appends `WARM_CACHE_PRIORITY_HANDLES` **after** the `MAX_HANDLES` slice, so actual per-run work is `min(N, 50) + |priority handles|`. Matches cost-analyst's 2026-07-17 P2 from the documentation angle.

## Missing Documentation

**M1 — `check:vercel-config` is a live CI gate absent from CLAUDE.md's CI Gates list.**
Wired at `.github/workflows/ci.yml:28` and `package.json:22`; script at `scripts/check-vercel-config.ts`. Five of six `check:*` scripts are documented — this one, the newest and the direct remediation for a five-month silent outage, is not. It asserts `vercel.json` lives in the Vercel Root Directory (`apps/web`) and that every path inside resolves.

**M2 — The `vercel.json` Root Directory constraint appears nowhere in CLAUDE.md.**
`vercel.json` now correctly lives at `apps/web/vercel.json` (verified; repo-root copy gone). ADR `docs/decisions/2026-07-16-vercel-json-must-live-in-root-directory.md` records the decision, but CLAUDE.md documents all four crons with no hint that their registration depends on file placement — the failure mode that produced no error for five months.

**M3 — CLAUDE.md:76 `/api/health` omits the #1047 `repo`-scope assertion.**
The route now probes whether the server `GITHUB_TOKEN` still carries `repo` and returns a distinct `insufficient_scope` status (`health/route.ts:68-104`), plus a durable Redis grace anchor replacing `PROCESS_STARTED_AT` (which reset on every cold start, so null heartbeats read as healthy). CLAUDE.md lists only the older probes and the `"skipped"` status.

**JSDoc:** no gaps found on complex logic. `lib/impact/v6.ts`, `lib/cache/redis.ts`, `lib/github/{client,stats-integrity,queries}.ts`, and `lib/profile/snapshot-write.ts` all carry thorough function-level docs — the incident-batch modules are, if anything, the best-documented code in the repo. The long-standing P3 (`lib/db/campaigns/types.ts` Zod type exports) remains self-explanatory and unchanged.

**TODO/FIXME doc-gap scan:** 3 hits, **0 real** — `agent-config.ts:283` (this agent's own prompt template), `cli/auth/poll/route.ts:33` (tracked as #953, not a doc gap), `AuthorTypewriter.tsx:23` (a string literal rendered by a typewriter animation).

## Environment Variables

**35/35 documented, zero mismatches in either direction.** Every variable read in `lib/env.ts` appears in CLAUDE.md; every variable in CLAUDE.md's env block is read in code.

| Variable | In CLAUDE.md | Used in code | Status |
|----------|-------------|-------------|--------|
| All 25 server vars (`ADMIN_*`, `*_CLIENT_ID/SECRET`, `CRON_SECRET`, `SUPABASE_*`, `UPSTASH_*`, `RESEND_*`, `GITHUB_TOKEN`, `CHAPA_*`, `WARM_CACHE_PRIORITY_HANDLES`, `SUPPORT_FORWARD_EMAIL`, `NEXTAUTH_SECRET`, `ALLOW_AGENT_RUN`) | Yes | Yes — via `lib/env.ts` accessors | GREEN |
| All 9 `NEXT_PUBLIC_*` vars | Yes | Yes — static literals in `lib/env.ts` (required for Next.js inlining, #918) | GREEN |
| `ANALYZE` | Yes | Yes — `next.config.ts:5` (build config, outside `lib/env.ts` by design) | GREEN |
| `NODE_ENV`, `VERCEL_ENV` | Documented as auto-injected | Yes — via `lib/env.ts` | GREEN |
| `PostHogProvider.tsx:8-9` direct `NEXT_PUBLIC_POSTHOG_*` reads | n/a | Client component | GREEN — not flagged per policy (build-time inlining) |

## Design System

**38/38 `--color-*` tokens match `apps/web/styles/globals.css` bidirectionally.** Zero undocumented tokens, zero orphaned entries. Verified by set-diff in both directions, not by sampling.

## Recommendations

Prioritized. S1–S4 are all one-paragraph edits with no behavior change, but they are the highest-value documentation work available in this repo right now: CLAUDE.md is loaded into every agent session, so an agent reading it today learns the model of token scoping that caused the incident.

1. **[P1] Fix CLAUDE.md:157 (S1)** — rewrite the #1002 section's token-scoping claim to match `client.ts:302-341` and `accepted-risks.md:262-266`: the server `GITHUB_TOKEN` is `repo`-scoped and private-inclusive; the user's OAuth token omits `repo` and is the blinded one. Delete the final sentence entirely — it is backwards, not merely imprecise.
2. **[P1] Fix CLAUDE.md:158 (S2)** — drop "authoritative" from the `search(is:merged)` description and state that search *is* token-scoped, so the fetch boundary tests only the payload's internal shape (per `stats-integrity.ts:114-125`).
3. **[P1] Fix `queries.ts:34-36` (S3)** — remove the "not token-scoped" premise; it contradicts `stats-integrity.ts` and sits in the query builder itself.
4. **[P1] Fix `client.ts:345-349` (S4)** — align the `#1002` comment with the corrected `#1050` block 40 lines above; one file should not carry two opposing models.
5. **[P2] Add `check:vercel-config` to CLAUDE.md's CI Gates list (M1)** — the only undocumented gate, and the one guarding against silent config non-loading.
6. **[P2] Document the `vercel.json` Root Directory constraint (M2)** — a line in the Cron section pointing at the ADR, so the placement dependency is discoverable from the file agents actually read.
7. **[P2] Update CLAUDE.md:76 for #1047 (M3)** — add the `repo`-scope assertion and `insufficient_scope` status.
8. **[P3] Correct `warm-cache/route.ts:46` "~4%" → "~1%" (S5)** and **CLAUDE.md:113's "50-handle/run ceiling" → `min(N,50) + |priority handles|` (S6)**.

**False positive closed:** cost-analyst's avatar-timeout doc/code mismatch (flagged 2026-07-15 and 2026-07-16) is **not a bug**, confirming triage's 2026-07-16 dismissal by independent measurement. `avatar.ts:33`'s `AbortSignal.timeout(2000)` is the hard fetch abort; the badge route's `AVATAR_RACE_DEADLINE_MS = 1000` (`badge.svg/route.ts:54`, applied via `Promise.race` at `:337-340`) is the effective critical-path cap. CLAUDE.md's "capped at 1000ms" is accurate. Two different layers, not a contradiction — please stop re-flagging.
