import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { getServiceClient } from "@/test/contract/invoke";
import {
  dbGetCampaignStats,
  dbClaimPendingSends,
  dbReleaseCampaignSendLease,
  dbAcknowledgeCampaignSends,
} from "./sends";

/**
 * #1079 — `dbGetCampaignStats` previously issued a plain, unpaginated
 * `select("status")` over every send row for a campaign. PostgREST's
 * `max_rows = 1000` (supabase/config.toml:18) silently truncates any such
 * select at 1000 rows with no error, which undercounted stats for any
 * campaign with more than 1000 recipients. `lib/email/campaigns.ts` uses
 * those counts to decide when a campaign is done and to persist
 * `sentCount`/`failedCount` — an undercount there means a campaign can be
 * marked "sent"/"failed" while recipients past row 1000 were never actually
 * emailed.
 *
 * This proves the fix against a real local Postgres/PostgREST stack, where
 * `max_rows` actually applies — the mocked unit tests in `sends.test.ts`
 * cannot exercise PostgREST's real truncation behavior.
 */

const RUN_ID = randomUUID();
const CAMPAIGN_NAME = `chapa-e2e-${RUN_ID}-campaign-stats`;

describe("dbGetCampaignStats past the 1000-row max_rows cap (contract)", () => {
  let campaignId: string | undefined;

  afterAll(async () => {
    if (!campaignId) return;
    const db = getServiceClient();
    // ON DELETE CASCADE on campaign_sends.campaign_id removes every seeded
    // send row along with the campaign.
    await db.from("email_campaigns").delete().eq("id", campaignId);
  });

  it("counts every send row across the full recipient list, not just the first 1000", async () => {
    const db = getServiceClient();

    const { data: campaign, error: campaignError } = await db
      .from("email_campaigns")
      .insert({
        name: CAMPAIGN_NAME,
        subject: "Contract test subject",
        headline: "Contract test headline",
        body_text: "Contract test body",
        cta_url: "https://example.com",
      })
      .select("id")
      .single();

    expect(campaignError).toBeNull();
    expect(campaign).not.toBeNull();
    campaignId = (campaign as { id: string }).id;

    const SENT_COUNT = 1000;
    const FAILED_COUNT = 250;
    const PENDING_COUNT = 3;

    const rows = [
      ...Array.from({ length: SENT_COUNT }, (_, i) => ({
        campaign_id: campaignId,
        handle: `sent-${i}`,
        email: `sent-${i}@example.com`,
        status: "sent",
      })),
      ...Array.from({ length: FAILED_COUNT }, (_, i) => ({
        campaign_id: campaignId,
        handle: `failed-${i}`,
        email: `failed-${i}@example.com`,
        status: "failed",
      })),
      ...Array.from({ length: PENDING_COUNT }, (_, i) => ({
        campaign_id: campaignId,
        handle: `pending-${i}`,
        email: `pending-${i}@example.com`,
        status: "pending",
      })),
    ];

    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const { error } = await db
        .from("campaign_sends")
        .insert(rows.slice(i, i + CHUNK));
      expect(error).toBeNull();
    }

    const stats = await dbGetCampaignStats(campaignId);

    expect(stats).toEqual({
      sent: SENT_COUNT,
      pending: PENDING_COUNT,
      processing: 0,
      failed: FAILED_COUNT,
    });
    expect(stats.sent + stats.pending + stats.processing + stats.failed).toBe(
      rows.length,
    );
  });
});

/**
 * #1085 — an expired-lease group is recovered whole by `claim_campaign_sends`
 * (ignoring the caller's `p_limit`) so a provider retry can replay an
 * identical payload. When that whole group doesn't fit the caller's
 * remaining daily quota, it must be released back to `pending` — preserving
 * its `group_token` identity so a *later* claim still recovers the exact
 * same row-ID membership as one indivisible group, rather than splitting it
 * across smaller batches (which would break provider-side idempotency for
 * an earlier ambiguous send attempt).
 *
 * This proves the real migration 033 SQL (CTEs, COALESCE seeding, the
 * whitespace-safe guard) against local Postgres — the string-matching
 * migration-contract test can't catch a logic bug in the CTE wiring itself.
 */
const RECOVERY_CAMPAIGN_NAME = `chapa-e2e-${RUN_ID}-lease-recovery`;

