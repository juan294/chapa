# Phase 4 evidence: commit-history 502 measurement

Measured 2026-09-25 about 07:15 local, with the server-equivalent token (`gh auth token`, GitHub user 3944118).
GraphQL allowance before the run: 4,985 remaining (from `gh api graphql -i` headers).

Repository `R_kgDORAaltg` is `juan294/paisaxe` (private, default branch `main`, 1,323 commits in total history).
Subject `MDQ6VXNlcjM5NDQxMTg=` (juan294). `since` = `2025-08-26T00:00:00.000Z`.
Cursor: `50c16b655dc3c96bca601bbe8bec8f7c9a38ef6e 1049` (the production job's saved cursor). `totalCount` 1,293.

## Page size and line counts at the saved cursor (3 runs each)

| Query | first | HTTP | Time (ms) |
|---|---|---|---|
| with additions/deletions | 50 | 502 x3 (nginx "502 Bad Gateway" HTML) | 11,017 / 10,714 / 10,766 |
| with additions/deletions | 20 | 200 x3 | 881 / 491 / 738 |
| with additions/deletions | 10 | 200 x3 | 379 / 461 / 789 |
| without line counts | 50 | 200 x3 | 455 / 420 / 817 |
| without line counts | 10 | 200 x3 | 471 / 483 / 423 |

Every successful query cost 1 point.

## Walking pages of 10 with line counts

| Offset | HTTP | Time (ms) |
|---|---|---|
| 1049 | 200 | 561 |
| 1059 | 200 | 682 |
| 1069 | 200 | 471 |
| 1079 | 502 | 10,546 |
| 1089 | 200 | 740 |

## Conclusion

GitHub computes line counts for every commit in the page inside a gateway timeout of about 10 seconds. At offset 1079 to 1088 one or more commits are too expensive to count even in a page of 10. The same page without line counts answers in under 1 s. So the cause is line counting, not history size or `since`.

The ladder order supported by the data: 50 with lines, then 20, then 10, then 10 without line counts. The absorb rule stays as the final bound.
