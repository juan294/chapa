/**
 * Campaign orchestration — initiate and process email campaign batches.
 *
 * Respects Resend Free plan daily limit (100 emails/day) by tracking
 * sends via a Redis counter and processing in claimed batches of 50.
 */

import { createHash, randomUUID } from "node:crypto";
import { getResend } from "./resend";
import { withTimeout, EMAIL_SEND_TIMEOUT_MS } from "@/lib/async/with-timeout";
import {
  buildAnnouncementHtml,
  buildAnnouncementText,
  type AnnouncementData,
} from "./templates/announcement";
import { dbGetUsersWithEmail } from "@/lib/db/users";
import type { Campaign, CampaignSendStats } from "@/lib/db/campaigns";
import {
  dbGetCampaign,
  dbUpdateCampaign,
  dbClaimCampaignForSending,
  dbReleaseCampaignClaim,
  dbCreateCampaignSends,
  dbClaimPendingSends,
  dbAcknowledgeCampaignSends,
  dbMarkSendsFailed,
  dbRequeueSends,
  dbGetCampaignStats,
} from "@/lib/db/campaigns";
import { cacheGet, cacheIncr, cacheReserveQuota } from "@/lib/cache/redis";
import { toDateString } from "@/lib/utils/date";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default sender address for campaign emails. */
export const EMAIL_FROM = "Chapa <notifications@chapa.thecreativetoken.com>";

/** Stay under 100 Free plan limit — leave 5 buffer for transactional emails. */
export const DAILY_SEND_LIMIT = 95;

/** Max emails per resend.batch.send() call (API limit is 100). */
export const BATCH_SIZE = 50;

/** Redis key prefix for daily send counter. */
const DAILY_QUOTA_KEY = "campaign:daily-sends";

