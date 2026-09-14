import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getSupabase } from "./supabase";
import { databaseInstantMicros, validDatabaseInstant } from "./source-time";
import { encryptToken } from "@/lib/auth/github";
import { getNextauthSecret } from "@/lib/env";

/** Declared structurally so the linked-platform store can depend on this
 * module without a cycle. */
export type RefreshLink = { readonly id: string; readonly updatedAt: string; readonly handle: string; readonly platform: string };
function args(link: RefreshLink, attemptId: string) {
  z.uuid().parse(link.id); z.uuid().parse(attemptId); databaseInstantMicros(link.updatedAt);
  return { p_owner: link.handle, p_actor: link.handle, p_platform: link.platform,
    p_link_id: link.id, p_link_version: link.updatedAt, p_attempt_id: attemptId };
}
async function rpc(name: string, input: object): Promise<unknown> {
  const db = getSupabase(); if (!db) throw new Error();
  const { data, error } = await db.rpc(name, input); if (error) throw new Error();
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
