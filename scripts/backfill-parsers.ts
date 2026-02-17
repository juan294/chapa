/**
 * Pure parsing/validation functions for the backfill script.
 *
 * Separated from backfill-supabase.ts so tests can run without
 * requiring @upstash/redis or @supabase/supabase-js at the root.
 */

import type { MetricsSnapshot } from "@chapa/shared";
import type { VerificationRecord } from "../apps/web/lib/verification/types";

/**
 * Parse a Redis sorted set member (JSON string) into a MetricsSnapshot.
 * Returns null if the JSON is invalid or required fields are missing.
 */
export function parseRedisSnapshot(json: string): MetricsSnapshot | null {
  try {
    const parsed = JSON.parse(json);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.date !== "string" ||
      typeof parsed.commitsTotal !== "number" ||
      typeof parsed.building !== "number" ||
      typeof parsed.tier !== "string"
    ) {
      return null;
    }
    return parsed as MetricsSnapshot;
  } catch {
    return null;
  }
}

/**
 * Parse a Redis `user:registered:<handle>` value into a user record.
 * Returns null if the value is invalid.
 */
export function parseRedisUser(
  value: unknown,
): { handle: string; registeredAt: string } | null {
  if (value == null || typeof value !== "object") return null;

  const obj = value as Record<string, unknown>;
  if (typeof obj.handle !== "string" || !obj.handle) return null;

  return {
    handle: obj.handle.toLowerCase(),
    registeredAt:
      typeof obj.registeredAt === "string"
        ? obj.registeredAt
        : new Date().toISOString(),
  };
}

/**
 * Parse a Redis `verify:<hash>` value into a VerificationRecord.
 * Returns null if the value is invalid.
 */
export function parseRedisVerification(
  value: unknown,
): VerificationRecord | null {
  if (value == null || typeof value !== "object") return null;

  const obj = value as Record<string, unknown>;
  if (typeof obj.handle !== "string") return null;
  if (obj.dimensions == null || typeof obj.dimensions !== "object") return null;

  return obj as unknown as VerificationRecord;
}

/**
 * Convert a MetricsSnapshot to a Supabase row for metrics_snapshots table.
 */
export function snapshotToRow(
  handle: string,
  s: MetricsSnapshot,
): Record<string, unknown> {
  return {
    handle: handle.toLowerCase(),
    date: s.date,
    captured_at: s.capturedAt,
    commits_total: s.commitsTotal,
    prs_merged_count: s.prsMergedCount,
    prs_merged_weight: s.prsMergedWeight,
    reviews_submitted: s.reviewsSubmittedCount,
    issues_closed: s.issuesClosedCount,
    repos_contributed: s.reposContributed,
    active_days: s.activeDays,
    lines_added: s.linesAdded,
    lines_deleted: s.linesDeleted,
    total_stars: s.totalStars,
    total_forks: s.totalForks,
    total_watchers: s.totalWatchers,
    top_repo_share: s.topRepoShare,
    max_commits_in_10min: s.maxCommitsIn10Min,
    micro_commit_ratio: s.microCommitRatio ?? null,
    docs_only_pr_ratio: s.docsOnlyPrRatio ?? null,
    building: s.building,
    guarding: s.guarding,
    consistency: s.consistency,
    breadth: s.breadth,
    archetype: s.archetype,
    profile_type: s.profileType,
    composite_score: s.compositeScore,
    adjusted_composite: s.adjustedComposite,
    confidence: s.confidence,
    tier: s.tier,
    confidence_penalties:
      s.confidencePenalties && s.confidencePenalties.length > 0
        ? s.confidencePenalties
        : null,
  };
}

/**
 * Convert a VerificationRecord to a Supabase row for verification_records table.
 */
export function verificationToRow(
  hash: string,
  r: VerificationRecord,
): Record<string, unknown> {
  return {
    hash,
    handle: r.handle.toLowerCase(),
    display_name: r.displayName ?? null,
    adjusted_composite: r.adjustedComposite,
    confidence: r.confidence,
    tier: r.tier,
    archetype: r.archetype,
    profile_type: r.profileType,
    building: r.dimensions.building,
    guarding: r.dimensions.guarding,
    consistency: r.dimensions.consistency,
    breadth: r.dimensions.breadth,
    commits_total: r.commitsTotal,
    prs_merged_count: r.prsMergedCount,
    reviews_submitted: r.reviewsSubmittedCount,
    generated_at: r.generatedAt,
  };
}
