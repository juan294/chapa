import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getSupabase } from "./supabase";
import { databaseInstantMicros, validDatabaseInstant } from "./source-time";
import { encryptToken } from "@/lib/auth/github";
import { getNextauthSecret } from "@/lib/env";
import { captureServerError } from "@/lib/analytics/server-errors";

/** Declared structurally so the linked-platform store can depend on this
 * module without a cycle. */
export type RefreshLink = { readonly id: string; readonly updatedAt: string; readonly handle: string; readonly platform: string };
function baseArgs(link: RefreshLink) {
  databaseInstantMicros(link.updatedAt);
  return { p_owner: link.handle, p_actor: link.handle, p_platform: link.platform,
    p_link_id: link.id, p_link_version: link.updatedAt };
}
function args(link: RefreshLink, attemptId: string) {
  z.uuid().parse(link.id); z.uuid().parse(attemptId);
  return { ...baseArgs(link), p_attempt_id: attemptId };
}
/** Preserves the Supabase `{ error }` result's own message (never just an
 * empty generic Error) so a caller that captures observability around this
 * helper has something diagnostic to report. */
async function rpc(name: string, input: object): Promise<unknown> {
  const db = getSupabase(); if (!db) throw new Error(`${name}: Supabase client unavailable`);
  const { data, error } = await db.rpc(name, input); if (error) throw new Error(`${name} failed: ${error.message}`);
  return data;
}
export type RefreshClaim = { status: "busy" | "stale" } | { status: "claimed"; attemptId: string };
export async function claimPlatformTokenRefresh(link: RefreshLink): Promise<RefreshClaim> {
  try {
    const attemptId = randomUUID();
    const result = z.union([z.object({ status: z.enum(["busy", "stale"]) }).strict(),
      z.object({ status: z.literal("claimed"), attemptId: z.uuid() }).strict()]).parse(await rpc("platform_token_refresh_claim", args(link, attemptId)));
    if (result.status === "claimed" && result.attemptId !== attemptId) throw new Error();
    return result;
  } catch { throw new Error("Platform refresh claim unavailable"); }
}

/**
 * The largest function duration any route that can reach a linked-source
 * refresh can actually run for, plus a safety margin. Verified directly
 * against the live Vercel project (read-only, 2026-09-23) rather than
 * inferred from source alone, because a route with no explicit `maxDuration`
 * export (`/api/refresh`, `/api/generate`, `/api/recalculate`, `/studio`,
 * `/u/[handle]` SSR — all reach `refreshSourceLink` via `getStats`) inherits
 * a *project-level* default the source tree does not show:
 *
 *   vercel api "/v9/projects/prj_hht2ez82Ucm4wAiKlGmBj4WOi2bV?teamId=team_eJRc3uJPBTvXknc9WbVr4nlh"
 *   -> defaultResourceConfig.functionDefaultTimeout: 300
 *   -> resourceConfig.fluid: true (Fluid Compute active)
 *   vercel api /v2/teams -> billing.plan: "pro"
 *
 * That confirms every unlabeled route inherits the SAME 300s ceiling as the
 * routes with an explicit `maxDuration = 300`
 * (`apps/web/vercel.json`'s `functions` block for `warm-cache`,
 * `sync-audience`, `process-campaigns`; `app/api/admin/bulk-recalculate/
 * route.ts`'s own `export const maxDuration = 300`) — not the higher ceiling
 * Fluid Compute on Pro would *allow* configuring (up to 800s), which is a
 * separate question from what is actually configured today. The badge route
 * declares only 35s, so it was never the binding constraint. If the function
 * that claimed an attempt is killed by the platform after it sent the
 * provider request but before it observed a response, that response can only
 * still be produced for as long as the function itself could still be
 * running — once its timeout has elapsed the runtime has torn it down and
 * nothing it started can still be "in flight" from the platform's point of
 * view. 300s is the true ceiling today; the extra 60s absorbs clock skew
 * between Postgres's `clock_timestamp()` and the platform's kill, plus
 * outbound TCP/TLS teardown time. Re-verify this if the project's default
 * timeout, Fluid Compute setting, or any reachable route's explicit
 * `maxDuration` ever changes. See
 * `docs/decisions/2026-09-23-refresh-claim-recovery.md`.
 */
