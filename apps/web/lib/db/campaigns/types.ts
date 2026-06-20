/**
 * Shared types, constants, validation helpers, and row-mappers for the
 * campaigns DB layer. Imported by `crud.ts` and `sends.ts`.
 */

import { parseRow, parseRows } from "../parse-row";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** The category of a campaign: product announcements or re-engagement messages. */
export type CampaignType = "announcement" | "engagement";
/** Lifecycle state of an email campaign from draft through completion or failure. */
export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "sent"
  | "failed"
  | "cancelled";
/** Delivery state of a single campaign send record. */
export type CampaignSendStatus = "pending" | "processing" | "sent" | "failed";

/** A fully hydrated email campaign including all content fields and send metrics. */
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

/** A single email send record tracking one recipient within a campaign batch. */
export interface CampaignSend {
  id: string;
  campaignId: string;
  handle: string;
  email: string;
  status: CampaignSendStatus;
  sentAt: string | null;
  error: string | null;
}

/** Aggregated delivery counts for a campaign (sent, pending, processing, failed). */
export interface CampaignSendStats {
  sent: number;
  pending: number;
  processing: number;
  failed: number;
}

// ---------------------------------------------------------------------------
// Internal row shapes (snake_case from DB)
// ---------------------------------------------------------------------------

export interface CampaignRow {
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

export interface CampaignSendRow {
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const CAMPAIGN_STATUSES = [
  "draft",
  "scheduled",
  "sending",
  "sent",
  "failed",
  "cancelled",
] as const satisfies readonly CampaignStatus[];

export const CAMPAIGN_SEND_STATUSES = [
  "pending",
  "processing",
  "sent",
  "failed",
] as const satisfies readonly CampaignSendStatus[];

export const CAMPAIGN_ROW_REQUIRED_KEYS = [
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

export const CAMPAIGN_SEND_ROW_REQUIRED_KEYS = [
  "id",
  "campaign_id",
  "handle",
  "email",
  "status",
] as const satisfies readonly (keyof CampaignSendRow & string)[];

export const CLAIM_CLEAR_FIELDS = {
  claimed_at: null,
  lease_expires_at: null,
  lease_token: null,
} as const;

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function validationError(message: string): Error {
  return new Error(`Campaign row validation failed: ${message}`);
}

export function isCampaignStatus(value: string): value is CampaignStatus {
  return CAMPAIGN_STATUSES.includes(value as CampaignStatus);
}

export function isCampaignSendStatus(
  value: string,
): value is CampaignSendStatus {
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

export function readFeatures(value: unknown): { text: string }[] {
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

// ---------------------------------------------------------------------------
// Row parsers
// ---------------------------------------------------------------------------

function parseCampaignRow(value: unknown): ParsedCampaignRow {
  const row = parseRow<CampaignRow>(
    value,
    CAMPAIGN_ROW_REQUIRED_KEYS,
    "email_campaigns",
  );
  if (!row) {
    throw validationError("missing required campaign fields");
  }

  if (
    row.type != null &&
    row.type !== "announcement" &&
    row.type !== "engagement"
  ) {
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

// ---------------------------------------------------------------------------
// Schema objects (used by row mappers and external callers)
// ---------------------------------------------------------------------------

/** Thin schema wrapper used by `mapCampaignRow` to parse raw `email_campaigns` DB rows. */
export const CampaignRowSchema = {
  parse: parseCampaignRow,
};

/** Thin schema wrapper used by `mapSendRow` to parse raw DB rows. */
export const CampaignSendRowSchema = {
  parse: parseCampaignSendRow,
};

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

/** Parse a raw `email_campaigns` DB row into a typed `Campaign` object. */
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

/** Parse a raw `campaign_sends` DB row into a typed `CampaignSend` object. */
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

// Re-export parseRows for use in crud/sends modules
export { parseRow, parseRows };
