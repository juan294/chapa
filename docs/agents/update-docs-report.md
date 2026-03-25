# Documentation Update Report

> Generated on 2026-03-24 | Branch: `develop` | Changes since v2.2.0 (17 commits)

## Summary

- 5 documents updated
- 0 diagrams refreshed (none exist)
- 3 version references corrected
- 0 inline doc blocks updated (no stale JSDoc found)
- 0 items flagged [NEEDS REVIEW]

## Changes by File

### 1. `README.md`
- **Updated:** Test count from `345+ test files, 5,720+ tests` to `367+ test files, 5,920+ tests`
- **Reason:** 167 new tests added during v38 remediation (5,926 actual as of bd07ec5)

### 2. `CHANGELOG.md`
- **Added:** `[Unreleased]` section documenting all post-v2.2.0 changes
- **Reason:** 17 commits since v2.2.0 with no changelog tracking. Covers: BadgeSkeleton, craft cache, HMAC 128-bit upgrade, platform OAuth refactor, dynamic analytics import, test coverage boost, a11y fixes, build fix

### 3. `docs/badge-verification.md`
- **Updated:** HMAC hash description from 8 hex chars (32 bits) to 32 hex chars (128 bits)
- **Updated:** Hash format validation to show all accepted formats (8/16/32 chars)
- **Updated:** Threat model brute-force entry to reflect 2^128 search space
- **Updated:** Verification strip example to show 32-char hash
- **Added:** Backward compatibility note for legacy hash formats
- **Reason:** HMAC hash was increased to 128 bits in commit c544bd0 (#617)

### 4. `docs/accepted-risks.md`
- **Updated:** "Last reviewed" date from 2026-03-22 to 2026-03-24, audit version from v22 to v38
- **Removed:** "When verification URLs are redesigned (hash length can be increased)" from review schedule (completed in #617)
- **Verified:** HMAC 64-bit risk was already marked as resolved (no change needed)
- **Reason:** Audit v38 completed; hash length increase was the outstanding review trigger

### 5. `docs/cli-guide.md`
- **Updated:** Docker example from `node:18-slim` to `node:20-slim`
- **Reason:** Project requires Node.js 20+; example was stale

## Not Updated (Verified Current)

- `CLAUDE.md` — Route table comprehensive, no new routes added since v2.2.0
- `docs/impact-v6.md` — Scoring spec unchanged
- `docs/design-system.md` — No design changes
- `docs/how-it-works.md` — All changes since v2.2.0 are internal (caching, refactoring, tests); no new user-facing behavior to document
- `docs/svg-design.md` — Badge layout unchanged
- Agent reports — Point-in-time snapshots; will be refreshed on next agent run
- `docs/agents/shared-context.md` — Agent entries are historical snapshots; stale numbers (test counts) will be updated when agents next run

## Flagged for Review

None.