export const REFRESH_CLAIM_TAKEOVER_THRESHOLD_SECONDS = 300 + 60;

export type RefreshTakeover =
  | { status: "too_fresh" | "exhausted" | "gone" | "stale" }
  | { status: "claimed"; attemptId: string };

/**
 * Take over a genuinely ambiguous, durably claimed attempt exactly once, and
 * only once it is older than {@link REFRESH_CLAIM_TAKEOVER_THRESHOLD_SECONDS}.
 * Never called for a "busy" claim response until the caller has decided the
 * prior attempt is worth attempting to take over — the RPC itself re-checks
 * staleness under its own row lock, so this call is always safe to attempt
 * and simply reports why it declined when it does.
 */
export async function takeoverPlatformTokenRefresh(link: RefreshLink): Promise<RefreshTakeover> {
  try {
    const attemptId = randomUUID();
    z.uuid().parse(attemptId);
    const result = z.union([z.object({ status: z.enum(["too_fresh", "exhausted", "gone", "stale"]) }).strict(),
      z.object({ status: z.literal("claimed"), attemptId: z.uuid() }).strict()]).parse(await rpc("platform_token_refresh_takeover",
        { ...baseArgs(link), p_new_attempt_id: attemptId, p_max_age_seconds: REFRESH_CLAIM_TAKEOVER_THRESHOLD_SECONDS }));
    if (result.status === "claimed" && result.attemptId !== attemptId) throw new Error(`platform_token_refresh_takeover: reply named a different attemptId for link ${link.id}`);
    return result;
  } catch (error) {
    // Observable durable-write failure (CLAUDE.md): the caller
    // (`refreshSourceLink`) swallows this exception into a generic
    // `unavailable` result, so without this capture a broken takeover path
    // would be entirely silent.
    void captureServerError({ route: "lib/db/platform-token-refresh:takeoverPlatformTokenRefresh", statusCode: 500, error });
    throw new Error("Platform refresh takeover unavailable");
  }
}

export type RefreshAttemptRelease = { status: "stale" } | { status: "released"; needsReconnect: boolean };

/**
 * Release the exact attempt this caller just claimed (or took over) because
 * its outcome is definitively known — no provider request is outstanding for
 * it. `needsReconnect` marks the connection for an owner-visible reconnect
 * prompt in the same call; pass it only for a definitive revoke
 * (`invalid_grant`), never for an ordinary definitive transient failure.
 */
export async function releasePlatformTokenRefreshAttempt(link: RefreshLink, attemptId: string, needsReconnect = false): Promise<RefreshAttemptRelease> {
  try {
    return z.union([z.object({ status: z.literal("stale") }).strict(),
      z.object({ status: z.literal("released"), needsReconnect: z.boolean() }).strict()]).parse(await rpc("platform_token_refresh_release_attempt",
        { ...args(link, attemptId), p_needs_reconnect: needsReconnect }));
  } catch (error) {
    // Observable durable-write failure (CLAUDE.md): releasing the barrier is
    // itself the write, and the caller (`refreshSourceLink`) swallows this
    // exception into a generic `unavailable` result — without this capture a
    // stuck barrier that could never even be released would fail silently.
    void captureServerError({ route: "lib/db/platform-token-refresh:releasePlatformTokenRefreshAttempt", statusCode: 500, error });
    throw new Error("Platform refresh release unavailable");
  }
}

/**
 * Mark a connection as needing reconnect WITHOUT releasing its refresh
 * barrier. Used only when a takeover's own retry is itself ambiguous: the
 * barrier must stay (the retried request's outcome is still genuinely
 * unknown, and `takeover_used` already forbids a second takeover), but
 * waiting longer can never resolve it, so the owner needs to be told now.
 * Version-guarded so a concurrent reconnect (which replaces this row and
 * clears the barrier itself) is never clobbered by a late, stale write.
 * A plain table write, not a RPC: this touches no consent-gated capability,
 * only a boolean the owner-facing status read surfaces.
 */
