/**
 * Supabase data access — campaign CRUD operations.
 *
 * All operations fail-open (return sensible defaults when DB is unavailable).
 */

import { getSupabase } from "../supabase";
import { cacheGet, cacheSet } from "../../cache/redis";
import {
  Campaign,
  CampaignType,
  CampaignRow,
  CAMPAIGN_ROW_REQUIRED_KEYS,
  isCampaignStatus,
  mapCampaignRow,
  parseRow,
  parseRows,
} from "./types";

const ENGAGEMENT_CACHE_KEY = "campaign:active-engagement";
const ENGAGEMENT_CACHE_TTL = 3600; // 1 hour

/**
 * List all campaigns, optionally filtered by status and/or type.
 *
 * @param status - Optional status filter (e.g. "draft", "sent")
 * @param type - Optional type filter ("announcement" | "engagement")
 * @returns Campaigns ordered by creation date descending; empty array on error
 */
export async function dbGetCampaigns(
  status?: Campaign["status"],
  type?: CampaignType,
): Promise<Campaign[]> {
  const db = getSupabase();
  if (!db) return [];

  try {
    let query = db.from("email_campaigns").select("*");

    if (status) {
      query = query.eq("status", status);
    }
    if (type) {
      query = query.eq("type", type);
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) throw error;
    if (!data) return [];

    const rows = parseRows<CampaignRow>(
      data,
      CAMPAIGN_ROW_REQUIRED_KEYS,
      "email_campaigns",
    );
    return rows.map(mapCampaignRow);
  } catch (error) {
    console.error("[db] dbGetCampaigns failed:", (error as Error).message);
    return [];
  }
}

/**
 * Fetch a single campaign by UUID.
 *
 * @returns The campaign, or `null` if not found or DB is unavailable
 */
export async function dbGetCampaign(id: string): Promise<Campaign | null> {
  const db = getSupabase();
  if (!db) return null;

  try {
    const { data, error } = await db
      .from("email_campaigns")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const row = parseRow<CampaignRow>(
      data,
      CAMPAIGN_ROW_REQUIRED_KEYS,
      "email_campaigns",
    );
    return row ? mapCampaignRow(row) : null;
  } catch (error) {
    console.error("[db] dbGetCampaign failed:", (error as Error).message);
    return null;
  }
}

/**
 * Insert a new campaign in "draft" status.
 *
 * @param campaign - Campaign content fields (type, name, subject, body, CTA, etc.)
 * @returns The new campaign's UUID, or `null` if the insert failed
 */
export async function dbCreateCampaign(
  campaign: Omit<
    Campaign,
    | "id"
    | "status"
    | "totalRecipients"
    | "sentCount"
    | "failedCount"
    | "createdAt"
    | "startedAt"
    | "completedAt"
  >,
): Promise<string | null> {
  const db = getSupabase();
  if (!db) return null;

  try {
    const { data, error } = await db
      .from("email_campaigns")
      .insert({
        type: campaign.type,
        name: campaign.name,
        subject: campaign.subject,
        preview_text: campaign.previewText,
        headline: campaign.headline,
        body_text: campaign.bodyText,
        features: campaign.features,
        cta_text: campaign.ctaText,
        cta_url: campaign.ctaUrl,
      })
      .select("id")
      .single();

    if (error) throw error;
    return data?.id ?? null;
  } catch (error) {
    console.error("[db] dbCreateCampaign failed:", (error as Error).message);
    return null;
  }
}

/**
 * Partially update a campaign's mutable fields (content, status, send counts).
 *
 * @param id      - Campaign UUID
 * @param updates - Partial field set to merge (only provided keys are written)
 * @returns `true` on success, `false` on error or missing DB
 */
export async function dbUpdateCampaign(
  id: string,
  updates: Partial<
    Pick<
      Campaign,
      | "name"
      | "subject"
      | "previewText"
      | "headline"
      | "bodyText"
      | "features"
      | "ctaText"
      | "ctaUrl"
      | "status"
      | "totalRecipients"
      | "sentCount"
      | "failedCount"
      | "startedAt"
      | "completedAt"
    >
  >,
): Promise<boolean> {
  if (updates.status !== undefined && !isCampaignStatus(updates.status)) {
    throw new Error(`Invalid campaign status: ${updates.status}`);
  }

  const db = getSupabase();
  if (!db) return false;

  try {
    const row: Record<string, unknown> = {};
    if (updates.name !== undefined) row.name = updates.name;
    if (updates.subject !== undefined) row.subject = updates.subject;
    if (updates.previewText !== undefined)
      row.preview_text = updates.previewText;
    if (updates.headline !== undefined) row.headline = updates.headline;
    if (updates.bodyText !== undefined) row.body_text = updates.bodyText;
    if (updates.features !== undefined) row.features = updates.features;
    if (updates.ctaText !== undefined) row.cta_text = updates.ctaText;
    if (updates.ctaUrl !== undefined) row.cta_url = updates.ctaUrl;
    if (updates.status !== undefined) row.status = updates.status;
    if (updates.totalRecipients !== undefined)
      row.total_recipients = updates.totalRecipients;
    if (updates.sentCount !== undefined) row.sent_count = updates.sentCount;
    if (updates.failedCount !== undefined)
      row.failed_count = updates.failedCount;
    if (updates.startedAt !== undefined) row.started_at = updates.startedAt;
    if (updates.completedAt !== undefined)
      row.completed_at = updates.completedAt;

    const { error } = await db
      .from("email_campaigns")
      .update(row)
      .eq("id", id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("[db] dbUpdateCampaign failed:", (error as Error).message);
    return false;
  }
}

/**
 * Fetch the most recent engagement campaign (cached 1h in Redis).
 *
 * Used during cron batch processing to avoid N+1 DB queries when
 * checking engagement campaign eligibility for each user.
 *
 * @returns The latest engagement campaign, or `null` if none exists
 */
export async function dbGetActiveEngagementCampaign(): Promise<Campaign | null> {
  // Check cache first — avoids N+1 queries during cron batch processing
  const cached = await cacheGet<Campaign>(ENGAGEMENT_CACHE_KEY);
  if (cached) return cached;

  const db = getSupabase();
  if (!db) return null;

  try {
    const { data, error } = await db
      .from("email_campaigns")
      .select("*")
      .eq("type", "engagement")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const row = parseRow<CampaignRow>(
      data,
      CAMPAIGN_ROW_REQUIRED_KEYS,
      "email_campaigns",
    );
    if (!row) return null;

    const campaign = mapCampaignRow(row);
    await cacheSet(ENGAGEMENT_CACHE_KEY, campaign, ENGAGEMENT_CACHE_TTL);
    return campaign;
  } catch (error) {
    console.error(
      "[db] dbGetActiveEngagementCampaign failed:",
      (error as Error).message,
    );
    return null;
  }
}

/**
 * Delete a campaign by UUID. Only draft campaigns can be deleted.
 *
 * @returns `true` on success, `false` if the delete failed or DB is unavailable
 */
export async function dbDeleteCampaign(id: string): Promise<boolean> {
  const db = getSupabase();
  if (!db) return false;

  try {
    // Only allow deletion of draft campaigns
    const { error } = await db
      .from("email_campaigns")
      .delete()
      .eq("id", id)
      .eq("status", "draft");

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("[db] dbDeleteCampaign failed:", (error as Error).message);
    return false;
  }
}
