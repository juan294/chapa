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
failure produced the stale `stats:stale:` comment fixed in Wave 1.

## Decision

One table. Rows are the flags; columns are the five effects that matter at this
seam.

`h` below is the lowercased handle.

| Flag | Cache keys READ | Cache keys WRITTEN | Live GitHub fetch? | Snapshot may persist? | Verification record may persist? |
|---|---|---|---|---|---|
| `readOnly: true`<br>(#1083, #1180) | `stats:v2:merged:h`, then on miss `stats:stale:v2:h` + overlays (`supplemental:h`, platform link rows) | **none** - the `_enrichWithLogins` backfill is suppressed too | **No.** Short-circuits to `_composeFromBaselineOnly`; returns `null` when no baseline exists | No - `persistProfileSnapshot` returns `false` immediately | No - `runPublicProfileSideEffects` returns before `deferProfileCacheWork` |
| `readOnly: false` (default) | same, plus a GitHub GraphQL fetch on miss | `stats:v2:merged:h` always; `stats:stale:v2:h` only when the fetch passes the integrity guards | Yes, on miss past the 6h TTL | Yes, subject to `statsComplete` and the once-per-day SETNX guard | Yes, subject to `statsComplete` |
| `inputsChanged: true`<br>(#826) | `stats:dirty:h` supplies the default when the option is absent | clears `stats:dirty:h` after the write | no effect | Yes, and **replaces** today's row (`dbReplaceSnapshot` UPSERT) instead of skipping on the `UNIQUE(handle, date)` conflict; also bypasses the same-day EMA lock for the value written | no effect |
| `ignoreSnapshot: true`<br>(#930) | **skips** the `getCachedLatestSnapshot` read entirely | none | no effect | Yes. With no prior, the EMA has nothing to smooth toward, so the persisted value equals the fresh score | no effect |
| `policy`<br>(EMA) | none | none | no effect | Selects the smoothing branch applied to the **snapshot** value only | no effect |
| `today`<br>(EMA) | none | none | no effect | The date the same-day lock compares against, and the date the snapshot is written under | no effect |
| `statsComplete`<br>(#1003, #1049) - *derived, not an input* | none | none | no effect | **Gate.** False blocks the write and emits `snapshot_skipped_incomplete_stats` | **Gate.** False makes `getPublicProfileVerification` return `null` |
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
