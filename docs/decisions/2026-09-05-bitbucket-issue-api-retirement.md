# S04 amendment: retired Bitbucket issue APIs

Status: approved by the owner on 2026-09-25 (#1299 closed). Proposed: 2026-09-05.

## Verified change

S04 expected live Bitbucket issue closure event collection. Atlassian's official changelog states that the issue tracker API endpoints were fully removed on 2026-08-20. The issue support article now redirects to the general Bitbucket support page. Source: [Bitbucket Cloud changelog, 20 August 2026](https://developer.atlassian.com/cloud/bitbucket/changelog/).

## Concrete replacement scope

1. Continue live Bitbucket commit, pull-request and submitted-review collection, with the original date, identity, pagination and diff completeness requirements.
2. Mark native Bitbucket `issue_work` as `unavailable` with `not_supported` coverage. Never turn endpoint retirement into an observed zero, drop the connected source, or claim live closure collection works.
3. Before relaunch, support dated historical issue artifacts through the already-required S07 import and S11 evidence ledger. Preserve recorded closure actor, date, accepted-result linkage, artifact revision and provenance. An owner upload is self-reported until accountable assessment; it cannot impersonate a live provider observation or independently corroborated work.
4. Retain the original fairness regressions on historical evidence: another person's closure earns no individual closure/delivery credit; `updated_on` cannot substitute for the closure event date; unlinked closure does not earn Delivery; missing evidence keeps the relevant completion range open.
5. Update S04, S07/S11 acceptance mapping, S17 provider-capability wording and S18 cross-provider validation before relaunch. This replaces an unavailable transport; the scoring and attribution requirements remain mandatory.

No Jira integration, external messaging or remote deployment is proposed. Bitbucket `issue_work` ships as `unavailable` / `not_supported` (`apps/web/lib/bitbucket/evidence.ts`). Since #1351, `issue_work` earns credit only with a linked issue result, so native closure collection is not needed for scoring.
