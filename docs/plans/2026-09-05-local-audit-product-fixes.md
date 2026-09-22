# Local audit product fixes
Date: 2026-09-05. Baseline: develop ab6e01a6.

## Authorization and scope

User authorized issue creation, all retained fixes today using RPI, local worktrees and local merge into develop. This explicitly continues through normal research/plan/implementation phase stops. **Pushing to GitHub is forbidden during the hackathon freeze.** No PR, remote merge, deployment, CI dispatch or production mutation. Every agent receives this restriction. Only GPT-6 Astra agents.

Discarded by owner: AR-L1 audit validator; DO-M1 Git rollback procedure; QA-M1 release-journey evidence. No changes to these findings or release gates/infrastructure. Existing verification is retained. Eleven issues remain one implementation phase; no deferred release waves.

## Issue coverage

| Finding | Issue | Group |
|---|---|---|
| FE-M1 | #1284 | Studio |
| FE-L1 | #1285 | Studio |
| BE-M1 | #1286 | Studio |
| BE-M2 | #1287 | Data |
| BE-M3 | #1288 | Data |
| PE-M1 | #1289 | Badge |
| SE-M1 | #1290 | Data |
| UX-M1 | #1291 | Badge |
| UX-M2 | #1292 | Badge |
| UX-M3 | #1293 | Studio |
| AS-M1 | #1294 | Studio |

## Phase 1: product fixes [batch-eligible groups]

See phase-1.md in the companion phase directory. Three disjoint worktrees implement groups concurrently. Each starts with failing focused regressions, then minimal code. Agents leave changes uncommitted for independent cross-review; root applies reviewed patches to the integration worktree and makes one local phase commit, so hooks never run full suites concurrently.

- [x] Studio group implemented and targeted regressions pass.
- [x] Data group implemented and targeted regressions pass.
- [x] Badge group implemented and targeted regressions pass.
- [x] Cross-review approves every group and fixes are applied.
- [x] Dedicated simplify review checks reuse, quality and efficiency.
- [x] Full verification passes on integrated candidate.
- [x] All eleven issues covered by the single local phase commit and acceptance evidence below.
- [x] Integration ready for local develop; final merge SHA and remote ref comparison belong in the completion report.

## Designs and invariants

Studio rejects unavailable/invalid owner config using the existing error boundary, keeping defaults for new users/demo and retaining decoder compatibility. Track persisted config separately from save status. Consume response body before final save revision comparison; record only the submitted configuration as persisted. Protect app-owned departures using native unload confirmation, preserving clean/demo, modifier/hash/download navigation. A narrow cancelable navigation helper handles existing keyboard/router commands; do not patch browser history or Next internals. Browser Back/Forward is outside this app-owned-navigation correction and must not be claimed as covered.

Simulator applies existing recency helpers before confidence, retaining solo Quality exclusion, optional Craft, rounding and read-only input handling. Text consumers use the existing text-safe token without changing brand fills or SVGs.

Supplemental writes commit DB first; only then publish Redis. Failed publication evicts stale overlay; if eviction also fails, return durable success with explicit deferred cache status and capture it. Never delete the protected GitHub baseline. Registration inspects DB errors and runs in an awaited after() callback with observed failures, preserving login availability and OAuth-only user insertion. CLI verifies valid timestamp shape and bounded signed lifetime after signature verification; new issuer reads time once and existing ten-day tokens allow small timestamp drift. No secret rotation/revocation store.

Badge producers carry the existing cacheable snapshot flag, allowing fallback rendering but forbidding shared Redis/edge publication for unknown config. Real absent config still caches; warm hits incur no DB lookup. Include background, share and cron paths; no new revision-fencing scheme.

Sharing names append the actual platform to existing localized action text. Insights hook gives notifications an identity; Settings keys Toast by it and loading uses duration=0. Keep manual dismissal, roles and timer cleanup. Success remains visible for its existing 2.5-second pre-reload interval; errors retain the normal result interval.

## Verification and review

Plan review: independently approved by a GPT-6 Astra reviewer on 2026-09-05 before source implementation. Review confirmed all eleven issue mappings, disjoint ownership, and the stated regression invariants. No blocking corrections.

Focused tests must show red before green. DB failure/success claims require local real-stack contracts using the existing wrapper; never read/copy .env.local into worktrees. Local Chapa Supabase is already running; do not reset shared databases or introduce migrations. No new CI gate.

Root sequentially runs existing typecheck, lint, full unit tests, local contracts, circular check and production build/bundle check on integration as appropriate. Git commit hooks run their existing checks and are not bypassed. Source changes receive a separate plan-compliance and simplify review by another Astra worker before local commits. Update this plan with evidence; record actual deviations in companion notes only if needed.

Manual production/browser/hackathon checks are not acceptance prerequisites here; no production deployment is authorized. GitHub issues stay open until local work can be published after the freeze. Final report includes exact local SHA, issue mapping, check results and remote ref comparisons.

## Completed acceptance evidence

Independent GPT-6 Astra cross-review and dedicated simplify review approved all three groups and the final integration adjustments. Focused regressions were observed failing before fixes, then passing. Integration corrected a test helper type and updated an existing source invariant to the snapshot resolver while retaining its cache-before-read assertion.

| Issues | Verified behavior |
|---|---|
| #1284, #1285 | Dirty state survives failed saves and delayed response bodies; reverting/resetting to persisted state clears it; app-owned navigation and unload guards retain their exclusions. |
| #1286 | Failed/invalid reads use the retry boundary; confirmed absence/demo keep defaults. |
| #1287 | Durable write precedes cache publication; failed publication evicts stale data; double failure reports deferred cache status; local DB reread/recomposition preserves the baseline. |
| #1288 | Resolved registry errors and deferred callback failures are observed; local DB create/update/reread passes. |
| #1289 | Unknown-config rendering skips Redis/shared caching across foreground, background, share and cron; known absence/recovery and warm-cache behavior remain valid. |
| #1290 | Signed legacy ninety-day and malformed timestamps fail; ten-day tokens and small issuer drift pass. |
| #1291 | Localized sharing names distinguish all three destinations without changing URLs. |
| #1292 | Loading has no expiry; result identity starts a fresh notification lifetime; dismissal, cleanup and existing success reload timing pass. |
| #1293 | Informational terminal and generation text uses the existing readable text token; brand fills remain unchanged. |
| #1294 | Simulation uses existing recency before confidence and matches unchanged-profile scoring with fixed context. |

Final sequential integration checks: typecheck, lint, 512 test files / 8,473 tests, 34 local contract files / 72 tests, circular dependency check, production build, and the existing 350 KB bundle check all passed (largest reported bundle: 227 KB). Local contracts used the existing localhost wrapper without database resets or production access. Existing commit hooks will run again on the staged phase commit.
