/**
 * Supabase data access — email campaigns.
 *
 * All operations fail-open (return sensible defaults when DB is unavailable).
 */

import { getSupabase } from "./supabase";
import { cacheGet, cacheSet } from "../cache/redis";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CampaignType = "announcement" | "engagement";

export interface Campaign {
  id: string;
  type: CampaignType;
  name: string;
  subject: string;
  previewText: string | null;
  headline: string;
  bodyText: string;
  features: { text: string }[];
  ctaText: string;
  ctaUrl: string;
  status: "draft" | "sending" | "sent" | "failed";
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface CampaignSend {
  id: string;
  campaignId: string;
  handle: string;
  email: string;
  status: "pending" | "sent" | "failed";
  sentAt: string | null;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapCampaignRow(row: any): Campaign {
  return {
    id: row.id,
    type: row.type ?? "announcement",
    name: row.name,
    subject: row.subject,
    previewText: row.preview_text ?? null,
    headline: row.headline,
    bodyText: row.body_text,
    features: (row.features as { text: string }[]) ?? [],
    ctaText: row.cta_text,
    ctaUrl: row.cta_url,
    status: row.status,
    totalRecipients: row.total_recipients ?? 0,
    sentCount: row.sent_count ?? 0,
    failedCount: row.failed_count ?? 0,
    createdAt: row.created_at,
    startedAt: row.started_at ?? null,
    completedAt: row.completed_at ?? null,
  };
}

function mapSendRow(row: any): CampaignSend {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    handle: row.handle,
    email: row.email,
    status: row.status,
    sentAt: row.sent_at ?? null,
    error: row.error ?? null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Campaign CRUD
// ---------------------------------------------------------------------------

export async function dbGetCampaigns(
  status?: Campaign["status"],
  type?: CampaignType,
): Promise<Campaign[]> {
  const db = getSupabase();
  if (!db) return [];

  try {
    let query = db
      .from("email_campaigns")
      .select("*");

    if (status) {
      query = query.eq("status", status);
    }
    if (type) {
      query = query.eq("type", type);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) throw error;
    if (!data) return [];

    return data.map(mapCampaignRow);
  } catch (error) {
    console.error("[db] dbGetCampaigns failed:", (error as Error).message);
    return [];
  }
}

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

    return mapCampaignRow(data);
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

const ENGAGEMENT_CACHE_KEY = "campaign:active-engagement";
const ENGAGEMENT_CACHE_TTL = 3600; // 1 hour

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

    const campaign = mapCampaignRow(data);
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

// ---------------------------------------------------------------------------
// Campaign sends
// ---------------------------------------------------------------------------

export async function dbCreateCampaignSends(
  campaignId: string,
  recipients: { handle: string; email: string }[],
): Promise<number> {
  const db = getSupabase();
  if (!db) return 0;

  try {
    const rows = recipients.map((r) => ({
      campaign_id: campaignId,
      handle: r.handle,
      email: r.email,
      status: "pending",
    }));

    const { error } = await db
      .from("campaign_sends")
      .upsert(rows, { onConflict: "campaign_id,handle" });

    if (error) throw error;
    return recipients.length;
  } catch (error) {
    console.error(
      "[db] dbCreateCampaignSends failed:",
      (error as Error).message,
    );
    return 0;
  }
}

export async function dbGetPendingSends(
  campaignId: string,
  limit: number,
): Promise<CampaignSend[]> {
  const db = getSupabase();
  if (!db) return [];

  try {
    const { data, error } = await db
      .from("campaign_sends")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("status", "pending")
      .order("id")
      .limit(limit);

    if (error) throw error;
    if (!data) return [];

    return data.map(mapSendRow);
  } catch (error) {
    console.error(
      "[db] dbGetPendingSends failed:",
      (error as Error).message,
    );
    return [];
  }
}

export async function dbMarkSendsSent(ids: string[]): Promise<void> {
  const db = getSupabase();
  if (!db) return;

  try {
    const { error } = await db
      .from("campaign_sends")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .in("id", ids);

    if (error) throw error;
  } catch (error) {
    console.error("[db] dbMarkSendsSent failed:", (error as Error).message);
  }
}

export async function dbMarkSendsFailed(
  ids: string[],
  errorMsg: string,
): Promise<void> {
  const db = getSupabase();
  if (!db) return;

  try {
    const { error } = await db
      .from("campaign_sends")
      .update({ status: "failed", error: errorMsg })
      .in("id", ids);

    if (error) throw error;
  } catch (error) {
    console.error("[db] dbMarkSendsFailed failed:", (error as Error).message);
  }
}

/**
 * Aggregate send status counts for a campaign via client-side counting.
 *
 * Uses JS aggregation instead of SQL GROUP BY because PostgREST does not
 * support GROUP BY. Acceptable at current scale (<1K sends/campaign).
 *
 * @param id - Campaign UUID
 * @returns Counts of sent, pending, and failed sends (defaults to 0)
 */
export async function dbGetCampaignStats(
  id: string,
): Promise<{ sent: number; pending: number; failed: number }> {
  const db = getSupabase();
  if (!db) return { sent: 0, pending: 0, failed: 0 };

  try {
    // PostgREST (Supabase query builder) does not support GROUP BY, so we fetch
    // the status column only and aggregate in JS. This is already minimal — one
    // narrow SELECT with a single-pass O(n) count. An RPC/database function would
    // move the aggregation to Postgres but adds migration overhead not warranted
    // at current scale (<1K sends/campaign).
    const { data, error } = await db
      .from("campaign_sends")
      .select("status")
      .eq("campaign_id", id);

    if (error) throw error;
    if (!data) return { sent: 0, pending: 0, failed: 0 };

    // Count by status — single pass, O(n) where n = rows for this campaign
    const counts: Record<string, number> = {};
    for (const row of data) {
      counts[row.status] = (counts[row.status] ?? 0) + 1;
    }

    return {
      sent: counts["sent"] ?? 0,
      pending: counts["pending"] ?? 0,
      failed: counts["failed"] ?? 0,
    };
  } catch (error) {
    console.error(
      "[db] dbGetCampaignStats failed:",
      (error as Error).message,
    );
    return { sent: 0, pending: 0, failed: 0 };
  }
}
