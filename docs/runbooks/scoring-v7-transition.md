# Runbook: v6 ↔ v7.2 scoring selection

This is the current flag-only transition protocol. It is not a record of a
production rehearsal and authorizes no production operation. Local fixture
checks and their exact candidate proof are recorded separately. Production
migration, recompute, flag mutation and release require their own explicit
authorization.

## Stored policies and shared rendering

| Concern | Legacy | Current observed point |
|---|---|---|
| Machine policy | `v6` | `v7.2` |
| Durable observation | `metrics_snapshots` (legacy EMA) | `scoring_v7_receipts`, policy-qualified trend anchors and `scoring_observed_current` |
| Receipt cache | historical receipt key retained | separate observed receipt key |
| SVG/OG artifact cache | explicit `v6` policy segment | explicit `v7.2` policy segment |
| Read selection | `scoring_v7_rendering=false` | `scoring_v7_rendering=true` |

Historical machine `v7` / algorithm `v7.1` remains independently replayable.
The shared application cache version is not a scoring-policy boundary. Image
keys, locks and URL versions include the selected machine policy. Exact
receipt caches bind revision and content hash to durable manifest authority.

A single captured `ScoringRenderSelection` is passed through issuance,
materialization and rendering. The dedicated flag reader bypasses generic
feature-flag maps/Next caches, retaining authority for at most five seconds and
only within the same UTC day. Failure is explicitly unavailable and noncacheable;
it does not become an authoritative false flag.

## Enablement after separate authorization

1. Admit the additive schema using the migration runbook and real authorized
   production credentials. A disposable local database is not production
   admission proof.
2. Verify the exact deployed code/registered policy and public consent scope.
   If recompute is needed, prepare the exact handle list and local dry-run
   outputs first. The older `scripts/scoring/migrate-v7.ts` targets the archived
   migration path; do not represent it as a v7.2 production migration.
3. Mutate only `scoring_v7_rendering` through the authorized admin flag action.
   Read back persistence and the separate edge purge outcome.
4. Check one authorized consenting fixture across badge, share, OG, Studio,
   APIs and verification. Active receipts supply the same policy/identity and
   canonical values. Missing receipts may use explicitly labelled v6;
   unavailable authority may not masquerade as genuine absence.

Record performed checks and exact identities. Do not mark these production
steps rehearsed because local fixtures passed.

## Rollback is flag-only

With explicit authorization, set `scoring_v7_rendering=false` through the admin
action and read it back. No code revert or new deployment is required. The
mutation invalidates the dedicated flag cache and attempts the global
`scoring-images` edge tag purge. Per-handle publication/configuration writes
invalidate both policy image namespaces and both SVG/OG edge tags.

A successful database mutation with a failed purge reports persisted success
and purge failure separately. Retry the idempotent purge action; do not claim
all images refreshed. Forced flag/config/receipt checks before and after cache
writes remove entries raced by a policy switch. No selected-v7.2 yesterday
image fallback is allowed, because old Craft may have expired at rollover.

Under the bounded online freshness assumptions, five seconds of flag authority
plus at most 300 seconds of image response freshness gives **≤305 seconds** to
converge even when immediate purge fails. Responses carry no stale-while-revalidate
or stale-if-error allowance. Current-policy response lifetime is also capped
at the end of its captured UTC date. The bound applies to online requests and
caches honoring response headers; independently downloaded images and external
proxies that disregard them cannot be recalled. Storage/flag failures use
no-store, explicitly unavailable responses rather than extending stale bytes.

The tradeoff is more policy/manifest reads and more frequent image revalidation.
Landing standings and version-selecting APIs are dynamic/no-store so a long
page cache cannot outlive the flag. Current standings never mix legacy rows
into a current-policy ranking.

**Never delete receipts or roll back a migration to change read selection.**
Keep historical verification and registered replay intact. Public data removal
for owner withdrawal/deletion is a separate authorized lifecycle operation;
a rollout rollback is not consent withdrawal.

## Before a production attempt

Record the exact candidate proof, schema admission, authorized handle scope,
flag state, named operator, rollback flag action and purge/fallback observations.
The historical empirical pilot remains unperformed under the existing owner
decision; do not invent a passing result or reopen that decision as a blocker.

See [the release playbook](../release/release-playbook.md),
[current spec](../impact-v7.md), [replay](../scoring-reproduction.md) and
[consumer inventory](../scoring-consumer-inventory.md).
