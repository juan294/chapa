/**
 * Supabase data access — email campaigns.
 *
 * All operations fail-open (return sensible defaults when DB is unavailable).
 */

import { getSupabase } from "./supabase";
import { parseRow, parseRows } from "./parse-row";
import { cacheGet, cacheSet } from "../cache/redis";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CampaignType = "announcement" | "engagement";
export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "sent"
  | "failed"
  | "cancelled";
export type CampaignSendStatus = "pending" | "sent" | "failed";

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
  status: CampaignStatus;
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
  status: CampaignSendStatus;
  sentAt: string | null;
  error: string | null;
}

interface CampaignRow {
  id: string;
  type: string | null;
  name: string;
  subject: string;
  preview_text?: string | null;
  headline: string;
  body_text: string;
  features?: unknown;
  cta_text: string;
  cta_url: string;
  status: string;
  total_recipients?: number | null;
  sent_count?: number | null;
  failed_count?: number | null;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
}

interface CampaignSendRow {
  id: string;
  campaign_id: string;
  handle: string;
  email: string;
  status: string;
  sent_at?: string | null;
  error?: string | null;
}

interface ParsedCampaignRow extends CampaignRow {
  type: CampaignType | null;
  status: CampaignStatus;
}

interface ParsedCampaignSendRow extends CampaignSendRow {
  status: CampaignSendStatus;
}

const CAMPAIGN_STATUSES = [
  "draft",
  "scheduled",
  "sending",
  "sent",
  "failed",
  "cancelled",
] as const satisfies readonly CampaignStatus[];
const CAMPAIGN_SEND_STATUSES = [
  "pending",
  "sent",
  "failed",
] as const satisfies readonly CampaignSendStatus[];

const CAMPAIGN_ROW_REQUIRED_KEYS = [
  "id",
  "name",
  "subject",
  "headline",
  "body_text",
  "cta_text",
  "cta_url",
  "status",
  "created_at",
] as const satisfies readonly (keyof CampaignRow & string)[];

const CAMPAIGN_SEND_ROW_REQUIRED_KEYS = [
  "id",
  "campaign_id",
  "handle",
  "email",
  "status",
] as const satisfies readonly (keyof CampaignSendRow & string)[];

function validationError(message: string): Error {
  return new Error(`Campaign row validation failed: ${message}`);
}

function isCampaignStatus(value: string): value is CampaignStatus {
  return CAMPAIGN_STATUSES.includes(value as CampaignStatus);
}

function isCampaignSendStatus(value: string): value is CampaignSendStatus {
  return CAMPAIGN_SEND_STATUSES.includes(value as CampaignSendStatus);
}

function readString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw validationError(`expected "${field}" to be a string`);
  }
  return value;
}

function readNullableString(value: unknown, field: string): string | null {
  if (value == null) return null;
  return readString(value, field);
}

function readNumberWithDefault(
  value: unknown,
  field: string,
  fallback: number,
): number {
  if (value == null) return fallback;
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw validationError(`expected "${field}" to be a number`);
  }
  return value;
}

function readFeatures(value: unknown): { text: string }[] {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    throw validationError('expected "features" to be an array');
  }

  return value.map((item, index) => {
    if (item == null || typeof item !== "object" || Array.isArray(item)) {
      throw validationError(`expected features[${index}] to be an object`);
    }

    const text = (item as Record<string, unknown>).text;
    if (typeof text !== "string") {
      throw validationError(`expected features[${index}].text to be a string`);
    }

    return { text };
  });
}

