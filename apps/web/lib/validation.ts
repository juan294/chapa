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
 * Structural validation for uploaded Stats90d.
 * Ensures the shape matches what we expect — prevents arbitrary JSON from being stored.
 */
export function isValidStats90dShape(value: unknown): boolean {
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
  ] as const;
  for (const key of requiredNumbers) {
    if (typeof obj[key] !== "number" || obj[key] < 0) return false;
  }

  if (!Array.isArray(obj.heatmapData)) return false;
  if (obj.heatmapData.length > 91) return false; // 13 weeks × 7 days
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
