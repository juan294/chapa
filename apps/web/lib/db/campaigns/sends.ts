/**
 * Supabase data access — campaign send operations (recipients, claim/ack lifecycle).
 *
 * All operations fail-open (return sensible defaults when DB is unavailable).
 */

import { getSupabase } from "../supabase";
import { fetchAllPages } from "../paginate";
import {
  CampaignSend,
  CampaignSendRow,
  CampaignSendStats,
  CAMPAIGN_SEND_ROW_REQUIRED_KEYS,
  CLAIM_CLEAR_FIELDS,
  isCampaignSendStatus,
  mapSendRow,
  parseRows,
} from "./types";

/**
 * Upsert `campaign_sends` rows for each recipient. Uses `onConflict: campaign_id,handle`
 * so re-running the same recipient list is idempotent.
 *
 * @returns Number of recipients provided; 0 on error
 */
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
      .upsert(rows, {
        onConflict: "campaign_id,handle",
        ignoreDuplicates: true,
      });

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

/**
 * Fetch up to `limit` unclaimed pending sends for a campaign.
 *
 * Unlike `dbClaimPendingSends`, this does not set a lease — use it for
 * read-only inspection or non-concurrent processing.
 */
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
    console.error("[db] dbGetPendingSends failed:", (error as Error).message);
    return [];
  }
}

/**
 * Atomically claim up to `limit` pending sends for exclusive processing.
 *
 * Delegates to the `claim_campaign_sends` Postgres RPC, which sets each
 * returned row's `status → "processing"`, `lease_token`, and `lease_expires_at`
 * in a single statement — preventing two concurrent workers from picking the
 * same batch. The caller must complete processing before `leaseExpiresAt` and
 * then atomically acknowledge the provider batch with the same `leaseToken`.
 * Expired leases are automatically re-claimable as an indivisible group by
 * the next cron invocation, preserving an identical idempotent payload.
 *
 * @param leaseToken - Opaque token that ties this batch to the claiming worker
 * @param leaseExpiresAt - ISO-8601 timestamp after which the claim expires
 */
export async function dbClaimPendingSends(
  campaignId: string,
  limit: number,
  leaseToken: string,
  leaseExpiresAt: string,
): Promise<CampaignSend[]> {
  if (!leaseToken.trim()) return [];
  const db = getSupabase();
  if (!db) return [];

  try {
    const { data, error } = await db.rpc("claim_campaign_sends", {
      p_campaign_id: campaignId,
      p_limit: limit,
      p_lease_token: leaseToken,
      p_lease_expires_at: leaseExpiresAt,
    });

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
      "[db] dbClaimPendingSends failed:",
      (error as Error).message,
    );
    return [];
  }
}

export interface CampaignSendAcknowledgement {
  id: string;
  status: "sent" | "failed";
  error: string | null;
}

/**
 * Atomically acknowledge every result in one provider batch.
 *
 * The database function performs no updates unless every input row still
 * belongs to the supplied lease. This prevents a partially written
 * acknowledgement from changing the payload membership of an idempotent
 * provider retry.
 */
export async function dbAcknowledgeCampaignSends(
  results: CampaignSendAcknowledgement[],
  leaseToken: string,
): Promise<boolean> {
  if (results.length === 0 || !leaseToken.trim()) return false;
  const db = getSupabase();
  if (!db) return false;

  try {
    const { data, error } = await db.rpc("acknowledge_campaign_sends", {
      p_lease_token: leaseToken,
      p_results: results,
    });

    if (error) throw error;
    return data === true;
  } catch (error) {
    console.error(
      "[db] dbAcknowledgeCampaignSends failed:",
      (error as Error).message,
    );
    return false;
  }
}

/**
 * Mark the given send IDs as "sent" and clear their lease fields.
 *
 * Only updates rows whose `status` is currently "processing". When
 * `leaseToken` is provided the update is also scoped to rows whose
 * `lease_token` matches — preventing a worker from accidentally acknowledging
 * a batch claimed by a different concurrent worker.
 *
 * @param leaseToken - If provided, scopes the update to rows with this lease
 */
