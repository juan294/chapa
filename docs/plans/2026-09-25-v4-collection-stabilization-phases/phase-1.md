# Phase 1: Remove the GitHub issue-closure scan

[batch-eligible] Depends on: none. Issue: #1351 (findings 2 and 3), #1346.
Branch: `fix/1351-drop-closure-scan`.

## Why

On 2026-09-24 at 19:15Z, `closures:` operations were 203,544 of the
roughly 206,000 known GitHub operations in unfinished jobs (research §2.3).
Each one is at least one GraphQL point from the shared 5,000-point hourly
allowance. The events they create are `issue_work` with
`acceptance: unknown("partial", "attribution_unknown")`
(`apps/web/lib/github/evidence.ts:456-463`). `acceptedKind` accepts
`issue_work` only with `linked_issue_result` (`apps/web/lib/impact/v7-evidence.ts:89-95`),
so these events never create a known delivery unit, activity date, project date
or category date. The one side path, a linked closer that adds a `files:`
operation (`evidence.ts:466-473`), only runs for a merged PR by the subject that
the merged search did not already find (`!prMeta[linkedWorkItemId]`).

## Step 1: equivalence test (write first, must pass on current code)

New file `apps/web/lib/impact/v7-evidence.github-issue-work.test.ts`.

```ts
// Fixture: realistic GitHub source, owned_and_contributed discovery
// (repositoryDiscoveryComplete false, reasons include discovery_incomplete),
// with accepted_change, authored_commit, review events, plus N GitHub
// issue_work events shaped exactly as evidence.ts:456-463 emits them
// (some with a merged closer by the subject, some by others, some with no closer).
const withIssueWork = input(events)
const without = input(events.filter(e => !(e.provider === "github" && e.kind === "issue_work")))
// Also flip github coverage.eventKinds.issue_work "partial" -> "unavailable" in `without`,
// which is what the collector reports after this phase.

it("GitHub issue_work never changes core scoring inputs", () => {
  expect(deriveCoreEvidenceV7(without).inputs).toEqual(deriveCoreEvidenceV7(withIssueWork).inputs)
  expect(deriveCoreEvidenceV7(without).observedCounts).toEqual(deriveCoreEvidenceV7(withIssueWork).observedCounts)
})
it("GitHub issue_work never changes the canonical display", () => {
  // Run both through the same path the receipt uses (score-receipt-observed.ts
  // / score-view-model.ts) and compare exact score, display score and tier.
})
```

Build the fixture with the existing helpers in the `lib/impact` tests (find
the ones used by `v7-evidence.test.ts`; do not invent a second builder).

If either assertion fails on current code, STOP. Report the difference to the
owner. The decision to drop the scan depends on this test.

## Step 2: failing collector tests

In `apps/web/lib/github/evidence-slice.test.ts`:

- "never requests V7Issues or V7Closures": run a full slice against the
  existing fetch fake; assert no request body contains `V7Issues` or
  `V7Closures`, and no checkpoint key starts with `issues:` or `closures:`.
- "drops legacy issue-closure operations": start from a checkpoint that holds
  `issues:R1` (done), `closures:I1` (not done) and `commits:R1` (not done).
  Assert that the returned checkpoint has no `issues:`/`closures:` keys, that
  `commits:R1` still runs, and that no request goes out for `closures:I1`.
- "reports issue_work unavailable": final coverage has
  `eventKinds.issue_work === "unavailable"`.

Update `evidence-parity.test.ts` expectations that depend on issue closures.

## Step 3: implementation

`apps/web/lib/github/evidence-queries.ts`:

```
- issues: `query V7Issues ...`
- closures: `query V7Closures ...`
```

`apps/web/lib/github/evidence.ts`:

```
  function registerRepo(repositoryId) {
    ...
    ensureOp(`commits:${repositoryId}`);
-   ensureOp(`issues:${repositoryId}`);
  }
- const issueRepo = ... ; state.issueRepo = issueRepo;
- const seededDataThrough = ...            // only reader was the issues `since`
~ const operations = checkpoint.operations
~   .filter(op => !op.key.startsWith("issues:") && !op.key.startsWith("closures:"))   // legacy in-flight checkpoints
~   .map(...)
+ delete state.issueRepo                   // drop the legacy map from resumed checkpoints
- if (op.key.startsWith("issues:")) { ... }
- if (op.key.startsWith("closures:")) { ... }
- const issuesComplete = ...
~ issue_work: "unavailable",
```

Keep `reasons.add("not_supported")`, which already covers the missing kind.
Update the `collectGitHubSlice` doc comment and the file-top comment in
`evidence-queries.ts` so they no longer mention issues.

`apps/web/e2e/helpers/redesign-upstream.test.ts:149`: update the comment
("files/reviews/commits: no fixture needed").

## Step 4: documentation

- `docs/accepted-risks.md`: new entry "GitHub collection shares one server
  token with the owner's account (2026-09-25)". State: all GitHub collection
  uses the server `GITHUB_TOKEN` (`apps/web/lib/platform/source-context.ts:49`),
  which is the owner's personal account (user ID 3944118). It shares 5,000
  GraphQL points per hour with the owner's own `gh`. Accepted because phase 1
  reduces the largest jobs from 30,000-74,000 operations to under about 3,000.
  `gh api rate_limit` misreports this allowance; read the `X-Ratelimit-*`
  headers from `gh api graphql -i`. Revisit if a job cannot finish within one day.
- `docs/impact-v7.md`: where it lists GitHub evidence sources, state that
  GitHub issue closures are not collected and why (no displayed-score effect).
- Runbook and CHANGELOG text: written in phase 5 ("Documentation for phases
  1 to 4"), so the batch phases do not edit the same files.
- After merge to `develop`: close #1346 with a comment that links the
  accepted-risk entry (REST: `gh api repos/:owner/:repo/issues/1346/comments`
  then `gh api -X PATCH repos/:owner/:repo/issues/1346 -f state=closed`, because
  the GraphQL allowance may be empty).

## Success criteria

### Automated
- Step 1 tests pass on the unchanged code and after step 3.
- `pnpm vitest run apps/web/lib/github apps/web/lib/impact apps/web/lib/collection`
- `pnpm run typecheck && pnpm run lint`
- Coverage floor for `lib/impact/**` holds.

### Manual
- None before release.
