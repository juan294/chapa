/**
 * Supabase data access — campaign send operations (recipients, claim/ack lifecycle).
 *
 * Mutating and queue-reading operations fail-open when the DB is unavailable.
 * Campaign stats fail loudly because they govern terminal campaign state.
 */

import { getSupabase } from "../supabase";
import {
  CampaignSend,
  CampaignSendRow,
  CampaignSendStatus,
  CampaignSendStats,
  CAMPAIGN_SEND_ROW_REQUIRED_KEYS,
  CLAIM_CLEAR_FIELDS,
  mapSendRow,
  parseRows,
} from "./types";

/**
 * A campaign's terminal state cannot be decided when its send counts cannot
 * be read. Callers must treat this as a retryable processing failure.
 */
export class CampaignStatsReadError extends Error {
  readonly campaignId: string;

  constructor(campaignId: string, cause: unknown) {
    super(`Failed to read campaign stats for "${campaignId}"`, { cause });
    this.name = "CampaignStatsReadError";
    this.campaignId = campaignId;
  }
}

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

/**
 * Release a claimed lease group back to `pending`.
 *
 * Used when a recovered expired-lease group — returned whole by
 * `claim_campaign_sends`, ignoring the requested limit, to preserve an
 * identical payload for provider idempotency (see `dbClaimPendingSends`) —
 * exceeds the remaining daily send quota. Re-claiming that group again would
 * just refresh its lease under a fresh window without making progress, so it
 * is released back to `pending` instead. The database function deliberately
 * leaves `group_token` untouched so a later claim recovers the exact same
 * membership rather than splitting it across smaller batches, which would
 * break provider-side idempotency for an earlier ambiguous attempt (#1085).
 *
 * @param expectedCount - Number of rows the caller expects to release (from
 *   its own claim result). A mismatch fails closed (returns false) so a
 *   caller never silently under- or over-releases the group it holds.
 */
export async function dbReleaseCampaignSendLease(
  leaseToken: string,
  expectedCount: number,
): Promise<boolean> {
  if (!leaseToken.trim() || expectedCount <= 0) return false;
  const db = getSupabase();
  if (!db) return false;

  try {
    const { data, error } = await db.rpc("release_campaign_send_lease", {
      p_lease_token: leaseToken,
    });

    if (error) throw error;
    return data === expectedCount;
  } catch (error) {
    console.error(
      "[db] dbReleaseCampaignSendLease failed:",
      (error as Error).message,
    );
    return false;
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
 * Read exact send status counts for a campaign without transferring rows.
 *
 * Four parallel HEAD requests use PostgREST's exact count and the existing
 * `(campaign_id, status)` index. HEAD counts are not limited by the API row
 * cap and return no response rows, so large campaigns do not require paging
 * every send after each processed batch.
 *
 * @param id - Campaign UUID
 * @returns Counts of sent, pending, processing, and failed sends
 * @throws {CampaignStatsReadError} when the complete count cannot be read
 */
export async function dbGetCampaignStats(
  id: string,
): Promise<CampaignSendStats> {
  const db = getSupabase();
  if (!db) {
    throw new CampaignStatsReadError(id, new Error("Supabase unavailable"));
  }

  try {
    const countStatus = async (status: CampaignSendStatus) => {
      const { count, error } = await db
        .from("campaign_sends")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", id)
        .eq("status", status);

      if (error) throw error;
      return count ?? 0;
    };

    const [sent, pending, processing, failed] = await Promise.all([
      countStatus("sent"),
      countStatus("pending"),
      countStatus("processing"),
      countStatus("failed"),
    ]);
    return { sent, pending, processing, failed };
  } catch (error) {
    console.error(
      "[db] dbGetCampaignStats failed:",
      (error as Error).message,
    );
    throw new CampaignStatsReadError(id, error);
  }
}
