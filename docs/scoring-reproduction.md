# Reproducing an issued v7 score

A public v7 receipt reproduces arithmetic over issued counts and evidence-completion bounds. It does not prove private-source truth, reviewer independence, developer ability or causal impact. Constants are declared product choices; empirical evaluation remains pending.

From this repository, with dependencies already installed, run:

```sh
pnpm exec tsx scripts/scoring/reference-calculator.ts receipt.json
```

The file is a JSON envelope with `receipt` and `contentHash` fields. The CLI reads only that local file and local code. It uses no secrets, network or ambient clock. It rejects unknown policies, unexpected fields, hash mismatches and disagreement in any numeric trace or displayed result. A successful result says `arithmetic_reproduced`; it is not an issuance signature verification. S14 owns durable issuance authentication and revocation.

The implementation in `scripts/scoring/reference-calculator.ts` independently implements normalization, four fixed core weights, exact/range rendering, unrounded tier thresholds, archetypes and optional Craft. It never imports a production calculator. It checks every intermediate step as well as outputs, with 1e-10 absolute tolerance for internal arithmetic (including integer-valued internal results), while count inputs, clamped counts, constants, displayed integers, labels and point/range classification remain exact. Canonical bytes and their hashes are never tolerance-normalized. Numeric inputs already represent deduplicated eligible count bounds: replay does not independently discover repositories, inspect private evidence or reassess semantic rubric verdicts.

## Serialization and content identity

`canonical-json-v1` is exactly:

- Plain JSON objects only; keys sorted by ascending UTF-16 code units, without locale comparison. Arrays retain their declared order, including evidence/source ordinals.
- Valid Unicode scalar strings preserved without normalization and encoded as UTF-8. Lone surrogate code units are rejected.
- Finite binary64 numbers use ECMAScript `JSON.stringify` spelling; negative zero becomes `0`. No intermediate rounding. Nonfinite numbers, BigInt, undefined, sparse/extended arrays, symbol keys, accessors, hidden properties, nonplain objects and cycles are rejected.
- No whitespace or trailing newline in the hashed payload. Dates are explicit normalized UTC RFC3339 strings with millisecond precision; a Date object is invalid. All three window copies must agree with the explicit 365-date window.
- SHA-256 covers exactly these canonical receipt bytes. The `contentHash` envelope is excluded from its own digest. The immutable payload includes receipt/revision identity, reference time, coverage, rubric results, core and optional Craft, policy/algorithm identity and the complete trace.

`sealScoreReceipt` validates the strict public schema, detaches and recursively freezes the payload, then computes its digest. It validates trace arithmetic and outputs before sealing. Independent replay separately recomputes the arithmetic. Sealing is content addressing, not durable storage or publication consent. Revisions use distinct randomly allocated UUIDv4 IDs; later revisions name their predecessor. `receiptId` identifies the logical receipt family and remains stable across corrections to the same reference context. `revisionId` identifies one immutable payload: S13 maps it to `scoring_v7_receipts.id`, with `supersedes_id` pointing to the predecessor revision ID. S13 enforces family/reference lineage; S14 issuance links and revocation references must consistently identify the revision. Persisted chain consistency is enforced by the storage owner. Never modify an issued payload or reuse its revision ID for corrected content.

## Pinned artifacts

`RECEIPT_ALGORITHM_V7` names revision `v7.1`. Its policy digest is SHA-256 of the exact UTF-8 bytes of `docs/plans/2026-09-05-scoring-relaunch-phases/policy.md`. Its algorithm digest is SHA-256 of the ordered byte concatenation of `apps/web/lib/impact/v7.ts` followed immediately by `apps/web/lib/insights/craft-v7.ts`, with no separator or newline added. The independently tested rules and all trace constants also live in each receipt. Tests verify both digests against these artifacts. Changing either artifact requires a reviewed new identity and preservation of old replay support; never silently repin already issued receipts.

## Public and private boundaries

`projectReceiptEvidence` allocates source/work ordinals (`source-1`, `work-1`) from the publisher's ordered, resolved ledger projection. Both direct receipt publication and projection reject duplicate work/criterion entries, retracted rows and accepted self-reports or accepted verdicts without the demonstrated-criterion reason; this function does not resolve raw revision chains. The subject is `subject-1`. These are receipt-local references, never hashes of private names. Persist the ordered projection with the immutable receipt; reordering a source or criterion array intentionally changes its identity.

The strict receipt schema rejects all unrecognized fields at every depth and accepts only fixed safe codes, enums, numeric values, UTC dates, UUIDv4 issuance identities and fixed artifact digests. Private hosts, account IDs, repository names, paths, URLs, raw reports, evaluator identities and free-text rationale have no receipt fields. Only rubric v7 is supported. Source data-through timestamps cannot exceed the receipt reference time. Complete coverage requires complete repository discovery and no unknown period intersecting the scoring window; outside-window periods are retained. Owner/authorized-reviewer evidence exports remain separate protected data; the receipt does not implement an owner export route.

No Craft payload (`null`), no eligible portfolio (`not_observed`) and an assessed portfolio with measured zero (`observed` with zero) remain distinct. None changes the four-dimension core.

Public aggregate receipt retention ends on owner withdrawal/deletion. S14 removes public access/private backing data and retains only a content-free revocation tombstone. Independently downloaded copies cannot be recalled; publication consent must explain that consequence.

## Historical limits and verification

Existing v6 records without complete saved inputs remain `legacy_not_replayable` under `VersionedScoringRecord`. This CLI rejects them instead of inventing missing evidence or running today's policy over guessed historical inputs. Legacy issuance links retain their historical semantics; a valid original link does not inspect an edited SVG.

Scoped tests cover frozen zero/saturation cases, 250 deterministic randomized point/range inputs, all numeric traces, absent/measured-zero Craft, malicious extra fields, mutated hashes/results, artifact digests, and the actual CLI in Honolulu and Tokyo with socket/fetch access disabled. A fake-clock replay one year later checks that receipt reference time controls arithmetic. These synthetic checks establish reproducibility, not empirical scoring validity.
