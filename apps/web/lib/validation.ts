/**
 * GitHub handle validation.
 *
 * Rules (from GitHub docs):
 * - 1–39 alphanumeric characters or hyphens
 * - Cannot start or end with a hyphen
 */
const GITHUB_HANDLE_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;

/**
 * Validate a GitHub handle against GitHub's naming rules.
 *
 * Rules: 1--39 alphanumeric characters or hyphens, cannot start or end
 * with a hyphen. Used to guard API endpoints and cache key construction
 * from injection via malformed handles.
 *
 * @param handle - The candidate GitHub handle to validate
 * @returns `true` if the handle matches GitHub's format requirements
 */
export function isValidHandle(handle: string): boolean {
  return GITHUB_HANDLE_RE.test(handle);
}

/**
 * GitHub EMU handle validation.
 *
 * EMU handles allow underscores (e.g. "Juan-GonzalezPonce_avoltagh")
 * in addition to alphanumeric characters and hyphens.
 * Max length: 100 characters.
 */
const EMU_HANDLE_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,98}[a-zA-Z0-9]$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate a GitHub EMU (Enterprise Managed User) handle.
 *
 * EMU handles allow underscores in addition to the standard alphanumeric
 * characters and hyphens (e.g. "Juan-GonzalezPonce_avoltagh"), with a
 * maximum length of 100 characters.
 *
 * @param handle - The candidate EMU handle to validate
 * @returns `true` if the handle matches EMU format requirements
 */
export function isValidEmuHandle(handle: string): boolean {
  if (handle.length === 1) return /^[a-zA-Z0-9]$/.test(handle);
  return EMU_HANDLE_RE.test(handle);
}

/**
 * Validate a BadgeConfig object from the Creator Studio.
 *
 * Ensures every field defined in `BADGE_CONFIG_OPTIONS` is present with a
 * recognized value, and rejects payloads with extra or missing fields.
 * Used by PUT /api/studio/config to guard user-submitted configurations.
 *
 * @param value - The candidate object to validate
 * @returns `true` if the object matches the expected BadgeConfig schema exactly
 */
import { BADGE_CONFIG_OPTIONS, type BadgeConfig } from "@chapa/shared";

const BADGE_CONFIG_KEYS = Object.keys(BADGE_CONFIG_OPTIONS) as (keyof typeof BADGE_CONFIG_OPTIONS)[];

export function isValidBadgeConfig(value: unknown): value is BadgeConfig {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;

  // Reject extra fields
  const keys = Object.keys(obj);
  if (keys.length !== BADGE_CONFIG_KEYS.length) return false;

  for (const key of BADGE_CONFIG_KEYS) {
    const val = obj[key];
    if (typeof val !== "string") return false;
    const allowed = BADGE_CONFIG_OPTIONS[key] as readonly string[];
    if (!allowed.includes(val)) return false;
  }

  return true;
}

/**
 * Validate a CLI telemetry payload (merge operation audit data).
 *
 * Checks structural integrity: operationId (UUID v4), targetHandle (GitHub handle),
 * sourceHandle (EMU handle), success (boolean), optional errorCategory, stats
 * (5 non-negative integer fields), timing (3 non-negative numbers), and cliVersion
 * (non-empty string, max 20 chars).
 *
 * Used by POST /api/telemetry.
 */
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_ERROR_CATEGORIES = ["auth", "network", "graphql", "server", "unknown"] as const;

export function isValidTelemetryPayload(value: unknown): boolean {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;

  // operationId: UUID v4 format
  if (typeof obj.operationId !== "string" || !UUID_V4_RE.test(obj.operationId)) return false;

  // targetHandle: valid GitHub handle
  if (typeof obj.targetHandle !== "string" || !isValidHandle(obj.targetHandle)) return false;

  // sourceHandle: valid EMU handle
  if (typeof obj.sourceHandle !== "string" || !isValidEmuHandle(obj.sourceHandle)) return false;

  // success: boolean
  if (typeof obj.success !== "boolean") return false;

  // errorCategory: optional, must be one of the valid values
  if (obj.errorCategory !== undefined && obj.errorCategory !== null) {
    if (typeof obj.errorCategory !== "string") return false;
    if (!(VALID_ERROR_CATEGORIES as readonly string[]).includes(obj.errorCategory)) return false;
  }

  // stats: object with 5 non-negative integer fields
  if (obj.stats == null || typeof obj.stats !== "object" || Array.isArray(obj.stats)) return false;
  const stats = obj.stats as Record<string, unknown>;
  const requiredStatFields = ["commitsTotal", "reposContributed", "prsMergedCount", "activeDays", "reviewsSubmittedCount"] as const;
  for (const key of requiredStatFields) {
    if (typeof stats[key] !== "number" || stats[key] < 0 || !Number.isInteger(stats[key])) return false;
  }

  // timing: object with 3 non-negative number fields
  if (obj.timing == null || typeof obj.timing !== "object" || Array.isArray(obj.timing)) return false;
  const timing = obj.timing as Record<string, unknown>;
  const requiredTimingFields = ["fetchMs", "uploadMs", "totalMs"] as const;
  for (const key of requiredTimingFields) {
    if (typeof timing[key] !== "number" || timing[key] < 0) return false;
  }

  // cliVersion: non-empty string, max 20 chars
  if (typeof obj.cliVersion !== "string" || obj.cliVersion.length === 0 || obj.cliVersion.length > 20) return false;

  return true;
}