describe("expired-lease group recovery and quota-shortfall release (contract, #1085)", () => {
  let campaignId: string | undefined;

  afterAll(async () => {
    if (!campaignId) return;
    const db = getServiceClient();
    await db.from("email_campaigns").delete().eq("id", campaignId);
  });

  it("releases an oversized recovered group to pending, then re-recovers the identical membership whole", async () => {
    const db = getServiceClient();

    const { data: campaign, error: campaignError } = await db
      .from("email_campaigns")
      .insert({
        name: RECOVERY_CAMPAIGN_NAME,
        subject: "Contract test subject",
        headline: "Contract test headline",
        body_text: "Contract test body",
        cta_url: "https://example.com",
      })
      .select("id")
      .single();

    expect(campaignError).toBeNull();
    expect(campaign).not.toBeNull();
    campaignId = (campaign as { id: string }).id;

    const GROUP_SIZE = 5;
    const { error: insertError } = await db.from("campaign_sends").insert(
      Array.from({ length: GROUP_SIZE }, (_, i) => ({
        campaign_id: campaignId,
        handle: `recover-${i}`,
        email: `recover-${i}@example.com`,
        status: "pending",
      })),
    );
    expect(insertError).toBeNull();

    // 1. Original claim: takes the whole group under lease A.
    const leaseA = `chapa-e2e-${RUN_ID}-lease-a`;
    const originalClaim = await dbClaimPendingSends(
      campaignId,
      GROUP_SIZE,
      leaseA,
      new Date(Date.now() + 60_000).toISOString(),
    );
    expect(originalClaim).toHaveLength(GROUP_SIZE);
    const originalIds = originalClaim.map((s) => s.id).sort();

    // 2. Simulate the provider call timing out / the worker dying before it
    // could acknowledge: force lease A's expiry into the past directly (a
    // real expiry would just be 10 minutes of wall-clock time passing).
    const { error: expireError } = await db
      .from("campaign_sends")
      .update({ lease_expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq("campaign_id", campaignId)
      .eq("lease_token", leaseA);
    expect(expireError).toBeNull();

    // 3. Next attempt: quota only allows 2, but the expired group must be
    // recovered WHOLE (all 5), ignoring the requested limit.
    const leaseB = `chapa-e2e-${RUN_ID}-lease-b`;
    const recovered = await dbClaimPendingSends(
      campaignId,
      2,
      leaseB,
      new Date(Date.now() + 60_000).toISOString(),
    );
    expect(recovered).toHaveLength(GROUP_SIZE);
    expect(recovered.map((s) => s.id).sort()).toEqual(originalIds);

    // 4. That recovered group doesn't fit quota either -> release it back to
    // pending instead of leaving it re-leased under lease B.
    const released = await dbReleaseCampaignSendLease(leaseB, GROUP_SIZE);
    expect(released).toBe(true);

    const { data: releasedRows, error: releasedError } = await db
      .from("campaign_sends")
      .select("id, status, lease_token, lease_expires_at, claimed_at, group_token")
      .eq("campaign_id", campaignId)
      .order("id");
    expect(releasedError).toBeNull();
    expect(releasedRows).toHaveLength(GROUP_SIZE);
    for (const row of releasedRows!) {
      expect(row.status).toBe("pending");
      expect(row.lease_token).toBeNull();
      expect(row.lease_expires_at).toBeNull();
      expect(row.claimed_at).toBeNull();
      // Group identity survives the release — seeded from the very first
      // expired lease token (lease A), not lease B.
      expect(row.group_token).toBe(leaseA);
    }

    // 5. A later attempt (quota still tight: limit=1) must recover the
    // released group whole again as a `pending_group`, not split it.
    const leaseC = `chapa-e2e-${RUN_ID}-lease-c`;
    const reRecovered = await dbClaimPendingSends(
      campaignId,
      1,
      leaseC,
      new Date(Date.now() + 60_000).toISOString(),
    );
    expect(reRecovered).toHaveLength(GROUP_SIZE);
    expect(reRecovered.map((s) => s.id).sort()).toEqual(originalIds);

    // 6. Quota is finally sufficient — acknowledge the group as sent,
    // proving the released-and-recovered group can still complete normally.
    const acknowledged = await dbAcknowledgeCampaignSends(
      reRecovered.map((s) => ({ id: s.id, status: "sent" as const, error: null })),
      leaseC,
    );
    expect(acknowledged).toBe(true);

    const finalStats = await dbGetCampaignStats(campaignId);
    expect(finalStats).toEqual({
      sent: GROUP_SIZE,
      pending: 0,
      processing: 0,
      failed: 0,
    });
  });
});
