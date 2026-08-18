import { afterAll, describe, expect, it } from "vitest";
import { getServiceClient } from "@/test/contract/invoke";
import { dbGetCampaignStats } from "./sends";

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

const CAMPAIGN_NAME = "contract-1079-campaign-stats";

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
