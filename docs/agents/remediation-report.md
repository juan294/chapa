# Remediation Report
> Generated on 2026-08-27 | Branch: `develop` | 78 findings processed
>
> Pre-launch report: `docs/agents/pre-launch-report.md` (generated 2026-08-27 10:54, HEAD `e72a4e3a`, verdict **NOT READY**)
>
> Supersedes the prior remediation cycle recorded in this file (2026-08-26, PRs #1154–#1160,
> 15 findings from an earlier Studio-revival pre-launch audit) — this entry documents a
> separate, larger remediation cycle against the newer 2026-08-27 pre-launch audit.

## Summary

- Findings processed: ~77 (of the pre-launch report's full inventory)
- Issues created and fixed: 27 (#1162–#1188), grouped into two waves by fix session
- Bonus fix (found mid-cycle, not in the original report): 1 (#1189)
- Issues filed only, not fixed (Wave 3 — strategic, human architectural judgment required): 7 (#1191–#1197)
- Total issues closed this cycle: 28 (#1162–#1189)
- CI status: all 6 required workflows (CI, Coverage, Bundle Size Analysis, Security Scan,
  Secret Scanning, Dead Code Detection) green on final HEAD `8ee9d1dc`
- Fixes were merged directly to `develop` via local branch merges (`remediate/*` branches),
  not GitHub PRs — no PR numbers exist for this cycle's commits

## Wave 1 (issues #1162–#1175, closed ~10:24–10:37 UTC)

| # | Issue | Title | Fix commit |
|---|-------|-------|------------|
| 1 | [#1162](https://github.com/juan294/chapa/issues/1162) | Alerts actually deliver (email, not webhook) + telemetry rate-limit bypass | `f04416f0` |
| 2 | [#1163](https://github.com/juan294/chapa/issues/1163) | BE-H1 mergeStats corrupts profile type + BE-H2 cache scope downgrade | `9de66c94` |
| 3 | [#1164](https://github.com/juan294/chapa/issues/1164) | English dictionary ships in every client bundle (FE-H1/PE-H1/PE-M1) | `f4ef0f82` |
| 4 | [#1165](https://github.com/juan294/chapa/issues/1165) | Share page session/locale + clipboard + embed snippet (FE-H2/FE-M1/UX-M4/UX-M5) | `a627793a` |
| 5 | [#1166](https://github.com/juan294/chapa/issues/1166) | Badge cold-miss latency + readOnly coalescing (PE-H2/BE-M1) | `a397e2aa` |
| 6 | [#1167](https://github.com/juan294/chapa/issues/1167) | UX-B1 nav/footer + contrast + touch targets + aria-current | `fe5fb4e8` |
| 7 | [#1168](https://github.com/juan294/chapa/issues/1168) | Badge SVG craft: verification legibility, reduced-motion, colour, a11y name | `5d6832e4` |
| 8 | [#1169](https://github.com/juan294/chapa/issues/1169) | UX-H5 thirteen error boundaries, three visual languages | `97b14c6d` |
| 9 | [#1170](https://github.com/juan294/chapa/issues/1170) | UX-H2 archetype essays render under empty headings + FE-M4 untranslated toast | `205fede7` |
| 10 | [#1171](https://github.com/juan294/chapa/issues/1171) | SE-M2 unbounded displayName into agent context + SE-L3/BE-L3 trust annotation | `fb6b0060` |
| 11 | [#1172](https://github.com/juan294/chapa/issues/1172) | BE-M3 permanent rate-limit lockout + BE-M2 quota refund across UTC midnight | `0bca2466` |
| 12 | [#1173](https://github.com/juan294/chapa/issues/1173) | Studio discoverability + preview parity + heatmap hydration + OS theme | `cef0b1ff` |
| 13 | [#1174](https://github.com/juan294/chapa/issues/1174) | SE-H1 interim: shorten CLI token lifetime + show initiating device on approval | `03fa4ad5` |
| 14 | [#1175](https://github.com/juan294/chapa/issues/1175) | Docs/config accuracy: runbook, env vars, knip, stale comment, delete-user tests | `7b359f3d` |

## Wave 2 (issues #1176–#1188, closed ~12:16–12:25 UTC)

| # | Issue | Title | Fix commit |
|---|-------|-------|------------|
| 1 | [#1176](https://github.com/juan294/chapa/issues/1176) | BE-M5 campaign throughput + BE-M6 config outage fails batch permanently | `0a982e74` |
| 2 | [#1177](https://github.com/juan294/chapa/issues/1177) | PE-M2 hourly badge SVG rewrite + PE-L3 unbounded avatar resolve | `c551ba61` |
| 3 | [#1178](https://github.com/juan294/chapa/issues/1178) | PE-M3 flag Map bypasses unstable_cache, nondeterministic ISR | `8f31f346` |
| 4 | [#1179](https://github.com/juan294/chapa/issues/1179) | PE-M4 serialized Redis round-trips on the cold-miss path | `039021f4` |
| 5 | [#1180](https://github.com/juan294/chapa/issues/1180) | PE-L1 share-page serial SVG read + PE-L2 duplicate snapshot read | `b364a82e` |
| 6 | [#1181](https://github.com/juan294/chapa/issues/1181) | UX-H3 badge SVG is hardcoded English in a Spanish-default product | `12f13e70`, `ffd507ab` |
| 7 | [#1182](https://github.com/juan294/chapa/issues/1182) | UX-M8/FE-L2 duplicate mobile controls + UX-M9 heatmap role/tabindex conflict | `6f65d8cf` |
| 8 | [#1183](https://github.com/juan294/chapa/issues/1183) | UX-M10 second half — carry the verified colour onto the verify page | `4d274d3d` |
| 9 | [#1184](https://github.com/juan294/chapa/issues/1184) | FE-L1/L3/L4/L6 — nested input, plain anchors, duplicate title, session bypass | `297a9092` |
| 10 | [#1185](https://github.com/juan294/chapa/issues/1185) | FE-L5 route error boundaries swallow every client render error | `447fcdfa` |
| 11 | [#1186](https://github.com/juan294/chapa/issues/1186) | BE-L1 studio cache is net-negative + BE-L2 case-sensitive guard key + BE-L6 dead spike page | `1e5b2f9f` |
| 12 | [#1187](https://github.com/juan294/chapa/issues/1187) | UX-L1 no type scale + UX-L3 crash-page contrast + UX-L4 spec contradicts code | `ec96556a` |
| 13 | [#1188](https://github.com/juan294/chapa/issues/1188) | QA-M2 misleading test name + QA-L2 inaccurate command doc + DO-L3 runbook latency claim | `eb6f226e` |

Note: #1186 removed the (unused) `/webmcp-spike` page created for a runtime spike, which
retroactively makes the 2026-08-27 performance-report.md's only P3 recommendation ("add
`/webmcp-spike` to CLAUDE.md's route table") moot — the route no longer exists.

## Bonus fix (found during remediation, not in the original pre-launch report)

| # | Issue | Title | Fix commit |
|---|-------|-------|------------|
| 1 | [#1189](https://github.com/juan294/chapa/issues/1189) | `text-complement` fails AA contrast as text on light-theme page backgrounds (~2.54:1) | `0d637036`, `cd239cc2`, `aa6cb86f` |

## Wave 3: Later / strategic (filed, not fixed)

Per the Wave 3 policy (`CLAUDE.local.md`), these require human architectural judgment and
were deliberately filed as issues without fix agents.

| # | Finding ID | Title | Issue |
|---|------------|-------|-------|
| 1 | AR-S1 | Two independent badge implementations | [#1191](https://github.com/juan294/chapa/issues/1191) |
| 2 | AR-S2 | Scoring/cache seam has ~7 interacting flags with no combination doc | [#1192](https://github.com/juan294/chapa/issues/1192) |
| 3 | BE-S1 | `_compose` has unchecked positional invariants (root cause of BE-H1) | [#1193](https://github.com/juan294/chapa/issues/1193) |
| 4 | FE-S1 | Session and locale sourcing chosen per page, not derived | [#1194](https://github.com/juan294/chapa/issues/1194) |
| 5 | FE-L7 | `ArchetypePageClient` is a server component | [#1195](https://github.com/juan294/chapa/issues/1195) |
| 6 | AR-L3 | TS omits `exactOptionalPropertyTypes` | [#1196](https://github.com/juan294/chapa/issues/1196) |
| 7 | PE-L4 | Full posthog-js bundle loaded when only capture is used | [#1197](https://github.com/juan294/chapa/issues/1197) |

Note: issue #1191's finding ID (`AR-S1`) collides with the older #1153 (`AR-S1 TypeScript and
ESLint major upgrades`) from the prior 2026-08-26 audit cycle — correctly filed as a separate
issue rather than reusing/overwriting #1153, per the finding-ID-collision precedent
(finding IDs are deterministic per audit and collide across cycles; disambiguate by audit
date, never reuse a same-ID prior issue).

## Final Verification

- [x] Wave 1 (14 findings) fixed and merged to `develop`
- [x] Wave 2 (13 findings) fixed and merged to `develop`
- [x] Bonus fix (#1189) fixed and merged to `develop`
- [x] Wave 3 (7 findings) filed as issues, correctly not auto-fixed
- [x] Final HEAD `8ee9d1dc` verified with all 6 required GitHub Actions workflows passing
      (CI, Coverage, Bundle Size Analysis, Security Scan, Secret Scanning, Dead Code Detection)
- [x] `develop` in sync with `origin/develop` (no ahead/behind)

## Deferred Items

Wave 3 issues #1191–#1197 remain in the strategic backlog pending human architectural
judgment, alongside the older carried #1153.

## Known documentation gap from this cycle

`CHANGELOG.md`'s `[Unreleased]` section is currently empty despite these 28 merged fixes
since the `v2.23.0` tag. Writing 28 changelog entries is `/update-docs` scope, not triage
scope — carried as a recommendation, not fixed in this cycle.
