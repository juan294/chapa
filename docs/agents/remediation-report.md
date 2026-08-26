# Remediation Report
> Generated on 2026-08-26 | Branch: `develop` | 15 findings processed
>
> Pre-launch report: `docs/agents/pre-launch-report.md`

## Summary

- Findings processed: 15 (Wave 1: 11, Wave 2: 3, Wave 3: 1)
- Issues created: 15
- Issues resolved in Wave 1: 11
- Issues filed only (not fixed): 4 (Wave 2: 3, Wave 3: 1)
- Halted (recommendation unsafe, needs human re-scope): 0
- Tests added: 53 test cases (43 net after replacing obsolete cases)
- Files modified: 50, including this report
- CI status: PASSING for every exact Wave 1 PR candidate merged so far; the final release-baseline PR carries this report

## Wave 1: Before launch (must-fix)

| # | Finding ID | Title | Severity | Tests Added | PR | Status |
|---|------------|-------|----------|-------------|----|--------|
| 1 | FE-H1 | Cold-cache Studio visits render fabricated zero metrics | high | 4 shared in work unit | [#1154](https://github.com/juan294/chapa/pull/1154) | Merged |
| 2 | PE-M1 | Studio verification loads unused trend state on every request | medium | 4 shared in work unit | [#1154](https://github.com/juan294/chapa/pull/1154) | Merged |
| 3 | BE-H1 | Redis can expose an uncommitted or stale Studio configuration | high | 26 shared in work unit | [#1155](https://github.com/juan294/chapa/pull/1155) | Merged |
| 4 | BE-M1 | The config read boundary trusts unknown JSON and hides storage failures | medium | 26 shared in work unit | [#1155](https://github.com/juan294/chapa/pull/1155) | Merged |
| 5 | PE-M2 | Default-config users repeatedly hit unbounded Redis and Supabase reads | medium | 26 shared in work unit | [#1155](https://github.com/juan294/chapa/pull/1155) | Merged |
| 6 | FE-H2 | Save failures are not fully handled and duplicate saves can overlap | high | 21 shared in work unit | [#1156](https://github.com/juan294/chapa/pull/1156) | Merged |
| 7 | UX-H1 | The Spanish-default Studio becomes an English control surface after its welcome | high | 21 shared in work unit | [#1156](https://github.com/juan294/chapa/pull/1156) | Merged |
| 8 | UX-H2 | Both primary control modes have broken assistive-state semantics | high | 21 shared in work unit | [#1156](https://github.com/juan294/chapa/pull/1156) | Merged |
| 9 | UX-M1 | The new preview footer can overflow narrow mobile cards | medium | 21 shared in work unit | [#1156](https://github.com/juan294/chapa/pull/1156) | Merged |
| 10 | AR-H1 | Root operational scripts remain outside static quality gates | high | N/A, quality-gate configuration | [#1157](https://github.com/juan294/chapa/pull/1157) | Merged |
| 11 | DO-M1 | An ancestry-based baseline lookup selects v2.22.0 instead of production v2.22.1 | medium | 2 | [#1158](https://github.com/juan294/chapa/pull/1158) | Final Wave 1 merge unit |

## Wave 2: After launch

| # | Finding ID | Title | Severity | Tests Added | PR | Status |
|---|------------|-------|----------|-------------|----|--------|
| 1 | PE-M3 | Every configuration change remounts the complete preview | medium | 0 | [#1150](https://github.com/juan294/chapa/issues/1150) | Filed, deferred pending user decision |
| 2 | AR-L1 | Studio command metadata remains stringly typed across the action boundary | low | 0 | [#1151](https://github.com/juan294/chapa/issues/1151) | Filed, deferred pending user decision |
| 3 | AR-L2 | Client preview imports metadata from server SVG implementation modules | low | 0 | [#1152](https://github.com/juan294/chapa/issues/1152) | Filed, deferred pending user decision |

## Wave 3: Later / strategic (filed, not fixed)

| # | Finding ID | Title | Severity | Issue | Rationale |
|---|------------|-------|----------|-------|-----------|
| 1 | AR-S1 | TypeScript and ESLint major upgrades need explicit gate migration | strategic | [#1153](https://github.com/juan294/chapa/issues/1153) | Filed for later human architectural judgment, as required by the Wave 3 policy. |

## Final Verification

- [x] Wave 1 implementation merged through PR #1157; PR #1158 is the final merge unit
- [x] Wave 2 explicitly held for the mandatory proceed-or-defer decision
- [x] Wave 3 issue filed in the backlog
- [x] `/simplify` final pass complete for Wave 1
- [x] Wave 1 cleanup scheduled immediately after final merged-commit verification

## Deferred Items

Wave 2 issues #1150, #1151, and #1152 remain open. Run `/remediate wave=2`
after the mandatory Wave 1 decision if they are deferred. Wave 3 issue #1153
remains in the later strategic backlog because it needs human architectural
judgment before implementation.
