# The scoring-data integrity contract covers GitHub-derived stats only

- **Date**: 2026-08-11
- **Status**: Accepted
- **Issues**: #1060, #1061
- **Supersedes**: nothing. First written record of a contract that had evolved across
  #1002, #1004, #1045, #1046 and #1050 without one.

## Context

Chapa composes a user's `StatsData` from four sources:

| Source | Fetched with | Token-scoped? |
|---|---|---|
| GitHub | the request's session token, else the server `GITHUB_TOKEN` | **yes** |
| Bitbucket / Codeberg / GitLab | that platform's own linked OAuth token | no (not by the GitHub token) |
| EMU supplemental | the EMU PAT, by the CLI, ahead of time | no (not by the GitHub token) |

Only the GitHub half varies with the authenticating token's scope. `OAUTH_SCOPES`
is `read:user user:email` — no `repo` — so a user's own session token cannot see
their private-repo merges, while the server `GITHUB_TOKEN` can. That asymmetry is
the entire reason the integrity guards exist:

- `isDegradedPrFetch` — rejects a fetch that lost merged-PR visibility relative to
  a better-scoped baseline (#1002, extended #1045).
- the non-downgrading cache-write rule — refuses to let a lower-scoped fetch
  overwrite a better-scoped cache entry (#1004 phase 2, corrected #1046 and #1050).

### What went wrong

The guards were built on top of a pipeline that already composed non-GitHub data.
The supplemental merge shipped 2026-04-26 (`52d7fa04`); the guards arrived
2026-07-07 onward. Nobody decided that composed data should be the guard input —
it simply already was, and each subsequent fix inherited the arrangement.

Two defects followed:

- **#1060** — a rejected fetch re-cached the pre-fetch baseline, which had never
  been composed with the supplemental read moments earlier. A user who ran
  `chapa merge` and then clicked Refresh lost the merge for 6 hours; every further
  refresh restarted the clock. Observed in production 2026-08-11: a badge stuck at
  16/Emerging against a true 69/Solid, with the cache entry carrying a `fetchedAt`
  three hours older than the supplemental upload that was supposed to have
  invalidated it.
- **#1061** — `isDegradedPrFetch` reads `prsMergedCount`, which `mergeStats` sums
  across sources. A large enough EMU contribution lifts a scope-blinded GitHub
  fetch over both detection signatures, disarming the guard for precisely the
  users with the most data to lose.

Neither was reachable by the test suite: every guard test declared supplemental
`null`, every supplemental test declared the baseline `null`, and no test combined
them.

## Decision

> The integrity guards operate exclusively on **GitHub-derived** stats.
> Linked-platform and EMU supplemental data are composed onto whichever
> GitHub-derived value the guards select — never before them, and never into the
> protected baseline.

Two supporting rules make that checkable:

1. `stats:stale:v2:<handle>` holds **GitHub-derived data only**. It is the guards'
   comparison baseline, so it must be composed the same way as the fresh value it
   is compared against. Versioned to `v2` because pre-#1060 entries at
   `stats:stale:` hold composed data; judging a GitHub-derived fetch against one of
   those would misfire on exactly the EMU users this protects.
2. `stats:v2:merged:<handle>` holds the **composed** value callers receive.

In code (`apps/web/lib/github/client.ts`) this is one invariant: the guards only
ever see `primary`; `_compose` layers everything else onto the winner. A future
fourth data source belongs in `_compose`, never in the guard input.

## Consequences

- A rejected fetch is now **non-destructive for every non-GitHub source**. It was
  only ever non-destructive for GitHub data.
- **A rejected fetch returns the better-scoped composed value to the caller**,
  rather than the caller's own blinded data. Previously the two rejection paths
  disagreed: a degraded fetch returned the baseline, a pure scope downgrade
  returned the blinded fetch. A user whose refresh is rejected now sees their real
  score.
- **Overlay sources load on the GitHub-fetch-failure path too.** Serving a
  GitHub-derived baseline without re-composition would drop EMU and linked-platform
  data during a GitHub outage. The cost is three short-circuited link checks and one
  Redis read on a path that is already failing, well inside the 3000ms cache-miss
  badge SLO.
- The pipeline got smaller: three serve paths collapsed to one, and
  `_serveStaleAndReCache` plus the post-composition `fetchScope` mutation are gone.
- `heal-poisoned-stats` gained a third detection shape. Its two existing predicates
  key on `prsMergedCount`/`prsMergedWeight`/lines and could not see #1060 — that
  entry was structurally valid, merely pre-merge.

## Alternatives considered

- **Guard on GitHub + linked platforms, excluding only EMU.** Rejected: a user with
  many Bitbucket or GitLab PRs could still mask a blinded GitHub fetch. Same defect,
  different source.
- **Re-apply the supplemental only on the fallback paths, leaving the guards on
  composed data.** Rejected: fixes #1060 while leaving #1061 open by design.
- **Keep `stats:stale` composed.** Rejected: the baseline and the fresh value would
  be built differently, which is the ambiguity that caused this bug class.
