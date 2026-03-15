/**
 * Campaign orchestration — initiate and process email campaign batches.
 *
 * Respects Resend Free plan daily limit (100 emails/day) by tracking
 * sends via a Redis counter and processing in batches of 50.
 */

import { getResend } from "./resend";
import {
  buildAnnouncementHtml,
  buildAnnouncementText,
  type AnnouncementData,
} from "./templates/announcement";
import { dbGetUsersWithEmail } from "@/lib/db/users";
import type { Campaign } from "@/lib/db/campaigns";
import {
  dbGetCampaign,
  dbUpdateCampaign,
  dbCreateCampaignSends,
  dbGetPendingSends,
  dbMarkSendsSent,
  dbMarkSendsFailed,
  dbGetCampaignStats,
} from "@/lib/db/campaigns";
import { cacheGet, cacheIncr } from "@/lib/cache/redis";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Stay under 100 Free plan limit — leave 5 buffer for transactional emails. */
export const DAILY_SEND_LIMIT = 95;

/** Max emails per resend.batch.send() call (API limit is 100). */
export const BATCH_SIZE = 50;

/** Redis key prefix for daily send counter. */
const DAILY_QUOTA_KEY = "campaign:daily-sends";

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

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export async function getDailyQuota(): Promise<number> {
  const key = `${DAILY_QUOTA_KEY}:${todayDateString()}`;
  const count = await cacheGet<number>(key);
  return count ?? 0;
}

async function incrementDailyQuota(count: number): Promise<void> {
  const key = `${DAILY_QUOTA_KEY}:${todayDateString()}`;
  await cacheIncr(key, count, 86400);
}

// ---------------------------------------------------------------------------
// Campaign lifecycle
// ---------------------------------------------------------------------------

/**
 * Populate campaign_sends from eligible users and set status to "sending".
 * Returns total recipient count, or null if campaign can't be initiated.
 */
export async function initiateCampaign(
  campaignId: string,
): Promise<{ totalRecipients: number } | null> {
  const campaign = await dbGetCampaign(campaignId);
  if (!campaign || campaign.status !== "draft") return null;

  const users = await dbGetUsersWithEmail();
  if (users.length === 0) return null;

  const count = await dbCreateCampaignSends(
    campaignId,
    users.map((u) => ({ handle: u.handle, email: u.email })),
  );

  await dbUpdateCampaign(campaignId, {
    status: "sending",
    totalRecipients: count,
    startedAt: new Date().toISOString(),
  });

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
  const todaySent = await getDailyQuota();
  const available = DAILY_SEND_LIMIT - todaySent;
  if (available <= 0) {
    return { sent: 0, failed: 0, remaining: -1 }; // quota exhausted
  }

  // Get next batch
  const batchLimit = Math.min(available, BATCH_SIZE);
  const pending = await dbGetPendingSends(campaignId, batchLimit);

  if (pending.length === 0) {
    // All sends processed — finalize campaign
    const stats = await dbGetCampaignStats(campaignId);
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
    await dbMarkSendsFailed(
      pending.map((s) => s.id),
      "Resend unavailable",
    );
    return { sent: 0, failed: pending.length, remaining: 0 };
  }

  // Build emails using shared content helper
  const emails = pending.map((send) => {
    const content = buildEmailContent(campaign, send.handle);
    return {
      from: "Chapa <notifications@chapa.thecreativetoken.com>",
      to: send.email,
      subject: campaign.subject,
      html: buildAnnouncementHtml(content),
      text: buildAnnouncementText(content),
    };
  });

  let batchSent = 0;
  let batchFailed = 0;
  const sendIds = pending.map((s) => s.id);

  try {
    const { error } = await resend.batch.send(emails);

    if (error) {
      await dbMarkSendsFailed(sendIds, error.message);
      batchFailed = pending.length;
    } else {
      await dbMarkSendsSent(sendIds);
      await incrementDailyQuota(pending.length);
      batchSent = pending.length;
    }
  } catch (error) {
    console.error(
      "[campaigns] processCampaignBatch error:",
      (error as Error).message,
    );
    await dbMarkSendsFailed(sendIds, (error as Error).message);
    batchFailed = pending.length;
  }

  // Single stats query at the end
  const stats = await dbGetCampaignStats(campaignId);
  await dbUpdateCampaign(campaignId, {
    sentCount: stats.sent,
    failedCount: stats.failed,
  });

  return { sent: batchSent, failed: batchFailed, remaining: stats.pending };
}
