# Exploratory Release Charters

Model tier: **opus** — Opus session for the orchestrator. Charter agents run as
parallel `general-purpose` background Tasks; tier them by cost (sonnet is usually
sufficient for a single charter's execution).

Independent, fresh-context exploratory testing of a fixed release candidate. This
is **Wave B** of the E2E Pro release-verification system
(`docs/playbooks/e2e-pro-release-verification.md`) — the cheap, high-yield layer that
targets interaction and recovery failures deterministic suites miss.

It complements, and does not replace:

- **`/pre-launch` + `/remediate`** — static, code-as-written audit. Charters
  exercise the *deployed candidate's behavior* instead.
- **`/release`** — the tagging authority. Charters feed evidence into the release
  gate; they never tag.

Read `docs/release/release-playbook.md` completely for release ordering and
authorization, then read the local blueprint's Wave B section for the decision
detail. This command is the executable charter protocol, not a release
procedure.

## Input

```text
/explore-release quality/evidence/runs/{runId}/candidate.json
```

The candidate record is mandatory and contains `runId`, `baselineTag`,
`developCommit`, `candidateTreeDigest`, `previewUrl`, and exactly:

```json
{
  "authorization": {
    "environments": ["local-contract", "ci-build", "preview"],
    "operations": [
      "read-only",
      "synthetic-local-write",
      "authorized-preview-interaction"
    ]
  }
}
```

Do not infer a moving candidate from `HEAD` or a branch, expand those
authorizations, or continue if the record is malformed or inconsistent with the
prepared release run.

## Step 1: Fix the candidate and read the diff

1. Confirm `baselineTag`, `developCommit`, and `candidateTreeDigest` are
   immutable and match the prepared run. Stop on mismatch (playbook D06).
2. Compute the change surface:

   ```bash
   git log --oneline "$baselineTag..$developCommit"
   git diff --stat "$baselineTag..$developCommit"
   ```

3. Map changed paths to user-facing capabilities, actors, surfaces, states, and
   external seams. Do not trust stale docs — inspect the actual routes, jobs, and
   providers touched.

## Step 2: Generate charters

Size the charter set to the diff — **do not pad the count**:

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
- receives the candidate, its charter, the safety contract, and the report format
  — but not the implementer's untested assumptions as facts;
- works independently from the other charter agents;
- reports findings without fixing them mid-charter.

Every charter attempts all eight maneuvers, in risk-first order, and reports each
as `passed` (with evidence), `failed` (with reproduction + evidence), or
`not-applicable` (with a concrete reason). **Omitting a row invalidates the
charter.**

| # | Maneuver | Intent |
|---:|---|---|
| 1 | Try the action twice | Double-submit, repeat, duplicate, idempotency failures. |
| 2 | Edit after every error | Error recovery, stale-state clearing, successful resubmission. |
| 3 | Interrupt mid-flow | Back, refresh, close/reopen, resume, timeout, reconnect. |
| 4 | Use a second session or role | Stale authz, propagation, isolation, concurrency errors. |
| 5 | Switch locale and viewport/device | Formatting, truncation, direction, responsive, state-transfer failures. |
| 6 | Compare copy with outcome | Messages, labels, and promises match actual behavior. |
| 7 | Read back downstream state | Authorized HTTP, datastore, storage, event, or telemetry evidence. |
| 8 | Ask "should this exist?" | Challenge unsafe, contradictory, confusing, impossible behavior. |

For non-visual systems, adapt maneuver 5 to the relevant execution context (OS,
API version, shell, network condition, client SDK, tenant config, input encoding).

Default timebox: **30 minutes** per charter. A timebox does not turn an untested
high-risk area into a pass — agents report where time expired.

## Step 4: Safety contract (non-negotiable)

Charter agents MUST:

- use synthetic, run-scoped fixtures prefixed `chapa-e2e-{runId}-`;
- operate only within the charter's authorization;
- never touch real user data;
- never trigger live charges, email, messages, destructive mutations, or hardware
  actions without explicit authorization (playbook D20);
- clean up only their own fixtures and prove zero unexpected residue;
- observe and report — never opportunistically change production or code.

## Step 5: Report and gate

Each agent returns a charter result beneath
`quality/evidence/runs/{runId}/charters/{charterId}.json` with:

```text
id
candidate = developCommit
executorContext
timeboxMinutes = 30
riskHypothesis
changedCapability, actors, surfaces, states, externalSeams
environment, allowedOperations, safetyClass
candidateRecord = input candidate-record path
maneuvers 1 through 8
findings and triage
skippedHighRiskAreas
fixtures and cleanup evidence
decision
```

The `candidate` field is the immutable `developCommit`; the charter also retains
the input candidate-record path so its `candidateTreeDigest` remains
independently attributable without duplicating identity fields in the charter
schema.

The orchestrator collects them into the exact release-workflow input:

```json
{
  "exploratoryCharters": [],
  "manualObligations": [],
  "manualResult": {
    "scenarioId": "release.manual-arcs",
    "environment": "preview"
  }
}
```

Populate `exploratoryCharters` with the complete charter JSON files. The release
operator populates `manualObligations` with one passed candidate-bound execution
record per catalog `manualObligationIds` and
`manualResult` with the complete schema-valid `ScenarioResult` and its `ui` and
`http` evidence. Save this as
`quality/evidence/runs/{runId}/pre-merge-evidence.json`; the release-verification
workflow validates and merges it before running the pre-merge analyzer.

The release is **BLOCKED** when any of the following hold:

- any charter reports a failed maneuver or decision;
- a high-risk maneuver or area was skipped;
- cleanup evidence is missing;
- a finding lacks triage;
- an accepted exception is not recorded before tagging.

Present a consolidated summary: per-charter decision, all findings with severity
and reproduction, skipped high-risk areas, and fixture/cleanup evidence. Every
finding must be tracked, but creating an outward-facing issue requires explicit
issue-creation authorization; until then, retain it in the charter evidence.

Do not tag or release from this command. Hand the evidence to `/release`, which
gates on it.

## Rules for this process

- Fixed, immutable candidate only.
- Fresh contexts only — the implementer does not review their own change here.
- All eight maneuver rows, every charter, or the charter is invalid.
- Synthetic run-scoped fixtures; clean up only what you created.
- Findings are reported, not fixed, during the charter.
