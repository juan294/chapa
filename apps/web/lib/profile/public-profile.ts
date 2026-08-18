import { captureServerError } from "@/lib/analytics/server-errors";
import { cacheSetNxStatus, trackBadgeGenerated } from "@/lib/cache/redis";
import { clearStatsDirty } from "@/lib/cache/dirty-stats";
import { dbUpsertUser } from "@/lib/db/users";
import { notifyFirstBadge } from "@/lib/email/notifications";
import { generateVerificationCode } from "@/lib/verification/hmac";
import { storeVerificationRecord } from "@/lib/verification/store";
import type { VerificationRecord } from "@/lib/verification/types";
import {
  materializeProfile,
  type MaterializedProfile,
} from "./materialize-profile";
import { guardStatsComplete } from "./persist-guard";
import { reconcileSnapshotWrite } from "./snapshot-write";

export interface PublicVerificationCode {
  hash: string;
  date: string;
}

export async function materializePublicProfile(
  handle: string,
  options: { token?: string; today?: string; readOnly?: boolean } = {},
): Promise<MaterializedProfile | null> {
  return materializeProfile(handle, {
    token: options.token,
    today: options.today,
    readOnly: options.readOnly,
    policy: "public-display",
  });
}

export function getPublicProfileVerification(
  materialized: MaterializedProfile,
): PublicVerificationCode | null {
  // #1003 — Never attest a verification record from stats that look
  // incomplete (e.g. served from an old poisoned `stats:stale` entry). This
  // single gate covers all four call sites: the three route call sites and
  // the internal `deferProfileCacheWork` call below.
  if (!materialized.statsComplete) return null;

  return generateVerificationCode(
    materialized.stats,
    materialized.displayImpact,
  );
}

function buildVerificationRecord(
  materialized: MaterializedProfile,
  verification: PublicVerificationCode,
): VerificationRecord {
  const { stats, displayImpact } = materialized;
  return {
    handle: stats.handle.toLowerCase(),
    displayName: stats.displayName,
    adjustedComposite: displayImpact.adjustedComposite,
    confidence: displayImpact.confidence,
    tier: displayImpact.tier,
    archetype: displayImpact.archetype,
    dimensions: displayImpact.dimensions,
    commitsTotal: stats.commitsTotal,
    prsMergedCount: stats.prsMergedCount,
    reviewsSubmittedCount: stats.reviewsSubmittedCount,
    generatedAt: verification.date,
    profileType: displayImpact.profileType,
  };
}

export async function runPublicProfileSideEffects(
  handle: string,
  materialized: MaterializedProfile,
  options: {
    verification?: PublicVerificationCode | null;
    readOnly?: boolean;
    sendFirstBadgeNotification?: boolean;
  } = {},
): Promise<void> {
  if (options.readOnly) return;

  const persisted = await persistProfileSnapshot(handle, materialized, {
    readOnly: options.readOnly,
  });

  // The SETNX dedup guard returning "exists" means deferred work already ran
  // earlier today for this handle — skip re-running it. Incomplete stats
  // (#1003) also skip persistence but are NOT a dedup case: the badge still
  // rendered for a real visitor, so telemetry/notifications should still run
  // once for this view. The verification record is separately gated inside
  // getPublicProfileVerification, so it stays skipped either way.
  if (!persisted && materialized.statsComplete) return;

  await deferProfileCacheWork(handle, materialized, options);
}

export async function persistProfileSnapshot(
  handle: string,
  materialized: MaterializedProfile,
  options: { readOnly?: boolean } = {},
): Promise<boolean> {
  if (options.readOnly) return false;

  if (!guardStatsComplete(handle, materialized)) {
    return false;
  }

  // Deduplication guard: once-per-day SETNX key prevents duplicate Supabase
  // writes when the CDN misses and multiple edge nodes hit the origin in parallel.
  // Only the explicit duplicate case should skip work; Redis outages must fail open.
  // #826 — When inputs have legitimately changed mid-day (supplemental upload),
  // bypass the guard so today's snapshot can be replaced with the fresh score.
  const today = new Date().toISOString().slice(0, 10);
  const guardStatus = await cacheSetNxStatus(
    `sideeffects:done:${handle}:${today}`,
    86400,
  );
  if (guardStatus === "exists" && !materialized.inputsChanged) return false;

  // #826 — replace today's row when inputs changed; otherwise insert and
  // let the UNIQUE(handle, date) constraint dedupe. The durable Supabase write
  // and its Redis cache mirror are reconciled as one envelope so a partial
  // failure (durable ok, cache stale) surfaces an operational alert (#975).
  const { persisted, writeOutcome } = await reconcileSnapshotWrite(
    handle,
    materialized.snapshot,
    { mode: materialized.inputsChanged ? "replace" : "insert" },
  );

  // #1009 — This is the badge-path snapshot write; every other write endpoint
  // (/api/insights, /api/refresh, /api/recalculate) already escalates a
  // persist failure via captureServerError. A "duplicate" outcome is benign
  // (row already existed) and must NOT alert — only a genuine "failed"
  // outcome is worth escalating, and the tri-state from #1015/#1016 lets us
  // distinguish the two here unambiguously. Fire-and-forget: never blocks or
  // fails the badge response.
  if (writeOutcome === "failed") {
    void captureServerError({
      route: "lib/profile/public-profile",
      statusCode: 200,
      error: new Error(`Failed to persist profile snapshot for handle: ${handle}`),
    });
  }

  if (persisted && materialized.inputsChanged) {
    await clearStatsDirty(handle);
  }

  return persisted;
}

export async function deferProfileCacheWork(
  handle: string,
  materialized: MaterializedProfile,
  options: {
    verification?: PublicVerificationCode | null;
    readOnly?: boolean;
    sendFirstBadgeNotification?: boolean;
  } = {},
): Promise<void> {
  if (options.readOnly) return;

  const verification = options.verification ??
    getPublicProfileVerification(materialized);
  const ops: Promise<unknown>[] = [];

  if (verification) {
    ops.push(
      storeVerificationRecord(
        verification.hash,
        buildVerificationRecord(materialized, verification),
      ),
    );
  }

  ops.push(trackBadgeGenerated(handle));
  if (options.sendFirstBadgeNotification) {
    ops.push(notifyFirstBadge(handle, materialized.displayImpact));
  }

  if (materialized.stats.displayName || materialized.stats.avatarUrl) {
    ops.push(
      dbUpsertUser(handle, {
        displayName: materialized.stats.displayName ?? undefined,
        avatarUrl: materialized.stats.avatarUrl ?? undefined,
      }).catch(() => undefined),
    );
  }

  await Promise.allSettled(ops);
}
