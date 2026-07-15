import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/auth/cron";
import { dbGetCampaigns } from "@/lib/db/campaigns";
import { processCampaignBatch } from "@/lib/email/campaigns";
import { withErrorCapture } from "@/lib/analytics/server-errors";
import { cacheSet } from "@/lib/cache/redis";

export const maxDuration = 300;
const HEARTBEAT_KEY = "cron:lastrun:process-campaigns";
const HEARTBEAT_TTL_SECONDS = 60 * 60 * 48;

/**
 * Leave a buffer before the function's `maxDuration` so there's time left to
 * finish the in-flight batch call, write the heartbeat, and return a response
 * before the platform kills the invocation mid-flight.
 */
const TIME_BUDGET_MS = (maxDuration - 30) * 1000;

interface CampaignBatchOutcome {
  campaignId: string;
  campaignName: string;
  sent: number;
  failed: number;
  remaining: number;
}

interface DeferredCampaign {
  campaignId: string;
  campaignName: string;
  reason: "time_budget" | "quota_exhausted";
}

export const GET = withErrorCapture("/api/cron/process-campaigns", async (request: NextRequest) => {
  const denied = verifyCronSecret(request);
  if (denied) return denied;

  // Find active campaigns (filter at DB level)
  const active = await dbGetCampaigns("sending");

  if (active.length === 0) {
    await cacheSet(HEARTBEAT_KEY, Date.now(), HEARTBEAT_TTL_SECONDS);
    return NextResponse.json({
      status: "idle",
      message: "No active campaigns",
    });
  }

  // Round-robin across ALL active campaigns in this run — a single run
  // used to process only active[0], starving any second concurrently-
  // "sending" campaign across successive daily runs (#1035).
  //
  // Quota safety: processCampaignBatch() re-reads the shared Redis daily
  // send counter (campaign:daily-sends:<date>) and reserves capacity
  // atomically via cacheReserveQuota() before every batch. That state is
  // persisted in Redis, not held in this function's memory, so quota
  // consumed by campaign N is immediately visible to campaign N+1 in the
  // very same run — no in-process counter needs to be threaded through to
  // keep campaign 2 from exceeding the daily cap.
  const startedAt = Date.now();
  const campaigns: CampaignBatchOutcome[] = [];
  const deferred: DeferredCampaign[] = [];

  for (let i = 0; i < active.length; i++) {
    const campaign = active[i]!;

    if (Date.now() - startedAt >= TIME_BUDGET_MS) {
      deferred.push({
        campaignId: campaign.id,
        campaignName: campaign.name,
        reason: "time_budget",
      });
      continue;
    }

    const result = await processCampaignBatch(campaign.id);
    campaigns.push({
      campaignId: campaign.id,
      campaignName: campaign.name,
      ...result,
    });

    // remaining === -1 is processCampaignBatch's signal that the shared
    // daily send quota is exhausted for today. Stop iterating — any later
    // campaign would just no-op against the same exhausted counter — and
    // defer the rest to the next run instead of burning time on them.
    if (result.remaining === -1) {
      for (let j = i + 1; j < active.length; j++) {
        deferred.push({
          campaignId: active[j]!.id,
          campaignName: active[j]!.name,
          reason: "quota_exhausted",
        });
      }
      break;
    }
  }

  await cacheSet(HEARTBEAT_KEY, Date.now(), HEARTBEAT_TTL_SECONDS);

  const first = campaigns[0];

  return NextResponse.json({
    status: "ok",
    processed: campaigns.length,
    // Backward-compatible top-level fields mirror the first processed
    // campaign's outcome for existing single-campaign consumers.
    campaignId: first?.campaignId,
    campaignName: first?.campaignName,
    sent: first?.sent,
    failed: first?.failed,
    remaining: first?.remaining,
    campaigns,
    ...(deferred.length > 0 ? { deferred } : {}),
  });
});
