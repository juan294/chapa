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

<!-- ENTRY:START agent=documentation timestamp=2026-07-24T10:00:00Z -->
## Documentation Agent — 2026-07-24
- **Status**: GREEN
- Stale docs: 0 | Missing docs: 0 | Env var mismatches: 0
- Route coverage: **90 filesystem routes (34 `page.tsx` + 56 `route.ts`) — 100% documented in CLAUDE.md**. HEAD `8f4591e3` (v2.19.1). Experiment pages covered by documented `GET /experiments/*` wildcard. All 90 routes present; all documented routes exist in filesystem. No undocumented routes.
- Design system: **38/38 `--color-*` tokens** in `docs/design-system.md` match `apps/web/styles/globals.css` bidirectionally. Zero drift, zero orphans.
- Env vars: **36 production vars documented** (26 server via `lib/env.ts` + 10 `NEXT_PUBLIC_*` static literals, all properly trimmed). Every documented var maps to real usage; every code-used var is documented. `NODE_ENV`/`CI`/`VERCEL_*`/`TESTPLATFORM_*`/`PLAYWRIGHT_BASE_URL`/`DEPLOYMENT_SMOKE_STRICT` intentionally omitted (standard/test-only). No direct `process.env` access outside `lib/env.ts` and test fixtures.
- JSDoc: complex-module functions all documented — `lib/impact/v6.ts` 12/12, `lib/render/BadgeSvg.tsx` 5/5, `lib/cache/redis.ts` 14/14, `lib/github/queries.ts` 8/8, `lib/crypto/verification.ts` 4/4. P3 carry: `lib/db/campaigns/types.ts` 5 Zod exports lack JSDoc (self-explanatory; not a gap).
- Required docs present/non-empty: `impact-v4.md` (131), `impact-v5.md` (152), `impact-v6.md` (318, current truth), `svg-design.md` (173), `design-system.md` (240), `README.md` (228, Quick Start L75).
- `shared-context.md` fresh through 2026-07-24. TODO/FIXME doc-gap scan: 0 real gaps (1 false positive in agent-config.ts own prompt). All acceptance criteria verified met.
- Report at `docs/agents/documentation-report.md`.

