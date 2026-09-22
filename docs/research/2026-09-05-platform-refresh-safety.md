# Platform refresh ownership and connection lifecycle

Status: reviewed and verified. Migration 046 was independently reviewed, one P1 gap was found and closed (release on reconnect, below), and migrations 001-046 were replayed on the disposable `chapa-scoring-v7` project with 153/153 local contracts in 45 files passing.

## Failure and required behavior

Independent B3 review found that two server instances could refresh the same rotating grant concurrently. The losing request could receive `invalid_grant` and delete the unchanged linked row before the successful request saved its replacement credentials. Comparing the row UUID/version only at completion did not prevent that sequence. Process-local in-flight sharing does not coordinate independent servers.

Credential errors no longer authorize automatic unlinking. A connected inaccessible source remains connected and unavailable, so it cannot silently disappear from score coverage. Only the owner’s explicit disconnect or administrative account deletion removes the connection.

The proposed durable claim allows one provider request while an attempt is unresolved. An uncertain network outcome cannot be treated as proof that a refresh grant was unused. Therefore there is no timed lease takeover, metadata-update reset or withdrawal/reconsent reset. An ambiguous or abandoned attempt requires explicit disconnect/reconnect unless its original successful claimant can still finish against the exact original row version. This deliberately favors preserving attribution and avoiding grant replay over automatic recovery. It does not claim exactly-once provider execution or recovery of a response lost after provider success.

## Operational data inventory

| Record | Contents | Access | Removal |
|---|---|---|---|
| `platform_token_refresh_attempts` | Link UUID, captured full-precision version, random attempt UUID, start time | Service-only claim/finish RPCs; service read inspection | Successful exact finish atomically clears the attempt; `user_platforms` deletion cascades it |

There is one unresolved row per connection, irrespective of later version changes. It contains no credential, provider response, private URL, evidence or owner handle. Its mandatory foreign key is `link_id -> user_platforms.id ON DELETE CASCADE`. The existing administrative deletion inventory already removes `user_platforms` by its real `handle` column; no fictitious child handle filter is introduced. Local contracts must verify the cascade through the actual parent deletion path.

The attempt belongs to the OAuth connection lifecycle. Evidence-consent withdrawal leaves the connection itself intact, so it also leaves an unresolved attempt barrier intact. Deleting only the barrier on withdrawal would make the same uncertain grant reusable after reconsent. Current evidence consent remains required by the proposed claim/finish RPCs; this does not grant legacy users consent implicitly. The temporary legacy path can return unavailable for expired pre-consent connections until the S15 consent/receipt transition is complete.

## Release on a superseded grant

The independent review of the 046 draft found that its stated recovery path did
not exist. `dbUpsertLinkedPlatform` reconnects with `onConflict "handle,platform"`,
so a reconnect updates the same `user_platforms` row and keeps its `id`. The
barrier is keyed by `link_id` and cascades only on parent deletion, so the new
grant inherited the stuck attempt and could never refresh again. Because every
failed provider outcome retains the barrier, a single timeout or 5xx made a
connection permanently unrefreshable, and the only escape was an explicit
Disconnect before reconnecting. The drafted cascade contract did not catch this:
it deleted the parent row directly rather than exercising a reconnect.

`platform_token_refresh_release(owner, actor, platform, link_id, link_version)`
closes it. It locks the link at the exact version the caller names and deletes
only attempts whose `link_version` differs from it, so an attempt claimed against
the current grant is preserved and a provider request still in flight keeps its
barrier. `dbUpsertLinkedPlatform` calls it after a successful upsert for the
three refreshable platforms; the monotonic link-version trigger guarantees the
reconnect advanced the version, so a pre-existing attempt is always superseded.

Two properties make this safe rather than a hole in the barrier. A reconnect
mints a brand-new refresh token from a fresh authorization, so a release can
never cause the same refresh grant to be presented twice. And any old in-flight
attempt still fails its own `finish` with `stale`, because the reconnect already
advanced the row version. Release deliberately requires no consent: it removes
capability rather than granting it, and recovery must stay available to
withdrawn and pre-v7 subjects.

A release failure is logged and does not fail the connection; the worst outcome
is the stuck state that existed before, never a lost grant.

## Transaction boundaries

Claim validates owner/actor/provider, current consent, exact linked-row UUID/version and current barrier, with subject → link → attempt lock order. Only a newly created claim authorizes provider HTTP. Existing claims, including retries with the same attempt UUID, return busy. Missing or stale authority performs no provider request.

Finish validates the original attempt and row version, writes encrypted replacement credentials, obtains the database’s strictly newer microsecond version and removes that attempt in one transaction. Failure or lost authority preserves the barrier and cannot affect a replacement connection. A known successful response may retain a reusable refresh token; this is distinct from an unknown outcome.

Required local evidence includes competing independent clients, paused successful completion, ambiguous timeout with arbitrarily advanced time, unchanged grant after metadata updates, withdrawal/reconsent, replacement-link fencing, successful atomic finish, wrong actor/attempt/version, browser privilege denial, read-only paths and administrative parent deletion. Tests and SQL review are mandatory; this document is not their passing record.

All of the above is now covered, plus the reconnect release, current-version
preservation and release authority cases. Evidence:
`logs/scoring-v7/s08-046-contract-confirmed.log` (153/153 in 45 files against
migrations 001-046 on the disposable project) and `s08-046-db-reset.log`.
