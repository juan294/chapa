# Triage Report
> Generated on 2026-07-16 | 10 reports processed | 5 action items | 1 Dependabot PR flagged for manual decision

## Agent Failures
None — no `logs/*.error.log` files modified in the last 24h.

## Reports Reviewed
| # | Report | Agent | Status | Action Items |
|---|--------|-------|--------|--------------|
| 1 | pre-launch-report.md | Pre-Launch Audit (2026-07-15) | Historical — see note below | 0 (all 33 findings verified already remediated) |
| 2 | cost-analyst-report.md | Cost Analyst | GREEN | 0 (1 claimed "doc/code mismatch" was a false positive, see below) |
| 3 | performance-report.md | Performance | GREEN | 1 (pin `knip` — done) |
| 4 | coverage-report.md | Coverage | GREEN | 4 (3 real gaps closed + issue #1006 closed; 1 justified skip) |
| 5 | documentation-report.md | Documentation | GREEN | 0 (superseded by update-docs-report.md's more recent pass) |
| 6 | security-report.md | Security | GREEN | 0 |
| 7 | cc-rpi-update-report.md | cc-rpi Update | no-op | 0 (already up to date as of v1.25.0) |
| 8 | update-docs-report.md | /update-docs | (historical record) | 0 (already-completed work; #1041 already fixed) |
| 9 | qa-report.md | QA | GREEN | 0 (1 claimed a11y finding was stale/false, see below) |

## Overall Status: GREEN

## Major Finding: pre-launch-report.md is Fully Historical
`pre-launch-report.md` (dated 2026-07-15, "NOT READY" verdict, 33 findings including a launch-blocker) matched the `-newer` mtime scan, so it was read and re-verified in full against the current codebase rather than assumed stale. **Every one of its 33 findings was directly confirmed already remediated** via the v2.18.0 release (#1008–#1042), verified by grep/read of the actual source — not by trusting commit messages or CLAUDE.md text alone:

| Finding | Verification |
|---|---|
| DO-B1/SE-M1 (pnpm audit no-op) | `check:vulnerabilities` via osv-scanner now exists (#1008) |
| SE-M2 (license denylist) | `check:licenses` allowlist exists (#1012) |
| BE-H1/PE-M1 (write-path alerting/latency) | `after()`-deferred persist confirmed in badge.svg/route.ts (#1013) |
| PE-M2 (250ms Redis deadline) | now 500ms (#1014) |
| PE-M3 (2s poll budget) | now ~950ms (#1029) |
| PE-L1 (avatar 2s wait) | `AVATAR_RACE_DEADLINE_MS=1000` race confirmed at route.ts:54 (#1029) |
| PE-H1 (daily warm-cache) | now hourly, confirmed in vercel.json (#1010) |
| DO-H1 (no migration CI check) | `check:pending-migrations` exists (#1011) |
| DO-M1 (latency-check no heartbeat) | heartbeat + health-route monitoring confirmed (#1018) |
| DO-M2 (no rollback runbook) | "## Reversing a Migration" section confirmed present |
| AR-M2 (process.env lint gap) | broadened selector confirmed (#1017) |
| FE-H1 (i18n client-render) | locale-segmented `app/[locale]/` RSC confirmed (#1023) |
| FE-M1 (`?lang=` bug) | `LocaleSync` calling `setLocale` immediately confirmed (#1020) |
| FE-M2 (duplicate Navbar) | `NavbarShell` extraction confirmed (#1025) |
| FE-M3 (typed accessors) | `tArray`/`tObject` confirmed (#1026) |
| BE-M3/SE-L1 (OAuth fail-open/no replay-consume) | fail-closed + per-platform nonce cookie confirmed (#1027) |
| QA-M1 (coverage gate global-only) | per-module floors confirmed in vitest.config.ts (#1028) |
| UX-M1 (HeatmapGrid tooltip) | `createPortal`/`zIndex: 99999` confirmed present |
| UX-M2 (5 error boundaries hardcoded English) | all 5 confirmed using `useTranslation` |
| UX-L1 (verify/error.tsx wrong color) | `text-complement` confirmed, no amber |
| UX-L2 (InfoTooltip no auto-flip) | `rect.top < 120` flip logic confirmed |
| UX-L3 (hardcoded dataviz colors) | `dimension-colors.ts` confirmed (#1040) |
| AR-M1 (GitHub excluded from parity test) | GitHub fixture confirmed in parity test (#1024) |
| QA-L1 (0.15 boundary untested) | exact 0.14/0.15 boundary tests confirmed |
| DO-L1 (no CONCURRENTLY policy) | policy section confirmed in migrations.md |
| BE-L2 (single-campaign cron) | round-robin confirmed (#1035) |
| BE-L1 (swallowed email failure) | `captureServerError` call confirmed |
| QA-S1 (no local contract preflight) | `test:contract:local` script confirmed (#1036) |
| AR-L1 (stale knip.json entries) | `knip` run returns zero configuration hints |
| AR-L2 (dev deps behind) | only `vite` patch remained — closed this cycle |

**No new action items were generated from this report.** Per `update-docs-report.md`'s own note, this file is an intentionally-preserved dated audit snapshot, not a living doc — it should not be re-processed as if new in a future triage cycle.

## False Positives Caught Before Acting
1. **cost-analyst's "avatar timeout mismatch"** — claimed `avatar.ts:33`'s `AbortSignal.timeout(2000)` contradicts CLAUDE.md's documented "1000ms" cap. Verified directly: these are two different layers — `avatar.ts:33` is the underlying fetch's hard abort (2000ms), while the badge route's `AVATAR_RACE_DEADLINE_MS = 1000` (`route.ts:54`) is the actual effective cap on the critical path via `Promise.race`. CLAUDE.md is accurate. No doc or code change made.
2. **qa-report's `/verify/[hash]` "missing h1"** — re-flagged a claim already correctly dismissed as a false positive in the 2026-07-08 triage cycle. Verified directly: `StatusCallout titleAs="h1"` renders an `<h1>` at both lines 101 and 223. No action taken; shared-context strengthened to stop this recurring.

## Action Items Completed
| # | Item | Source Report | Tests Added | Status |
|---|------|--------------|-------------|--------|
| 1 | Closed **issue #1006** — `KeyboardShortcutsListener`'s `next/dynamic` loader (`ShortcutCheatSheet`) was never resolved by any test. Added `KeyboardShortcutsListener.render.test.tsx`, mirroring the established `GlobalCommandBarLazy.render.test.tsx`/`SharePageOwnerContentLazy.render.test.tsx` precedent and reusing the shared `resolveDynamicLoader()` helper. | coverage-report.md (carried) | 1 new file, 2 tests | Done |
| 2 | Closed `lib/github/stats.ts`'s `fetchStats` function-coverage gap (50%→100% funcs). The `fireAndForget` `onError` closure and the `.filter((n) => n.merged)` callback were both under-exercised — existing tests only used an *empty* `nodes` array, so the filter's callback body never ran. Added a test with non-empty `nodes` (all `merged: false`) plus a rejecting `captureServerEvent` mock. | coverage-report.md | 1 new test | Done |
| 3 | Closed one of two branch gaps in `apps/web/app/api/admin/campaigns/route.ts` GET handler (80%→90% branches) — the `?type=` query param ternary (`rawType && VALID_TYPES.includes(...)`) had no test at all. Added tests for a valid type and an invalid/bogus type. | coverage-report.md | 2 new tests | Done |
| 4 | Pinned `knip` as a devDependency (`6.27.0`) in `package.json`, per performance-agent's reproducibility recommendation. | performance-report.md | — | Done |
| 5 | Bumped `vite` 8.1.4→8.1.5 (patch, dev-only) — last remaining item from the pre-launch audit's AR-L2 dev-deps carry. | pre-launch-report.md (historical, re-verified) | — | Done |

## Investigated and Reverted: knip.json ignoreDependencies
While investigating performance-report's "9 false-positive unused dependencies" finding, I initially added all 9 to `knip.json`'s `ignoreDependencies` to suppress them. Before committing, I checked what CI actually runs (`.github/workflows/knip.yml`: plain `knip` and `knip --dependencies` — **neither uses `--production`**) and confirmed both are already clean without any suppression. The `--production` false positives only appear under a flag CI never passes. Knip itself flagged my added ignore entries as redundant ("Remove from ignoreDependencies") configuration hints, confirming the plain scan already resolves these deps correctly. Reverted the `knip.json` change; kept only the version pin.

## Skipped With Justification
- **`lib/render/demoData.ts` + `archetypeDemoData.ts`'s 50%-branch gap** (`LEVEL_TO_COUNT[...] ?? 0` fallback) — every literal grid in both files only ever contains values 0-4, all valid `LEVEL_TO_COUNT` keys; the fallback can only trigger on an out-of-range grid value, which no current literal introduces. The builder functions (`buildDemoHeatmap`, `buildHeatmap`) are not exported, so testing this branch would require adding an export purely for test access. Same class as two now-confirmed cases in `stats.ts` (`firstIssue?.`, `raw.pullRequests?.`) and `route.ts` (`firstIssue?.path`) — all guard against a value the type system already guarantees is present, so the branch is unreachable in practice, not a real gap.
- **`dbGetCampaignStats`'s carried P2** (4-parallel-COUNT pattern, bounded/admin-only) — cost-analyst's own recommendation remains "not urgent," unchanged across 7+ cycles.

## Dependabot PRs
| # | PR | Update Type | Disposition | Notes |
|---|----|----|----|----|
| 924 | `actions/checkout` 6→7 | major | Deferred (flagged for manual decision) | `gh pr update-branch` still fails — unresolved conflict. Dependabot itself now reports an internal "something went wrong, retry with `@dependabot recreate`" state. All CI checks have been green since 2026-06-24 (9+ triage cycles). Recommend the user either run `@dependabot recreate` + resolve the conflict manually, or close it and let Dependabot re-open fresh. |

## GitHub Security & Quality Alerts
| # | Type | Severity | Status | Notes |
|---|------|----------|--------|-------|
| 1 | Code scanning (CodeQL) | — | Disabled (403) | Accepted risk, documented in `docs/accepted-risks.md` |
| 2 | Secret scanning | — | Disabled (404) | Accepted risk, documented in `docs/accepted-risks.md` |
| 3 | Dependabot security alerts | — | 0 open | Query succeeded |

## Verification
- [x] All tests passing (8,488/8,488, 497 files)
- [x] Typecheck clean (both workspaces)
- [x] Lint clean (both workspaces)
- [x] `/simplify` pass — no findings (diff matches established repo conventions exactly)
- [ ] CI green on push (pending — monitoring after push)

## Carried Items
- `dbGetCampaignStats` 4-parallel-COUNT pattern (P2, bounded/admin-only, cost-analyst's own "not urgent" judgment, unchanged for 7+ cycles)
- Dependabot PR #924 (see above — now escalated to the user rather than re-deferred silently)
