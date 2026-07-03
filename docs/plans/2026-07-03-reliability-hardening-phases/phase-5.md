# Phase 5 — Process guarantees

**Depends on:** nothing (docs + skill/rule edits only).
**Batch:** **[batch-eligible]** — touches only docs, `.claude/`, and CLAUDE.md;
disjoint from all code phases. Can run any time, in parallel with Phases 1-4.
**Goal:** write the lessons into the workflow so the seam-bug *class* can't recur.
Tooling (Phases 1-4) catches the bugs; process stops them coming back.

---

## 5.1 Codify the two invariants

**Edit `CLAUDE.md` (Engineering rules) and/or the acceptance criteria:** add both
Chapa invariants from the playbook:

1. *A 500 on user input is always a bug.*
2. *A durable write that fails but reports success is always a bug* (per D1: failures
   must be observable — 5xx/`persisted:false`/capture; `loud` where unrecoverable,
   `graceful-but-logged` where recomputable).

State the policy: **new write endpoint ⇒ payload-matrix registration** (enforced by
`check:write-registration`, but written as policy too).

## 5.2 Instance-sweep rule (make explicit)

**Edit the `/remediate` skill and `/triage` skill** (`.claude/` skills) — require, for
every bug fix:

- Grep the **signature** of the bug class (the pattern, not just the named file).
- Fix + test **every** instance in the same change.
- Record the grep signature + full `file:line` list in the PR/report.
- A finding is not resolved until the class is closed.

(This already lives in project memory as a lesson; promote it to the skill text.)

## 5.3 Seam-bug regression standard

**Edit `/remediate` (or a testing rule in `.claude/rules/testing.md`):** every
production 5xx (`server_error` / `badge_5xx` / `oauth_callback_failure` in PostHog)
**and** every reported "said success but nothing saved" becomes a tracked issue with
a regression test **at the failing seam via the real stack** — a `*.contract.test.ts`
matrix test or a DB-reading E2E. **A unit-mock reproduction is explicitly NOT
sufficient** for a seam bug.

## 5.4 Weekly error triage

**Edit `/triage` skill:** fold error-tracker review into the existing agent-report
triage cadence — covering **both** PostHog `server_error` events **and** the new
client-error stream (Phase 4.3) — feeding §5.3.

## 5.5 Pre-launch gate additions

**Edit `/pre-launch` skill** (and the CLAUDE.local.md pre-launch audit spec):
- **qa-lead:** verify `pnpm run test:contract` is green and every write route is
  matrix-registered (`check:write-registration` exits 0).
- **devops:** verify the cron-heartbeat health gate passes and the nightly prod-probe
  workflow exists and is scheduled.

## 5.6 Reference the playbook

**Edit `CLAUDE.md` Project File Locations table** (or the docs index): add
`docs/playbooks/reliability-hardening-playbook.md` as the reliability reference, and
this plan under `docs/plans/`.

---

## Success criteria

**Automated:**
- [ ] None (docs/process only). Optionally: a link-check that the plan's phase-file
      links resolve.

**Manual:**
- [ ] `CLAUDE.md` states both invariants + the new-write-endpoint-registration policy.
- [ ] `/remediate` and `/triage` skills contain the instance-sweep rule + the
      real-stack seam-regression standard.
- [ ] `/pre-launch` qa-lead + devops checklists include the contract-suite,
      registration-gate, and cron-heartbeat items.
- [ ] Playbook + plan referenced from the docs index.
- [ ] A dry-run mental walk-through: a hypothetical new write endpoint added without a
      contract test is caught by CI (`check:write-registration`) AND flagged by the
      updated `/pre-launch`.

## Files touched

- edit: `CLAUDE.md`, `CLAUDE.local.md` (pre-launch spec), `.claude/skills/` for
  `/remediate`, `/triage`, `/pre-launch` (per the skill file layout),
  `.claude/rules/testing.md`, docs index.

## GitHub issues

None required (process). Optionally one `type: docs` tracking issue for the
process-doc updates.
