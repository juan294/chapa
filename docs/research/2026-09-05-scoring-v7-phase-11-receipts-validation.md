# Scoring v7: immutable receipts and independent replay validation

Scope: S12 / #1307. GPT-6 Astra implemented the receipt contract and independent calculator. Independent Astra review approved the final corrections and completed a dedicated simplify pass. Full integration checks then passed. S12 is verified; S13 persistence, S14 issuance verification, consumer adoption and empirical validation remain required before relaunch.

Public receipts contain the explicit reference window, complete eligible count bounds, every normalization and weighted contribution, exact results and displayed values, optional separate Craft, structured coverage/rubric metadata, opaque receipt-local identities and pinned policy/algorithm digests. Strict validation excludes private names, URLs, reports, evaluator identifiers, tokens and unrecognized fields at every depth. Canonical JSON fixes key order, Unicode/UTF-8, binary64 spelling, dates and negative zero; invalid or silently altered JSON values are rejected. Sealing detaches and freezes the payload and hashes its canonical bytes. These steps identify content; they do not establish source truth, issuance authentication or consent.

The separately coded CLI recomputes core/Craft arithmetic and all intermediate traces without importing production calculators, network access, credentials or an ambient clock. Inputs, clamped counts, constants, hashes, labels, displayed integers and point/range classification remain exact. Internal arithmetic comparisons use the declared absolute tolerance of 1e-10, including integer-valued intermediate results. Missing Craft, no observed portfolio and measured zero remain distinct; none changes the core. Legacy v6 records lacking complete evidence remain non-replayable, never reconstructed from guesses.

Review corrected direct publication accepting metadata that its projection helper rejected, future data-through timestamps and contradictory complete coverage, and exact internal-float comparisons that defeated the documented replay tolerance. Shared metadata validators now cover projection, parsing, sealing and hash verification. Direct recomputed-hash regressions demonstrate that a fresh hash cannot legitimize contradictory rubric metadata or incorrect arithmetic. Complete coverage cannot claim incomplete discovery or an intersecting unknown period. Independent review and simplify approved these final bytes after the temporary agent-capacity interruption recorded in the earlier checkpoint.

## Sequential local verification

- Scoped tests: 2 files / 13 tests passed.
- Fixtures include frozen zero/saturation cases, 250 deterministic randomized inputs, altered counts/trace/hash/metadata, canonicalization rejection boundaries and one-year clock independence.
- The actual CLI ran in Honolulu and Tokyo with fetch and socket connections disabled and produced identical results.
- Full typecheck and lint: passed. Lint retains three existing unused-destructuring warnings in the S07 test fixture; there are no lint errors.
- Full suite: 549 files / 9,014 tests passed.
- Coverage with unchanged thresholds: statements 94.66%, branches 89.70%, functions 95.10%, lines 97.14%.
- Scripts coverage, circular dependency check and production build: passed locally.

No schema or durable write belongs to S12; S13 and S14 own those contracts. Logs are under `logs/scoring-v7/s12-*.log`, with the exact seven approved files recorded in `s12-import-manifest.json`. No push, PR, hosted CI, deployment or production operation was performed. Synthetic replay checks establish declared arithmetic reproducibility, not empirical fairness or causal impact.

```text
packages/shared/src/canonical-json.test.ts
scripts/scoring/reference-calculator.test.ts
```

The [reproduction guide](../scoring-reproduction.md) documents execution, exact hashing, artifact identities, privacy boundaries and historical limitations. Logical receipt families stay stable across corrections to a reference context; immutable revision IDs identify each stored payload and its verification/revocation target. Storage must enforce that lineage and persist the exact issued envelope before exposing retrievable links.
