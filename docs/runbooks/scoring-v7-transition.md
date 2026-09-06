# Runbook: the v6 → v7 scoring transition

Status: rehearsed locally. **Not authorized for production.** Production
migration, recompute and release each need separate explicit authorization from
the owner; nothing in this document grants any of them.

## Why this transition is cheap to undo

It is additive. v7 writes new receipt revisions and new cache entries in their
own namespace; it rewrites nothing v6 owns.

| Concern | v6 | v7 |
| --- | --- | --- |
| Cache namespace | `CACHE_VERSION = "v2"` | `SCORING_V7_CACHE_VERSION = "v7"` |
| Durable score | `metrics_snapshots` | `scoring_v7_receipts` (+ trend anchors) |
| Badge artifact | `BADGE_RENDER_VARIANT` | unchanged until the numbers change |

The namespaces are separate on purpose. One shared namespace would let a mixed
deployment serve a v7 label over a v6 payload — a request reading a v6 entry
gets v6 math and a v6 label, a request reading a v7 entry gets v7 math and a v7
label, and neither can be mistaken for the other. That is the single failure the
split exists to make impossible.

## Rehearsal

```bash
# Plan only. Reads nothing, writes nothing, calls nothing.
pnpm exec tsx scripts/scoring/migrate-v7.ts <handle>...
pnpm exec tsx scripts/scoring/migrate-v7.ts --json <handle>...

# Local rehearsal, refused without the explicit target.
CHAPA_MIGRATION_TARGET=local pnpm exec tsx scripts/scoring/migrate-v7.ts --apply <handle>...
```

Two dry runs over the same handles produce byte-identical output, and the plan
is order- and case-insensitive, so a rehearsal can be repeated without drift.

The plan states, per handle: what is read, what is written, what is
invalidated, and — listed explicitly rather than left to inference — what is
preserved. Quote its `recomputes` total in any production authorization
request; it is one recompute per handle and no more.

## What must never happen during the transition

- **A v7 label over v6 math.** Enforced by the separate namespace and by
  `ScoreViewModel.policyVersion`, which every consumer reads. A v6 model is
  labelled `v6` and limited to `legacy_aggregate`.
- **Blended trend versions.** Different policy versions segment the trend; an
  EMA anchor from one version is never consumed by another.
- **A fabricated replay.** v6 records keep their non-replayable legacy status.
  Where inputs were never saved, reconstruction stays explicitly unavailable
  rather than being invented from a stored score.
- **A broken verification link.** Existing verification records and archived
  history survive untouched; a legacy link resolves to the legacy record.

## Rollback

Rollback is a **code change**, not a data operation:

1. Revert the read selection so consumers project the v6 model again.
2. Deploy the revert through the normal release path.

Do not delete v7 receipts, do not roll back a migration, and do not drop the v7
cache namespace. The v7 rows are valid issued artifacts whose verification links
may already be public; deleting them would break a promise the receipt made.
Stale v7 cache entries expire on their own TTL and are ignored while the read
selection points at v6.

## Before requesting production authorization

Have these concrete, not estimated:

- [ ] The exact handle list, and the `recomputes` total from a dry run.
- [ ] The data-access scope the dry run prints, reviewed against the consent
      state of each named handle.
- [ ] Confirmation that the empirical pilot in
      `docs/research/scoring-v7-validation-results.md` has been completed —
      it is a relaunch blocker and is currently **not started**.
- [ ] A named rollback owner and the revert commit prepared.

## Related

- Policy: `docs/plans/2026-09-05-scoring-relaunch-phases/policy.md`
- Spec: `docs/impact-v7.md`
- Consumers: `docs/scoring-consumer-inventory.md`
- Release procedure: `docs/release/release-playbook.md`
