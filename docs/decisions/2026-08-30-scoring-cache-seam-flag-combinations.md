# The scoring/cache seam: what the seven flags do in combination

Date: 2026-08-30
Status: Accepted
Issue: #1192 (AR-S2)

## Context

`materializeProfile` and `getStats` thread seven independent behaviour flags
through one path. Each is documented where it is defined. What did not exist is
any artifact describing what the **combinations** do.

The measurement that motivated this is issue-number density on one seam: #800,
#826, #930, #1001, #1002, #1003, #1004, #1045, #1049, #1050, #1060, #1061,
#1083, #1086, #1193 across three files. Several were regressions of a prior fix
(#1050 corrected #1002's direction; #1060/#1061 corrected #1004's composition
order; #1193 removed the fold-order dependence BE-H1 had only made tolerable).

This document is a derived table, not prose. It replaces the corresponding
paragraphs in CLAUDE.md rather than joining them, because a duplicate
description of the same rules makes drift worse rather than better - that exact
failure produced the stale `stats:stale:` comment fixed in Wave 1. (S08, #1302, later removed the `stats:v2:merged:`/`stats:stale:v2:` keys altogether; 8fcc0371 restored a single grant-bound `stats:v3:<handle>` record, and the read-only row below was rewritten on 2026-09-07 to match.)

**2026-09-22 (badge-source-outage-resilience, phase 1)** — production
`/u/juan294/badge.svg` returned the generic load-error SVG because one linked
source's token refresh hit an ambiguous, durably-claimed "busy" outcome
(`refreshSourceLink` mapping it to `unavailable`, correctly never retried),
even though a complete aggregate had been collected minutes earlier under the
exact same grants. The old single-pass `getStats` read and refreshed every
linked source's authorization together, before ever consulting the cache, so
one ambiguous refresh turned a handle with a perfectly good aggregate into a
hard `null`. `getStats` is now a compatibility wrapper over `readStats`
(`apps/web/lib/github/client.ts`), which reads raw (unrefreshed) authorization
first, tries the exact-bound cache, and only then refreshes — with an
exact-bound `stale` last-known-good fallback at both the refresh-failure and
collection-failure points. The `readOnly`/`readOnly: false` rows below are
rewritten for this; the other flags are unaffected.

## Decision

One table. Rows are the flags; columns are the five effects that matter at this
seam.

`h` below is the lowercased handle.

| Flag | Cache keys READ | Cache keys WRITTEN | Live GitHub fetch? | Snapshot may persist? | Verification record may persist? |
|---|---|---|---|---|---|
| `readOnly: true`<br>(#1083, #1180; rewritten for the fresh/stale envelope, 2026-09-22) | `stats:v3:h`, bound to the RAW (unrefreshed) access context + linked-grant state. A same-day hit inside the 6 h fresh window is `current`; an exactly-bound hit up to 7 days old is `stale`. Anything else — foreign binding, expired retention, unversioned row — is a miss | **none** — no cache write, no token refresh, no provider/GitHub call, no inflight entry, either way | **No.** Never, `current` or `stale` | No — `statsComplete` is unconditionally `false` for a `stale` read, so `persistProfileSnapshot` refuses it the same as `readOnly: false` would refuse a genuinely incomplete one | No — same `statsComplete` gate |
| `readOnly: false` (default) | Same RAW-bound `stats:v3:h` read first. A `current` hit needs no refresh at all. On a miss/`stale` hit, each raw-authorized linked source is refreshed; a refresh failure (e.g. a durably-claimed "busy" token-refresh outcome) falls back to the SAME raw-bound entry as `stale` rather than `null`. A successful refresh rebuilds the binding (a link's `updatedAt` may have changed) and re-tries the cache under the new binding before collecting live; a collection failure falls back to `stale` under that new binding | `stats:v3:h`, bound to the caller's POST-refresh grant state (`referenceDate` inside the envelope, not the binding; 7-day Redis TTL, only 6 h of it `current`) | Only when no `current` hit exists anywhere in the sequence above | Yes for `current`, subject to `statsComplete` and the once-per-day SETNX guard. **Never for `stale`** — `statsComplete` is unconditionally `false` for it | Yes for `current`, subject to `statsComplete`. Never for `stale`, same gate |
| `inputsChanged: true`<br>(#826) | `stats:dirty:h` supplies the default when the option is absent | clears `stats:dirty:h` after the write | no effect | Yes, and **replaces** today's row (`dbReplaceSnapshot` UPSERT) instead of skipping on the `UNIQUE(handle, date)` conflict; also bypasses the same-day EMA lock for the value written | no effect |
| `ignoreSnapshot: true`<br>(#930) | **skips** the `getCachedLatestSnapshot` read entirely | none | no effect | Yes. With no prior, the EMA has nothing to smooth toward, so the persisted value equals the fresh score | no effect |
| `policy`<br>(EMA) | none | none | no effect | Selects the smoothing branch applied to the **snapshot** value only | no effect |
| `today`<br>(EMA) | none | none | no effect | The date the same-day lock compares against, and the date the snapshot is written under | no effect |
| `statsComplete`<br>(#1003, #1049) - *derived, not an input* | none | none | no effect | **Gate.** False blocks the write and emits `snapshot_skipped_incomplete_stats` | **Gate.** False makes `getPublicProfileVerification` return `null` |
| `statsFreshness`<br>(`"current" \| "stale"`, badge-source-outage-resilience, 2026-09-22) - *derived from `readStats`, not an input* | none | none | no effect | Folds into `statsComplete`: `statsComplete = statsFreshness === "current" && <structural validity>`, so `stale` alone is sufficient to block persistence regardless of how healthy the underlying counts look | Folds into `statsComplete` the same way. The v6 `ScoreViewModel.freshness` field also carries this label through to every renderer (badge, OG, share page); a committed v7/v7.2 receipt keeps its own independent freshness derived from its window, never this one |
| `fetchScope`<br>(#1004, #1050) - *derived, not an input* | none | **Gate on writes.** A lower-scoped fetch (`public`) never clobbers a higher-scoped entry (`authenticated`) | classified from the token on the fetch that produced it | indirectly - a rejected fetch never becomes the value a snapshot is built from | indirectly, same reason |

### The combinations that actually bite

Three pairings account for most of the issue history above:

1. **`readOnly` + cold key.** Before #1083 this triggered a live GitHub fetch on
   every public read of an uncached handle. It now returns the baseline or
   `null`. A caller that treats `null` as "no profile" rather than "not cached"
   will show an empty page for a real user.
2. **`inputsChanged` + the same-day lock.** The lock exists to stop a
   feedback loop where today's snapshot smooths toward itself. `inputsChanged`
   is the one sanctioned bypass, and it must set BOTH the EMA bypass and the
   UPSERT path - setting only one leaves the fresh score computed and then
   discarded on the UNIQUE conflict.
3. **`fetchScope` + composition order.** The guards must see GitHub-derived
   stats only. #1060 and #1061 were both caused by composing overlays before
   the guards ran: a rejected fetch discarded a fresh EMU merge, and a large
   supplemental could lift a scope-blinded fetch over both detection
   signatures. `_compose` runs after the guards, never before.
4. **`readOnly: false` + a refresh/collection failure.** This is the new one
   (2026-09-22). The rule is exact-authorization equality, not merely "some
   cache entry exists": a `stale` serve is only ever allowed when the raw (or,
   after a successful refresh, the post-refresh) authorization state used to
   attempt the failed operation is byte-for-byte the SAME as what wrote the
   cached entry. A changed link UUID/version, a disabled flag, a disconnect,
   or a different GitHub access context all change the binding, so the old
   entry becomes an unrelated miss rather than a wrongly-served stale read —
   the system falls through to live collection (which may itself succeed with
   a legitimately different aggregate, or fail to `unavailable`) instead of
   the old entry ever being returned.

Invalidation is unaffected by any of this: `stats:v3:h` is still the single
key `buildStatsCacheKey`/`invalidateProfileReadModels` delete, whether the row
they are clearing was `current`, `stale`, or absent.

### The not-found marker (LE-8-2, 2026-09-07)

`getStats` has a third outcome beside stats and `null`: the
`GitHubUserNotFound` sentinel (`lib/github/not-found.ts`), returned only when
GitHub answered with `user: null` beside its NOT_FOUND error or beside no
error at all. It is never written under `stats:v3:h` — that key holds stats
only — and it does not touch any row of the table above. Its own key,
`stats:notfound:h`, holds the sentinel for five minutes so repeat hits on a
handle nobody owns stop reaching GitHub; the live path checks it after a
stats miss and before fetching, and the read-only path reads it too, since a
read is all it is. Every other failure is still `null`, which is why an
outage or a rate limit can never become a 404 on the badge route or the
share page.

### What this document deliberately does not do

No property tests and no CI gate. The value here is comprehension; the
enforcement already exists as the integrity guards themselves, and new gates are
rejected by project policy.

## Consequences

- CLAUDE.md's "Same-day refresh signal", "Display vs. trend smoothing" and
  "Read-only cold-key reads" bullets are replaced by a pointer here. The
  degraded-fetch and integrity-contract bullets stay, because they carry the
  threat model rather than the flag behaviour, and the second already links
  `2026-08-11-scoring-data-integrity-contract.md`.
- A new flag on this seam belongs in the table above, in the same commit that
  adds it.
