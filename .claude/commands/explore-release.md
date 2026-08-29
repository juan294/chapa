# Exploratory Release Charters

Model tier: **opus** — Opus session for the orchestrator. Charter agents run as
parallel `general-purpose` background Tasks; tier them by cost (sonnet is usually
sufficient for a single charter's execution).

Independent, fresh-context exploratory testing of a fixed release candidate.
This is explicit, risk-selected deep verification — it complements
deterministic suites but is not a required step of any default `/release`,
and it never tags or gates a release by itself.

It complements, and does not replace:

- **`/pre-launch` + `/remediate`** — static, code-as-written audit. Charters
  exercise the *deployed candidate's behavior* instead.
- **`/release`** — the tagging authority. Charters produce one report the
  release operator may read; they never feed an analyzer and never tag.

Read `docs/release/release-playbook.md` completely for release ordering and
authorization. This command is a verification tool, not a release procedure.

## Input

```text
/explore-release <commit-or-tag> [risk-scope]
```

Fix the exact commit or annotated tag under test — never infer a moving
candidate from `HEAD` or a branch. `risk-scope` is optional free text
narrowing which changed capabilities to charter (e.g. "OAuth and billing
only"); omit it to size charters from the full diff.

## Step 1: Fix the candidate and read the diff

1. Resolve the candidate to an exact commit SHA and its tree digest. Stop on
   ambiguity.
2. Compute the change surface:

   ```bash
   git log --oneline "$baselineTag..$candidateCommit"
   git diff --stat "$baselineTag..$candidateCommit"
   ```

3. Map changed paths to user-facing capabilities, actors, surfaces, states, and
   external seams. Do not trust stale docs — inspect the actual routes, jobs, and
   providers touched.

## Step 2: Generate charters

Size the charter set to the diff and any given risk-scope — **do not pad the
count**:

- tiny, isolated diff → 1 charter;
- normal release → 2–4 charters;
- more only for distinct high-risk capability groups.

Prioritize: outward writes, new/changed state transitions, vendor or retry
behavior, authorization boundaries, changed copy that promises an outcome, new
multi-surface flows, and recent escape classes.

Each charter names: changed capability, affected actors/roles, affected surfaces,
relevant states, external seams, primary risk hypothesis, and the authorized
environments and operations.

## Step 3: Execute each charter in a fresh context

Spawn one background Task per charter (`subagent_type: general-purpose`). Each
agent MUST be a fresh context that:

- did **not** implement the change;
- receives the candidate, its charter, and the safety contract — but not the
  implementer's untested assumptions as facts;
- works independently from the other charter agents;
- reports findings without fixing them mid-charter.

Each charter attempts the maneuvers relevant to its risk hypothesis (double
submission, error recovery, interruption/resume, cross-session/role isolation,
locale/viewport variation, copy-vs-behavior comparison, downstream readback,
and "should this exist?"), reporting each attempted maneuver as `passed` (with
evidence), `failed` (with reproduction + evidence), or `not-applicable` (with a
concrete reason). Size the maneuver set to the charter's risk — this is a
judgment call, not a fixed eight-row form.

Default timebox: **30 minutes** per charter. A timebox does not turn an untested
high-risk area into a pass — agents report where time expired.

## Step 4: Safety contract (non-negotiable)

Charter agents MUST:

- use synthetic, run-scoped fixtures prefixed `chapa-e2e-{runId}-`;
- operate only within the charter's authorization;
- never touch real user data;
- never trigger live charges, email, messages, destructive mutations, or hardware
  actions without explicit authorization;
- clean up only their own fixtures and prove zero unexpected residue;
- observe and report — never opportunistically change production or code.

## Step 5: Report

Each agent returns a charter result with: id, candidate commit, executor
context, timebox, risk hypothesis, changed capability/actors/surfaces/states/
external seams, environment and allowed operations, attempted maneuvers,
findings and triage, skipped high-risk areas, and fixture/cleanup evidence.

The orchestrator collects charter results into one concise report — findings
by severity, skipped high-risk areas, and fixture/cleanup evidence. Every
finding must be tracked, but creating an outward-facing issue requires explicit
issue-creation authorization; until then, retain it in the report.

Do not tag or release from this command. This is a report for the release
operator to read, not an input to an analyzer.

## Rules for this process

- Fixed, immutable candidate only.
- Fresh contexts only — the implementer does not review their own change here.
- Synthetic run-scoped fixtures; clean up only what you created.
- Findings are reported, not fixed, during the charter.
- Never a required or unconditional step of a default release.
