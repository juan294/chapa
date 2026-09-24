import { resolveScoreModel } from "./score-model";
import type { GitHubUserNotFound } from "@/lib/github/not-found";
import { trackBadgeGenerated } from "@/lib/cache/redis";
import { dbUpdateUserProfile } from "@/lib/db/users";
import { notifyFirstBadge } from "@/lib/email/notifications";
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
  options: { token?: string; today?: string; readOnly?: boolean } = {},
): Promise<MaterializedProfile | GitHubUserNotFound | null> {
  return materializeProfile(handle, {
    token: options.token,
    today: options.today,
    readOnly: options.readOnly,
  });
}

/**
 * The durable side effects that follow a rendered badge or share page
 * (#1335 phase 5 — "delete v6"). Snapshot persistence and the v6 HMAC
 * verification record are gone: the issued receipt is the durable,
 * attestable artifact (`lib/verification/hmac.ts`'s `signReceiptV7` /
 * `authenticateReceiptV7`, resolved per render by
 * `lib/profile/badge-verification.ts`'s `resolveBadgeVerification`), and it
 * is minted at issuance time (`lib/profile/issue-receipt.ts`), never here.
 * What remains on the render path is telemetry and the owner-profile-
 * metadata refresh.
 */
export async function runPublicProfileSideEffects(
  handle: string,
  materialized: MaterializedProfile,
  options: {
    readOnly?: boolean;
    sendFirstBadgeNotification?: boolean;
  } = {},
): Promise<void> {
  if (options.readOnly) return;

  const ops: Promise<unknown>[] = [trackBadgeGenerated(handle)];

  if (options.sendFirstBadgeNotification) {
    const scoring = materialized.scoring ?? await resolveScoreModel(handle);
    if (scoring) ops.push(notifyFirstBadge(handle, scoring));
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
