# Scoring v7.2 — local qualification and release packet

Updated 2026-09-08. This is the active packet for the observed-point policy;
the September5 research and completed historical reports remain unchanged.

> **Superseded in part, 2026-09-23.** Publication consent, the v6
> selected-or-fallback framing and the flag-only transition runbook this
> packet references are retired. See
> `docs/decisions/2026-09-23-universal-v72-no-consent.md` for what changed
> and why. The qualification procedure, evidence rules and empirical-pilot
> limitation below are unaffected and remain current.

**This packet authorizes nothing.** Implementation, local qualification,
production release, production migration and production recompute are separate
facts. Production remains untouched unless the owner explicitly authorizes the
relevant action.

## Current status

The current policy and owner decisions are recorded in
[`2026-09-08-v7-single-score-consistency-phases/policy.md`](../plans/2026-09-08-v7-single-score-consistency-phases/policy.md)
and [`2026-09-08-scoring-v7-observed-point-policy.md`](../decisions/2026-09-08-scoring-v7-observed-point-policy.md).

The earlier empirical pilot was **not performed**. The existing owner decision
permits this implementation without it; it is neither a passing empirical
result nor an unresolved request for pilot approval. Arithmetic, replay and
matched-fixture tests establish conformance to declared rules, not empirical
fairness, developer ability or external validity. Preserve that limitation.

The old packet's S04 approval/pilot blockers and instruction that publication
lifts the no-Preview rule are superseded. No authorization implicitly lifts the
standing prohibition on Vercel Preview deployment creation.

## What must agree

- Machine policy `v7.2` uses four equally weighted observed core points.
  Craft is report-derived, optional and zero-weight in the core. First valid
  scored report unlocks the fifth visible axis, including a measured zero.
- Expired/unavailable Craft retains the unlocked label and update guidance,
  without a current number or fake zero. Historical aggregate inputs remain
  replayable while retained under consent.
- Canonical display, exact arithmetic, tier, archetype eligibility and receipt
  identity agree across badge, Studio, dashboard, APIs, tools, history, emails
  and leaderboard. Mixed policy/window comparisons do not claim improvement.
- Historical machine `v7` / algorithm `v7.1` receipts and engines are unchanged.
  Legacy `v6` remains explicitly identified when selected or no receipt exists.
- Receipt-private report labels, body digests, paths and tokens never enter
  public output. Consent withdrawal/retraction and verification states retain
  their explicit meaning.

## Local evidence

Qualify the final exact commit and complete Git tree using the schema2
`local-candidate` procedure in [release-playbook.md](release-playbook.md).
All named local gates, allowlisted build artifact hashes and production-mode
loopback probes must actually pass. Prior phase logs under `logs/v7-point/`
are implementation evidence, not proof of an as-yet-unqualified final tree.
Do not carry their status forward across a later tracked commit.

Store local proof, manifests, browser results and review screenshots outside
the tracked candidate. Do not write an evidence commit after qualification.
The final packet for an attempt references those files and exact identities;
it must state any missing local gate rather than fabricating a result.

## Remote admission remains pending

Before any later push, inspect remote triggers read-only. A production-only
Ignored Build Step can still allow a Preview deployment object to be created;
skipping its build is not prevention. If no documented non-destructive
prevention is available, stop before push. Do not clear the guard or dispatch
remote verification to complete this packet.

Only a separately authorized production attempt can provide real production
migration admission, deployed commit/tree/deployment identity, production
probe results, and tag/release readback. Local checks cannot impersonate those
observations. No remote workflow, PR, deployment, message, production migration
or recompute is part of local qualification.

## Operational references

- [Current scoring spec](../impact-v7.md) and [offline replay](../scoring-reproduction.md)
- [Scored-consumer agreement](../scoring-consumer-inventory.md)
- [The collection queue runbook](../runbooks/scoring-collection-queue.md)
- [Release procedure](release-playbook.md)
- [Historical empirical status](../research/scoring-v7-validation-results.md)
