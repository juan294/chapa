# Reproducing registered scoring receipts

Local arithmetic replay is one gate in the [schema2 local-candidate release
procedure](release/release-playbook.md). It reads local files and does not
create a deployment, authenticate issuance or prove production readiness.
The historical empirical pilot remains unperformed under the existing owner
decision; a successful replay is conformance evidence, not empirical validation.

## Registered policies

The CLI dispatches exact registered policy/algorithm pairs: historical `v7` / `v7.1`, and observed-point `v7.2` / `v7.2`. Unknown pairs or changed artifact digests fail closed. The existing `parsePublicScoreReceipt`, `sealScoreReceipt` and `verifyScoreReceipt` APIs remain historical and narrow. Current receipts use `parseObservedScoreReceipt`, `sealObservedScoreReceipt` and `verifyObservedScoreReceipt`; cross-version verification uses the explicitly named registered APIs.

The current policy reports one point from four fixed equally weighted observed dimensions. Craft is a separate report-derived outcome calculation; it never enters the core average. `scripts/scoring/reference-calculator-v7-observed.ts` independently reproduces every scalar, original-bound archetype eligibility, outcome contribution, coverage, exact point and canonical display label. It imports no production calculator. The separately frozen `packages/shared/src/__fixtures__/observed-owner-envelope.json` reproduces exact46.40250879691149/display46 while the historical archived envelope still reproduces46–100.

Current ordinary displays round to the nearest integer. If core rounding crosses an unrounded tier boundary30/70/85, the display truncates to two decimals and is capped at boundary−0.01 to account for binary64 multiplication rounding a predecessor onto the boundary. The exact value remains separately available. Display values/labels, count inputs and constants compare exactly; calculated internal values permit absolute error at most1e-10. This tolerance never changes canonical bytes or hashes.

`score-receipt-observed-artifacts.ts` lists the exact ordered UTF-8 source files whose bytes concatenate without separators into the current algorithm digest. This includes the observed engine, historical eligibility engine, evidence derivation/aggregation, report classifier/calculator/selection, shared policy/validation/window dependencies, serialization, and the current strict parser. Its identity module is excluded to avoid self-reference. The current policy digest binds the September8 policy document. Tests verify actual file bytes against both digests. These current artifacts must remain immutable once receipts publish; subsequent changes require another registered revision.

Current public Craft contains canonical aggregate inputs, a scored/insufficient result, and, for scored reports, an opaque public report UUID with explicit replacement linkage. Raw report hashes, labels, HTML and private locators are absent. Expired Craft retains its **original** report inputs/window and result in `lastReport`, with no current numerical vertex. Replay checks the old arithmetic against that old window and validates expiry against the current receipt context. Raw-body expiry therefore cannot destroy numerical replay. A legitimate scored0 remains distinct from insufficient data, no report, expiry and unavailability.

Current evidence collections are canonicalized before receipt-local ordinal allocation by the materializer. Incidental ID allocation and caller clock copies do not change semantic identity; genuine source data-through times, coverage, report identity/period and changed observations do. These semantic rules govern durable no-op selection, while the immutable content hash still covers the entire issued payload exactly.

The sections below describe the preserved historical `v7` / `v7.1` contract unless explicitly stated otherwise.

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
