import { canonicalJson, createScoringWindow, type ReportCraftCandidate, type ReportCraftResult, type ReportCraftSelection, type ReportCraftSelectionInputs } from "@chapa/shared";
import { calculateReportCraftInputs, reportCraftPeriodStatus } from "./report-craft";

const conflict = (): ReportCraftSelection => ({ status: "conflict", reason: "same_period_requires_explicit_correction" });
const periodKey = (row: ReportCraftCandidate) => `${row.inputs.reportPeriod.endExclusive}|${row.inputs.reportPeriod.startInclusive}`;

/** Collapse true digest duplicates, then require one complete nonbranching
 * correction chain. Array order, score, and upload clocks never choose a head.
 */
function correctionHead(rows: readonly ReportCraftCandidate[], scoredIds: ReadonlySet<string>): ReportCraftCandidate | null {
  const byId = new Map<string, ReportCraftCandidate>();
  const byDigest = new Map<string, ReportCraftCandidate[]>();
  for (const row of rows) {
    const previous = byId.get(row.reportId);
    if (previous && canonicalJson(previous) !== canonicalJson(row)) return null;
    byId.set(row.reportId, row);
    const group = byDigest.get(row.contentDigest.value) ?? [];
    if (group[0] && canonicalJson(group[0].inputs) !== canonicalJson(row.inputs)) return null;
    group.push(row);
    byDigest.set(row.contentDigest.value, group);
  }
  const parents = new Map<string, string | null>();
  const representatives = new Map<string, ReportCraftCandidate>();
  for (const [digest, group] of byDigest) {
    const parentDigests = new Set<string | null>();
    for (const row of group) {
      if (row.supersedesReportId === null) parentDigests.add(null);
      else {
        if (row.supersedesReportId === row.reportId) return null;
        const parent = byId.get(row.supersedesReportId);
        if (!parent) return null;
        // Same-content reuploads have no new arithmetic revision.
        if (parent.contentDigest.value !== digest) parentDigests.add(parent.contentDigest.value);
      }
    }
    if (parentDigests.size !== 1) return null;
    parents.set(digest, [...parentDigests][0] ?? null);
    // Equivalent bytes may have duplicate storage IDs. This tie-break chooses
    // only an identity representative, never between different report scores.
    representatives.set(digest, [...group].sort((a, b) => a.reportId < b.reportId ? -1 : a.reportId > b.reportId ? 1 : 0)[0]!);
  }
  const roots = [...parents].filter(([, parent]) => parent === null);
  if (roots.length !== 1) return null;
  const child = new Map<string, string>();
  for (const [digest, parent] of parents) {
    if (parent === null) continue;
    if (child.has(parent)) return null;
    child.set(parent, digest);
  }
  let head = roots[0]![0];
  let lastScored: ReportCraftCandidate | null = null;
  const visited = new Set<string>();
  while (!visited.has(head)) {
    visited.add(head);
    const candidate = representatives.get(head)!;
    if (scoredIds.has(candidate.reportId)) lastScored = candidate;
    const next = child.get(head);
    if (!next) return visited.size === parents.size ? lastScored : null;
    head = next;
  }
  return null;
}

/** Current report selection only. The caller retains invalid-upload diagnostics
 * and historical reports privately; a failed upload cannot erase a good point.
 */
export function selectReportCraft(input: ReportCraftSelectionInputs): ReportCraftSelection {
  const none = (result: Exclude<ReportCraftResult, { status: "scored" }>): ReportCraftSelection => ({ status: "none", result });
  const unavailable = (reason: "source_error" | "outside_window") => none({ status: "unavailable", unlocked: input.previouslyUnlocked,
    point: null, lastReport: input.lastPublished, reason });
  try {
    const expected = createScoringWindow(input.window.referenceTime);
    if (canonicalJson(expected) !== canonicalJson(input.window)) return unavailable("source_error");
  } catch { return unavailable("source_error"); }

  const eligible: ReportCraftCandidate[] = [];
  const currentCandidates: ReportCraftCandidate[] = [];
  const insufficient: Extract<ReportCraftResult, { status: "insufficient_report_data" }>[] = [];
  let outside = false, invalid = false;
  for (const row of input.candidates) {
    if (!row || typeof row.reportId !== "string" || !row.reportId.trim() || row.contentDigest?.algorithm !== "SHA-256"
      || !/^[0-9a-f]{64}$/.test(row.contentDigest.value) || !(row.supersedesReportId === null || typeof row.supersedesReportId === "string")) { invalid = true; continue; }
    const calculation = calculateReportCraftInputs(row.inputs);
    if (calculation.status !== "valid") { invalid = true; continue; }
    try {
      if (reportCraftPeriodStatus(input.window, calculation.inputs.reportPeriod) !== "current") { outside = true; continue; }
    } catch { invalid = true; continue; }
    const candidate: ReportCraftCandidate = { reportId: row.reportId, contentDigest: { algorithm: "SHA-256", value: row.contentDigest.value }, supersedesReportId: row.supersedesReportId, inputs: calculation.inputs };
    currentCandidates.push(candidate);
    if (calculation.result.status === "insufficient_report_data") { insufficient.push(calculation.result); continue; }
    eligible.push(candidate);
  }
  if (eligible.length) {
    eligible.sort((a, b) => periodKey(a) < periodKey(b) ? 1 : periodKey(a) > periodKey(b) ? -1 : 0);
    const newest = periodKey(eligible[0]!);
    if (input.lastPublished) {
      try {
        const published = input.lastPublished.reportPeriod;
        if (reportCraftPeriodStatus(input.window, published) === "current"
          && newest < `${published.endExclusive}|${published.startInclusive}`) return unavailable("source_error");
      } catch { return unavailable("source_error"); }
    }
    // Insufficient rows remain lineage links but cannot replace the last
    // scored node. Missing current candidates must never downgrade publication.
    const selected = correctionHead(currentCandidates.filter(row => periodKey(row) === newest), new Set(eligible.map(row => row.reportId)));
    return selected ? { status: "selected", candidate: selected } : conflict();
  }
  if (input.previouslyUnlocked) {
    if (input.lastPublished) {
      try {
        if (reportCraftPeriodStatus(input.window, input.lastPublished.reportPeriod) !== "current") return none({ status: "expired", unlocked: true, point: null, lastReport: input.lastPublished });
      } catch { return unavailable("source_error"); }
    }
    return unavailable(outside ? "outside_window" : "source_error");
  }
  if (insufficient.length) {
    insufficient.sort((a, b) => {
      const aKey = `${a.reportPeriod.endExclusive}|${a.reportPeriod.startInclusive}|${a.reason}`;
      const bKey = `${b.reportPeriod.endExclusive}|${b.reportPeriod.startInclusive}|${b.reason}`;
      return aKey < bKey ? 1 : aKey > bKey ? -1 : 0;
    });
    return none(insufficient[0]!);
  }
  if (invalid) return unavailable("source_error");
  if (outside) return unavailable("outside_window");
  return none({ status: "no_report", unlocked: false, point: null });
}
