import { cacheSetNxStatus, trackBadgeGenerated } from "@/lib/cache/redis";
import { clearStatsDirty } from "@/lib/cache/dirty-stats";
import { updateSnapshotCache } from "@/lib/cache/snapshot-cache";
import { dbInsertSnapshot, dbReplaceSnapshot } from "@/lib/db/snapshots";
import { dbUpsertUser } from "@/lib/db/users";
import { notifyFirstBadge } from "@/lib/email/notifications";
import { generateVerificationCode } from "@/lib/verification/hmac";
import { storeVerificationRecord } from "@/lib/verification/store";
import type { VerificationRecord } from "@/lib/verification/types";
import {
  materializeProfile,
  type MaterializedProfile,
} from "./materialize-profile";

export interface PublicVerificationCode {
  hash: string;
  date: string;
}

export async function materializePublicProfile(
  handle: string,
  options: { token?: string; today?: string } = {},
): Promise<MaterializedProfile | null> {
  return materializeProfile(handle, {
    token: options.token,
    today: options.today,
    policy: "public-display",
  });
}

export function getPublicProfileVerification(
  materialized: MaterializedProfile,
): PublicVerificationCode | null {
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
  options: { verification?: PublicVerificationCode | null } = {},
): Promise<void> {
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
  if (guardStatus === "exists" && !materialized.inputsChanged) return;

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
  ops.push(notifyFirstBadge(handle, materialized.displayImpact));
  ops.push(
    (async () => {
      // #826 — replace today's row when inputs changed; otherwise insert and
      // let the UNIQUE(handle, date) constraint dedupe.
      const persisted = materialized.inputsChanged
        ? await dbReplaceSnapshot(handle, materialized.snapshot)
        : await dbInsertSnapshot(handle, materialized.snapshot);
      if (persisted) {
        await updateSnapshotCache(handle, materialized.snapshot);
        if (materialized.inputsChanged) {
          await clearStatsDirty(handle);
        }
      }
    })(),
  );

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
