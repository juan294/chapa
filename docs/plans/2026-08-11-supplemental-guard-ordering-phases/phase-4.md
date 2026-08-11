# Phase 4 — ADR and documentation `[batch-eligible]`

> Files: `docs/decisions/2026-08-11-scoring-data-integrity-contract.md` (new),
> `CLAUDE.md`, `docs/accepted-risks.md`
> No file overlap with phases 1, 2, 3.

## 1. Why

`docs/decisions/` holds 10 ADRs; grep for `fetchScope|degraded|supplemental|integrity|1004|1002`
matches only the unrelated deployment-stack ADR. The scoring-data integrity contract —
five issues and four months of iteration (#1002 → #1004 → #1045 → #1046 → #1050) —
exists only as code comments, CLAUDE.md bullets, and one `accepted-risks.md` entry.

That absence has a measurable cost: research §11 raised two questions
(what the guards should judge; what the baseline should hold) that **no artifact in
the repository could answer**. Both had to be escalated to the owner. This plan settles
them, and an ADR is where that belongs.

## 2. New ADR

`docs/decisions/2026-08-11-scoring-data-integrity-contract.md`, following the structure
of the existing ADRs (see `2026-07-16-vercel-json-must-live-in-root-directory.md` for
the house format — Status / Context / Decision / Consequences).

Content to record:

**Context** — the token-scoping asymmetry (`OAUTH_SCOPES` omits `repo`, so a user's own
session token is the weak one while the server `GITHUB_TOKEN` is private-inclusive);
the three boundaries of the contract; the #1060/#1061 ordering defect and how it arose
(supplemental merging shipped 2026-04-26, the guards 2026-07-07 onward — the guards
were layered onto a pipeline that already composed EMU data).

**Decision** — state the invariant in one sentence so it is greppable and quotable:

> The integrity guards operate exclusively on **GitHub-derived** stats. Linked-platform
> and EMU supplemental data are composed onto whichever GitHub-derived value the guards
> select, never before them and never into the protected baseline.

Plus the two supporting rules: `stats:stale:v2:<handle>` holds GitHub-derived data only;
`stats:v2:merged:<handle>` holds the composed value callers receive.

**Consequences** — records D4 (a rejected fetch now returns the better-scoped composed
value to the caller) and D5 (overlay sources load on the fetch-failure path).
Note that adding a fourth data source in future must extend `_compose`, never the
guard input.

## 3. `CLAUDE.md` updates

- Amend the "Scoring-data integrity contract (#1004, corrected #1045)" bullet: the
  cache boundary description must state that scope-ranked writes apply to
  GitHub-derived data, and that supplemental/linked-platform data composes on top.
  Add `#1060`/`#1061` to the issue trail and link the new ADR.
- Amend the "Supplemental EMU stats" caching bullet to name `stats:stale:v2:` and state
  that the baseline deliberately excludes supplemental.
- Verify the file stays within its character limit — it has been trimmed for this
  before (`6facbc` "Fix CLAUDE.md character limit exceeded"). Prefer editing the
  existing bullets over appending new ones.

## 4. `docs/accepted-risks.md` update

The "OAuth app requests no `repo` scope" entry (`:275-281`) states the mitigation as
*"a scope-blind refresh … is rejected (last-known-good served), not corrupting."*
That was true only of GitHub-derived fields; #1060 is the counter-example where
rejection **was** corrupting, for supplemental data.

Amend the Mitigation line to reflect post-#1060 behaviour: rejection now serves
last-known-good GitHub data recomposed with current supplemental and linked-platform
data, so a rejected refresh is non-destructive for every source. Keep the Decision and
Severity lines unchanged — the underlying scope decision is unaffected.

## 5. Success criteria

**Automated**
- `pnpm run lint` clean (markdown is not linted, but the repo-wide task must pass).
- No broken relative links: every path referenced in the new ADR resolves.

**Manual**
- Owner reads the ADR's Decision section and confirms the one-sentence invariant
  matches intent. This is the artifact future contributors and agents will be judged
  against, so the wording is the deliverable.