/** Claimed campaign send rows are eligible for recovery after this lease window. */
const CLAIM_LEASE_MS = 10 * 60 * 1000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build announcement data from a campaign + per-recipient handle. */
export function buildEmailContent(
  campaign: Pick<
    Campaign,
    "headline" | "bodyText" | "features" | "ctaText" | "ctaUrl" | "previewText"
  >,
  handle: string,
): AnnouncementData {
  return {
    handle,
    headline: campaign.headline,
    bodyText: campaign.bodyText,
    features: campaign.features,
    ctaText: campaign.ctaText,
    ctaUrl: campaign.ctaUrl,
    previewText: campaign.previewText ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Daily quota tracking
// ---------------------------------------------------------------------------

export async function getDailyQuota(): Promise<number> {
  const key = `${DAILY_QUOTA_KEY}:${toDateString(new Date())}`;
  const count = await cacheGet<number>(key);
  return count ?? 0;
}

async function refundDailyQuota(count: number): Promise<void> {
  if (count <= 0) return;

  const key = `${DAILY_QUOTA_KEY}:${toDateString(new Date())}`;
  await cacheIncr(key, -count, 86400);
}

function getRemainingSends(stats: CampaignSendStats): number {
  return stats.pending + stats.processing;
}

interface ResendBatchResult {
  id?: string | null;
  error?: { message?: string | null } | null;
}

interface ResendBatchError {
  message?: string | null;
  statusCode?: number | null;
  name?: string | null;
}

const TRANSIENT_RESEND_ERROR_NAMES = new Set([
  "rate_limit",
  "rate_limit_exceeded",
  "internal_server_error",
  "application_error",
  "concurrent_idempotent_requests",
]);

function isTransientResendError(error: ResendBatchError, wasThrown: boolean): boolean {
  if (wasThrown) return true;
  if (error.statusCode === 429 || (error.statusCode != null && error.statusCode >= 500)) {
    return true;
  }
  return error.name != null && TRANSIENT_RESEND_ERROR_NAMES.has(error.name);
}

// ---------------------------------------------------------------------------
// Campaign lifecycle
// ---------------------------------------------------------------------------

/**
 * Populate campaign_sends from eligible users and set status to "sending".
 * Returns total recipient count, or null if campaign can't be initiated.
 *
 * Accepts an optional pre-fetched campaign to avoid a redundant DB query
 * when the caller has already loaded the campaign (e.g. the send route).
 */
export async function initiateCampaign(
  campaignId: string,
  prefetched?: Campaign | null,
): Promise<{ totalRecipients: number } | null> {
  const campaign = prefetched ?? await dbGetCampaign(campaignId);
  if (!campaign || campaign.status !== "draft") return null;

  const users = await dbGetUsersWithEmail();
  if (users.length === 0) return null;

  const startedAt = new Date().toISOString();
  const claimed = await dbClaimCampaignForSending(
    campaignId,
    users.length,
    startedAt,
  );
  if (!claimed) return null;

  const count = await dbCreateCampaignSends(
    campaignId,
    users.map((u) => ({ handle: u.handle, email: u.email })),
  );
  if (count === 0) {
    const released = await dbReleaseCampaignClaim(campaignId, startedAt);
    if (!released) {
      throw new Error(
        "Failed to release campaign after recipient persistence failure",
      );
    }
    return null;
  }

  return { totalRecipients: count };
}

/**
 * Send the next batch of pending emails for a campaign.
 * Respects daily quota. Returns send counts.
 */
export async function processCampaignBatch(
  campaignId: string,
): Promise<{ sent: number; failed: number; remaining: number }> {
  const campaign = await dbGetCampaign(campaignId);
  if (!campaign || campaign.status !== "sending") {
    return { sent: 0, failed: 0, remaining: 0 };
  }

  // Check daily quota
  const quotaKey = `${DAILY_QUOTA_KEY}:${toDateString(new Date())}`;
  const todaySent = await getDailyQuota();
  const available = DAILY_SEND_LIMIT - todaySent;
  if (available <= 0) {
    return { sent: 0, failed: 0, remaining: -1 }; // quota exhausted
  }

  const batchLimit = Math.min(available, BATCH_SIZE);
  const leaseToken = randomUUID();
  const leaseExpiresAt = new Date(Date.now() + CLAIM_LEASE_MS).toISOString();
  const claimed = await dbClaimPendingSends(
    campaignId,
    batchLimit,
    leaseToken,
    leaseExpiresAt,
  );

  if (claimed.length === 0) {
    const stats = await dbGetCampaignStats(campaignId);
    const remaining = getRemainingSends(stats);
    if (remaining > 0) {
      return { sent: 0, failed: 0, remaining };
    }

    const finalStatus =
      stats.failed > 0 && stats.sent === 0 ? "failed" : "sent";
    await dbUpdateCampaign(campaignId, {
      status: finalStatus as "sent" | "failed",
      sentCount: stats.sent,
      failedCount: stats.failed,
      completedAt: new Date().toISOString(),
    });
    return { sent: 0, failed: 0, remaining: 0 };
  }

  const resend = getResend();
  if (!resend) {
    const acknowledged = await dbMarkSendsFailed(
      claimed.map((s) => s.id),
      "Resend unavailable",
      leaseToken,
    );
    if (!acknowledged) throw new Error("Failed to acknowledge failed campaign emails");
    const stats = await dbGetCampaignStats(campaignId);
    await dbUpdateCampaign(campaignId, {
      sentCount: stats.sent,
      failedCount: stats.failed,
    });
    return {
      sent: 0,
      failed: claimed.length,
      remaining: getRemainingSends(stats),
    };
  }

  // Build emails using shared content helper
  const emails = claimed.map((send) => {
    const content = buildEmailContent(campaign, send.handle);
    return {
      from: EMAIL_FROM,
      to: send.email,
      subject: campaign.subject,
      html: buildAnnouncementHtml(content),
      text: buildAnnouncementText(content),
    };
  });

  const reservation = await cacheReserveQuota(
    quotaKey,
    claimed.length,
    DAILY_SEND_LIMIT,
    86400,
  );
  if (!reservation.allowed) {
    // Leave the claimed rows in processing until the lease expires to prevent
    // another worker from re-sending the same recipients inside this quota window.
    return { sent: 0, failed: 0, remaining: -1 };
  }

  let batchSent = 0;
  let batchFailed = 0;
  const sendIds = claimed.map((s) => s.id);
  const idempotencyKey = `campaign/${campaignId}/${createHash("sha256")
    // Expired leases are recovered as one indivisible group by the claim RPC,
    // so the full ordered membership and provider payload remain identical.
    .update(sendIds.join("\n") || campaignId)
    .digest("hex")}`;

  let data: unknown = null;
  let error: ResendBatchError | null = null;
  let providerThrew = false;
  try {
    const response = await withTimeout(
      resend.batch.send(emails, { idempotencyKey }),
      EMAIL_SEND_TIMEOUT_MS,
      "processCampaignBatch",
    );
    data = response.data;
    error = response.error as ResendBatchError | null;
  } catch (caught) {
    providerThrew = true;
    error = caught instanceof Error
      ? { message: caught.message, name: caught.name }
      : { message: "Unknown Resend batch failure" };
  }

  if (error) {
    const message = error.message ?? "Unknown Resend batch failure";
    if (isTransientResendError(error, providerThrew)) {
      const requeued = await dbRequeueSends(sendIds, message, leaseToken);
      if (!requeued) throw new Error("Failed to requeue transient campaign emails");
      await refundDailyQuota(claimed.length);
      const stats = await dbGetCampaignStats(campaignId);
      await dbUpdateCampaign(campaignId, {
        sentCount: stats.sent,
        failedCount: stats.failed,
      });
      return { sent: 0, failed: 0, remaining: getRemainingSends(stats) };
    } else {
      const acknowledged = await dbMarkSendsFailed(sendIds, message, leaseToken);
      if (!acknowledged) {
        await refundDailyQuota(claimed.length);
        throw new Error("Failed to acknowledge failed campaign emails");
      }
      batchFailed = claimed.length;
    }
  } else {
    const results = Array.isArray(data) ? (data as ResendBatchResult[]) : [];
    const acknowledgements: Array<{
      id: string;
      status: "sent" | "failed";
      error: string | null;
    }> = [];

    for (const [index, send] of claimed.entries()) {
      const result = results[index];
      if (result?.id && !result.error) {
        acknowledgements.push({ id: send.id, status: "sent", error: null });
        continue;
      }

      const message = result?.error?.message ?? "Unknown Resend batch failure";
      acknowledgements.push({ id: send.id, status: "failed", error: message });
    }

    const acknowledged = await dbAcknowledgeCampaignSends(
      acknowledgements,
      leaseToken,
    );
    if (!acknowledged) {
      await refundDailyQuota(claimed.length);
      throw new Error("Failed to acknowledge campaign email batch");
    }

    batchSent = acknowledgements.filter(
      (item) => item.status === "sent",
    ).length;
    batchFailed = claimed.length - batchSent;
  }

  if (batchFailed > 0) {
    await refundDailyQuota(batchFailed);
  }

  // Single stats query at the end
  const stats = await dbGetCampaignStats(campaignId);
  await dbUpdateCampaign(campaignId, {
    sentCount: stats.sent,
    failedCount: stats.failed,
  });

  return {
    sent: batchSent,
    failed: batchFailed,
    remaining: getRemainingSends(stats),
  };
}
