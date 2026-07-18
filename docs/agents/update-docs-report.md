# Documentation Update Report

> Generated on 2026-07-18 | Branch: `develop` | Changes since `v2.19.0` (8175a8a0, 2026-07-16)

## Summary

- **1 document updated** (`CHANGELOG.md` — `[Unreleased]` section)
- **0 diagrams updated** (0 exist in the repo — confirmed by dedicated discovery pass, nothing stale)
- **0 version references corrected** (tag, `apps/web/package.json`, and `CHANGELOG.md`'s top released entry all agree at `v2.19.0`; README badges, cc-rpi blueprint marker, and CI Node pins all current)
- **0 inline doc blocks updated** (no new/changed exported function signatures in this range needed a JSDoc refresh — `stats-integrity.ts`'s new `isScopeBlindedStats()` already carries full JSDoc from its own commit)
- **0 items flagged [NEEDS REVIEW]**

## Discovery

Four parallel read-only agents (change-analyst, doc-inventory, diagram-analyzer, version-scanner) audited the 24-file/1084-insertion/434-deletion delta since `v2.19.0`. Net finding: the same-day triage cycle immediately prior to this pass (commit `d9a4525a`) had already corrected every doc-relevant gap it touched — CLAUDE.md's OAuth token-scoping model (#1002/#1004 sections), the `/api/health` `insufficient_scope` line, the CI Gates list (`check:vercel-config`), and the cron section's `vercel.json` Root Directory note. The only gap that survived that cycle was `CHANGELOG.md`, which is not part of the triage workflow's scope.

## Changes by File

### `CHANGELOG.md`

The `[Unreleased]` section documented only the `heal-poisoned-stats`/#1049 fix (`isScopeBlindedStats` detector for the #1045 corruption shape). Two shipped, unreleased fixes had no entry:

1. **Extended the existing #1049 entry** with one sentence noting the `metrics_snapshots` column-name bug (`issues_closed` vs `issues_closed_count`) the heal script's own dry-run caught same-day, before it touched any data — this was a same-day self-correction within the same fix, not a separate outstanding issue, so it's folded into the existing bullet rather than given its own.
2. **Added a new entry** for the `warm-cache` `WARM_CACHE_PRIORITY_HANDLES` ceiling-bypass fix — a real correctness bug (per-run GitHub-call volume could exceed the documented 50-handle ceiling, live since the cron went hourly in #1010) closed this triage cycle after being carried as a cost-analyst P2 for 2 cycles.
3. **Added a new entry** for the `dbGetCampaignStats` rewrite (4 parallel `COUNT` queries → 1 query + JS reduce) — closed this triage cycle after being carried as a cost-analyst P2 for 7+ cycles.

All three entries match the existing bold-summary + explanatory-paragraph voice and cite the same technical details (issue numbers where they exist, file/function names, concrete before/after behavior) as the surrounding entries.

## Flagged for Review

None.

## Notes

- **Markdownlint**: no `.markdownlint*` config exists in this repo and no CI workflow runs markdownlint, so `npx markdownlint CHANGELOG.md` was run but its default-ruleset output (80-char line-length warnings, duplicate `### Fixed` heading warnings — both pre-existing and structurally expected in a Keep-a-Changelog file) was not treated as a real failure, consistent with this project's own policy of gating markdownlint on the presence of a project config.
- **Version bump**: change-analyst noted this range (a real data-corruption detection/repair fix, a live cron rate-limit-ceiling fix, and a cost fix) looks like a legitimate `v2.19.1` or `v2.20.0` candidate. No version bump was made — that's `/release`'s decision, not `/update-docs`'s. Recommend running `/release` next if a new version is being prepared.
- `/pre-launch` catches issues `/update-docs` does not (security, performance, accessibility) — not run as part of this pass.
