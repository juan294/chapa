/**
 * PR weight formula: w = (0.5 + 0.25*ln(1+filesChanged) + 0.25*ln(1+additions+deletions)) * sizeMultiplier
 * sizeMultiplier = min(1, totalChanges / 10) where totalChanges = changedFiles + additions + deletions
 * Capped at 3.0 per PR. Total across all PRs is capped at 120 (enforced by caller).
 */
export function computePrWeight(pr: {
  additions: number;
  deletions: number;
  changedFiles: number;
}): number {
  const totalChanges = pr.changedFiles + pr.additions + pr.deletions;
  const sizeMultiplier = Math.min(1, totalChanges / 10);

  const rawWeight =
    0.5 +
    0.25 * Math.log(1 + pr.changedFiles) +
    0.25 * Math.log(1 + pr.additions + pr.deletions);

  return Math.min(rawWeight * sizeMultiplier, 3.0);
}
