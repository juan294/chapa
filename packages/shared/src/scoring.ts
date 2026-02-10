/**
 * PR weight formula: w = 0.5 + 0.25*ln(1+filesChanged) + 0.25*ln(1+additions+deletions)
 * Capped at 3.0 per PR. Total across all PRs is capped at 40 (enforced by caller).
 */
export function computePrWeight(pr: {
  additions: number;
  deletions: number;
  changedFiles: number;
}): number {
  const w =
    0.5 +
    0.25 * Math.log(1 + pr.changedFiles) +
    0.25 * Math.log(1 + pr.additions + pr.deletions);
  return Math.min(w, 3.0);
}
