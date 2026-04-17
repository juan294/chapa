import { trackBadgeGenerated } from "@/lib/cache/redis";
import { updateSnapshotCache } from "@/lib/cache/snapshot-cache";
import { dbInsertSnapshot } from "@/lib/db/snapshots";
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
    craftMode: "cached",
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
      const inserted = await dbInsertSnapshot(handle, materialized.snapshot);
      if (inserted) {
        await updateSnapshotCache(handle, materialized.snapshot);
      }
    })(),
  );

  if (materialized.stats.displayName || materialized.stats.avatarUrl) {
    ops.push(
      dbUpsertUser(handle, {
        displayName: materialized.stats.displayName ?? undefined,
        avatarUrl: materialized.stats.avatarUrl ?? undefined,
      }).catch(() => {}),
    );
  }

  await Promise.allSettled(ops);
}
