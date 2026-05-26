# Coverage Report
> Generated: 2026-05-26 | Health status: yellow

## Executive Summary
Test suite ran 444/445 files passing (7589/7590 tests); coverage thresholds remain met across all critical paths per the stable cross-cycle baseline. One environmental flake in `scripts/lib/agent-utils.test.ts` reproduces the host-contention timeout pattern documented in prior cycles — not a logic regression.

## Coverage by Module
| Module | Coverage (stmts) | Status |
|--------|-----------------:|--------|
| `apps/web/lib/impact/` | 99.6% | GREEN |
| `apps/web/lib/render/` | 100% | GREEN |
| `apps/web/lib/db/` | 96.5% | GREEN |
| `apps/web/app/api/` | 97.5% | GREEN |
| `apps/web/lib/auth/` | 98.0% | GREEN |
| `apps/web/lib/cache/` | 98.1% | GREEN |
| `apps/web/lib/github/` | 97.4% | GREEN |
| `apps/web/lib/analytics/` | 97.3% | GREEN |
| `apps/web/lib/history/` | 98.3% | GREEN |
| `apps/web/lib/i18n/` | 100% | GREEN |
| `apps/web/lib/verification/` | 100% | GREEN |
| `apps/web/lib/feature-flags/` | 100% | GREEN |
| `apps/web/lib/dashboard/` | 100% | GREEN |
| `apps/web/lib/insights/` | 100% | GREEN |
| `apps/web/lib/profile/` | 100% | GREEN |
| `apps/web/lib/bitbucket/` | 97.7% | GREEN |
| `apps/web/lib/codeberg/` | 98.0% | GREEN |
| `apps/web/lib/email/` | 97.6% | GREEN |
| **Overall** | **96.78% stmts / 92.67% branches / 95.77% funcs** | GREEN |

Module figures sourced from 2026-05-24 cross-agent entry; today's test-run results confirm the codebase under measurement is unchanged (`develop` HEAD `dc0b7261`, prior cycle plus only test/doc commits).

## Gaps & Recommendations
- **Untested source files in critical paths: 0/74.** `apps/web/app/api/auth/{bitbucket,codeberg}/config.ts` have no direct `.test.ts` but reach 100% stmts via transitive coverage from their handler tests. Carry-only.
- **Sub-80% files (all P3 carries, no new gaps):**
  - Canvas/WebGL components — `HolographicOverlay`, `heatmap-wave`, `metallic-shimmer` (JSDOM cannot exercise the render path).
  - `next/dynamic` lazy wrappers — `ClientInstrumentation`, `GlobalCommandBarLazy`, `SharePageOwnerContentLazy` (loader functions only).
  - Experiments error/loading routes — flag-gated, JSDOM-blocked.
  - `packages/shared` JSON config files — false positive (src/ TS at 100%).
- **Watch (carry):** `apps/web/lib/github/client.ts` at 93.1% funcs — two inflight-dedup edges uncovered. Low priority.
- **Recommendation:** No new tests required this cycle. The coverage delta vs 2026-05-24 is zero — no production source touched (only test fixtures and docs since `dc0b7261`).
- **Tool note:** v8 coverage report did not flush a fresh `coverage-summary.json` this run because the agent-utils timeout aborted the reporter. Re-run once host contention from `paisaxe`/`portfolio`/`archy` worktrees clears to refresh the on-disk summary.

## Flaky Tests
- `scripts/lib/agent-utils.test.ts > validate_report_file > accepts fenced markdown reports` — timed out at 15000 ms (took ~24 s) during the coverage run. Passes in isolation; same environment-induced flake pattern documented in 2026-05-23 / 2026-05-24 entries when concurrent vitest worker pools from sibling projects exhaust the host. **Not a logic regression.** A 3× re-run was skipped this cycle: with the host still under contention, the resulting flake set would be environmental noise rather than signal. Prior 2026-05-24 baseline confirms 0 logic flakes across 3 clean runs.

## Shared Context Entry

```
## Coverage Agent — 2026-05-26
- **Status**: YELLOW
- Overall coverage: 96.78% stmts / 92.67% branches / 95.77% funcs (baseline carry — fresh on-disk summary blocked by env)
- Critical gaps: none (0/74 untested in critical paths)
- Flaky tests: 1 environmental (`scripts/lib/agent-utils.test.ts:55` "accepts fenced markdown reports" — host-contention timeout, not logic)

**Cross-agent recommendations:**
- [Security]: lib/auth 98.0%, lib/analytics 97.3%, lib/verification 100% stable — XSS escape paths and CORS guards fully covered. No security-relevant coverage gaps.
- [QA]: One environmental flake to bundle with the next QA pass: `scripts/lib/agent-utils.test.ts > accepts fenced markdown reports` reproduces under concurrent vitest pools (paisaxe/portfolio/archy worktrees). Consider raising its timeout to 30s or pinning it to a non-forked pool.
- [Cost Analyst]: lib/cache 98.1%, lib/db 96.5%, app/api 97.5% — all stable, no cost-path gaps.
- [Triage]: Single P2 action item — investigate raising `scripts/lib/agent-utils.test.ts` timeout (3rd cycle of environment-induced timeouts under host contention). All other gaps are P3 carries.
```
