# Universal v7.2 scoring, no consent, durable collection

Date: 2026-09-23. Status: accepted and implemented.

Plan: `docs/plans/2026-09-23-universal-v72-reliable-collection.md`. Research:
`docs/research/2026-09-23-v72-universal-issuance-and-collection-reliability.md`.

## What happened

`scoring_v7_rendering` was switched on at 09:57:16Z. juan294 granted consent at
10:03:23Z. Four source observations were written, but no receipt was ever
issued, and nothing was logged: GitHub stopped at 400 events on a single 30s
timeout, Bitbucket recorded an opaque `source_error` on its one repository,
and any `source_error` silently downgraded issuance to a skip. Every surface
kept rendering v6, and the landing top-three strip was empty. There was no
error a user or an operator could see, and no way to retry.

## Owner decisions (binding)

1. Every signed-up subject is scored with v7.2. The publication-consent
   option is removed completely: UI, API action, SQL predicates and the
   source-authorization gate.
2. No legacy v6 remains as a rendered or selectable policy on any surface. v6
   scoring code and v6 data are deleted, including `metrics_snapshots`,
   `verification_records` and v6 HMAC codes. The `scoring_v7_rendering`
   selector is retired.
3. Collection is durable and resumable, and it converges for very active
   profiles.
4. No silent failure. Every skipped or failed outcome is recorded, observable
   and shown to the owner with a reason and a way to recover.
5. Only signed-up users are scored. A signed-up user is a handle with a
   `user_platforms` row for `github`, the same test `dbUpsertUser` and #1239
   already use to decide whether a `users` row represents a real signup, not
   the email filter. Any other handle's badge shows a "not on Chapa yet"
   state with no number.
6. The first score is not published until collection is complete. Until then,
   surfaces show "scoring in progress" with progress figures.
7. Docs are updated to record the reversal.

## Why consent is gone, not fixed

The failure above was not a bug in the consent gate. It was two independent
things stacked on top of one honest state: no receipt existed because
collection never finished, and the outcome was invisible because nothing
recorded why. Consent added a third condition (an explicit opt-in) on top of
those two, for a product with one user and no adversarial audience to protect
anyone's evidence from. An opt-in step that gates a private beta of one is not
privacy, it is a place for a silent skip to hide. Removing it does not remove
any privacy guarantee that mattered: private evidence, raw report bodies and
reviewer rationale were never public regardless of consent, and remain
private under the same rules. What consent gated was whether a public,
already-anonymous numeric receipt got issued at all.

## What this supersedes

- `docs/decisions/2026-09-05-scoring-v7-policy.md`'s data-and-access boundary:
  `scoring_v7_subjects.public_evidence_consent` and the consent predicates on
  admission and rendering are gone. RLS, access-context isolation and evidence
  privacy stand unchanged; only the publication gate is removed.
- `docs/decisions/2026-09-08-scoring-v7-observed-point-policy.md`'s "Consent
  and privacy" framing of publication as an opt-in action: publication is
  automatic for every signed-up subject.
- `docs/plans/2026-09-08-v7-single-score-consistency-phases/policy.md`'s
  "Consent and privacy" section (import-flow acknowledgment, `p_acknowledged`
  as a publication gate): the acknowledgment step is retired.
- `docs/runbooks/scoring-v7-transition.md`'s flag-only v6/v7.2 rendering
  selection: there is one policy now, `SCORING_POLICY = "v7.2"`, and no flag
  to roll it back to a legacy render. Replaced by
  `docs/runbooks/scoring-collection-queue.md`.
- `docs/release/scoring-v7-release-packet.md`'s framing of v6 as a fallback a
  subject can still land on: v6 no longer renders anywhere.

Archived machine `v7` / algorithm `v7.1` receipts are untouched by any of
this: they remain immutable and independently replayable, because they are a
record of a prior release, not a rendering fallback.

## The #1239 boundary still holds

#1239 established that only the OAuth callback may write a `users` row,
because a public read (`/u/:handle`, the badge route) accepts any handle on
earth and must never register a stranger just for being looked up. Universal
scoring does not relax this. A subject is created and a collection job is
enqueued only from the authenticated, durable-write side of the app: the
OAuth callback, an owner's own refresh, recalculate or generate, a platform
reconnect callback, the warm-cache cron (registered users only) or an admin
action. `/u/:handle` and `/u/:handle/badge.svg` still never enqueue anything.
An unregistered handle gets a "not on Chapa yet" badge state, not a job, a
row, or a name and avatar borrowed from a stranger's GitHub profile.

## Why a durable queue, not a bigger single run

juan294's own backfill needed roughly 3,000 GitHub requests, more than one
`after()` run and close to the 5,000/h token ceiling; the search API is
separately capped at 1,000 nodes. Raising the single-run budget could not
converge for a profile like that. A Redis list queue was rejected too: the
repo has no queue primitive in Redis, while leases, retries and audit are
already proven in Postgres by the campaign-send pattern (migrations
023-033), and durability belongs next to the receipts it feeds, not in a
best-effort cache.

The chosen shape is a lease-based job table (`scoring_collection_jobs`,
migration 055) with checkpointed collector slices, worked by the
`collect-evidence` cron every 5 minutes. A crash or a rate limit does not
lose progress: a claim recovers an expired lease, a rate limit waits until
the provider's own reset time, a transient error backs off across 8
attempts, and a per-item 401/403/404 on a fan-out item (one deleted PR, one
now-private file list) is absorbed as partial coverage rather than failing
the whole job, per "unavailable is still not empty"
(`docs/plans/2026-09-08-v7-single-score-consistency-phases/policy.md:25`).
Only an identity-level failure (401/403 on the credential itself) is
terminal, and it is recoverable by reconnecting. When every one of an owner's
connected providers completes for the day, fan-in issues the receipt
(migration 056, `scoring_issuance_attempts`). Every state along the way
(`queued`, `running`, `waiting_rate_limit`, `retrying`, `failed`, `complete`)
is visible to the owner (`/api/scoring/status`, the share-page owner panel,
`/settings`), to the public (badge and share `collecting` / `action_needed` /
`unregistered` states) and to the operator (`/api/health`'s `scoringQueue`
block, `scoring_collection_failed` / `scoring_issuance_failed` /
`scoring_queue_stuck` alerts, PostHog events).

## What stays frozen

Receipt schema and scoring math are unchanged by any of this.
`computeObservedImpactV7`, the receipt parsers and the `v7.2` policy stay
byte-identical, including the 15 files `scoring-consumer-inventory.test.ts`
lists as byte-digested (`apps/web/lib/impact/{observed-v7,v7,v7-evidence}.ts`,
the three `lib/insights/report-craft*.ts` files, and nine
`packages/shared/src/*.ts` modules). This plan changed collection, gating and
rendering only.

## Migrations

`054_remove_publication_consent.sql` drops the consent predicates.
`055_scoring_collection_queue.sql` adds the job table. `056_scoring_status_and_fan_in.sql`
adds fan-in issuance tracking. `057_retire_v6_selector.sql` forces the
`scoring_v7_rendering` flag on for the running release during the deploy
window, so the flag's own row still exists but nothing new reads it. The
tables and columns this plan retires (`metrics_snapshots`, `verification_records`,
the consent columns, the flag row itself) are dropped by
`058_contract_v6_and_consent.sql` only after production is confirmed running
the new code (expand-migrate-contract, `docs/runbooks/migrations.md:203-215`).
That migration is a phase-7 production action requiring its own explicit
authorization; it has not been run as of this document.
