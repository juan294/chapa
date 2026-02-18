/**
 * GitHub handle validation.
 *
 * Rules (from GitHub docs):
 * - 1–39 alphanumeric characters or hyphens
 * - Cannot start or end with a hyphen
 */
const GITHUB_HANDLE_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;

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

export function isValidEmuHandle(handle: string): boolean {
  if (handle.length === 1) return /^[a-zA-Z0-9]$/.test(handle);
  return EMU_HANDLE_RE.test(handle);
}

/**
 * Validate a BadgeConfig object.
 * Ensures every field is present with a recognized value, and no extra fields exist.
 */
import { BADGE_CONFIG_OPTIONS } from "@chapa/shared";

const BADGE_CONFIG_KEYS = Object.keys(BADGE_CONFIG_OPTIONS) as (keyof typeof BADGE_CONFIG_OPTIONS)[];

export function isValidBadgeConfig(value: unknown): boolean {
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
 * Structural validation for uploaded StatsData.
 * Ensures the shape matches what we expect — prevents arbitrary JSON from being stored.
 */
/**
 * Validate a CLI telemetry payload (merge operation audit data).
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
 * Ensures the shape matches what we expect — prevents arbitrary JSON from being stored.
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
    if (typeof obj[key] !== "number" || obj[key] < 0) return false;
  }

  if (!Array.isArray(obj.heatmapData)) return false;
  if (obj.heatmapData.length > 371) return false; // 53 weeks × 7 days
  for (const entry of obj.heatmapData) {
    if (
      entry == null ||
      typeof entry !== "object" ||
      typeof entry.date !== "string" ||
      typeof entry.count !== "number"
    )
      return false;
  }

  return true;
}
