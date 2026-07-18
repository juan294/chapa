# Agent Shared Context
> Cross-agent intelligence — agents read this before running and write findings after finishing.
> Pruned automatically to keep the last 3 entries per agent type.
>
> **Rules:**
> 1. Read this file before starting any work
> 2. Write an entry after finishing — use the format below
> 3. Cross-agent recommendations are mandatory
> 4. Maximum 3 entries per agent type — remove the oldest when adding a new one
> 5. Be specific with findings — numbers, file paths, and actionable items

<!-- ENTRY:START agent=documentation timestamp=2026-07-03T10:00:00Z -->
## Documentation Agent — 2026-07-03
- **Status**: GREEN
- Stale docs: 0 | Missing docs: 0 | Env var mismatches: 0
- Route coverage: **88 filesystem routes (34 `page.tsx` + 54 `route.ts`) — 100% documented in CLAUDE.md**. HEAD `8516b06b` (v1.25.0 sync). Experiment pages covered by documented `GET /experiments/*` wildcard. `POST /api/challenge` (added #933) confirmed present in CLAUDE.md — the 2026-06-26 gap is CLOSED. No undocumented routes, no documented-but-missing routes.
- Design system: **38/38 `--color-*` tokens** in `docs/design-system.md` match `apps/web/styles/globals.css` bidirectionally (comm-verified). Zero drift, zero orphans.
- Env vars: **26 server vars via `lib/env.ts` + 10 `NEXT_PUBLIC_*` + `ANALYZE` all documented** (100%). Every documented var maps to real usage; every `lib/env.ts` var is documented. `NODE_ENV`/`CI`/`VERCEL_*`/`TESTPLATFORM_*`/`PLAYWRIGHT_BASE_URL`/`DEPLOYMENT_SMOKE_STRICT` intentionally omitted (standard/test-only). `X`/`UPPERCASE`/`NEXT_PUBLIC_X` in raw grep are ESLint-literal examples in `env.ts` doc-comments — not real vars. `PostHogProvider.tsx` direct `NEXT_PUBLIC_POSTHOG_*` reads acceptable (client, build-time inlining).
- JSDoc: complex-module functions all documented — `lib/impact/v6.ts` 9/9, `lib/cache/redis.ts` 14/14, `lib/render/BadgeSvg.tsx` full. **P3 carry**: `lib/db/campaigns/types.ts` 5 Zod type exports + schema lack JSDoc (self-explanatory; sibling `types.test.ts` added 2026-07-01).
- Required docs present/non-empty: `impact-v4.md` (131), `impact-v5.md` (152), `impact-v6.md` (289, current truth), `svg-design.md` (173), `design-system.md` (236), `README.md` (228, Quick Start L75).
- `shared-context.md` fresh through 2026-07-03. TODO/FIXME doc-gap scan: 1 false positive (`agent-config.ts:283`, own prompt template). No real gaps.
- Report at `docs/agents/documentation-report.md`.

**Cross-agent recommendations:**
- [QA]: No documentation-related UX issues. All 88 routes documented; no doc changes affect runtime behavior.
- [Security]: No security doc gaps. All `NEXT_PUBLIC_*` vars non-sensitive; server secrets flow through `lib/env.ts`; admin-auth and CORS-scoped routes documented in CLAUDE.md. No undocumented export with security surface.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=documentation timestamp=2026-06-26T10:00:00Z -->
## Documentation Agent — 2026-06-26
- **Status**: YELLOW
- Stale docs: 0 | Missing docs: 1 | Env var mismatches: 0
- Route coverage: **85/86 filesystem routes (85 documented, 1 missing)**. HEAD `1bfc75df` (v2.15.0). Delta since 2026-06-19 cycle: `POST /api/challenge` added by #933 (`app/api/challenge/route.ts`) — **not in CLAUDE.md**. All other routes verified present. Flagged previously by performance (2026-06-25) and coverage (2026-06-26) agents.
- Design system: **38/38 `--color-*` tokens** in `docs/design-system.md` match `apps/web/styles/globals.css` exactly. Zero drift, zero orphans.
- Env vars: **all 35+ production vars documented** (100%). `PostHogProvider.tsx:8-9` direct `NEXT_PUBLIC_*` reads — acceptable (client component, build-time inlining). `CI`/`PLAYWRIGHT_BASE_URL`/`DEPLOYMENT_SMOKE_STRICT` test-only (intentional omissions). All server-side vars flow through `lib/env.ts`.
- JSDoc: P3 carries unchanged — `lib/cache/redis.ts` (`RateLimitResult`, `CacheSetNxStatus` types), `lib/db/campaigns/types.ts` (Zod schema + 5 type exports). All functions documented.
- Required docs all present/non-empty: `impact-v4.md` (131), `impact-v5.md` (152), `impact-v6.md` (289, current truth), `svg-design.md` (173), `README.md` (228).
- TODO/FIXME doc-gap scan: 1 false positive (`lib/agents/agent-config.ts:283`). No real gaps.
- Report at `docs/agents/documentation-report.md`.

**Cross-agent recommendations:**
- [QA]: No documentation-related UX issues. The missing `/api/challenge` entry does not affect runtime behavior.
- [Security]: `/api/challenge` route is authenticated + IP rate-limited (server-side only). No security doc gap; no `NEXT_PUBLIC_*` leak. Verify rate-limit guard in route handler before next security scan.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=cost-analyst timestamp=2026-07-16T03:00:00Z -->
## Cost Analyst — 2026-07-16
- **Status**: GREEN
- Estimated monthly cost at 10K users: **~$50–75/mo**. Unchanged.
- Redis key growth risk: low | Uncached external calls: 0 | Resource leak risks: 0
- **Cost-surface delta since 2026-07-15 cycle**: **LARGE — first non-zero-delta cycle in 5.** HEAD moved `9bfb9a6c` → `a45ae765` (65 commits, v2.18.0 released: hourly warm-cache #1010, badge latency SLO + `latency-check` cron #974, badge critical-path perf #1029, OAuth fail-closed hardening #1027, i18n RSC rearchitecture #1023, snapshot-write reliability #1015/#1016/#1009). Net cost impact: **neutral to positive** — verified by direct build + source inspection, not assumed from commit messages.
- Redis: **43 non-test cache-write call sites across 22 production files** (up from 38/22 on 2026-07-15) — growth is the new `latency-check` heartbeat write + `process-campaigns` round-robin, not sprawl. Default TTL 21,600s (`redis.ts:82`) unchanged. Still exactly **1 intentional TTL-0**: `cron:warm-cache:offset` (`warm-cache/route.ts:169`, small bounded rotation cursor). Hourly warm-cache (#1010) increases *invocation count* 24x/day but the per-run handle ceiling (50) and GitHub-rate-limit math are documented in-code (`warm-cache/route.ts:44-54`) — no new unbounded key pattern.
- Supabase: **11 tables + 2 views, 28 migrations** (latest `028_grant_service_role_access.sql`) — unchanged, no new tables in this delta. Lazy singleton `lib/db/supabase.ts:13` intact. `dbGetCampaignStats` 4-parallel-COUNT P2 carried, unchanged. `reconcileSnapshotWrite` (`lib/profile/snapshot-write.ts`, new/changed this cycle) adds write-outcome tracking, not new query volume.
- External calls: **0 uncached.** All GitHub/Resend paths route through cache-first pipelines. Platform OAuth (Bitbucket/Codeberg/GitLab) connect/callback/disconnect confirmed on fail-closed `rateLimitStrict()` post-#1027 with per-platform replay-resistant state cookie.
- Vercel/bundle: **re-verified via full `pnpm run build` + chunk measurement** (not carried from a stale baseline) — **2,132 KB raw / 638 KB gzipped, 73 chunks**, down from 672 KB gzipped/77 chunks on 2026-07-09 despite the large feature delta. Cause: the #1023 i18n RSC rearchitecture moved 9 pages to `app/[locale]/...` with build-time `generateStaticParams` (both locales pre-rendered as static/SSG in the build output), shrinking rather than growing the client bundle. Largest chunk 228 KB, well under the 350 KB CI gate.
- **Doc/code mismatch found (not a cost issue, flagged for documentation agent)**: CLAUDE.md's badge-latency-SLO section states avatar fetch is capped at "1000ms"; actual code (`lib/render/avatar.ts:33`, unchanged since #961 `7dcf9aea`) uses `AbortSignal.timeout(2000)`. One-line doc fix needed.
- **P1s: NONE. P2s: 1 (`dbGetCampaignStats`, carried). P3s: 1 (doc mismatch above, new).**

**Cross-agent recommendations:**
- [Performance]: Bundle **shrank** on gzip (672→638 KB, 77→73 chunks) despite 65 commits landing, because #1023 moved 9 pages to static/SSG rendering instead of client-bundled. Worth confirming in your next cycle since it runs against the usual "more pages = bigger bundle" assumption.
- [Security]: No new cache-poisoning or rate-limit surface. OAuth platform routes' fail-closed `rateLimitStrict()` + replay-resistant state cookie (#1027) confirmed still in place.
- [Coverage]: New surfaces this cycle worth a coverage spot-check if not already covered: `reconcileSnapshotWrite`'s tri-state outcome tracking and the `latency-check` cron.
- [Documentation]: CLAUDE.md badge-latency-SLO section says avatar timeout is "1000ms" — actual is 2000ms (`avatar.ts:33`). One-line fix, no behavior change.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=cost-analyst timestamp=2026-07-17T03:00:00Z -->
## Cost Analyst — 2026-07-17
- **Status**: GREEN
- Redis key growth risk: low | Uncached external calls: 0 | Resource leak risks: 0
- **The headline is a correction, not a new cost**: per #1052, `vercel.json` sat outside the Vercel Root Directory from project creation (2026-02-10) until 2026-07-16, so **all four crons had never run once**. Every prior cost report in this series — including my own 2026-07-16 entry, which claimed hourly warm-cache "increases invocation count 24x/day" — priced a workload that was not executing. I inspected the config's contents and never verified the jobs actually fired. This is the first cycle where cron spend is real.
- Cost impact of the crons going live: **small and within the standing estimate.** ~810 invocations/mo (720 hourly warm-cache + ~90 dailies). Warm-cache worst case 50 handles × 24 runs = **1,200 GitHub GraphQL calls/day ≈ 1.0%** of the 5,000/hr authenticated budget (1 call per handle — contribution data + authoritative `search(is:merged)` are fields on one request, verified at `queries.ts:54`). **~$50–75/mo at 10K users holds** — it always described the intended state; the system has caught up to it.
- Redis: 44 production write sites, ~27 key patterns. Exactly 3 no-TTL keys, all fixed-cardinality singletons with no per-handle fanout (`cron:warm-cache:offset`, `stats:badges_generated`, `stats:unique_badges` HLL ~12 KB). All per-handle keys ≤7d.
- Supabase: 11 tables + 2 views, 28 migrations, 11/11 ENABLE+FORCE RLS, zero db/migration commits since 2026-07-16. `reconcileSnapshotWrite` = 1 DB round trip per call.
- Bundle: measured **1,993 KB raw / 580 KB gzipped, 73 chunks**, largest 227 KB (gate 350 KB).
- **P1s: NONE. P2s: 2 (one new). P3s: 2.**

**Three claims I carried in prior cycles that are wrong — please stop propagating them:**
1. **`getStats()` has no Redis lock.** Cross-instance GitHub-fetch coalescing does not exist; dedup is an in-process `Map` (`client.ts:33`) only. The Redis lock is in the badge *render* path (`badge.svg/route.ts:95,117`) — different concern.
2. **`dbGetCampaignStats` is not "admin-only, threshold-gated."** All 3 callers are the `process-campaigns` cron batch path (`campaigns.ts:164,188,280`). The ~5,000-send threshold exists only in a docstring (`sends.ts:224-226`), never in code. Still bounded/O(1), so severity is unchanged — the reassuring framing was not.
3. **The `~4%` GitHub-budget figure** at `warm-cache/route.ts:46` doesn't reconcile (1,200/day vs 5,000/hr is a unit mismatch). Real number is ~1%.

**Cross-agent recommendations:**
- [Performance]: My 2026-07-16 report gave you 2,132 KB raw / 638 KB gzipped and you independently matched it; this cycle measures **1,993 KB / 580 KB** on 18 commits that touched no client surface. That gap is almost certainly measurement methodology, not a real shrink — worth one cross-check so we agree on a baseline rather than both drifting. Also: the 638→580 "improvement" should not be attributed to any optimization.
- [Security]: New P2 — `WARM_CACHE_PRIORITY_HANDLES` entries are appended *after* the `MAX_HANDLES` ceiling slice (`warm-cache/route.ts:120-128`), so per-run work is `min(N,50) + |priority handles|`, exceeding the documented ceiling. Env-var-controlled and previously inert (cron never ran); now hourly. Low severity, but it is an unbounded-by-config input to a live job.
- [Coverage]: `schedule.test.ts` asserted `vercel.json`'s *contents* and passed for five months while the file was in a location where nothing read it — its own docstring flagged the gap. #1052 added `check:vercel-config` as a location gate. Generalize: for any config whose effect depends on placement relative to an external system's setting, a contents test is not coverage. Worth auditing whether other config assertions have the same shape.
- [Documentation]: `warm-cache/route.ts:46` says the cron uses "~4%" of the GitHub budget; correct figure is ~1%. One-line fix.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=triage timestamp=2026-07-16T10:00:00Z -->
## Triage -- 2026-07-16
- **Reports processed**: 10 (cost-analyst, performance, coverage, documentation, security, cc-rpi-update no-op, update-docs, qa — all GREEN) plus a full re-verification of `pre-launch-report.md`.
- **Major finding**: `pre-launch-report.md` (2026-07-15, "NOT READY", 33 findings) is **fully historical** — every one of its 33 findings was directly re-verified against live code and confirmed already remediated via the v2.18.0 release (#1008–#1042): osv-scanner replacing pnpm audit (DO-B1/SE-M1), license allowlist (SE-M2), badge latency SLO timings (PE-M1/M2/M3/L1 — `after()`-deferred write, 500ms Redis deadline, ~950ms poll budget, `AVATAR_RACE_DEADLINE_MS=1000` race), snapshot-write tri-state (BE-H1/M1/M2), warm-cache hourly cadence (PE-H1), pending-migrations CI check (DO-H1), latency-check heartbeat (DO-M1), migration rollback runbook section (DO-M2), broadened no-process-env lint (AR-M2), i18n RSC locale segments (FE-H1), `?lang=` live-apply fix (FE-M1), NavbarShell extraction (FE-M2), tArray/tObject accessors (FE-M3), OAuth fail-closed + replay nonce (BE-M3/SE-L1), coverage per-module floors (QA-M1), HeatmapGrid portal tooltip (UX-M1), i18n'd error boundaries (UX-M2), verify/error.tsx teal tokens (UX-L1), InfoTooltip auto-flip (UX-L2), dimension-colors.ts (UX-L3), GitHub parity test extended (AR-M1), 0.15 boundary tests (QA-L1), CONCURRENTLY index policy doc (DO-L1), round-robin campaigns (BE-L2), captureServerError on challenge email failure (BE-L1), test:contract:local script (QA-S1), clean knip.json (AR-L1). Zero new action items from this report — do not re-run its findings as if new in a future cycle; it is a dated point-in-time artifact per update-docs-report.md's own note.
- **False positives caught before acting**: (1) cost-analyst's "avatar timeout doc/code mismatch" (avatar.ts 2000ms vs CLAUDE.md's 1000ms) is not a bug — `avatar.ts:33`'s 2000ms is the underlying fetch abort; the badge route's separate `AVATAR_RACE_DEADLINE_MS=1000` (route.ts:54) is the actual effective cap via `Promise.race`, matching CLAUDE.md exactly. (2) qa-report.md's `/verify/[hash]` "missing h1" re-flag is stale/false — `StatusCallout titleAs="h1"` is present (lines 101, 223), already correctly dismissed as a false positive in the 2026-07-08 cycle; it should not resurface again.
- **Action items resolved**: 5 — (1) closed issue #1006 (`KeyboardShortcutsListener` `next/dynamic` loader coverage gap) via a new `KeyboardShortcutsListener.render.test.tsx` sibling, matching the established `GlobalCommandBarLazy`/`SharePageOwnerContentLazy` precedent exactly; (2) closed `lib/github/stats.ts` fetchStats function-coverage gap (50%→100% funcs) — added a test where `captureServerEvent` rejects and `pullRequests.nodes` is non-empty (all `merged:false`) so the `.filter((n) => n.merged)` callback actually executes rather than short-circuiting on an empty array; (3) closed one of `app/api/admin/campaigns/route.ts`'s two flagged branch gaps (80%→90%) — added tests for the GET `?type=` query param (valid + invalid values); the remaining branch (a `firstIssue?.` defensive optional-chain guarding against a Zod-guaranteed-non-empty `issues` array) is genuinely unreachable and left as an accepted gap, same class as item 5; (4) pinned `knip` as a devDependency (`6.27.0`) per performance-agent's P3 — reproducibility fix only; verified CI's actual two knip invocations (`knip`, `knip --dependencies`, no `--production`) were never broken by the 9 "unused dependency" false positives performance-agent saw under `--production` — an `ignoreDependencies` fix was attempted and reverted after knip itself flagged it as redundant config, since the plain/default scan already resolves these correctly; (5) bumped `vite` 8.1.4→8.1.5 (last item of the pre-launch AR-L2 dev-deps carry, now fully closed).
- **Skipped with justification**: `lib/render/demoData.ts` + `archetypeDemoData.ts`'s 50%-branch gap (`LEVEL_TO_COUNT[...] ?? 0` fallback) — the fallback can only trigger on a grid value outside 0-4, and every literal grid in both files only ever contains 0-4; the builder functions aren't exported, so covering it would require an export added purely for test access. Same class of accepted-unreachable-defensive-code as `stats.ts`'s `firstIssue?.`/`raw.pullRequests?.` chains (both guard against a TypeScript-contract-guaranteed-present value). `dbGetCampaignStats`'s carried P2 (4-parallel-COUNT, bounded/admin-only) — agent's own recommendation remains "not urgent," unchanged across many cycles.
- **`/simplify` (4 parallel agents)**: ran on the coverage-gap diff (route.test.ts, stats.test.ts, new KeyboardShortcutsListener.render.test.tsx) before committing.
- **GitHub alerts**: Code scanning (403) + secret scanning (404) both disabled — GHAS unavailable on this repo's tier, both formally documented in `docs/accepted-risks.md` since the 2026-07-15 cycle (no re-verification needed going forward, just confirm the doc entry stands). Dependabot security alerts: query succeeded, 0 open.
- **Dependabot**: PR #924 (`actions/checkout` 6→7, major) — attempted `gh pr update-branch`, still fails with an unresolved conflict; Dependabot itself now reports an internal "something went wrong" retry state on the PR. Deferred per major-bump policy, unchanged across 9+ cycles, all CI green throughout. Flagged directly to the user this cycle as a candidate for a manual decision (merge via `@dependabot recreate` + manual conflict resolution, or close) rather than looping on it again next cycle.
- **Summary**: The bulk of this cycle's value was verification, not new code — confirming a "NOT READY" pre-launch audit from the day before was in fact fully remediated, and catching two stale/false-positive re-flags (avatar timeout, verify page h1) before wasting a fix cycle on non-bugs. Real work was 5 small, targeted coverage/tooling fixes plus two justified, documented skips.

**Cross-agent recommendations:**
- [Coverage]: Issue #1006 is closed — drop from future carry lists. `lib/github/stats.ts` now 100% funcs. `app/api/admin/campaigns/route.ts` branch coverage 80%→90%; the remaining branch is an accepted unreachable-defensive-code gap, not a new carry. `demoData.ts`/`archetypeDemoData.ts`'s 50%-branch gap is now explicitly documented as an accepted skip (unexported literal-data builder, unreachable fallback) rather than an open item to keep re-flagging.
- [Performance / Architect]: `knip` is now pinned at `6.27.0` in `package.json`. Note for future cycles: CI only ever runs plain `knip` and `knip --dependencies` (both clean) — running `knip --production` locally will keep surfacing the same 9 known false positives (`@resvg/resvg-js`, `@vercel/analytics`, `@vercel/speed-insights`, `canvas-confetti`, `next-themes`, `posthog-js`, `resend`, `server-only`, `svix`); this is a knip production-entry-graph limitation, already manually verified twice now, not a real gap — no `ignoreDependencies` suppression was added since it would only mask CI's actual (unaffected) gates.
- [Cost Analyst]: The avatar-timeout "doc/code mismatch" flagged in your 2026-07-15/07-16 cycles is a false positive — `avatar.ts:33`'s 2000ms and the badge route's `AVATAR_RACE_DEADLINE_MS=1000` (route.ts:54) are two different layers (hard fetch abort vs. soft critical-path race), not a contradiction. Drop from future flags.
- [QA]: The `/verify/[hash]` "no h1" finding in qa-report.md (2026-07-15) is a stale re-flag of something already correctly dismissed in your 2026-07-08 cycle (`StatusCallout titleAs="h1"` is present). Please don't re-surface this specific claim again without a fresh line-by-line read of the current file.
- [Security]: No new findings. GHAS-disabled and axe-core MPL-2.0 accepted-risk entries confirmed still current.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=triage timestamp=2026-07-15T04:30:00Z -->
## Triage -- 2026-07-15
- **Environment fix**: `gh` CLI was broken at session start — a stale x86_64 binary at `/usr/local/bin/gh` shadowed a missing arm64 Homebrew install, failing with "bad CPU type in executable" (exit 127). Reinstalled/relinked via `brew install gh`; now resolves correctly at `/opt/homebrew/bin/gh`, authenticated as `juan294`.
- **Reports processed**: 5 modified this cycle (coverage GREEN, security GREEN, cost-analyst GREEN — 4th consecutive zero-delta cycle, documentation GREEN, cc-rpi-update no-op). All GREEN, no blocking items.
- **Action items resolved**: 1 genuine coverage gap, verified by direct measurement before fixing (coverage-report.md's "0% stmts" claim on `apps/web/app/experiments/error.tsx` + `loading.tsx` was accurate this time — existing sibling `*.test.tsx` files only did `fs.readFileSync` + `.toContain()` string assertions, never actually rendering the component, hence genuine 0% statement coverage despite "having a test"). Added real `@testing-library/react` render tests; confirmed 100% stmts via targeted coverage run.
- **`/simplify` (4 parallel agents)**: reuse + efficiency agents independently found the same issue — the codebase has an established `*.render.test.tsx` split convention (`apps/web/app/error.render.test.tsx`, `loading.render.test.tsx`, `cli/authorize/error.render.test.tsx`, `admin/loading.render.test.tsx`) that keeps jsdom render tests in a sibling file, separate from the plain source-string `.test.tsx` files, so the `jsdom` environment pragma doesn't tax the string-only tests. Split `error.test.tsx`/`loading.test.tsx` back to their original form and added `error.render.test.tsx`/`loading.render.test.tsx` matching the root precedent exactly. Simplification agent's "extract a helper for the duplicated `vi.fn()+render()` setup" suggestion was rejected — the established root `error.render.test.tsx` precedent repeats that same two-line setup per test with no helper, so matching convention took priority over introducing a new local abstraction. Altitude agent's "delete the now-superseded string-assertion tests" suggestion was also rejected — verified the root `error.test.tsx`/`error.render.test.tsx` pair keeps overlapping assertions in both files by design (established, repeated 4x), so trimming would have broken precedent. 8,339/8,339 tests, typecheck + lint clean.
- **Housekeeping**: formally documented two long-standing "accepted permanent limitation" items in `docs/accepted-risks.md` that had been re-verified as unchanged across 7+ prior triage cycles but never actually written down — `axe-core`'s MPL-2.0 license (dev-only) and the GHAS code-scanning/secret-scanning-disabled state (private-repo tier limitation, equivalent coverage via CI Gitleaks + `pnpm audit` + weekly security-agent cycles).
- **GitHub alerts**: Code scanning (403) + secret scanning (404) both disabled — GHAS unavailable on this repo's tier, now formally documented in `docs/accepted-risks.md` (see Housekeeping). Dependabot security alerts: query succeeded, 0 open.
- **Dependabot**: PR #924 (`actions/checkout` 6→7, major) — attempted `gh pr update-branch` to clear the `CONFLICTING`/`DIRTY` merge state; rebase failed with an unresolved conflict. Left commented and deferred (major-bump policy). Now stale across 8+ consecutive cycles with all CI checks green — flagged directly to the user as a candidate for manual merge.
- **Summary**: Fixed a broken `gh` CLI, closed a real (verified, not stale) coverage gap while following the `/simplify` panel's convergent recommendation to match an existing test-file-split convention, and converted two repeatedly-reconfirmed "accepted permanent limitation" verbal notes into actual `accepted-risks.md` entries.

**Cross-agent recommendations:**
- [Coverage]: `apps/web/app/experiments/error.tsx` + `loading.tsx` now both 100% stmts via new `*.render.test.tsx` siblings — drop from future carry lists. Issue #1006 (`KeyboardShortcutsListener.test.tsx` loader gap) remains open, untouched by this cycle.
- [Cost Analyst / Performance]: No cost-surface or bundle-size impact — test-only + two doc-only accepted-risk entries, zero production code changed.
- [Security]: GHAS-disabled state and axe-core MPL-2.0 are now formally documented in `docs/accepted-risks.md` — no more need to re-verify/re-mention as a verbal "accepted permanent limitation" each cycle; just confirm the doc entry is unchanged.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=triage timestamp=2026-07-18T06:00:00Z -->
## Triage -- 2026-07-18
- **Reports processed**: 5 new this cycle (cost-analyst GREEN, coverage GREEN, documentation YELLOW, performance GREEN — knip pin already confirmed done, cc-rpi-update no-op). Every claim was independently re-verified against live source before acting — none taken on trust.
- **Major finding, verified true**: documentation-report.md's YELLOW was accurate. CLAUDE.md still taught the pre-#1050 OAuth token-scoping model backwards (the exact inverse of shipped behavior — "only the user's own OAuth token can repopulate private-repo PRs" when it is in fact the *blinded* one). Confirmed against `client.ts:298-344`'s corrected model and `docs/accepted-risks.md`'s 2026-07-16 entry before editing. Same disproven "search(is:merged) is authoritative" premise (#1045 disproved it) was live in `queries.ts:34-36` and repeated a second time at `queries.ts:111-116` (not separately flagged by documentation-report, caught by the same grep sweep). Fixed all 4 CLAUDE.md/code-comment sites (S1-S4) plus the extra `queries.ts` instance — comment/prose only, no behavior change.
- **Action items resolved (code, TDD)**:
  1. **`WARM_CACHE_PRIORITY_HANDLES` ceiling bypass (cost-analyst P2, carried 2 cycles)** — confirmed real by reading `warm-cache/route.ts:106-128`: priority handles were merged AFTER the `MAX_HANDLES` slice, so per-run work could reach `min(N,50) + |priority|`. Wrote a failing regression test first (200 users, 5 out-of-slice priority handles → 55 processed, confirmed red), then fixed by computing `rotationCeiling = MAX_HANDLES - priorityHandles.length` and threading it through the slice/wrap-around/`nextOffset` logic instead of `MAX_HANDLES` directly. Now genuinely capped at 50/run — CLAUDE.md's existing "50-handle/run ceiling" wording needed no change once the code matched it.
  2. **`warm-cache/route.ts:45` "~4%" → "~1%"** (cost-analyst P3 + documentation S5, both independently flagged the same unit-mismatch: daily total ÷ hourly budget). One-line comment fix.
  3. **`dbGetCampaignStats` 4-parallel-COUNT → 1 query** (cost-analyst P2, carried 7+ cycles as "not urgent"). Rewrote to a single `.select("status")` fetch + JS reduce via the existing `isCampaignSendStatus` guard, instead of a new Postgres RPC/migration — caller is cron-only and bounded by one campaign's recipient list, so a schema change wasn't warranted (this tradeoff is presented in the plan and not separately re-litigated here). Rewrote the full test block first (red against the old implementation), then implemented.
  4. **`apps/web/app/[locale]/layout.tsx` 0% stmts** (coverage-report, new gap from #1023) — added `layout.render.test.tsx` covering `generateStaticParams()` and `LocaleSegmentLayout`'s pass-through render. 100% stmts confirmed via targeted coverage run.
- **`/simplify` (4 parallel agents)**: 2 real findings, both applied. Simplification agent caught a dead `rotationCeiling === 0` branch in the warm-cache fix (verified by hand: the wrap-around/plain-slice branches already reduce to `[]` in that case since `offset < allHandles.length` always holds) — removed, 4 branches → 3. Same agent caught a contradictory cast in `dbGetCampaignStats`'s reduce loop (`as { status: CampaignSendStatus }[]` asserted the value already valid, then re-validated it with `isCampaignSendStatus` — one line claimed certainty the next line disproved) — narrowed the cast to `{ status: string }[]` so the guard does the actual work, matching the new "ignores unrecognized status" test. Reuse, efficiency, and altitude agents found nothing to fix. Re-verified full suite after applying (typecheck/lint/test all clean, 8,529/8,529).
- **GitHub alerts**: Code scanning (403) + secret scanning (404) both disabled — unchanged accepted risk, documented in `docs/accepted-risks.md`. Dependabot security alerts: query succeeded, 0 open.
- **Dependabot**: 0 open PRs this cycle (prior #924 `actions/checkout` major-bump carry, open across 9+ cycles, is gone — resolved or closed between 2026-07-16 and this cycle; nothing to process).
- **Summary**: Highest-value work was the CLAUDE.md correction — an agent reading it fresh was learning the exact model that caused the #1045 incident. Both carried cost-analyst P2s (priority-handle ceiling, campaign-stats round-trips) finally landed after sitting 2-7+ cycles as "not urgent," each with a real TDD regression test proving the before-state was broken.

**Cross-agent recommendations:**
- [Documentation]: CLAUDE.md's #1002/#1004 OAuth-scoping sections, the `/api/health` line, the CI Gates list, and the cron section are all now corrected/complete (S1-S6, M1-M3 from your 2026-07-17 report). Drop all 9 from future carry lists. `queries.ts:111-116` had a second instance of the same disproven premise your report didn't catch — worth a repo-wide grep sweep (`rg "authoritative.*search\(is:merged\)|search\(is:merged\).*not.*token-scoped"`) next cycle to confirm nothing else survived.
- [Cost Analyst]: Both carried P2s (priority-handle ceiling, campaign-stats round-trips) are closed with code + tests, not just docs. Your "~4%"→"~1%" P3 is fixed. Bundle-baseline reconciliation with performance (638 vs 580 KB gzip) is still open — that's a measurement-methodology question, not something this cycle touched.
- [Coverage]: `app/[locale]/layout.tsx` is now 100% stmts — drop from carry lists. No other gaps from this cycle's reports needed action.
- [Performance]: `knip` pin confirmed still in place (`package.json`, `6.27.0`) — no regression, nothing to do.
- [Security]: No new findings. GHAS-disabled state and Dependabot-clean status unchanged.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=qa timestamp=2026-06-24T09:00:00Z -->
## QA Agent — 2026-06-24
- **Status**: GREEN
- Tests: 7986/7986 passed across 464 files, 0 failed, 0 skipped
- Type errors: 0
- Lint issues: 0
- A11y issues: 0 — all `<img>` tags have alt; focus-visible global (`globals.css:455`) + 5 production components; campaigns `<tr role="button">` aria-label gap from May 6 now resolved (`campaigns-dashboard.tsx:908`); heading hierarchy correct across all sampled pages; 13 error boundaries + 13 loading states
- Design system: 0 violations. Accepted exceptions unchanged: global-error.tsx, apple-icon.tsx, icon.tsx (static assets), experiments/** (Canvas/WebGL).

**Cross-agent recommendations:**
- [Coverage]: `SharePageH2.test.tsx` exists and covers the i18n H2 wrapper. All critical paths remain ≥96% stmts.
- [Security]: No security-related quality issues. All XSS vectors covered. No hardcoded secrets in production JSX. All interactive elements accessible.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=qa timestamp=2026-05-06T09:00:00Z -->
## QA Agent — 2026-05-06
- **Status**: GREEN
- Tests: 7567/7567 passed across 445 files, 0 failed, 0 skipped
- Type errors: 0
- Lint issues: 0
- A11y issues: 1 low-severity — `<tr role="button" tabIndex={0}>` in campaigns table (`app/admin/campaigns/campaigns-dashboard.tsx:900`) missing `aria-label`. Admin-only surface. All other `<img>` tags have alt, focus-visible in globals.css + 4 production components, heading hierarchy correct, 13 error boundaries, 13 loading states.
- Design system: **0 violations** in production components. Accepted exceptions unchanged: `global-error.tsx`, `apple-icon.tsx`, `icon.tsx` static assets, `experiments/**` Canvas/WebGL.

**Cross-agent recommendations:**
- [Coverage]: Prior P2s (verify, about/scoring, about/verification, cli/authorize pages) confirmed resolved per coverage-agent May 6. Remaining P2s: 7 archetype pages `generateMetadata` runtime tests, `cli/authorize/error.tsx` 0% stmts, `lib/i18n/detect.ts` ~75% branches.
- [Security]: No security-related quality issues. Campaigns `<tr role="button">` missing `aria-label` is a11y only — no data exposure. All XSS vectors and interactive elements covered.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=documentation_agent timestamp=2026-04-24T07:03:08Z -->
## Documentation Agent — 2026-04-24
- **Status**: GREEN
- Stale docs: 0
- Missing docs: 0
- Env var mismatches: 0 (33/33 production vars documented; `TESTPLATFORM_*`, `CI`, `NODE_ENV` intentionally omitted)
- Route coverage: 44/44 API routes + 24/24 pages documented
- Design tokens: 38/38 color tokens in `globals.css` match `docs/design-system.md`
- Required docs present and non-empty: `impact-v4.md`, `impact-v5.md`, `impact-v6.md`, `svg-design.md`, `design-system.md`, `README.md` (215 lines with Quick Start), `shared-context.md` (371 lines, fresh through 2026-04-24)
- TODO/FIXME referencing doc gaps: 0 (1 false positive in agent-config template literal)

**Cross-agent recommendations:**
- [QA]: No user-facing features with doc gaps. All feature-flagged routes (studio, experiments, insights, bitbucket, codeberg) have both CLAUDE.md entries and env var documentation.
- [Security]: No outdated security docs. `docs/accepted-risks.md` present. All `NEXT_PUBLIC_*` vars confirmed non-sensitive and documented. OAuth flows (GitHub, Bitbucket, Codeberg) and HMAC verification (`docs/badge-verification.md`) docs align with current implementation.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=documentation_agent timestamp=2026-05-22T07:26:10Z -->
## Documentation Agent — 2026-05-22
- **Status**: GREEN
- Stale docs: 0
- Missing docs: 0 critical (3 minor design-system table formatting gaps remain — 3rd cycle carry, non-functional)
- Env var mismatches: 0

**Cross-agent recommendations:**
- [QA]: No documentation-related UX gaps. All user-facing routes (33 pages) documented.
- [Security]: No security doc gaps. All env vars (`CHAPA_ALERT_WEBHOOK_URL`, `ADMIN_SECRET`, `CRON_SECRET`, `CHAPA_VERIFICATION_SECRET`, `RESEND_WEBHOOK_SECRET`) documented; `NEXT_PUBLIC_*` vars confirmed non-sensitive. SDK-internal env names surfaced by grep (`SUPABASE_SECRET_KEY`, `RESEND_BASE_URL`, `KV_REST_API_*`, `ICEBERG_TOKEN`) are Next.js / library bundled references, not real app config.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=security timestamp=2026-06-29T09:00:00Z -->
## Security Scanner — 2026-06-29
- **Status**: GREEN
- Vulnerabilities: **0 critical / 0 high / 0 moderate / 0 low** — `pnpm audit` clean across 628 dependencies. Prior esbuild HIGH (GHSA-gv7w-rqvm-qjhr) resolved via `pnpm.overrides` pinning.
- Secret leaks: **none** — no `SUPABASE_SERVICE_ROLE_KEY`/`NEXTAUTH_SECRET`/`ADMIN_SECRET` in any `NEXT_PUBLIC_*` binding. All server secrets through `lib/env.ts`. Only publishable vars public: `NEXT_PUBLIC_POSTHOG_KEY`, feature-flag booleans. No literal API keys/tokens in source.
- License issues: **none** — no GPL/AGPL. MPL-2.0 (`@resvg/resvg-js`, `lightningcss`, `dompurify`) + LGPL-3.0 (`@img/sharp-libvips-darwin-arm64`) all formally accepted in `docs/accepted-risks.md`.
- RLS: **11/11 tables ENABLE + FORCE RLS** (studio_configs added in migration 027). Deny-all-anon policies. Views: SECURITY INVOKER (014).
- CORS: wildcard `*` scoped to 2 read-only rate-limited GETs (`/api/verify/[hash]`, `/api/profile/[handle]`). `cors-mutation-guard.test.ts` CI guard in place.
- XSS: all 7 SVG user-input fields escaped via `escapeXml()` — `handle`/`displayName` (`BadgeSvg.tsx:49,51`), `avatarDataUri` (`:164`), `archetypeText` (`:188`), `tier` (`:245`), `hash`/`date` (`VerificationStrip.ts:13-14`).
- Knip `--production`: 1 finding (`vitest.setup.ts` — false positive). 0 real unused production dependencies.
- **P3-1 CARRY**: `/api/challenge` handle-level rate limit (3/day) uses fail-open `rateLimit()` at `route.ts:81`; fix is one-line swap to `rateLimitStrict()`. Compensating controls: session auth required + Resend limits.

**Cross-agent recommendations:**
- [Coverage]: No security-relevant coverage gaps. lib/auth 97.3%, lib/render 99.6% (all SVG escape paths covered), lib/verification 100%.
- [QA]: No security UX issues. CORS wildcard scoped; mutation guard invariant test active. All interactive SVG/markup fields escaped.
- [Triage]: P3 only — swap `rateLimit()` to `rateLimitStrict()` in `apps/web/app/api/challenge/route.ts:81`. No P1/P2 action required.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=performance timestamp=2026-07-02T09:00:00Z -->
## Performance Agent — 2026-07-02
- **Status**: GREEN
- Total First Load JS: **2,079 KB raw / 659 KB gzipped** (76 chunks). **+5 KB raw (+0.2%) / +2 KB gzipped vs 2026-06-25** (2,074 / 657 / 77) — flat, within noise. HEAD `8516b06b` (cc-rpi blueprint v1.25.0 sync + Sonnet 5 CI migration + triage fixes since #933); no meaningful app-code bundle delta despite ~19 intervening commits (#935-#962 fix/feat batch).
- Routes >500 KB: **0**. Routes >300 KB: **0**. Largest chunks 227 / 190 / 110 / 107 / 89 KB raw — all framework/vendor.
- Build: Next 16.2.9 Turbopack, 3.9s compile, 8.8s TypeScript, 0 errors. `pnpm install --frozen-lockfile` clean (lockfile up to date). 89 routes (13 static, 76 dynamic), 67 static pages generated.
- Knip `--production`: **1 finding** — `vitest.setup.ts` (same false positive, test infrastructure). 0 real unused production exports.
- `"use client"` (non-test, anchored): **117** (+4 vs 2026-06-25) — growth spread across the #935-#962 i18n/UX/backend fix batch (aria-label localization, InfoTooltip portal audit, studio config backing store), no single new large client bundle. Key public pages (`/`, `/about`, `/u/[handle]`, archetypes) confirmed server components (0 "use client" in first 3 lines). 7 `next/dynamic` files (Studio, admin, command bar, analytics, instrumentation, share-page owner content).
- Badge route: `maxDuration=35`; success `s-maxage=21600 / SWR=86400`, error `s-maxage=300 / SWR=600`; in-flight dedup (`inflightBadgeRenders` Map, now documented per #946) + Redis lock. 0 uncached external calls.
- Fonts: `next/font/google` (JetBrains Mono + Plus Jakarta Sans), 0 external font requests. CLS: badge fallback `<img>` explicit `width=1200 height=630`; **`LiteYouTubeEmbed` P3 from 2026-06-25 now RESOLVED** — thumbnail `<img>` has explicit `width={480} height={270}` (fixed in 2026-07-01 triage cycle, item 4). `prefers-reduced-motion` present in globals.css.
- `/api/challenge` route doc gap (P3 from 2026-06-25) also RESOLVED — now in CLAUDE.md route table.

**Cross-agent recommendations:**
- [Coverage]: No new performance-critical untested paths. Bundle flat; the #935-#962 fix batch shipped with its own test coverage per coverage agent's stable 96.31% stmts across the same period.
- [Security]: No performance issues with security implications. Badge in-flight dedup + rate limit unchanged. `/api/challenge` fail-open P3 was closed in the 2026-07-01 triage cycle (both IP and handle limiters now `rateLimitStrict()`) — no performance-adjacent security gap remains.
- [QA]: No CLS regressions — the last open CLS item (LiteYouTubeEmbed thumbnail) is now fixed. Bundle flat, no TTI/LCP impact expected.
- [Cost Analyst]: Bundle flat at 2,079 KB raw / 659 KB gzipped (+5 KB noise). M-bundle monitor stays closed — no `ANALYZE=true` run needed this cycle.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=coverage timestamp=2026-06-30T02:00:16Z -->
## Coverage Agent — 2026-06-30
- **Status**: GREEN
- Overall coverage: **96.31% stmts / 92.15% branches / 95.32% funcs / 97.52% lines** on HEAD `e54c7a6b` (cc-rpi blueprint v1.25.0 sync). Test suite **473 files / 8,114 tests**, all passing. Numbers fully stable vs 2026-06-28 and 2026-06-29 — zero regressions, third consecutive identical cycle.
- Critical paths all GREEN: lib/impact 99.6% (98.7% br / 100% fn), lib/render 99.6% (92.3% br / 100% fn), app/api 97.3% (93.5% br / 96.1% fn), lib/db 96.5% (93.3% br / 100% fn), lib/history 98.3%, lib/dashboard 99.2%.
- Only YELLOW module: `lib/gitlab` 75.2% branches — `lib/gitlab/queries.ts` at 71.8% br (24 missed branches). All stmts ≥87.7% throughout.
- Sub-80% stmts: 9 unchanged P3 carries (experiments JSDOM/Canvas/WebGL, next/dynamic lazy wrappers, HolographicOverlay).
- Flaky tests: **0 detected** (clean single run, 8114/8114, 83.88s under --maxWorkers=3).
- Branch gaps to watch: `lib/render/svg-to-png.ts` 66.7% br (Sharp error path, 1 branch), `lib/i18n/provider.tsx` 61.5% br (JSDOM locale-switch, 5 branches), `lib/gitlab/queries.ts` 71.8% br (24 missed — largest single gap).
- Report at `docs/agents/coverage-report.md`.

**Cross-agent recommendations:**
- [Security]: No security-relevant coverage gaps. lib/auth 97.3%, lib/render 99.6% (all SVG escape paths covered), lib/verification 100%. OAuth token-refresh error paths (83–85% br) are integration limitations, not security holes.
- [QA]: 0 flaky tests. Suite stable at 8,114/8,114 across 473 files. No new gaps introduced.
- [Triage]: No P1/P2 items. Three P3 actions carried: (1) `lib/db/campaigns/types.ts` — add `types.test.ts` with Zod `.safeParse()` tests (88.7% stmts, no sibling test); (2) `lib/render/svg-to-png.ts` Sharp error path test (66.7% br, 1 branch); (3) `lib/gitlab/queries.ts` mock-network tests for OAuth error branches (71.8% br, 24 missed).
- [Cost Analyst]: All cost-path modules ≥96% stmts. lib/cache 98.2%, lib/db 96.5%, app/api 97.3% — stable for 3 cycles.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=coverage timestamp=2026-06-29T02:10:00Z -->
## Coverage Agent — 2026-06-29
- **Status**: GREEN
- Overall coverage: **96.31% stmts / 92.15% branches / 95.32% funcs / 97.51% lines** on HEAD `e54c7a6b` (cc-rpi blueprint v1.25.0 sync). Test suite **473 files / 8,114 tests**, all passing. Numbers stable vs 2026-06-28 cycle — no regressions.
- Critical paths all GREEN: lib/impact 99.6% (98.7% br / 100% fn), lib/render 99.6% (92.3% br / 100% fn), app/api 97.3% (93.5% br / 96.1% fn), lib/db 96.5% (93.3% br / 100% fn), lib/platform 100%, lib/dashboard 99.2%.
- Only YELLOW module: `lib/gitlab` 75.2% branches — `lib/gitlab/queries.ts` at 71.8% br (24 missed branches) pulls the module below 80%. All stmts ≥87.7% throughout.
- Sub-80% stmts: 9 unchanged P3 carries (experiments JSDOM/Canvas/WebGL, next/dynamic lazy wrappers, HolographicOverlay).
- Flaky tests: **0 detected** (clean single run, 8114/8114, 92s under --maxWorkers=3).
- Branch gaps to watch: `lib/render/svg-to-png.ts` 66.7% br (Sharp error path, 1 branch), `lib/i18n/provider.tsx` 61.5% br (JSDOM locale-switch, 5 branches), `lib/gitlab/queries.ts` 71.8% br (24 missed — largest single gap).
- Report at `docs/agents/coverage-report.md`.

**Cross-agent recommendations:**
- [Security]: No security-relevant coverage gaps. lib/auth 97.3%, lib/render 99.6% (all SVG escape paths covered), lib/verification 100%. OAuth token-refresh error paths (83–85% br) are integration limitations, not security holes.
- [QA]: 0 flaky tests. Suite stable at 8,114/8,114 across 473 files.
- [Triage]: No P1/P2 items. P3 actions: (1) `lib/db/campaigns/types.ts` — add `types.test.ts` with Zod `.safeParse()` tests (88.7% stmts, no sibling test); (2) `lib/render/svg-to-png.ts` Sharp error path test (66.7% br, 1 branch); (3) `lib/gitlab/queries.ts` mock-network tests for OAuth error branches (71.8% br, 24 missed).
- [Cost Analyst]: All cost-path modules ≥96% stmts. lib/cache 98.2%, lib/db 96.5%, app/api 97.3% — stable.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=security timestamp=2026-07-06T09:00:00Z -->
## Security Scanner — 2026-07-06
- **Status**: GREEN
- Vulnerabilities: **0 critical / 0 high / 0 moderate / 0 low** — `pnpm audit` clean across 1,087 dependencies. Prior dev-only esbuild HIGH/LOW (2026-06-15) remains resolved.
- Secret leaks: **none** — no hardcoded API keys/tokens/passwords in source (grepped `app`/`lib`/`components`/`packages`, only test fixtures matched). No `SUPABASE_SERVICE_ROLE_KEY`/`NEXTAUTH_SECRET`/`ADMIN_SECRET`/`CRON_SECRET`/`CHAPA_VERIFICATION_SECRET`/`RESEND_API_KEY`/`RESEND_WEBHOOK_SECRET`/`CLIENT_SECRET` in any `NEXT_PUBLIC_*` binding.
- License issues: **none** — 0 GPL/AGPL across full dependency tree. Same accepted weak-copyleft set unchanged (MPL-2.0: `@resvg/resvg-js`, `lightningcss`, `dompurify`; LGPL-3.0: `@img/sharp-libvips-darwin-arm64`), all documented in `docs/accepted-risks.md`.
- RLS: **11/11 tables ENABLE + FORCE RLS** confirmed via migration grep (002, 003, 007, 010, 015, 016, 018, 024, 025, 027). Deny-all-anon policies; views `SECURITY INVOKER` (014).
- CORS: wildcard `*` scoped to 2 read-only rate-limited GETs (`/api/verify/[hash]`, `/api/profile/[handle]`); `cors-mutation-guard.test.ts` guard in place, unchanged.
- XSS: all SVG user-input fields escaped via `escapeXml()` — `handle`/`headerName` (`BadgeSvg.tsx:49-52`, both branches escaped), `avatarDataUri` (`:164`), `archetypeText` (`:188`), `tier` (`:245`), `hash`/`date` (`VerificationStrip.ts:13-14`).
- `/api/challenge` rate limiting: **both IP (5/hr) and handle (3/day) limiters confirmed on `rateLimitStrict()`** (`route.ts:24,81`) — the fail-open P3 closed 2026-07-01 has not regressed.
- `server-only` guards: present on all 7 auth/verification modules — unchanged since 2026-06-22 fix.
- Knip `--production`: 2 false positives (`vitest.setup.ts`, `vitest.contract-setup.ts`, test infra). 0 real unused production deps.
- GitHub: Dependabot vulnerability alerts enabled (204 response), 0 open security PRs. #924 (`actions/checkout` 6→7, major, non-security) remains deferred, unchanged.

**Cross-agent recommendations:**
- [Coverage]: No security-relevant coverage gaps. lib/auth 97.3%, lib/render 100% stmts (all escapeXml paths covered), lib/verification 100% per 2026-07-06 coverage cycle.
- [QA]: No security UX issues. CORS wildcard scoped; mutation guard test active; all SVG/markup fields escaped.
- [Triage]: No action items this cycle — everything is a confirmation of previously-closed items with zero regressions.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=security timestamp=2026-07-13T09:00:00Z -->
## Security Scanner — 2026-07-13
- **Status**: GREEN
- Vulnerabilities: **0 critical / 0 high / 0 moderate / 0 low** — `pnpm audit` clean across 628 dependencies. HEAD `9bfb9a6c` (unchanged since 2026-07-10; only uncommitted `docs/agents/*.md` edits in tree — zero production code delta).
- Secret leaks: **none** — no hardcoded API keys/tokens/passwords in `apps/web` (only `lib/test-helpers/platform-auth-fixtures.ts` `test-*` fixtures matched). No `SUPABASE_SERVICE_ROLE_KEY`/`NEXTAUTH_SECRET`/`ADMIN_SECRET`/`CRON_SECRET`/`*_CLIENT_SECRET` in any `NEXT_PUBLIC_*` binding. Only public var: `NEXT_PUBLIC_POSTHOG_KEY` (publishable, `env.ts:84`).
- License issues: **none** — scanned 373 pkgs in pnpm store, **0 GPL/AGPL/SSPL/EUPL/CDDL/OSL**. Weak-copyleft (MPL/LGPL: `dompurify` dual-Apache, `lightningcss`, `axe-core` dev-only, `@resvg/resvg-js`, `@img/sharp-libvips-*`) all documented in `docs/accepted-risks.md`.
- RLS: **11/11 tables ENABLE + FORCE RLS** (users, user_platforms, metrics_snapshots, verification_records, tool_insights, merge_operations, feature_flags, studio_configs, supplemental_stats, email_campaigns, campaign_sends).
- CORS: wildcard `*` scoped to 2 read-only rate-limited GETs (`/api/profile/[handle]`, `/api/verify/[hash]`); `cors-mutation-guard.test.ts` guard active.
- XSS: all SVG user-input fields escaped via `escapeXml()` — `handle` (`BadgeSvg.tsx:49`), `displayName` (`:51`), `avatarDataUri` (`:164`), `archetypeText` (`:188`), `tier` (`:245`), `hash`/`date` (`VerificationStrip.ts:13-14`).
- Knip `--production`: 2 false positives (`vitest.setup.ts`, `vitest.contract-setup.ts`). 0 real unused production deps.

**Cross-agent recommendations:**
- [Coverage]: No security-relevant coverage gaps — lib/auth 97.3%, lib/render 100% stmts (all escapeXml paths), lib/verification 100% per latest coverage cycle.
- [QA]: No security UX issues. CORS wildcard scoped; mutation guard test active; all SVG/markup fields escaped.
- [Triage]: No P1/P2/P3 action items — a clean confirmation cycle. Optional housekeeping: add `axe-core` MPL-2.0 (dev-only) to `docs/accepted-risks.md` for completeness.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=qa_agent timestamp=2026-06-24T07:06:53Z -->
## QA Agent — 2026-06-24
- **Status**: GREEN
- Tests: 7977/7977 passed across 464 files, 0 failed, 0 skipped
- Type errors: 0
- Lint issues: 0
- A11y issues: 0 — all `<img>` tags have alt; focus-visible global + 5 production components; campaigns `<tr role="button">` aria-label gap from May 6 is now resolved; heading hierarchy correct across all sampled pages; 13 error boundaries + 13 loading states

**Cross-agent recommendations:**
- [Coverage]: `SharePageH2.test.tsx` exists and closes the prior H2 wrapper gap. All other critical paths remain ≥96% stmts.
- [Security]: No security-related quality issues. All XSS vectors covered. Interactive elements accessible. No hardcoded secrets or token leaks observed in production JSX.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=cost_analyst timestamp=2026-07-06T01:03:24Z -->
## Cost Analyst — 2026-07-06
- **Status**: GREEN
- Redis key growth risk: low
- Uncached external calls: 0
- Resource leak risks: 0 (1 documented accepted-risk: bounded in-flight badge-render Map)

**Cross-agent recommendations:**
- [Performance]: No app-code delta since 2026-07-05 (HEAD unchanged at `09666b59`) — bundle figure (2,079 KB raw / 659 KB gzipped, 77 chunks) still current, no re-measurement needed until new commits land.
- [Security]: No new rate-limit gaps. `/api/challenge` strict limiters (IP + handle) confirmed still in place at `sends.ts`/`route.ts` level checked this cycle.
- [Coverage]: `dbGetCampaignStats` (`lib/db/campaigns/sends.ts:231-271`) and the badge in-flight dedup Map are both cost-sensitive paths — confirm they remain covered if either file is touched in a future change.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=qa_agent timestamp=2026-07-08T07:04:26Z -->
## QA Agent — 2026-07-08
- **Status**: GREEN
- Tests: 8326/8326 passed across 485 files, 0 failed, 0 skipped, 0 flakes (66.9s, --maxWorkers=3)
- Type errors: 0
- Lint issues: 0
- A11y issues: 0 — all `<img>` have alt; both `role="button"` usages (`campaigns-dashboard.tsx:903`, `ActivityHeatmap.tsx:567`) carry aria-labels + keyboard handlers; focus-visible global + 8 production components; verify/[hash] h1 rendered via `StatusCallout titleAs="h1"` (heuristic false positive, do not re-flag); 13 error boundaries + global-error + 13 loading states + not-found

**Cross-agent recommendations:**
- [Coverage]: Confirms your 2026-07-08 findings from the QA angle — `ClientErrorReporter.tsx` (~61% br) and `ClientInstrumentation.tsx` (no sibling test) are the only weak spots in the client error/telemetry UX surface; both JSDOM-testable. Suite grew 8,251 → 8,326 (+75) since your run, still 0 flakes.
- [Security]: No security-related quality issues. All interactive elements accessible, no hardcoded hex/secrets in production JSX, design-system exceptions unchanged (global-error/icons/experiments). Nothing new for your next scan.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=performance timestamp=2026-07-09T09:00:00Z -->
## Performance Agent — 2026-07-09
- **Status**: GREEN
- Total First Load JS: **2,128 KB raw / 672 KB gzipped** (77 chunks). **+49 KB raw (+2.4%) / +13 KB gzipped vs 2026-07-02** (2,079 / 659 / 76) — re-baseline after the #982 landing refactor + v2.17.0 observability batch (#974/#975/#976), as cost-analyst requested. Below the 2,300 KB `ANALYZE=true` trigger. HEAD `b16274ba`.
- **Landing `/` confirmed static**: builds as `○` with `force-static` + `revalidate 3600` — the highest-traffic route is now CDN/ISR-served. The #982 pattern is sound: `app/page.tsx` stays a server component, renders the demo badge SVG at build time and passes the string prop, so `renderBadgeSvg`/`demoData` never enter the client bundle; `LandingPageClient.tsx` (501 lines) imports only lightweight i18n/nav/CTA components.
- Routes >500 KB: **0**. Routes/chunks >350 KB (CI budget): **0**. Largest chunks 227 / 190 / 109 / 107 / 88 KB raw — all framework/vendor.
- Build: Next 16.2.9 Turbopack, 4.6s compile, 8.7s TypeScript, 0 errors; `pnpm install --frozen-lockfile` clean. 90 routes, 68 static pages in 848ms.
- Unused exports: **0** — knip `--production` shows only the 2 known test-infra false positives (`vitest.setup.ts`, `vitest.contract-setup.ts`).
- `"use client"` (non-test): **125** (+8) — from the #982 split + error/telemetry client-surface tests. Key public pages all server components. 11 `next/dynamic`/`import()` files; no sync imports of heavy libs anywhere.
- Badge route: `maxDuration=35`; success `s-maxage=21600/SWR=86400`, error `300/600`; **new #974 `Server-Timing` header** on every response + daily `/api/cron/latency-check` synthetic enforcing p95 800ms hit / 3000ms miss — badge latency is now continuously observable.
- Fonts: `next/font/google`, `display:swap`, 0 external requests. CLS: badge fallback `<img>` 1200×630 + skeleton; LiteYouTubeEmbed 480×270 fix holding; `prefers-reduced-motion` present. #982 locale flash is a content-swap, not a layout shift (same-layout Spanish shell) — accepted per documented i18n architecture.

**Cross-agent recommendations:**
- [Coverage]: No new performance-critical untested paths — #974/#975/#976 all shipped with sibling tests per your 2026-07-09 run. Nothing bundle-driven to cover.
- [Security]: No performance issues with security implications. Badge dedup + rate limiting unchanged; `latency-check` cron is CRON_SECRET-gated; `Server-Timing` exposes only duration metrics, no internals worth redacting.
- [QA]: No CLS regressions. Only new user-visible timing artifact is the #982 landing locale flash for non-`es` users (documented tradeoff, content-swap only) — worth an eyeball if you smoke-test the landing page, but no action expected.
- [Cost Analyst]: Re-baseline delivered per your 2026-07-09 ask: **2,128 KB raw / 672 KB gzipped**, and `/` confirmed static in build output — the invocation-count win is real. New baseline supersedes 2,079/659; trigger stays 2,300 KB raw.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=coverage_agent timestamp=2026-07-15T00:03:52Z -->
## Coverage Agent — 2026-07-15
- **Status**: GREEN
- Overall coverage: 96.70% stmts / 92.78% branches / 95.57% funcs / 97.89% lines (8,335 tests / 485 files, all passing, 77.1s under --maxWorkers=3)
- Critical gaps: none on critical paths — lib/impact 99.6%, lib/render 100% stmts, app/api 97.5%, lib/db 97.3%. Sub-80% files are all flag-gated experiments/JSDOM-limited P3 carries plus two trivial 0% files (`app/experiments/error.tsx`, `app/experiments/loading.tsx`). Notable: `lib/gitlab` branch gap from June cycles (71.8% br in queries.ts) is RESOLVED — module now 100% stmts / 97.2% br; drop from carry lists.
- Flaky tests: 0

**Cross-agent recommendations:**
- [Security]: No security-relevant coverage gaps — lib/auth 97.3%, lib/render 100% stmts (all `escapeXml()` paths covered), lib/verification 100%, lib/cache 97.1%. The `/api/challenge` route and rate-limiter paths remain fully covered under app/api's 97.5%.
- [QA]: Suite grew 8,326 → 8,335 (+9) since your 2026-07-08 run, still 0 flakes and 0 failures. `dynamic-mock.ts` helper (66.7% br) is test infra only; issue #1006 still tracks the `KeyboardShortcutsListener.test.tsx` loader gap. The two 0% experiments files (`error.tsx`/`loading.tsx`) are one-line render tests if you want the pages module fully green.
- [Triage]: gitlab/queries.ts branch carry and the GlobalCommandBarLazy/SharePageOwnerContentLazy items are all confirmed closed — no P1/P2 items this cycle.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=qa_agent timestamp=2026-07-15T07:04:43Z -->
## QA Agent — 2026-07-15
- **Status**: GREEN
- Tests: 8450/8450 passed across 495 files (0 failed, 0 skipped, 63s)
- Type errors: 0
- Lint issues: 0
- A11y issues: 1 low-severity — `app/verify/[hash]/page.tsx` has no `<h1>` (title at line 107 is a styled `<p>`; section headings start at `<h2>` lines 155/177). All `<img>` tags have alt; both `role="button"` sites have aria-labels; focus-visible global + 6 components; 14 error boundaries + 13 loading states + not-found.
- Design system: 0 violations — hex colors confined to accepted exceptions (icon.tsx, apple-icon.tsx, global-error.tsx, experiments/**, badge renderer).

**Cross-agent recommendations:**
- [Coverage]: Suite grew 8,335 → 8,450 (+115 tests, +10 files) since your 2026-07-15 run — likely post-triage additions; re-baseline counts next cycle. No new failing or flaky tests observed.
- [Security]: No security-related quality issues. No hardcoded hex/secrets in production JSX, no onClick-on-div patterns, CORS/XSS surfaces untouched this cycle (verified zero production-code delta vs cost-analyst's report).
<!-- ENTRY:END -->

<!-- ENTRY:START agent=coverage_agent timestamp=2026-07-16T00:58:31Z -->
## Coverage Agent — 2026-07-16
- **Status**: GREEN
- Overall coverage: 96.7% stmts / 92.79% branches / 95.55% funcs / 97.9% lines (8483/8483 tests, 496/496 files passing)
- Critical gaps: none in `lib/impact/`, `lib/render/`, `app/api/`, `lib/db/` (all ≥84% across every metric). Only 5 files project-wide <80% stmts, all known accepted P3 carries (locale layout `generateStaticParams`, HolographicOverlay, 3 experiments/Canvas pages). Minor P3 branch/func gaps: `lib/github/stats.ts` (50% funcs), `app/api/admin/campaigns/route.ts` (80% branches), `lib/render/{demoData,archetypeDemoData}.ts` (50% branches each).
- Flaky tests: 0 confirmed. One transient `[vitest-pool-runner]` worker-timeout infra flake (8 files) on an initial run under system load; did not reproduce on clean re-run — infra, not code.

**Cross-agent recommendations:**
- [Security]: No security-relevant coverage gaps. lib/auth 97.4% stmts, lib/render 100% stmts (all XSS-escape paths covered).
- [QA]: Suite fully green at 8483/8483 across 496 files. If CI ever shows a `[vitest-pool-runner]: Timeout waiting for worker to respond` failure, treat as infra/resource flake and retry rather than a code regression — reproduced once under heavy concurrent background load, not on a clean run.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=cost_analyst timestamp=2026-07-16T01:05:12Z -->
## Cost Analyst — 2026-07-16
- **Status**: GREEN
- Redis key growth risk: low
- Uncached external calls: 0
- Resource leak risks: 0

**Cross-agent recommendations:**
- [Performance]: Bundle actually **shrank** on gzip (672 KB → 638 KB, 77→73 chunks) despite the i18n RSC rearchitecture (#1023) landing 9 pages under `app/[locale]/...` with build-time `generateStaticParams` for both locales — worth confirming in your next bundle-size cycle since it contradicts the usual "more pages = bigger bundle" assumption (these pages moved server-side/static instead).
- [Security]: OAuth platform connect/callback/disconnect routes (Bitbucket/Codeberg/GitLab) confirmed on fail-closed `rateLimitStrict()` post-#1027, alongside the existing replay-resistant per-platform state cookie — no cost-driven rate-limit gap found.
- [Coverage]: No cost-critical path regressions found in this delta; `reconcileSnapshotWrite`'s tri-state outcome tracking and the new `latency-check` cron are both new surfaces worth a coverage spot-check if not already covered.
- [Documentation]: CLAUDE.md's badge-latency-SLO section states the avatar fetch timeout is "1000ms" — actual code (`avatar.ts:33`) is 2000ms, unchanged since #961 (predates the #1029 doc language). One-line doc fix, no behavior change.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=performance timestamp=2026-07-16T09:00:00Z -->
## Performance Agent — 2026-07-16
- **Status**: GREEN
- Total First Load JS: **2,132 KB raw / ~638 KB gzipped** (73 chunks) — flat, matches cost-analyst's independent 2026-07-16 measurement (672→638 KB gzip drop from 2026-07-09 attributed to #1023 i18n RSC rearchitecture moving 9 pages to static/SSG, confirmed by both agents independently).
- Routes >500 KB: **0**. Routes >350 KB (CI gate): **0**. Largest chunks 228 / 192 / 112 / 108 / 92 KB raw — all framework/vendor.
- Build: `pnpm install --frozen-lockfile` clean, Turbopack compile 4.3s, TypeScript 10.1s, 0 errors, 81 routes, 9 locale-segmented pages confirmed SSG (`●`, both `en`/`es` pre-rendered).
- **Knip `--production` (v6.27.0, unpinned) regression this cycle**: flagged 9 "unused dependencies" (`@resvg/resvg-js`, `@vercel/analytics`, `@vercel/speed-insights`, `canvas-confetti`, `next-themes`, `posthog-js`, `resend`, `server-only`, `svix`) — all manually verified via grep as genuinely imported in production source (false positives). Root cause: `knip` is not a pinned devDependency, so `npx knip` silently runs whatever is latest on the registry each cycle; this cycle's version changed detection behavior. **P3 recommendation: pin `knip` in package.json.**
- `"use client"` (non-test): 108. `next/dynamic` usages: 8. Key public pages confirmed server components — no regressions.
- Badge route: cache headers unchanged (`s-maxage=21600/SWR=86400` success, `300/600` error), `Server-Timing` header confirmed present (#974).
- Fonts: `next/font/google`, 0 external font requests. CLS: badge fallback `<img>` 1200×630, `LiteYouTubeEmbed` 480×270 — both unchanged/healthy. `prefers-reduced-motion` present.
- Report at `docs/agents/performance-report.md`.

**Cross-agent recommendations:**
- [Coverage]: No untested performance-critical paths found this cycle — bundle, caching, and CLS surfaces unchanged since 2026-07-09.
- [Security]: No performance issues with security implications this cycle. Badge route cache headers and Server-Timing instrumentation unchanged.
- [QA]: No UX performance concerns — no CLS regressions, fonts render via next/font with zero external requests.
- [Triage / Cost Analyst]: New P3 — `knip` is unpinned (bare `npx knip`), causing a false-positive regression this cycle (9 "unused deps" that are all actually used, verified by hand). Recommend adding `knip` as a pinned devDependency so future cycles don't have to re-verify the same false positives from scratch.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=performance_agent timestamp=2026-07-16T07:03:19Z -->
## Performance Agent — 2026-07-16
- **Status**: GREEN
- Total First Load JS: 2,132 KB raw / ~638 KB gzipped (73 chunks) — matches cost-analyst's 2026-07-16 figure via independent measurement
- Routes >500KB: 0
- Unused exports: 0 real (knip flagged 9 dependencies + 2 files this cycle; all 9 dependencies manually verified as false positives — genuinely imported in production source. Root cause: knip isn't version-pinned, latest v6.27.0 changed detection behavior. Recommend pinning.)

**Cross-agent recommendations:**
- [Coverage]: No untested performance-critical paths found this cycle — bundle, caching, and CLS surfaces unchanged since 2026-07-09.
- [Security]: No performance issues with security implications this cycle. Badge route cache headers and Server-Timing instrumentation unchanged.
- [QA]: No UX performance concerns — no CLS regressions, fonts render via next/font with zero external requests.
- [Triage / Cost Analyst]: New P3 — `knip` is unpinned (bare `npx knip`), causing a false-positive regression this cycle (9 "unused deps" that are all actually used). Recommend adding `knip` as a pinned devDependency so future cycles don't have to re-verify the same false positives.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=cost_analyst timestamp=2026-07-17T01:09:13Z -->
## Cost Analyst — 2026-07-17
- **Status**: GREEN
- Redis key growth risk: low | Uncached external calls: 0 | Resource leak risks: 0
- **The headline is a correction, not a new cost**: per #1052, `vercel.json` sat outside the Vercel Root Directory from project creation (2026-02-10) until 2026-07-16, so **all four crons had never run once**. Every prior cost report in this series — including my own 2026-07-16 entry, which claimed hourly warm-cache "increases invocation count 24x/day" — priced a workload that was not executing. I inspected the config's contents and never verified the jobs actually fired. This is the first cycle where cron spend is real.
- Cost impact of the crons going live: **small and within the standing estimate.** ~810 invocations/mo (720 hourly warm-cache + ~90 dailies). Warm-cache worst case 50 handles × 24 runs = **1,200 GitHub GraphQL calls/day ≈ 1.0%** of the 5,000/hr authenticated budget (1 call per handle — contribution data + authoritative `search(is:merged)` are fields on one request, verified at `queries.ts:54`). **~$50–75/mo at 10K users holds** — it always described the intended state; the system has caught up to it.
- Redis: 44 production write sites, ~27 key patterns. Exactly 3 no-TTL keys, all fixed-cardinality singletons with no per-handle fanout (`cron:warm-cache:offset`, `stats:badges_generated`, `stats:unique_badges` HLL ~12 KB). All per-handle keys ≤7d.
- Supabase: 11 tables + 2 views, 28 migrations, 11/11 ENABLE+FORCE RLS, zero db/migration commits since 2026-07-16. `reconcileSnapshotWrite` = 1 DB round trip per call.
- Bundle: measured **1,993 KB raw / 580 KB gzipped, 73 chunks**, largest 227 KB (gate 350 KB).
- **P1s: NONE. P2s: 2 (one new). P3s: 2.**

**Three claims I carried in prior cycles that are wrong — please stop propagating them:**
1. **`getStats()` has no Redis lock.** Cross-instance GitHub-fetch coalescing does not exist; dedup is an in-process `Map` (`client.ts:33`) only. The Redis lock is in the badge *render* path (`badge.svg/route.ts:95,117`) — different concern.
2. **`dbGetCampaignStats` is not "admin-only, threshold-gated."** All 3 callers are the `process-campaigns` cron batch path (`campaigns.ts:164,188,280`). The ~5,000-send threshold exists only in a docstring (`sends.ts:224-226`), never in code. Still bounded/O(1), so severity is unchanged — the reassuring framing was not.
3. **The `~4%` GitHub-budget figure** at `warm-cache/route.ts:46` doesn't reconcile (1,200/day vs 5,000/hr is a unit mismatch). Real number is ~1%.

**Cross-agent recommendations:**
- [Performance]: My 2026-07-16 report gave you 2,132 KB raw / 638 KB gzipped and you independently matched it; this cycle measures **1,993 KB / 580 KB** on 18 commits that touched no client surface. That gap is almost certainly measurement methodology, not a real shrink — worth one cross-check so we agree on a baseline rather than both drifting. Also: the 638→580 "improvement" should not be attributed to any optimization.
- [Security]: New P2 — `WARM_CACHE_PRIORITY_HANDLES` entries are appended *after* the `MAX_HANDLES` ceiling slice (`warm-cache/route.ts:120-128`), so per-run work is `min(N,50) + |priority handles|`, exceeding the documented ceiling. Env-var-controlled and previously inert (cron never ran); now hourly. Low severity, but it is an unbounded-by-config input to a live job.
- [Coverage]: `schedule.test.ts` asserted `vercel.json`'s *contents* and passed for five months while the file was in a location where nothing read it — its own docstring flagged the gap. #1052 added `check:vercel-config` as a location gate. Generalize: for any config whose effect depends on placement relative to an external system's setting, a contents test is not coverage. Worth auditing whether other config assertions have the same shape.
- [Documentation]: `warm-cache/route.ts:46` says the cron uses "~4%" of the GitHub budget; correct figure is ~1%. One-line fix.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=documentation timestamp=2026-07-17T10:00:00Z -->
## Documentation Agent — 2026-07-17
- **Status**: YELLOW
- Stale docs: 6 | Missing docs: 3 | Env var mismatches: 0
- **Root cause of this cycle's YELLOW**: CLAUDE.md was last touched **2026-07-15** (`git log -1 -- CLAUDE.md`), one day *before* the #1045–#1054 incident batch. It never received the corrected model, so it still teaches the two false premises that caused the incident. All mechanical checks are perfect; the drift is entirely narrative.
- Route coverage: **90/90 filesystem routes (34 `page.tsx` + 56 `route.ts`) — 100% documented**, verified bidirectionally on HEAD `74bbcff0`. No undocumented routes, no documented-but-missing routes.
- Design system: **38/38 `--color-*` tokens** match `globals.css` bidirectionally (set-diff both directions, not sampled). Zero drift.
- Env vars: **35/35 documented, zero mismatches both directions.** Only direct `process.env` outside `lib/env.ts` is `PostHogProvider.tsx:8-9` (client, build-time inlining — not flagged per policy). `ANALYZE` correctly documented + used at `next.config.ts:5`.
- Required docs all present/non-empty: `impact-v4.md` (131), `impact-v5.md` (152), `impact-v6.md` (318), `svg-design.md` (173), `design-system.md` (240), `README.md` (230, Quick Start L75), `accepted-risks.md` (287).
- JSDoc: no gaps on complex logic — the incident-batch modules (`client.ts`, `stats-integrity.ts`, `snapshot-write.ts`) are the best-documented code in the repo. TODO/FIXME doc-gap scan: 3 hits, **0 real** (agent-config.ts:283 = own prompt template; poll/route.ts:33 = tracked #953; AuthorTypewriter.tsx:23 = a rendered string literal).
- Report at `docs/agents/documentation-report.md`.

**Four stale claims that describe the system backwards — all one-paragraph, no-behavior-change edits:**
1. **CLAUDE.md:157** — *"Only the user's own OAuth token can repopulate private-repo PRs (cron/bulk-recalculate use the server token and cannot)"* is **the exact inverse** of shipped code. `client.ts:302-341` (#1050): `OAUTH_SCOPES` omits `repo`, so the user's session token is the blinded one (140 PRs); the tokenless path falls back to the `repo`-scoped server `GITHUB_TOKEN` (987). `accepted-risks.md:262-266` has the corrected model; CLAUDE.md never got it.
2. **CLAUDE.md:158** — calls the #1004 fetch boundary *"an authoritative `search(is:merged)` count"*. `stats-integrity.ts:114-116` on that premise: **"That premise is false."**
3. **`queries.ts:34-36`** — still asserts *"`search(is:merged)` is not token-scoped"*, directly contradicting `stats-integrity.ts:114-120`, in the file that builds the query.
4. **`client.ts:345-349`** — the `#1002` comment still names the server `GITHUB_TOKEN`/anonymous path as blinded, contradicting the corrected #1050 block **40 lines above it in the same file**.

**Cross-agent recommendations:**
- [Cost Analyst]: **Both your 2026-07-17 flags CONFIRMED** by independent measurement. `warm-cache/route.ts:46`'s "~4%" is a unit mismatch (daily total vs hourly budget); real is 50/hr ÷ 5,000/hr ≈ **1%**. And CLAUDE.md:113's *"50-handle/run ceiling"* is wrong the same way your P2 says — `route.ts:120-128` appends `WARM_CACHE_PRIORITY_HANDLES` **after** the `MAX_HANDLES` slice, so real per-run work is `min(N,50) + |priority handles|`. Both are on my recommendation list. Separately: your avatar-timeout flag (2026-07-15, 2026-07-16) is a **false positive** — triage was right. `avatar.ts:33`'s 2000ms is the hard fetch abort; `AVATAR_RACE_DEADLINE_MS=1000` (`badge.svg/route.ts:54`, raced at `:337-340`) is the effective cap, matching CLAUDE.md. Please drop it.
- [Security]: No security doc gaps, but two items land near your surface. `/api/health` now returns an `insufficient_scope` status and asserts the server `GITHUB_TOKEN` still holds `repo` (`health/route.ts:68-104`, #1047) — **undocumented in CLAUDE.md**, and it is the monitor standing between a token rotation and every badge silently reverting to public-only data. Also `check:vercel-config` (`ci.yml:28`) is a live gate absent from CLAUDE.md's CI Gates list.
- [QA]: No documentation-related UX issues — no user-facing copy is wrong, and no doc finding here changes runtime behavior. All 90 routes documented.
- [Coverage]: Your generalization from the `schedule.test.ts` five-month false-pass ("a contents test is not coverage when placement determines effect") is now enforced for this case by `check:vercel-config`, which asserts *location*. Worth auditing other config assertions for the same shape — I found no other doc claiming a config is loaded, but I check docs, not test semantics.
- [Triage]: The 4 P1s above are pure text fixes with no behavior change; they can ship as one `docs:` commit. Highest value in the repo right now — CLAUDE.md loads into every agent session, so an agent reading it today learns the token-scoping model that caused the incident.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=coverage_agent timestamp=2026-07-18T00:03:16Z -->
## Coverage Agent — 2026-07-18
- **Status**: GREEN
- Overall coverage: 96.72% stmts / 92.85% br / 95.61% fn / 97.92% lines — HEAD `74bbcff0`, 498 files / 8,525 tests, all passing (98.9s, --maxWorkers=3). Up from 96.31% stmts (2026-06-30 baseline); suite grew 8,450 → 8,525 since QA's 2026-07-15 run.
- Critical gaps: only 1 actionable — `apps/web/app/[locale]/layout.tsx` at **0% stmts** (36 lines, #1023 i18n migration; `generateStaticParams` never executed, sibling tests cover `page.tsx` only). Everything else sub-80% is a known accepted carry (HolographicOverlay 50%, 3 experiments Canvas/WebGL pages, demoData branch skips per 2026-07-16 triage). Former largest gap `lib/gitlab/queries.ts` (24 missed br) now CLOSED — lib/gitlab at 100% stmts / 97.2% br.
- Critical paths: lib/impact 99.6/98.7, lib/render 100/93.5, app/api 97.3/94.2, lib/db 97.2/94.5 — all green. Cost-analyst's spot-check request satisfied: `reconcileSnapshotWrite` (lib/profile 96.9%) and `latency-check` cron (app/api) both covered.
- Flaky tests: 0

**Cross-agent recommendations:**
- [Security]: No security-relevant coverage gaps — lib/auth 97.4%, lib/render 100% stmts (all escapeXml paths), lib/verification 100%, OAuth platform modules (bitbucket/codeberg/gitlab) all ≥92.8% stmts with gitlab now fully closed.
- [QA]: One concrete new item: add a render/params test for `app/[locale]/layout.tsx` (0% stmts) following the existing `[locale]/page.render.test.tsx` pattern — it's the file that pre-renders both locales and currently matches the "adjacent test mentions it but never executes it" anti-pattern from the #1052 schedule.test.ts lesson.
- [Triage]: Drop `lib/gitlab/queries.ts` (71.8% br) from carry lists — closed. Sole new P3: `[locale]/layout.tsx` test above.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=cost-analyst timestamp=2026-07-18T03:00:00Z -->
## Cost Analyst — 2026-07-18
- **Status**: GREEN
- Redis key growth risk: low | Uncached external calls: 0 | Resource leak risks: 0
- **Zero-delta cycle**: HEAD still `74bbcff0` (2026-07-16 20:56 CEST); no commits since the 2026-07-17 run. Tree holds only `docs/agents/*.md` edits + an untracked local `.codex/` tool-config dir (24 KB, no cost surface). Per the measurements-not-inferences rule, every figure below was re-measured against live source, not carried.
- Redis: **42 production cache-write call sites across 24 files** (grep excludes tests AND `lib/cache/redis.ts` module-internals — the 2026-07-17 "44" counted the module's 2 stat-singleton writes; methodology, not a code change). Default TTL 21,600s (`redis.ts:82`). Exactly **3 no-TTL keys**, all fixed-cardinality singletons: `cron:warm-cache:offset` (`warm-cache/route.ts:169`), `stats:badges_generated` + `stats:unique_badges` HLL (`redis.ts:295-296`). All per-handle keys ≤7d. OAuth state nonces TTL'd via direct `redis.set` (`oauth-state.ts:68`).
- Supabase: 11 tables + 2 views, 28 migrations. **11/11 ENABLE+FORCE RLS re-verified with a schema-qualified grep** (a naive `TABLE [a-z_]+` grep undercounts to 9 — `public.`-prefixed statements truncate; worth knowing for future audits). Lazy singleton (`supabase.ts:13`), `server-only`, `persistSession:false`. `dbGetCampaignStats` P2 carried with the 2026-07-17 corrected framing (cron-only callers, docstring-only threshold).
- External calls: **0 uncached.** `getStats()` 6h/7d SWR (`client.ts:19-20`) + in-process `_inflight` Map (`client.ts:33`) — and per the 2026-07-17 correction, NO cross-instance Redis lock on the fetch path. Warm-cache GitHub usage ≈ 1% of the 5,000/hr budget; the "~4%" comment (`warm-cache/route.ts:45`) is **still unfixed**.
- Vercel: maxDurations re-verified (badge 35; warm-cache/sync-audience/process-campaigns/bulk-recalculate 300; latency-check 60). Bundle carried from 2026-07-17's measurement (**1,993 KB raw / 580 KB gzipped, 73 chunks**) — zero client-surface commits, a rebuild would measure the identical tree.
- **P1s: NONE. P2s: 2 (both carried, both re-verified still open). P3s: 2 (both carried).**

**Cross-agent recommendations:**
- [Security]: The `WARM_CACHE_PRIORITY_HANDLES` P2 is confirmed still live at `warm-cache/route.ts:119-128` — priority handles merge AFTER the `MAX_HANDLES` slice, so per-run work is `min(N,50) + |priority|` on an hourly job. One-line fix (re-slice after merge); nobody has picked it up in two cycles.
- [Performance]: Bundle-baseline sync request stands from 2026-07-17 (your 638 KB gzip vs my measured 580 KB — methodology, not a shrink). No rebuild this cycle; nothing changed to measure.
- [Documentation]: Your 2026-07-17 confirmation of both my flags is appreciated — but note neither the "~4%" comment (`warm-cache/route.ts:45`) nor the CLAUDE.md "50-handle ceiling" wording has actually been fixed yet; both re-verified still present this cycle. The avatar-timeout flag stays dropped (triage's two-layer explanation accepted, recorded in my report).
- [Coverage]: No cost-sensitive path changed; your 2026-07-18 confirmation that `reconcileSnapshotWrite` and `latency-check` are covered closes my 2026-07-16 spot-check request. Nothing new from me.
<!-- ENTRY:END -->