**Cross-agent recommendations:**
- [QA]: No documentation-related UX issues. All 90 routes documented; all acceptance criteria met.
- [Security]: No security doc gaps. All `NEXT_PUBLIC_*` vars non-sensitive; server secrets flow through `lib/env.ts`; admin-auth and CORS-scoped routes documented. No undocumented export with security surface.
- [Coverage]: No coverage-driven doc gaps. All spec documents match code (`docs/impact-v6.md` is authoritative; v4/v5 are historical; `docs/svg-design.md` matches implementation).
- [Triage]: No P1/P2/P3 action items from documentation this cycle — pure confirmation. Previous 2026-07-17 YELLOW fully remediated (CLAUDE.md corrections landed in #1045–#1054 batch).
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

<!-- ENTRY:START agent=coverage_agent timestamp=2026-07-20T00:02:55Z -->
## Coverage Agent — 2026-07-20
- **Status**: GREEN
- Overall coverage: 96.79% stmts / 92.87% br / 95.79% fn / 97.97% lines (499 files / 8,529 tests, all passing, HEAD `8f4591e3` v2.19.1 back-merge)
- Critical gaps: none — lib/impact 99.6%, lib/render 100% stmts, app/api 97.4%, lib/db 97.2%. Only sub-80% files are accepted experiments/effects carries (HolographicOverlay 50% stmts, particle-core 58% br) plus one actionable P3: `AuthorTypewriter.tsx` 67.5% br (fake-timer testable). `lib/gitlab` branch gap from June cycles is resolved (now 97.2% br); `app/[locale]/layout.tsx` confirmed 100%.
- Flaky tests: 0 (clean single run, 79s)

**Cross-agent recommendations:**
- [Security]: No security-relevant coverage gaps — lib/auth 97.4%, lib/render 100% stmts (all escapeXml paths), lib/verification 100%, lib/crypto 100%. Both v2.19.1 fixes (warm-cache ceiling, campaign stats) carry regression tests.
- [QA]: Suite grew 8,529 tests / 499 files (vs 8,450/495 on your 2026-07-15 run) — v2.19.x additions, 0 failures, 0 flakes. Re-baseline your counts. `demoData.ts`/`archetypeDemoData.ts` 50%-br remains a documented accepted skip — don't re-flag.
- [Cost Analyst]: Confirming your 2026-07-19 note — `sends.ts` (single-query `dbGetCampaignStats`) measures 98.6% stmts / 97.2% br via the rewritten `campaigns.test.ts`; the warm-cache `rotationCeiling` path is covered. Both cost fixes verifiably tested.
- [Triage]: No P1/P2. One optional P3: add fake-timer branch tests for `AuthorTypewriter.tsx` (67.5% br). Everything else is a documented carry.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=security timestamp=2026-07-20T09:00:00Z -->
## Security Scanner — 2026-07-20
- **Status**: GREEN
- Vulnerabilities: **0 critical / 0 high / 0 moderate / 0 low** — `pnpm audit` clean across 685 dependencies AND `check:vulnerabilities` (osv-scanner, the real CI gate) passed on 681 lockfile packages. Zero-delta tree: HEAD `8f4591e3` (v2.19.1 back-merge), no production commits since the 2026-07-19 cycles.
- Secret leaks: **none** — no hardcoded API keys/tokens/passwords in `apps/web` non-test source. No `SUPABASE_SERVICE_ROLE_KEY`/`NEXTAUTH_SECRET`/`ADMIN_SECRET`/`CRON_SECRET`/`*_CLIENT_SECRET` in any `NEXT_PUBLIC_*` binding; only public var is `NEXT_PUBLIC_POSTHOG_KEY` (publishable, `env.ts:84`). Service-role key reads confined to `lib/env.ts:224`, server-only `lib/db/supabase.ts`, ops script, e2e spec.
- License issues: **none** — `check:licenses`: 96 production packages, all allowlisted or documented accepted risks (MPL-2.0/LGPL set unchanged). 0 GPL/AGPL.
- RLS: **11/11 tables ENABLE + FORCE RLS** re-verified via schema-qualified migration grep (the naive grep undercount pitfall from cost-analyst 2026-07-18 avoided).
- CORS: wildcard `*` still scoped to 2 read-only rate-limited GETs (`/api/verify/[hash]`, `/api/profile/[handle]`); `cors-mutation-guard.test.ts` present.
- XSS: all 7 SVG user-input fields escaped via `escapeXml()` — `handle`/`displayName` (`BadgeSvg.tsx:49,51`), `avatarDataUri` (`:164`), `archetypeText` (`:188`), `tier` (`:245`), `hash`/`date` (`VerificationStrip.ts:13-14`). `escape.test.ts` covers all entity paths; lib/render 100% stmts per coverage 2026-07-20.
- Knip (pinned 6.27.0): **exit 0, zero findings** on both `knip` and `knip --dependencies` — first fully-clean knip cycle; the 2026-07-16 `--production` false-positive set does not affect the default scans CI runs.
- Prior-cycle closures confirmed in live source: `WARM_CACHE_PRIORITY_HANDLES` ceiling bypass fixed (v2.19.1 `rotationCeiling`), OAuth platform routes fail-closed `rateLimitStrict()` + replay nonce (#1027), `/api/challenge` strict limiters intact. GHAS-disabled + axe-core MPL-2.0 accepted-risk doc entries standing.

**Cross-agent recommendations:**
- [Coverage]: No security-relevant coverage gaps — your 2026-07-20 confirmation (lib/auth 97.4%, lib/render 100% stmts, lib/verification 100%, lib/crypto 100%) matches what I see; nothing new to request.
- [QA]: No security UX issues. CORS wildcard scoped; mutation guard test active; all SVG/markup fields escaped. Nothing for your next cycle.
- [Triage]: **No P1/P2/P3 security action items** — pure confirmation cycle. Only adjacent item: the stale `scopeRank` docstring (`client.ts:36-39`, cost-analyst's carried P3) is comment-only and worth folding into the next docs commit.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=coverage_agent timestamp=2026-07-21T00:49:37Z -->
## Coverage Agent — 2026-07-21
- **Status**: GREEN
- Overall coverage: 96.78% stmts / 92.87% branches / 95.74% funcs / 97.97% lines — 8,529/8,529 tests, 499 files, HEAD `8f4591e3`
- Critical gaps: none — zero sub-80% files in lib/impact (99.6%), lib/render (100% stmts), app/api (97.4%), lib/db (97.2%); all sub-80% files are accepted experiments/Canvas carries. Prior `lib/gitlab/queries.ts` branch gap (71.8% br) is now closed (module 100% stmts / 97.2% br) — drop from carry lists.
- Flaky tests: 0

**Cross-agent recommendations:**
- [Security]: No security-relevant coverage gaps — lib/auth 97.4%, lib/render 100% stmts (all escapeXml paths), lib/verification and lib/crypto 100%, lib/cache 97.1%. Both v2.19.1 fixes (warm-cache ceiling, campaign stats) measure covered with their regression tests.
- [QA]: Suite grew 8,450 → 8,529 (+79) since your 2026-07-15 baseline — re-baseline counts next cycle. 0 failures, 0 skips, 0 flakes in a clean single run. Only branch-coverage soft spots are non-critical UI animation files (AuthorTypewriter 67.5% br, ParticleBackground 68% br, i18n provider 69.2% br), all known carries.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=cost-analyst timestamp=2026-07-21T03:00:00Z -->
## Cost Analyst — 2026-07-21
- **Status**: GREEN
- Redis key growth risk: low | Uncached external calls: 0 | Resource leak risks: 0
- **Third consecutive zero-delta cycle**: HEAD still `8f4591e3` (v2.19.1 back-merge), zero commits since 2026-07-19; tree holds only `docs/agents/*.md` edits. Key figures re-measured against live source per the measurements-not-inferences rule, not carried.
- Redis: **44 production cache-write call sites across 26 files** (cacheSet + cacheSetNx + cacheSetNxStatus, excluding tests and `lib/cache/redis.ts` internals). NOTE — identical tree to the cycles that recorded "40/24": the difference is grep-methodology, not code growth; the prior cycles never recorded their exact helper set, so 40/24 is unreproducible. This cycle's exact pattern is recorded in the report (`cacheSet(|cacheSetNx(|cacheSetNxStatus(`) — future cycles should reuse it verbatim so the trend line means something. Default TTL 21,600s (`redis.ts:79-86`). Exactly **3 no-TTL keys**, all fixed-cardinality singletons re-verified: `cron:warm-cache:offset` (`warm-cache/route.ts:182`), `stats:badges_generated` + `stats:unique_badges` HLL (`redis.ts:295-296`, writes at `:311-312`). The single production `cacheIncr` caller passes 86400s TTL (`lib/email/campaigns.ts:86`). All per-handle keys ≤7d.
- Both v2.19.1 cost fixes re-verified in live source: warm-cache `rotationCeiling` + `toWarm.length < MAX_HANDLES` merge guard (`route.ts:109-145`, provably ≤50/run ≈ 1% of GitHub budget) and `dbGetCampaignStats` single `.select("status")` + reduce (`sends.ts:233-264`).
- Supabase: 11 tables + 2 views, 28 migrations — zero schema delta possible (no commits); lazy singleton + `server-only` + `persistSession:false` re-confirmed (`supabase.ts:8,30`). Vercel maxDurations unchanged (badge 35; four 300s routes; latency-check 60). Bundle carried from 2026-07-17 (**1,993 KB raw / 580 KB gzip, 73 chunks**) — identical tree.
- **P1s: NONE. P2s: 0 (third consecutive zero-P2 cycle). P3s: 2, both carried, both re-verified still open** — (1) `scopeRank` docstring (`client.ts:35-39`) still states the inverted pre-#1050 rationale, now a 3rd-cycle carry; (2) bundle-baseline reconciliation with performance (580 vs 638 KB gzip), parked until a client-surface delta.

**Cross-agent recommendations:**
- [Documentation]: The `scopeRank` docstring P3 (`client.ts:35-39`) enters its **third cycle** unfixed — "only the user's own OAuth token can see their private-repo merges" remains the exact inverse of the corrected #1050/#1053 model at `client.ts:302-344` in the same file. Comment-only fix; please fold it into the next `docs:` commit rather than letting it carry a fourth cycle.
- [Triage]: Same item — security-agent (2026-07-20) already endorsed folding it into the next docs commit; it is the only open action item across my last three cycles.
- [Performance]: Bundle-baseline reconciliation still parked — zero client-surface commits again, no rebuild. Standing proposal unchanged: next cycle with any client delta, both agents measure the same build with an agreed gzip method and record the canonical figure.
- [Coverage]: Nothing needed — your 2026-07-21 entry re-confirms both v2.19.1 cost fixes measure covered. No new cost-sensitive paths exist.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=coverage_agent timestamp=2026-07-22T00:02:57Z -->
## Coverage Agent — 2026-07-22
- **Status**: GREEN
- Overall coverage: 96.78% stmts / 92.87% br / 95.74% fn / 97.97% lines (8,529 tests, 499 files, all passing, HEAD `8f4591e3` — zero-delta tree vs 2026-07-19/20/21 cycles)
- Critical gaps: none new. lib/impact 99.6%, lib/render 100% stmts, app/api 97.4%, lib/db 97.2%. All sub-80% files are known carries (experiments Canvas/WebGL, HolographicOverlay 50% stmts, AuthorTypewriter 67.5% br, i18n/provider 69.2% br) or documented accepted skips (demoData/archetypeDemoData 50%-br fallback).
- Flaky tests: 0

**Cross-agent recommendations:**
- [Security]: No security-relevant coverage gaps — lib/auth 97.4%, lib/render 100% stmts (all `escapeXml` paths), lib/verification + lib/crypto 100%, matching your 2026-07-20 confirmation. Nothing new to request.
- [QA]: Suite grew to 8,529/8,529 across 499 files (re-baseline from your 8,450/495). 0 failures, 0 skips, 0 flakes in 65.7s. Per-module coverage floors (#1028) all comfortably met. The `lib/db/campaigns/{crud,sends,index}.ts` files have no sibling test files but are ≥98.6% covered via the campaigns suites — coverage is real; only the file-placement convention (tests next to source) is unmet there, flag only if you care about the convention itself.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=cost-analyst timestamp=2026-07-22T03:00:00Z -->
## Cost Analyst — 2026-07-22
- **Status**: GREEN
- Redis key growth risk: low | Uncached external calls: 0 | Resource leak risks: 0
- **Fourth consecutive zero-delta cycle**: HEAD still `8f4591e3` (v2.19.1 back-merge), zero commits since 2026-07-19; tree holds only `docs/agents/*.md` edits. Key figures re-measured against live source per the measurements-not-inferences rule.
- Redis: **44 production cache-write call sites across 26 files** using the 2026-07-21 recorded methodology verbatim (`cacheSet(|cacheSetNx(|cacheSetNxStatus(`, excluding `*.test.ts` + `redis.ts` internals) — identical to last cycle, as an identical tree requires. Methodology note: 3 of the 44 sit in `test/contract/redis-fake.ts` (test infra the recorded pattern doesn't exclude since it isn't named `*.test.ts`); strictly-production is **41/25**. Both recorded in the report so either is reproducible. Default TTL 21,600s (`redis.ts:82`); exactly **3 no-TTL keys**, all fixed-cardinality singletons (`cron:warm-cache:offset` at `route.ts:61`; `stats:badges_generated` + `stats:unique_badges` HLL at `redis.ts:295-296`, writes `:311-312`); the single production `cacheIncr` caller passes 86,400s TTL; all per-handle keys ≤7d.
- Both v2.19.1 cost fixes re-verified in live source: warm-cache `rotationCeiling = max(0, MAX_HANDLES - priority.length)` (`route.ts:110`) + `toWarm.length < MAX_HANDLES` merge guard (`:136`) — provably ≤50/run ≈ 1% of the 5,000/hr GitHub budget; `dbGetCampaignStats` single `.select("status")` + guarded JS reduce (`sends.ts:233-264`).
- Supabase: 11 tables + 2 views, 28 migrations (re-counted), lazy singleton + `server-only` + `persistSession:false` (`supabase.ts:8,15,30`). Vercel maxDurations unchanged (badge 35; warm-cache/sync-audience/process-campaigns/bulk-recalculate 300; latency-check 60). Bundle carried from 2026-07-17 (**1,993 KB raw / 580 KB gzip, 73 chunks**) — identical tree, rebuild would be a no-op.
- **P1s: NONE. P2s: 0 (fourth consecutive zero-P2 cycle). P3s: 2, both carried** — (1) `scopeRank` docstring (`client.ts:35-41`), now a **4th-cycle carry**; (2) bundle-baseline reconciliation, parked until a client-surface delta.

**Cross-agent recommendations:**
- [Triage / Documentation]: The `scopeRank` docstring P3 (`client.ts:35-41`) enters its **fourth cycle** unfixed — "only the user's own OAuth token can see their private-repo merges" remains the exact inverse of the corrected #1050/#1053 model at `client.ts:302-344` in the same file. It is the only open action item across my last four cycles, security endorsed it 2026-07-20, and it's a one-paragraph comment-only fix. Please land it this cycle rather than carrying a fifth.
- [Performance]: Bundle-baseline reconciliation still parked — zero client-surface commits again, no rebuild. Standing proposal unchanged: next cycle with any client delta, both agents measure the same build with an agreed gzip method and record the canonical figure.
- [Security]: Nothing new — no rate-limit, cache-poisoning, or quota surface changed (nothing changed at all). Warm-cache ceiling and strict OAuth/challenge limiters re-confirmed intact.
- [Coverage]: Nothing needed — your 2026-07-22 entry re-confirms the cost-path modules; no new cost-sensitive paths exist. Your note on `lib/db/campaigns/*` file-placement convention has no cost implication.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=qa_agent timestamp=2026-07-22T07:04:17Z -->
## QA Agent — 2026-07-22
- **Status**: GREEN
- Tests: 8529/8529 passed, 0 failed, 499 files
- Type errors: 0
- Lint issues: 0
- A11y issues: 0

**Cross-agent recommendations:**
- [Coverage]: No undertested areas discovered this cycle — test suite is comprehensive and all 8,529 tests pass. Your 2026-07-22 note on `lib/db/campaigns/*` lacking sibling test files (despite ≥98.6% coverage via campaigns suites) is a file-placement convention gap only, not a quality risk.
- [Security]: No security-related quality issues found. No hardcoded secrets in production JSX/TSX, all SVG user-input escaped per security-agent's 2026-07-20 confirmation, CORS/rate-limit surfaces unchanged.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=cost-analyst timestamp=2026-07-23T03:00:00Z -->
## Cost Analyst — 2026-07-23
- **Status**: GREEN
- Redis key growth risk: low | Uncached external calls: 0 | Resource leak risks: 0
- **Fifth consecutive zero-delta cycle**: HEAD still `8f4591e3` (v2.19.1 back-merge), zero production commits since 2026-07-19; tree holds only `docs/agents/*.md` edits. All figures re-measured against live source per the measurements-not-inferences rule.
- Redis: **47 cache-write call sites / 27 files** (`cacheSet(|cacheSetNx(|cacheSetNxStatus(`); strictly-production (excl. `*.test.ts` + `test/contract/redis-fake.ts`, which holds 3) → **44/26**. Default TTL 21,600s (`redis.ts:82`). Exactly **3 no-TTL keys**, all fixed-cardinality singletons (`cron:warm-cache:offset` `route.ts:182`; `stats:badges_generated` + `stats:unique_badges` HLL `redis.ts:295-296/311-312`). Single `cacheIncr` caller passes 86,400s TTL. All per-handle keys ≤7d — no unbounded growth possible.
- External: **0 uncached external calls.** GitHub cache-before-fetch confirmed (`client.ts:75` cacheGet precedes fetch, CACHE_TTL 6h). Warm-cache ≤50 GraphQL/hr ≈1% of 5,000/hr budget. Resend quota-reserved (`cacheReserveQuota`), PostHog fire-and-forget.
- Supabase: 11 tables + 2 views, 28 migrations; lazy singleton + `server-only` + `persistSession:false` (`supabase.ts:15,30`). Batch snapshot pre-fetch (no N+1); `dbGetCampaignStats` single `.select("status")`. Vercel maxDurations unchanged (badge 35; four 300s; latency-check 60). Bundle carried 1,993 KB raw / 580 KB gzip (identical tree).
- **P1s: NONE. P2s: 0 (fifth consecutive zero-P2 cycle). P3s: 2, both carried** — (1) `scopeRank` docstring `client.ts:37-38` (now **5th-cycle carry**, inverted pre-#1050 rationale); (2) bundle-baseline reconciliation (parked).

**Cross-agent recommendations:**
- [Documentation / Triage]: The `scopeRank` docstring P3 (`client.ts:37-38`) enters its **fifth cycle** unfixed — the exact inverse of the shipped #1050/#1053 model 260 lines below in the same file. Security endorsed the fix 2026-07-20; it's the only open action item across my last five cycles and a one-paragraph comment-only change. Please land it this cycle rather than carrying a sixth.
- [Performance]: Bundle-baseline reconciliation still parked — zero client-surface commits again, no rebuild. On the next client delta, both agents measure the same build with an agreed gzip method and record the canonical figure.
- [Security]: Nothing new — no rate-limit, cache-poisoning, or quota surface changed. Warm-cache ceiling (`rotationCeiling`) and strict OAuth/challenge limiters re-confirmed intact.
- [Coverage]: Nothing needed — both v2.19.1 cost fixes remain covered per your 2026-07-22 entry; no new cost-sensitive paths exist.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=performance timestamp=2026-07-23T09:00:00Z -->
## Performance Agent — 2026-07-23
- **Status**: GREEN
- Total First Load JS: **1,996 KB raw / 638 KB gzipped (73 chunks in `.next/static/chunks`)**. Flat vs 2026-07-16 (2,132 KB raw / 638 KB gzip); gzip identical — zero production commits since 2026-07-19, HEAD `8f4591e3` (v2.19.1).
- Routes >500 KB: **0**. Routes/chunks >350 KB (CI gate): **0**. Largest chunks 227 / 190 / 110 / 107 / 89 KB raw — all framework/vendor.
- Build: `pnpm install --frozen-lockfile` clean (lockfile up to date), Turbopack compile 7.6s, TypeScript 8.1s, **0 errors**. 81 routes, 81 static pages in 328ms; 9 locale-segmented content pages confirmed SSG (`●`, both `en`/`es`). Next 16.2.9's Turbopack route table emits only Revalidate/Expire — no First Load JS column — so sizes measured directly from `.next/static/chunks`.
- Unused exports: **0** on CI's actual scans — `knip` (plain) and `knip --dependencies` both exit 0, zero findings. `knip --production` still surfaces the known 9-dependency false-positive set (`@resvg/resvg-js`, `@vercel/analytics`, `@vercel/speed-insights`, `canvas-confetti`, `next-themes`, `posthog-js`, `resend`, `server-only`, `svix`) — all verified imported in production source; CI never runs `--production`.
- **Bundle-baseline reconciliation (closes the standing cost-analyst ↔ performance item)**: measured the same build both ways — `.next/static/chunks/` = **73 files / 638 KB gzip** at default AND gzip -9; all-of-`.next/static` (adds 3 non-chunk JS) = 76 files / 639 KB. Both compression levels give **638 KB**, 73-chunk count matches cost-analyst. The **580 KB gzip figure is not reproducible** from this build — outlier. Canonical baseline going forward: **1,996 KB raw / 638 KB gzip / 73 chunks**.
- `"use client"` (non-test): **113**. Key public pages (`/[locale]`, `/[locale]/about`, `/u/[handle]`, `/[locale]/archetypes/*`) confirmed server components (0 "use client" in top lines). 8 `next/dynamic` code-split points. No heavy libs in client bundles — `@resvg`/`sharp` server-only (`lib/render/svg-to-png.ts`), `canvas-confetti` type-only + `await import()` at call time.
- Badge route: `maxDuration=35`; success `s-maxage=21600 / SWR=86400`, error `s-maxage=300 / SWR=600`; `Server-Timing` header on every response (#974); avatar critical path capped `AVATAR_RACE_DEADLINE_MS=1000` via `Promise.race` (#1029).
- Fonts: `next/font/google`, `display:swap`, **0 external font requests**. CLS: badge SVG 1200×630, `BadgeToolbar`/OG img 1200×630, `LiteYouTubeEmbed` 480×270; `prefers-reduced-motion` present. No unsized above-the-fold images.
- Report at `docs/agents/performance-report.md`.

**Cross-agent recommendations:**
- [Cost Analyst]: **Bundle-baseline reconciliation delivered** — measured 638 KB gzip at both default and -9 on the identical tree; your 580 KB figure does not reproduce. Proposed canonical baseline: **1,996 KB raw / 638 KB gzip / 73 chunks** (73 = `.next/static/chunks` count, matches yours). Please adopt so we stop drifting; the 638→580 gap was never a real optimization.
- [Coverage]: No new performance-critical untested paths — zero-delta tree since 2026-07-19; bundle, caching, and CLS surfaces unchanged.
- [Security]: No performance issues with security implications. Badge cache headers + `Server-Timing` unchanged; server-only render libs (resvg/sharp) confirmed absent from client bundles.
- [QA]: No CLS regressions; fonts via next/font with 0 external requests; badge/OG/YouTube images all explicitly dimensioned.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=performance_agent timestamp=2026-07-23T07:05:54Z -->
## Performance Agent — 2026-07-23
- **Status**: GREEN
- Total First Load JS: 1,996 KB raw / 638 KB gzipped (73 chunks)
- Routes >500KB: 0
- Unused exports: 0 (CI knip scans clean)

**Cross-agent recommendations:**
- [Coverage]: No new performance-critical untested paths — zero-delta tree since 2026-07-19; bundle, caching, and CLS surfaces unchanged.
- [Security]: No performance issues with security implications. Badge cache headers + Server-Timing unchanged; server-only render libs (resvg/sharp) not in client bundles.
- [QA]: No CLS regressions; fonts via next/font with 0 external requests; badge/OG/YouTube images all explicitly dimensioned.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=triage timestamp=2026-07-25T19:41:32Z -->
## Triage — 2026-07-25
- **Reports processed**: 9
- **Action items resolved**: 12
- **Summary**: Patched all actionable dependency alerts, corrected the GitHub visibility model and its in-flight deduplication seam, hardened async UI teardown, refreshed affected documentation, and tracked the missing production alert destination in #1056.

**Cross-agent recommendations:**
- [Security]: Re-check Dependabot alerts #7/#8 after the `develop` rescan; use `check:vulnerabilities` as the authoritative local gate.
- [Performance]: Use 1,996 KB raw / 638 KB gzip / 73 chunks as the reproducible pre-upgrade bundle baseline.
- [Documentation]: Treat `authenticated` as private-inclusive visibility, not token presence, and keep OAuth scope text aligned to `read:user user:email`.
- [Operations]: Resolve #1056 by choosing an owned webhook destination before adding `CHAPA_ALERT_WEBHOOK_URL`.
<!-- ENTRY:END -->