export async function dbMarkSendsSent(
  ids: string[],
  leaseToken?: string,
): Promise<boolean> {
  if (ids.length === 0) return true;
  const db = getSupabase();
  if (!db) return false;

  try {
    let query = db
      .from("campaign_sends")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        error: null,
        ...CLAIM_CLEAR_FIELDS,
      })
      .eq("status", "processing");

    if (leaseToken) {
      query = query.eq("lease_token", leaseToken);
    }

    const { data, error } = await query.in("id", ids).select("id");

    if (error) throw error;
    return Array.isArray(data) && data.length === ids.length;
  } catch (error) {
    console.error("[db] dbMarkSendsSent failed:", (error as Error).message);
    return false;
  }
}

/**
 * Mark the given send IDs as "failed" and clear their lease fields.
 *
 * Only updates rows whose `status` is currently "processing". When
 * `leaseToken` is provided the update is also scoped to rows whose
 * `lease_token` matches — same lease-isolation guarantee as `dbMarkSendsSent`.
 *
 * @param errorMsg - Human-readable failure reason stored in the `error` column
 * @param leaseToken - If provided, scopes the update to rows with this lease
 */
export async function dbMarkSendsFailed(
  ids: string[],
  errorMsg: string,
  leaseToken?: string,
): Promise<boolean> {
  if (ids.length === 0) return true;
  const db = getSupabase();
  if (!db) return false;

  try {
    let query = db
      .from("campaign_sends")
      .update({
        status: "failed",
        error: errorMsg,
        ...CLAIM_CLEAR_FIELDS,
      })
      .eq("status", "processing");

    if (leaseToken) {
      query = query.eq("lease_token", leaseToken);
    }

    const { data, error } = await query.in("id", ids).select("id");

    if (error) throw error;
    return Array.isArray(data) && data.length === ids.length;
  } catch (error) {
    console.error("[db] dbMarkSendsFailed failed:", (error as Error).message);
    return false;
  }
}

/**
 * Aggregate send status counts for a campaign in a single logical query.
 *
 * Fetches only the `status` column for every send row and reduces counts in
 * JS. Previously issued 4 parallel COUNT queries (one per status) — this
 * fetches once instead (cost P2-1). A campaign's recipient list can exceed
 * PostgREST's `max_rows = 1000` cap (supabase/config.toml:18), so this pages
 * through with `fetchAllPages`/`.range()` rather than silently truncating —
 * this function drives the campaign terminal-state decision in
 * `lib/email/campaigns.ts`, where an undercount could mark a campaign
 * "sent"/"failed" while recipients past row 1000 were never actually
 * emailed (#1079).
 *
 * @param id - Campaign UUID
 * @returns Counts of sent, pending, processing, and failed sends (defaults to 0)
 */
export async function dbGetCampaignStats(
  id: string,
): Promise<CampaignSendStats> {
  const db = getSupabase();
  if (!db) return { sent: 0, pending: 0, processing: 0, failed: 0 };

  try {
    // .order("id") makes pagination deterministic across round trips —
    // without it, Postgres doesn't guarantee stable row order between the
    // separate .range() queries fetchAllPages issues, which could skip or
    // double-count rows across page boundaries.
    const data = await fetchAllPages<{ status: string }>((from, to) =>
      db
        .from("campaign_sends")
        .select("status")
        .eq("campaign_id", id)
        .order("id")
        .range(from, to),
    );

    const stats: CampaignSendStats = {
      sent: 0,
      pending: 0,
      processing: 0,
      failed: 0,
    };
    for (const row of data) {
      if (isCampaignSendStatus(row.status)) stats[row.status]++;
    }
    return stats;
  } catch (error) {
    console.error(
      "[db] dbGetCampaignStats failed:",
      (error as Error).message,
    );
    return { sent: 0, pending: 0, processing: 0, failed: 0 };
  }
}
