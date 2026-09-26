# Phase 4: Reduce and identify large evidence without whole-source arrays

Depends on: Phase 3. Batch: sequential.

## Red parity tests first

Use `aggregateEngineeringEvidence`, `deriveCoreEvidenceV7`, `computeObservedImpactV7`, and `receiptSemanticIdentity` as reference oracles (`packages/shared/src/scoring-aggregation-v7.ts:232-310`, `apps/web/lib/impact/v7-evidence.ts:159-180`, `apps/web/lib/impact/observed-v7.ts:70-76`, `apps/web/lib/profile/receipt-semantic-identity.ts:29-46`). Generate the same evidence in different provider orders, page sizes, event orders, and duplicate layouts. Assert exact aggregation selection, lower/upper counts, activity calendar, limitations, exact/display score and tier, public projection, and the private semantic digest. Include mirrored acceptance, canonical aliases, unclear attribution, large work groups, and supported quality criteria. Run the new tests red before switching production issuance.

## Implementation

```ts
const reducer = beginObservedEvidence(window, sourceManifests, ledger);
for (const source of sourceManifests) {
  for await (const page of validatedSourcePages(source)) reducer.addPage(source, page);
}
const core = reducer.finish();
const digest = await canonicalEvidenceDigest(reducer.canonicalSpool(), receipt, ledger);
publishOnlyAfter({ allPagesVerified: true, scoreAndDigestValid: true });
```

The reducer keeps the cross-source maps needed for work selection, aliases, dates, support references, and attribution. It does not retain full event objects once a page has been reduced. For unclear attribution, keep the small alternative count state while processing each event rather than running a second full-array aggregation (`apps/web/lib/impact/v7-evidence.ts:160-164`). Preserve the pure scoring policy in `apps/web/lib/impact/observed-v7.ts:23-67`; only its input construction changes. Build `resolvedCriteria` from the reducer's selected work/reference state rather than rescanning every original event (`apps/web/lib/profile/score-receipt-observed.ts:31-102`).

The canonical digest is an exact-format constraint, not an opportunity to change hash semantics. Stream canonical JSON fragments in the same property and lexical array order that `canonicalizeReceiptEvidence` currently creates (`apps/web/lib/profile/receipt-semantic-identity.ts:3-17`). Use bounded sorted runs or a canonical-key index for events; verify byte equality to the old serializer before hashing on fixtures small enough for both paths. The digest of unchanged evidence across a release must remain unchanged, preventing a spurious new receipt revision. Do not replace it with sorted event hashes or a new digest version without a separately reviewed plan.

Change the issuance collector to pass manifests/pages rather than concatenated provider arrays (`apps/web/lib/profile/score-receipt-v7.ts:62-102`, `score-receipt-observed.ts:155-206`). A page read failure aborts issuance and preserves the previous receipt through the current `preserve("source_error")` path (`score-receipt-observed.ts:127-132,170-176`). Keep report-only writes on their existing retained-core route (`score-receipt-observed.ts:135-153`).

## Success criteria

### Automated

- Parity tests pass at 1, 999, 1,001, 17,572, and 100,000 events, with randomized page/order splits and a mixed-provider case.
- The benchmark from Phase 1 proves 100k issuance within the configured execution budget and peak RSS at most 70% of configured memory, while the receipt/public score and private digest match the reference on fixtures where the reference can run.
- A failed page, digest mismatch, or reducer invariant cannot publish a receipt; existing receipt remains authoritative and fan-in can retry.
- Run targeted scoring/identity tests, `pnpm run typecheck`, `pnpm run lint`, `pnpm run test:coverage`, then local DB contracts sequentially.

### Manual

- None before a separately authorized release. If exact digest parity or the memory budget fails, stop and revise this plan rather than raising the cap.