export async function markPlatformNeedsReconnect(link: RefreshLink): Promise<void> {
  const route = "lib/db/platform-token-refresh:markPlatformNeedsReconnect";
  try {
    const db = getSupabase();
    if (!db) {
      void captureServerError({ route, statusCode: 500, error: new Error(`markPlatformNeedsReconnect: Supabase client unavailable for link ${link.id}`) });
      return;
    }
    const { data, error } = await db.from("user_platforms")
      .update({ needs_reconnect: true })
      .eq("id", link.id).eq("updated_at", link.updatedAt)
      .select("id");
    if (error) {
      void captureServerError({ route, statusCode: 500, error: new Error(`markPlatformNeedsReconnect update failed for link ${link.id}: ${error.message}`) });
      return;
    }
    if (!data || data.length === 0) {
      // Version-guard miss (the link changed — e.g. a concurrent reconnect —
      // between when this attempt started and now): not a storage failure,
      // but the owner never got the reconnect flag this call intended to
      // set, so it must still be observable rather than a quiet no-op.
      void captureServerError({ route, statusCode: 500, error: new Error(`markPlatformNeedsReconnect: no row matched link ${link.id} at version ${link.updatedAt} (version-guard miss)`) });
    }
  } catch (error) {
    // best-effort by design (the barrier itself still blocks further
    // refresh attempts either way) but never silent — CLAUDE.md requires
    // every durable write failure to be observable.
    void captureServerError({ route, statusCode: 500, error });
  }
}
export async function finishPlatformTokenRefresh(link: RefreshLink, attemptId: string,
  tokens: { accessToken: string; refreshToken: string | null; expiresAt: Date | null },
): Promise<{ status: "stale" } | { status: "updated"; id: string; updatedAt: string }> {
  try {
    const id = link.id, version = databaseInstantMicros(link.updatedAt);
    const secret = getNextauthSecret(); if (!secret || !tokens.accessToken.trim() || (tokens.refreshToken !== null && !tokens.refreshToken.trim())) throw new Error();
    const result = z.union([z.object({ status: z.literal("stale") }).strict(),
      z.object({ status: z.literal("updated"), id: z.uuid(), updatedAt: z.string().refine(validDatabaseInstant) }).strict()]).parse(await rpc("platform_token_refresh_finish", {
        ...args(link, attemptId), p_access_token: encryptToken(tokens.accessToken, secret),
        p_refresh_token: tokens.refreshToken === null ? null : encryptToken(tokens.refreshToken, secret),
        p_expires_at: tokens.expiresAt?.toISOString() ?? null,
      }));
    if (result.status === "updated" && (result.id !== id || databaseInstantMicros(result.updatedAt) <= version)) throw new Error();
    return result;
  } catch { throw new Error("Platform refresh completion unavailable"); }
}
/** Platforms whose grants are renewed through the refresh barrier. */
export const REFRESH_BARRIER_PLATFORMS: ReadonlySet<string> = new Set(["gitlab", "bitbucket", "codeberg"]);
/** Clears attempts superseded by a new authorization grant. The caller must
 * pass the link version the new grant produced; an attempt claimed against that
 * exact version is preserved. Recovery, so it is never gated on consent. */
export async function releasePlatformTokenRefreshBarrier(link: RefreshLink): Promise<{ status: "stale" } | { status: "released"; cleared: number }> {
  try {
    z.uuid().parse(link.id); databaseInstantMicros(link.updatedAt);
    return z.union([z.object({ status: z.literal("stale") }).strict(),
      z.object({ status: z.literal("released"), cleared: z.number().int().min(0) }).strict()]).parse(await rpc("platform_token_refresh_release", {
        p_owner: link.handle, p_actor: link.handle, p_platform: link.platform, p_link_id: link.id, p_link_version: link.updatedAt }));
  } catch { throw new Error("Platform refresh release unavailable"); }
}
