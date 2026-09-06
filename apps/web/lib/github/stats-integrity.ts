import type { RawContributionData, StatsData } from "@chapa/shared";

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const finiteNonnegative = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
const count = (value: unknown): value is number => finiteNonnegative(value) && Number.isSafeInteger(value);
const rows = (value: unknown, valid: (row: Record<string, unknown>) => boolean): boolean => Array.isArray(value) && value.every(row => record(row) && valid(row));

// Date.parse normalizes impossible month days, so verify the calendar date
// separately before accepting a supplied ISO timestamp.
function calendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

function timestamp(value: unknown): value is string {
  return typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value) &&
    calendarDate(value.slice(0, 10)) && Number.isFinite(Date.parse(value));
}

/** Structural validation of legacy v6 aggregates, NOT proof of source coverage.
 * Measured zeros, low PR weights and annual expiration are valid values.
 */
export function isValidLegacyStats(stats: StatsData): boolean {
  if (!record(stats) || typeof stats.handle !== "string" || !stats.handle || !timestamp(stats.fetchedAt)) return false;
  const counts: (keyof StatsData)[] = ["commitsTotal", "activeDays", "prsMergedCount", "reviewsSubmittedCount", "issuesClosedCount", "linesAdded", "linesDeleted", "reposContributed", "maxCommitsIn10Min", "totalStars", "totalForks", "totalWatchers"];
  if (!counts.every(key => count(stats[key])) || !finiteNonnegative(stats.prsMergedWeight) || !finiteNonnegative(stats.topRepoShare) || stats.topRepoShare > 1) return false;
  const ratios = [stats.microCommitRatio, stats.batchSizeScore, stats.docsOnlyPrRatio, stats.prDescriptionRate, stats.featureBranchRate, stats.issueLinkageRate];
  if (!ratios.every(value => value === undefined || (finiteNonnegative(value) && value <= 1))) return false;
  if (stats.medianPrLeadTimeHours !== undefined && !finiteNonnegative(stats.medianPrLeadTimeHours)) return false;
  if (stats.primaryReviewsSubmittedCount !== undefined && !count(stats.primaryReviewsSubmittedCount)) return false;
  return rows(stats.heatmapData, day => calendarDate(day.date) && count(day.count));
}

/** Validate fields used by the legacy aggregator without inferring missing work.
 * A capped/filtered mixed-state sample cannot contradict a separate search.
 * Missing pages require v7 coverage; passing this check does not mean complete.
 */
export function assessRawFetchIntegrity(raw: RawContributionData): { ok: true } | { ok: false; reason: string } {
  if (!record(raw) || !record(raw.contributionCalendar) || !record(raw.pullRequests) || !record(raw.reviews) || !record(raw.issues) || !record(raw.repositories) || !record(raw.ownedRepoStars)) return { ok: false, reason: "missing_required_block" };
  const calendar = raw.contributionCalendar;
  const prs = raw.pullRequests;
  const valid = typeof raw.login === "string" && raw.login.length > 0 && count(raw.mergedPrTotalCount) && count(calendar.totalContributions) &&
    rows(calendar.weeks, week => rows(week.contributionDays, day => calendarDate(day.date) && count(day.contributionCount))) &&
    count(prs.totalCount) && rows(prs.nodes, node => [node.additions, node.deletions, node.changedFiles, node.closingIssuesCount].every(count) && typeof node.merged === "boolean" && (node.body === null || typeof node.body === "string") && typeof node.headRefName === "string" && (node.createdAt === undefined || timestamp(node.createdAt)) && (node.mergedAt === undefined || node.mergedAt === null || timestamp(node.mergedAt))) &&
    count(raw.reviews.totalCount) && count(raw.issues.totalCount) && count(raw.repositories.totalCount) &&
    rows(raw.repositories.nodes, repo => typeof repo.nameWithOwner === "string" && (repo.defaultBranchRef === null || (record(repo.defaultBranchRef) && record(repo.defaultBranchRef.target) && record(repo.defaultBranchRef.target.history) && count(repo.defaultBranchRef.target.history.totalCount)))) &&
    rows(raw.ownedRepoStars.nodes, repo => count(repo.stargazerCount) && count(repo.forkCount) && record(repo.watchers) && count(repo.watchers.totalCount));
  return valid ? { ok: true } : { ok: false, reason: "invalid_legacy_schema" };
}
