---

**cc-rpi sync: v1.15.0** (commit `7ef063d`) — 2 commands updated, pushed to `origin/develop`, CI green (390 test files, 7001 tests passing).

### What changed

**Blueprint release: v1.15.0** — Pre-launch deep-audit restructure + 3-wave remediation

**Commands updated:**

- **`/pre-launch`** — Major upgrade (6→8 specialists):
  - Added Staff Frontend Engineer (`FE`) and Staff Backend Engineer (`BE`) as dedicated specialists
  - Structured finding ID system: `<DOMAIN>-<SEVERITY_LETTER><COUNTER>` (e.g. `SE-B1`, `UX-M3`)
  - 16-section report format with machine-parseable Section 14 wave index
  - Critic mindset preamble + system-map-first Domain Model per specialist
  - All 8 run on **opus** model
  - Rule #73 enforced: only QA runs the full test suite in parallel audit

- **`/remediate`** — 3-wave processing (was single-pass):
  - Wave 1 (Before launch): blockers + high severity — fix agents spawned
  - Wave 2 (After launch): medium severity — optional defer with `wave=2` resume
  - Wave 3 (Later/strategic): GitHub issues filed only, no fix agents (human architectural judgment required — documented Rule #58 exception)
  - STOP gate between waves, per-wave push/PR/merge/cleanup cycle

**Unchanged:** skills, rules, CLAUDE.md, settings.json
 no changes (not in diff)

**CLAUDE.md:** no changes needed

**settings.json:** no changes needed

### Commit

`569bf17` chore: sync with cc-rpi blueprint v1.15.0 - pushed to origin/develop (390 test files, 7001 tests passing)

### Notable New Capabilities

/pre-launch uses opus for deeper analysis, adds Staff FE/BE engineers, produces structured report with machine-parseable finding IDs.

/remediate now processes findings in 3 priority waves. Wave 3 items get GitHub issues but require human judgment (aligns with Rule 58 100% coverage exception).