function parseCampaignRow(value: unknown): ParsedCampaignRow {
  const row = parseRow<CampaignRow>(
    value,
    CAMPAIGN_ROW_REQUIRED_KEYS,
    "email_campaigns",
  );
  if (!row) {
    throw validationError("missing required campaign fields");
  }

  if (row.type != null && row.type !== "announcement" && row.type !== "engagement") {
    throw validationError(`unexpected campaign type "${String(row.type)}"`);
  }
  if (!isCampaignStatus(row.status)) {
    throw validationError(`unexpected campaign status "${row.status}"`);
  }

  readString(row.id, "id");
  readString(row.name, "name");
  readString(row.subject, "subject");
  readString(row.headline, "headline");
  readString(row.body_text, "body_text");
  readString(row.cta_text, "cta_text");
  readString(row.cta_url, "cta_url");
  readString(row.created_at, "created_at");
  readNullableString(row.preview_text, "preview_text");
  readFeatures(row.features);
  readNumberWithDefault(row.total_recipients, "total_recipients", 0);
  readNumberWithDefault(row.sent_count, "sent_count", 0);
  readNumberWithDefault(row.failed_count, "failed_count", 0);
  readNullableString(row.started_at, "started_at");
  readNullableString(row.completed_at, "completed_at");

  return {
    ...row,
    type: row.type === "engagement" ? "engagement" : "announcement",
    status: row.status,
  };
}

function parseCampaignSendRow(value: unknown): ParsedCampaignSendRow {
  const row = parseRow<CampaignSendRow>(
    value,
    CAMPAIGN_SEND_ROW_REQUIRED_KEYS,
    "campaign_sends",
  );
  if (!row) {
    throw validationError("missing required campaign send fields");
  }

  if (!isCampaignSendStatus(row.status)) {
    throw validationError(`unexpected campaign send status "${row.status}"`);
  }

  readString(row.id, "id");
  readString(row.campaign_id, "campaign_id");
  readString(row.handle, "handle");
  readString(row.email, "email");
  readNullableString(row.sent_at, "sent_at");
  readNullableString(row.error, "error");

  return {
    ...row,
    status: row.status,
  };
}

export const CampaignRowSchema = {
  parse: parseCampaignRow,
};

export const CampaignSendRowSchema = {
  parse: parseCampaignSendRow,
};

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------

export function mapCampaignRow(row: unknown): Campaign {
  const parsed = CampaignRowSchema.parse(row);
  return {
    id: parsed.id,
    type: parsed.type === "engagement" ? "engagement" : "announcement",
    name: parsed.name,
    subject: parsed.subject,
    previewText: parsed.preview_text ?? null,
    headline: parsed.headline,
    bodyText: parsed.body_text,
    features: readFeatures(parsed.features),
    ctaText: parsed.cta_text,
    ctaUrl: parsed.cta_url,
    status: parsed.status,
    totalRecipients: parsed.total_recipients ?? 0,
    sentCount: parsed.sent_count ?? 0,
    failedCount: parsed.failed_count ?? 0,
    createdAt: parsed.created_at,
    startedAt: parsed.started_at ?? null,
    completedAt: parsed.completed_at ?? null,
  };
}

export function mapSendRow(row: unknown): CampaignSend {
  const parsed = CampaignSendRowSchema.parse(row);
  return {
    id: parsed.id,
    campaignId: parsed.campaign_id,
    handle: parsed.handle,
    email: parsed.email,
    status: parsed.status,
    sentAt: parsed.sent_at ?? null,
    error: parsed.error ?? null,
  };
}

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

    const row = parseRow<CampaignRow>(data, CAMPAIGN_ROW_REQUIRED_KEYS, "email_campaigns");
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

    const row = parseRow<CampaignRow>(data, CAMPAIGN_ROW_REQUIRED_KEYS, "email_campaigns");
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

    const rows = parseRows<CampaignSendRow>(
      data,
      CAMPAIGN_SEND_ROW_REQUIRED_KEYS,
      "campaign_sends",
    );
    return rows.map(mapSendRow);
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
 * Aggregate send status counts for a campaign via bounded count queries.
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
    const countByStatus = async (status: CampaignSendStatus): Promise<number> => {
      const { count, error } = await db
        .from("campaign_sends")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", id)
        .eq("status", status);

      if (error) throw error;
      return count ?? 0;
    };

    const [sent, pending, failed] = await Promise.all([
      countByStatus("sent"),
      countByStatus("pending"),
      countByStatus("failed"),
    ]);

    return {
      sent,
      pending,
      failed,
    };
  } catch (error) {
    console.error(
      "[db] dbGetCampaignStats failed:",
      (error as Error).message,
    );
    return { sent: 0, pending: 0, failed: 0 };
  }
}
