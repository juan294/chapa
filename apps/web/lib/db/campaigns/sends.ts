/**
 * Supabase data access — campaign send operations (recipients, claim/ack lifecycle).
 *
 * All operations fail-open (return sensible defaults when DB is unavailable).
 */

import { getSupabase } from "../supabase";
import {
  CampaignSend,
  CampaignSendStatus,
  CampaignSendRow,
  CampaignSendStats,
  CAMPAIGN_SEND_ROW_REQUIRED_KEYS,
  CLAIM_CLEAR_FIELDS,
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
 * then call `dbMarkSendsSent` / `dbMarkSendsFailed` with the same `leaseToken`
 * to release the lease. Expired leases are automatically re-claimable by the
 * next cron invocation.
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
): Promise<void> {
  const db = getSupabase();
  if (!db) return;

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

    const { error } = await query.in("id", ids);

    if (error) throw error;
  } catch (error) {
    console.error("[db] dbMarkSendsSent failed:", (error as Error).message);
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
): Promise<void> {
  const db = getSupabase();
  if (!db) return;

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

    const { error } = await query.in("id", ids);

    if (error) throw error;
  } catch (error) {
    console.error("[db] dbMarkSendsFailed failed:", (error as Error).message);
  }
}

/**
 * Aggregate send status counts for a campaign via bounded count queries.
 *
 * Uses 4 parallel COUNT queries (one per status). This is efficient at normal
 * volumes; if a campaign exceeds ~5,000 sends, replace with a single GROUP BY
 * RPC to avoid the extra round-trips (tracked as cost P2-1).
 *
 * @param id - Campaign UUID
 * @returns Counts of sent, pending, and failed sends (defaults to 0)
 */
export async function dbGetCampaignStats(
  id: string,
): Promise<CampaignSendStats> {
  const db = getSupabase();
  if (!db) return { sent: 0, pending: 0, processing: 0, failed: 0 };

  try {
    const countByStatus = async (
      status: CampaignSendStatus,
    ): Promise<number> => {
      const { count, error } = await db
        .from("campaign_sends")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", id)
        .eq("status", status);

      if (error) throw error;
      return count ?? 0;
    };

    const [sent, pending, processing, failed] = await Promise.all([
      countByStatus("sent"),
      countByStatus("pending"),
      countByStatus("processing"),
      countByStatus("failed"),
    ]);

    return {
      sent,
      pending,
      processing,
      failed,
    };
  } catch (error) {
    console.error(
      "[db] dbGetCampaignStats failed:",
      (error as Error).message,
    );
    return { sent: 0, pending: 0, processing: 0, failed: 0 };
  }
}
