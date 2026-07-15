# Documentation Update Report

> Generated on 2026-07-15 | Branch: `develop` | Changes since `361d7326` (prior docs-sync commit) — the #1008–#1040 pre-launch remediation batch (46 commits, 33 issues)

## Summary

- **8 documents updated** (`CHANGELOG.md`, `CLAUDE.md`, `README.md`, `docs/accepted-risks.md`, `docs/design-system.md`, `docs/runbooks/observability.md`, plus 2 files touched by an unrelated concurrent scheduled QA agent)
- **1 diagram checked, 0 updated** (`docs/chapa-architecture.drawio` — every change in this batch operates below the diagram's component-level granularity, consistent with how prior similarly-scoped changes were handled)
- **1 accepted-risk entry resolved** (the 2026-06-19 "locale flash" entry — #1023 shipped the per-locale route segments it was waiting on)
- **1 stale version/stat reference corrected** (README test count)
- **1 out-of-scope bug filed separately** (#1041, `sitemap.ts` missing `/archetypes/artificer` — pre-existing, unrelated to this batch)
- **0 items flagged [NEEDS REVIEW]**

Discovery ran 4 parallel read-only agents (change-analyst, doc-inventory, diagram-analyzer, version-scanner) against the 46-commit remediation batch that closed all 33 findings from `docs/agents/pre-launch-report.md`. Given the user's standing approval for this pass, updates were implemented directly rather than gated on a separate plan-approval step.

## Changes by File

### `CHANGELOG.md`
The `[Unreleased]` section had zero entries for this batch despite 25 substantive commits. Added full `### Added`/`### Fixed`/`### Changed`/`### Docs` entries covering all 33 issues: the i18n locale-segmented rearchitecture (#1023) and its ADR carve-out, the CI vulnerability/license/pending-migrations gates (#1008/#1011/#1012), badge-route latency fixes (#1013/#1014/#1029), the snapshot-write tri-state model (#1009/#1015/#1016), OAuth fail-closed + replay-nonce hardening (#1027), warm-cache hourly cadence (#1010), the `?lang=` live-apply fix (#1020), translated error boundaries (#1022), tooltip portal fixes (#1021/#1040), Navbar consolidation (#1025), and the remaining smaller fixes (#1017, #1018, #1019, #1024, #1026, #1028, #1030–#1039).

### `CLAUDE.md`
- **CI Gates**: added `check:vulnerabilities`, `check:licenses`, `check:pending-migrations` (previously undocumented despite running in CI); noted the broadened `no-process-env` scope; noted the per-module coverage floors' exact values.
- **Development Guardrails**: corrected the copyleft policy description to name the actual allowlist (including 0BSD/CC0-1.0) and the accepted-risk exception mechanism.
- **Caching rules**: rewrote the snapshot-write reconciliation bullet for the tri-state (`inserted`/`duplicate`/`failed`) model and its cross-call-race caveat; rewrote the rate-limit fail-open bullet to note the OAuth fail-closed exception; updated the badge latency SLO bullet with the new timing budgets (500ms cache-read deadline, ~950ms poll budget, 1000ms avatar deadline, `after()`-deferred persist).
- **Route table**: `/api/cron/process-campaigns` now describes round-robin multi-campaign processing; `/api/health` mentions cron-heartbeat staleness monitoring.
- **Code ownership areas**: added Navbar/NavbarShell, `dimension-colors.ts`, and the `tArray`/`tObject` typed-accessor requirement.

### `README.md`
Corrected the stale test-count stat (516+/8,000+ → 496+/8,479+); added a sentence to the bilingual-UI blurb noting per-locale server rendering (no flash); added `proxy.ts` and `app/[locale]/` to the project-structure tree.

### `docs/accepted-risks.md`
Marked the 2026-06-19 "static content pages render at DEFAULT_LOCALE" entry `~~Resolved~~` — its own text anticipated exactly the fix #1023 shipped ("Full per-locale SSR would require per-locale route segments... deferred to a future milestone").

### `docs/design-system.md`
Added a "Tooltips (mandatory pattern)" subsection documenting the portal/fixed/z-99999/auto-flip requirement — this was previously enforced only via private agent memory, not the project's own canonical UI spec, and #1021's fix was exactly a violation of this pattern.

### `docs/runbooks/observability.md`
Added `badge_latency_slo_breach` to the alert-signal table (was missing despite existing since #974) and a new paragraph documenting the `cron:lastrun:*` heartbeat mechanism (#1018 added `latency-check` to the monitored set).

### `docs/agents/qa-report.md`, `docs/agents/shared-context.md`
Updated by the scheduled QA agent (unrelated automation running concurrently) — included in this commit since they were already staged when the sync landed; not authored by this pass.

## Diagrams

`docs/chapa-architecture.drawio` was checked and requires no change. Every change in this batch (the locale-segmented proxy, OAuth fail-closed + replay nonce, warm-cache cadence, snapshot-write saga hardening) is an internal-behavior or implementation-detail change within already-depicted components — consistent with how prior similarly-scoped changes (#825, #826, #1002) were represented only as annotations, never new nodes.

## Flagged for Review

None. `docs/agents/pre-launch-report.md` itself now has a stale test-count snapshot (487/8,339) baked into its Executive Summary and Domain Model sections — left untouched, as it's a dated point-in-time audit record, not a living doc, consistent with how prior audit reports have been treated.

## Out-of-Scope Finding

While auditing `apps/web/app/sitemap.ts` for locale-migration impact (confirmed unaffected — URLs remain unprefixed), found its `ARCHETYPES` array omits `"artificer"`, a live, documented page — a pre-existing bug unrelated to this batch. Filed as [#1041](https://github.com/juan294/chapa/issues/1041) rather than folded into this release.
