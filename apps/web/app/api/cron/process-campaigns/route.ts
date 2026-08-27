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

  // Round-robin across ALL active campaigns in this run, giving each one
  // batch per pass and repeating passes until every campaign's backlog
  // drains or the run runs out of quota/time (#1176/BE-M5). A single run
  // used to call processCampaignBatch() exactly ONCE per campaign — that
  // claims at most BATCH_SIZE (50) rows and returns, wasting most of the
  // day's quota whenever a campaign's backlog exceeds one batch. Passing
  // over the list repeatedly (instead of draining one campaign fully before
  // moving to the next) preserves the #1035 fairness property: a campaign
  // with a huge backlog can't monopolize the day's quota ahead of a second
  // concurrently-"sending" campaign.
  //
  // Quota safety: processCampaignBatch() re-reads the shared Redis daily
  // send counter (campaign:daily-sends:<date>) and reserves capacity
  // atomically via cacheReserveQuota() before every batch. That state is
  // persisted in Redis, not held in this function's memory, so quota
  // consumed by campaign N is immediately visible to campaign N+1 in the
  // very same run (or the very next pass) — no in-process counter needs to
  // be threaded through to keep one campaign from exceeding the daily cap.
  const startedAt = Date.now();
  const outcomes = new Map<string, CampaignBatchOutcome>();
  // Campaigns excluded from further passes this run: either finished
  // (remaining === 0) or stalled (see below). The `while` condition below
  // re-checks this every pass so a campaign only gets as many turns as it
  // can actually use.
  const excluded = new Set<string>();
  let quotaExhausted = false;

  outerLoop: while (active.some((c) => !excluded.has(c.id))) {
    for (const campaign of active) {
      if (excluded.has(campaign.id)) continue;

      if (Date.now() - startedAt >= TIME_BUDGET_MS) {
        break outerLoop;
      }

      const result = await processCampaignBatch(campaign.id);
      const prior = outcomes.get(campaign.id);
      outcomes.set(campaign.id, {
        campaignId: campaign.id,
        campaignName: campaign.name,
        sent: (prior?.sent ?? 0) + result.sent,
        failed: (prior?.failed ?? 0) + result.failed,
        remaining: result.remaining,
      });

      // remaining === -1 is processCampaignBatch's signal that the shared
      // daily send quota is exhausted for today. Stop the entire run — any
      // other campaign would just no-op against the same exhausted counter
      // — and defer everything not yet attempted to the next run.
      if (result.remaining === -1) {
        quotaExhausted = true;
        break outerLoop;
      }

      // Exclude the campaign from further passes once it's finished
      // (remaining === 0), or once an attempt makes no forward progress at
      // all (sent === 0 && failed === 0 with remaining still positive — e.g.
      // an oversized recovered lease group that doesn't fit the remaining
      // quota, or a permanently misconfigured Resend client, see BE-M6).
      // Looping "while remaining > 0" without this guard would busy-spin a
      // stalled campaign for the rest of TIME_BUDGET_MS, hammering the DB
      // for no benefit and starving every other active campaign in this
      // run. A stalled campaign still gets exactly one attempt per run and
      // is picked back up on the next cron invocation.
      if (result.remaining === 0 || (result.sent === 0 && result.failed === 0)) {
        excluded.add(campaign.id);
      }
    }
  }

  const campaigns = Array.from(outcomes.values());
  const deferred: DeferredCampaign[] = [];
  for (const campaign of active) {
    if (outcomes.has(campaign.id)) continue;
    deferred.push({
      campaignId: campaign.id,
      campaignName: campaign.name,
      reason: quotaExhausted ? "quota_exhausted" : "time_budget",
    });
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