/**
 * Structural validation for uploaded StatsData.
 *
 * Ensures the shape matches what the scoring pipeline expects — prevents
 * arbitrary JSON from being stored. Validates: handle + fetchedAt (strings),
 * 14 required non-negative number fields (commits, PRs, reviews, etc.) with
 * per-field magnitude caps, optional ratio/numeric fields that feed scoring
 * (#984), and heatmapData (array of {date, count} entries, max 371 = 53 weeks × 7 days).
 *
 * Used by POST /api/supplemental.
 */
export function isValidStatsShape(value: unknown): boolean {
  if (value == null || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;

  const requiredStrings = ["handle", "fetchedAt"] as const;
  for (const key of requiredStrings) {
    if (typeof obj[key] !== "string") return false;
  }

  const requiredNumbers = [
    "commitsTotal",
    "activeDays",
    "prsMergedCount",
    "prsMergedWeight",
    "reviewsSubmittedCount",
    "issuesClosedCount",
    "linesAdded",
    "linesDeleted",
    "reposContributed",
    "topRepoShare",
    "maxCommitsIn10Min",
    "totalStars",
    "totalForks",
    "totalWatchers",
  ] as const;
  for (const key of requiredNumbers) {
    if (!isNonNegativeFiniteNumber(obj[key])) return false;
  }

  if (typeof obj.activeDays === "number" && obj.activeDays > 365) return false;
  if (!isRatio(obj.topRepoShare)) return false;

  // BE-M1 (#950): Numeric range caps — prevent arbitrarily large values from
  // flowing into computeImpactV6 and snapshots.
  if (typeof obj.commitsTotal === "number" && obj.commitsTotal > 100_000) return false;
  if (typeof obj.prsMergedCount === "number" && obj.prsMergedCount > 10_000) return false;
  if (typeof obj.prsMergedWeight === "number" && obj.prsMergedWeight > 10_000) return false;
  if (typeof obj.reviewsSubmittedCount === "number" && obj.reviewsSubmittedCount > 50_000) return false;
  if (typeof obj.issuesClosedCount === "number" && obj.issuesClosedCount > 10_000) return false;
  if (typeof obj.linesAdded === "number" && obj.linesAdded > 500_000) return false;
  if (typeof obj.linesDeleted === "number" && obj.linesDeleted > 500_000) return false;
  if (typeof obj.reposContributed === "number" && obj.reposContributed > 5_000) return false;
  if (typeof obj.maxCommitsIn10Min === "number" && obj.maxCommitsIn10Min > 1_000) return false;
  if (typeof obj.totalStars === "number" && obj.totalStars > 10_000_000) return false;
  if (typeof obj.totalForks === "number" && obj.totalForks > 1_000_000) return false;
  if (typeof obj.totalWatchers === "number" && obj.totalWatchers > 1_000_000) return false;

  // Optional ratio fields (0..1) that feed the Quality/Craft dimensions.
  const optionalRatios = [
    "microCommitRatio",
    "docsOnlyPrRatio",
    "batchSizeScore",
    "prDescriptionRate",
    "featureBranchRate",
    "issueLinkageRate",
  ] as const;
  for (const key of optionalRatios) {
    if (obj[key] !== undefined && !isRatio(obj[key])) return false;
  }

  // #984: optional non-ratio numeric fields that also flow into computeImpactV6
  // and persist into snapshots/history need non-negative + range guards.
  if (obj.medianPrLeadTimeHours !== undefined) {
    if (!isNonNegativeFiniteNumber(obj.medianPrLeadTimeHours) || obj.medianPrLeadTimeHours > 100_000) {
      return false;
    }
  }
  if (obj.primaryReviewsSubmittedCount !== undefined) {
    if (
      !isNonNegativeFiniteNumber(obj.primaryReviewsSubmittedCount) ||
      obj.primaryReviewsSubmittedCount > 50_000
    ) {
      return false;
    }
  }

  if (!Array.isArray(obj.heatmapData)) return false;
  if (obj.heatmapData.length > 371) return false; // 53 weeks × 7 days
  for (const entry of obj.heatmapData) {
    if (
      entry == null ||
      typeof entry !== "object" ||
      !("date" in entry) ||
      !("count" in entry)
    )
      return false;
    const heatmapEntry = entry as Record<string, unknown>;
    if (
      typeof heatmapEntry.date !== "string" ||
      !ISO_DATE_RE.test(heatmapEntry.date) ||
      !isNonNegativeFiniteNumber(heatmapEntry.count)
    ) {
      return false;
    }
  }

  return true;
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isRatio(value: unknown): value is number {
  return isNonNegativeFiniteNumber(value) && value <= 1;
}
