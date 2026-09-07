import type { ImpactV6Result, PublicImpactV6Result } from "@chapa/shared";
import type { GitHubUserNotFound } from "@/lib/github/not-found";
import { captureServerError } from "@/lib/analytics/server-errors";
import { cacheDel, cacheSetNxStatus, trackBadgeGenerated } from "@/lib/cache/redis";
import { clearStatsDirty } from "@/lib/cache/dirty-stats";
import { dbUpdateUserProfile } from "@/lib/db/users";
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

/**
 * Strip owner-only confidence data before an `ImpactV6Result` crosses into a
 * "use client" component's serialized props for a non-owner share-page
 * visitor (#1067 FE-M1). Whatever is passed as a client-component prop is
 * serialized into the RSC payload the browser downloads regardless of
 * whether any component renders it — a client-side `isOwner` display gate is
 * not sufficient on its own.
 *
 * Returns a NEW object; never mutates `impact`. The same
 * `MaterializedProfile.displayImpact` reference this is called on also feeds
 * the persisted snapshot and the HMAC verification record in the same
 * request (see `runPublicProfileSideEffects` / `buildVerificationRecord`
 * above), both of which require the real confidence value.
 */
export function redactImpactForVisitor(
  impact: ImpactV6Result,
): PublicImpactV6Result {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { confidence: _confidence, confidencePenalties: _confidencePenalties, ...publicImpact } = impact;
  return publicImpact;
}

export async function materializePublicProfile(
  handle: string,
  options: { token?: string; today?: string; readOnly?: boolean } = {},
): Promise<MaterializedProfile | GitHubUserNotFound | null> {
  return materializeProfile(handle, {
    token: options.token,
    today: options.today,
    readOnly: options.readOnly,
    policy: "public-display",
  });
}

export function getPublicProfileVerification(
  materialized: Pick<
    MaterializedProfile,
    "stats" | "displayImpact" | "statsComplete"
  > & { scoring?: MaterializedProfile["scoring"] },
): PublicVerificationCode | null {
  // #1311 — a v6 HMAC attests v6 dimensions, tier, archetype and confidence.
  // Issuing one for a profile whose badge draws a v7 receipt would put a
  // verification link on that badge resolving to a different set of numbers,
  // which is the "two answers for one revision" the shared model exists to
  // prevent, arriving from the other direction. A v7 profile is attested by
  // its receipt (see `deriveReceiptVerificationTokenV7`), never by this.
  if (materialized.scoring?.policyVersion === "v7") return null;

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

/**
 * The durable side effects that follow a rendered badge or share page: the
 * badge route (foreground and background continuation) and the share page
 * both run exactly this sequence inside `after()`.
 *
 * LE-6-1 — `verification` is the code the artifact was rendered with, and it
 * is stored on EVERY render, not only on the first render of the day. The
 * snapshot write is deduplicated by a once-per-day guard, and this sequence
 * used to stop dead when that guard said "exists". But a hash moves whenever
 * the stats behind it move (a refetch after the 6h stats TTL, a fetch under a
 * different token scope, a refresh, a recalculate), and each later render
 * that day printed a new hash into a 24h-cached SVG that no row backed —
 * `/verify/<hash>` answered 404 for the number on the badge. The snapshot,
 * telemetry and profile-refresh writes stay once per day; the record for
 * the hash that was just published does not.
 */
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

  // `persisted` is false for the same-day dedup (work already ran today) and
  // for incomplete stats (#1003). Either way only the verification record for
  // the artifact just rendered may still be written — and for incomplete
  // stats `getPublicProfileVerification` has already refused to mint one, so
  // nothing is written at all.
  await deferProfileCacheWork(handle, materialized, {
    ...options,
    verificationOnly: !persisted,
  });
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
  // BE-L2 (#1186) — GitHub handles are case-insensitive; every other
  // handle-derived cache key lowercases first (dbReplaceSnapshot,
  // buildSnapshotKey, buildBadgeSvgCacheKey). Without this, `/u/JuanX` and
  // `/u/juanx` each claimed an independent day guard and re-ran the
  // deferred sequence once per casing variant per day.
  const today = new Date().toISOString().slice(0, 10);
  const guardKey = `sideeffects:done:${handle.toLowerCase()}:${today}`;
  const guardStatus = await cacheSetNxStatus(guardKey, 86400);
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

    // #1081 — The SETNX day-guard above was already claimed for this
    // handle+day before the durable write ran. A genuine write failure must
    // release it (rather than leaving it in place until its 24h TTL expires)
    // so the NEXT badge request today retries the write instead of silently
    // forfeiting the rest of the day's snapshot history to the next
    // warm-cache rotation. "inserted" and "duplicate" are correct terminal
    // states and must NOT release the guard.
    void cacheDel(guardKey);
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
    verificationOnly?: boolean;
  } = {},
): Promise<void> {
  if (options.readOnly) return;

  // One mint per artifact: a caller that resolved the verification — to a
  // code or to null — is never second-guessed here, so the stored hash is the
  // printed hash. Only a caller that resolved nothing gets one minted for it.
  // A v7 model is attested by its receipt (`resolveBadgeVerification`), never
  // by a legacy row (#1311), so its token must not land in
  // `verification_records` under the receipt token either.
  const verification =
    materialized.scoring?.policyVersion === "v7"
      ? null
      : options.verification !== undefined
        ? options.verification
        : getPublicProfileVerification(materialized);
  const ops: Promise<unknown>[] = [];

  if (verification) {
    ops.push(
      storeVerificationRecord(
        verification.hash,
        buildVerificationRecord(materialized, verification),
      ),
    );
  }

  // Snapshot persistence is deduplicated once per day, but the rendered
  // verification hash can still change after a refresh or linked-platform
  // update. Store that hash without repeating telemetry, notifications, or
  // user metadata writes that already ran for today's snapshot.
  if (options.verificationOnly) {
    await Promise.allSettled(ops);
    return;
  }

  ops.push(trackBadgeGenerated(handle));
  if (options.sendFirstBadgeNotification) {
    ops.push(notifyFirstBadge(handle, materialized.displayImpact));
  }

  if (materialized.stats.displayName || materialized.stats.avatarUrl) {
    ops.push(
      // Refreshes an already-registered user's name/avatar so /admin stays
      // current. Deliberately an UPDATE: this path must never be the reason a
      // row exists (#1239).
      dbUpdateUserProfile(handle, {
        displayName: materialized.stats.displayName ?? undefined,
        avatarUrl: materialized.stats.avatarUrl ?? undefined,
      }).catch(() => undefined),
    );
  }

  await Promise.allSettled(ops);
}
