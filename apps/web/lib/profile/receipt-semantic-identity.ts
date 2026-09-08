import { canonicalJson, canonicalSha256, type EngineeringEvidenceInput, type PublicObservedScoringReceipt } from "@chapa/shared";

/** These normalized-evidence arrays are sets, not ordered policy rules. Sort
 * before projectReceiptEvidence allocates source/work ordinals. Never apply
 * this transform to a receipt's algorithm rules (e.g. archetype tie order).
 */
function orderedEvidence(value: unknown): unknown {
  if (Array.isArray(value)) {
    const keyed = value.map(item => orderedEvidence(item)).map(item => [canonicalJson(item), item] as const);
    return [...new Map(keyed).entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, item]) => item);
  }
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, orderedEvidence(item)]));
  return value;
}

export function canonicalizeReceiptEvidence(input: EngineeringEvidenceInput): EngineeringEvidenceInput {
  return orderedEvidence(input) as EngineeringEvidenceInput;
}

/** Private storage identity, never a public report/work identity. Excludes
 * allocated envelope lineage and incidental caller window references only.
 *
 * projectEngineeringLedger currently stamps its projected coverage and event
 * dataThrough with the caller's referenceTime. Normalize ONLY that demonstrably
 * synthetic value for the registered ledger. Genuine provider dataThrough,
 * actual ledger recordedAt/assessedAt, report periods and historical windows
 * remain part of identity. The returned digest belongs in service-only storage.
 */
export async function receiptSemanticIdentity(receipt: PublicObservedScoringReceipt, evidence: EngineeringEvidenceInput, privateLedgerIdentity: unknown = null): Promise<string> {
  const referenceTime = receipt.window.referenceTime;
  function normalize(value: unknown, key = ""): unknown {
    if (Array.isArray(value)) return value.map(item => normalize(item));
    if (!value || typeof value !== "object") return value;
    const row = value as Record<string, unknown>;
    const syntheticLedger = row.dataThrough === referenceTime && (
      (row.provider === "portfolio" && row.discovery === "registered_ledger")
      || (row.provider === "portfolio" && row.host === "ledger.chapa")
      || (row.discovery === "registered_ledger" && typeof row.source === "object" && row.source !== null
        && (row.source as Record<string, unknown>).provider === "portfolio" && (row.source as Record<string, unknown>).host === "ledger.chapa"));
    return Object.fromEntries(Object.entries(row)
      .filter(([name]) => !(key === "window" && row.referenceDate === receipt.window.referenceDate && name === "referenceTime"))
      .map(([name, item]) => [name, syntheticLedger && name === "dataThrough" ? "synthetic-ledger-reference" : normalize(item, name)]));
  }
  const { receiptId: _family, revisionId: _revisionId, revision: _revision, supersedesRevisionId: _supersedes, recordedAt: _recordedAt, action: _action, ...semantic } = receipt;
  void _family; void _revisionId; void _revision; void _supersedes; void _recordedAt; void _action;
  return canonicalSha256({ receipt: normalize(semantic), retracted: receipt.action === "retract", evidence: normalize(canonicalizeReceiptEvidence(evidence)), ledger: orderedEvidence(privateLedgerIdentity) });
}
