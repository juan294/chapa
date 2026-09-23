import "server-only";
import { validDatabaseInstant } from "./source-time";
/**
 * Supabase data access — user_platforms table.
 *
 * Stores linked platform accounts (Bitbucket, future: GitLab, etc.).
 * All operations fail-open (return sensible defaults when DB is unavailable).
 * Tokens are encrypted at rest using AES-256-GCM (same as GitHub session tokens).
 */

import type { LinkedPlatform } from "@chapa/shared";
import { getSupabase } from "./supabase";
import { encryptToken, decryptToken } from "@/lib/auth/github";
import { getNextauthSecret } from "@/lib/env";
import {
  REFRESH_BARRIER_PLATFORMS,
  releasePlatformTokenRefreshBarrier,
} from "./platform-token-refresh";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlatformTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSecret(): string {
  const secret = getNextauthSecret();
  if (!secret) throw new Error("NEXTAUTH_SECRET is required for token encryption");
  return secret;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Get linked platform for a user (returns null if not linked or DB unavailable).
 * Decrypts tokens using NEXTAUTH_SECRET.
 */
export async function dbGetLinkedPlatform(
  handle: string,
  platform: string,
): Promise<{ remoteLogin: string; tokens: PlatformTokens } | null> {
  const db = getSupabase();
  if (!db) return null;

  try {
    const { data, error } = await db
      .from("user_platforms")
      .select("remote_login, access_token, refresh_token, token_expires_at")
      .eq("handle", handle.toLowerCase())
      .eq("platform", platform)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const secret = getSecret();
    const accessToken = decryptToken(data.access_token, secret);
    if (!accessToken) {
      console.error("[db] dbGetLinkedPlatform: failed to decrypt access token");
      return null;
    }

    const refreshToken = data.refresh_token
      ? decryptToken(data.refresh_token, secret)
      : null;

    return {
      remoteLogin: data.remote_login,
      tokens: {
        accessToken,
        refreshToken,
        expiresAt: data.token_expires_at
          ? new Date(data.token_expires_at)
          : null,
      },
    };
  } catch (error) {
    console.error("[db] dbGetLinkedPlatform failed:", (error as Error).message);
    return null;
  }
}

/** Private current linkage, never a public credential or evidence projection. */
export interface StrictLinkedPlatform {
  readonly id: string;
  readonly updatedAt: string;
  readonly handle: string;
  readonly platform: string;
  readonly remoteLogin: string;
  readonly tokens: PlatformTokens;
}
export type StrictLinkedPlatformResult =
  | { status: "linked"; link: StrictLinkedPlatform }
  | { status: "unlinked" }
  | { status: "unavailable"; reasonCode: "storage_error" | "invalid_record" | "credential_error" };

/** Fresh read only. Absence, failed storage and unusable credentials are distinct.
 * Callers must recheck current linkage after asynchronous work before publishing.
 * The legacy reader above retains its historical null/failure compatibility.
 */
export async function dbGetLinkedPlatformStrict(handle: string, platform: string): Promise<StrictLinkedPlatformResult> {
  try {
    const db = getSupabase();
    if (!db) return { status: "unavailable", reasonCode: "storage_error" };
    const owner = handle.toLowerCase();
    const { data, error } = await db.from("user_platforms")
      .select("id, handle, platform, remote_login, updated_at, access_token, refresh_token, token_expires_at")
      .eq("handle", owner).eq("platform", platform).maybeSingle();
    if (error) return { status: "unavailable", reasonCode: "storage_error" };
    if (data === null) return { status: "unlinked" };
    if (!data || typeof data !== "object" || typeof data.id !== "string" ||
      !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(data.id) ||
      data.handle !== owner || data.platform !== platform || typeof data.remote_login !== "string" || !data.remote_login.trim() ||
      !validDatabaseInstant(data.updated_at) || typeof data.access_token !== "string" || !data.access_token ||
      !(data.refresh_token === null || typeof data.refresh_token === "string") ||
      !(data.token_expires_at === null || validDatabaseInstant(data.token_expires_at))) {
      return { status: "unavailable", reasonCode: "invalid_record" };
    }
    try {
      const secret = getSecret();
      const accessToken = decryptToken(data.access_token, secret);
      const refreshToken = data.refresh_token === null ? null : decryptToken(data.refresh_token, secret);
      if (!accessToken?.trim() || (data.refresh_token !== null && !refreshToken?.trim())) return { status: "unavailable", reasonCode: "credential_error" };
      return { status: "linked", link: { id: data.id, updatedAt: data.updated_at, handle: owner, platform,
        remoteLogin: data.remote_login, tokens: { accessToken, refreshToken,
          expiresAt: data.token_expires_at === null ? null : new Date(data.token_expires_at) } } };
    } catch { return { status: "unavailable", reasonCode: "credential_error" }; }
  } catch { return { status: "unavailable", reasonCode: "storage_error" }; }
}

/**
 * Store/update a linked platform (upsert on handle+platform).
 * Encrypts tokens using NEXTAUTH_SECRET before storing.
 */
export async function dbUpsertLinkedPlatform(
  handle: string,
  platform: string,
  remoteLogin: string,
  accessToken: string,
  refreshToken: string | null,
  expiresAt: Date | null,
): Promise<boolean> {
  const db = getSupabase();
  if (!db) return false;

  try {
    const secret = getSecret();
    const owner = handle.toLowerCase();
    const { data, error } = await db
      .from("user_platforms")
      .upsert(
        {
          handle: owner,
          platform,
          remote_login: remoteLogin,
          access_token: encryptToken(accessToken, secret),
          refresh_token: refreshToken
            ? encryptToken(refreshToken, secret)
            : null,
          token_expires_at: expiresAt?.toISOString() ?? null,
          updated_at: new Date().toISOString(),
          // A fresh grant from the OAuth flow is, by construction, not
          // waiting on reconnect any more — clear any prior #1332 flag so a
          // successful reconnect always resolves the owner-visible prompt.
          needs_reconnect: false,
        },
        { onConflict: "handle,platform" },
      )
      .select("id, updated_at")
      .single();

    if (error) throw error;
    // A reconnect updates this row in place, so the new grant inherits any
    // unresolved refresh barrier and could never refresh again. Clearing
    // superseded attempts here is the documented recovery path; an attempt
    // claimed against the version this grant just produced is preserved.
    if (data && REFRESH_BARRIER_PLATFORMS.has(platform)) {
      try {
        await releasePlatformTokenRefreshBarrier({
          id: data.id,
          updatedAt: data.updated_at,
          handle: owner,
          platform,
        });
      } catch (releaseError) {
        console.error(
          "[db] refresh barrier release failed:",
          (releaseError as Error).message,
        );
      }
    }
    return true;
  } catch (error) {
    console.error("[db] dbUpsertLinkedPlatform failed:", (error as Error).message);
    return false;
  }
}

/**
 * Remove a linked platform.
 */
export async function dbDeleteLinkedPlatform(
  handle: string,
  platform: string,
): Promise<boolean> {
  const db = getSupabase();
  if (!db) return false;

  try {
    const { error } = await db
      .from("user_platforms")
      .delete()
      .eq("handle", handle.toLowerCase())
      .eq("platform", platform);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("[db] dbDeleteLinkedPlatform failed:", (error as Error).message);
    return false;
  }
}

/**
 * Update tokens after refresh.
 * Encrypts new tokens before storing.
 */
export async function dbUpdatePlatformTokens(
  handle: string,
  platform: string,
  accessToken: string,
  refreshToken: string | null,
  expiresAt: Date | null,
): Promise<boolean> {
  const db = getSupabase();
  if (!db) return false;

  try {
    const secret = getSecret();
    const { error } = await db
      .from("user_platforms")
      .update({
        access_token: encryptToken(accessToken, secret),
        refresh_token: refreshToken
          ? encryptToken(refreshToken, secret)
          : null,
        token_expires_at: expiresAt?.toISOString() ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("handle", handle.toLowerCase())
      .eq("platform", platform);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("[db] dbUpdatePlatformTokens failed:", (error as Error).message);
    return false;
  }
}

/**
 * Check if a user has a linked platform (lightweight — no token decryption).
 */
export async function dbHasLinkedPlatform(
  handle: string,
  platform: string,
): Promise<boolean> {
  const db = getSupabase();
  if (!db) return false;

  try {
    const { data, error } = await db
      .from("user_platforms")
      .select("id")
      .eq("handle", handle.toLowerCase())
      .eq("platform", platform)
      .limit(1);

    if (error) throw error;
    return Array.isArray(data) && data.length > 0;
  } catch (error) {
    console.error("[db] dbHasLinkedPlatform failed:", (error as Error).message);
    return false;
  }
}

/**
 * Get all linked platforms for a user (no tokens, just metadata).
 * Returns [] when DB unavailable (graceful degradation).
 */
export async function dbGetLinkedPlatforms(
  handle: string,
): Promise<LinkedPlatform[]> {
  const db = getSupabase();
  if (!db) return [];

  try {
    const { data, error } = await db
      .from("user_platforms")
      .select("platform, remote_login, connected_at, needs_reconnect")
      .eq("handle", handle.toLowerCase())
      .order("connected_at");

    if (error) throw error;
    if (!data) return [];

    return (data as { platform: string; remote_login: string; connected_at: string; needs_reconnect: boolean | null }[]).map(
      (row) => ({
        platform: row.platform as LinkedPlatform["platform"],
        remoteLogin: row.remote_login,
        connectedAt: row.connected_at,
        needsReconnect: row.needs_reconnect === true,
      }),
    );
  } catch (error) {
    console.error("[db] dbGetLinkedPlatforms failed:", (error as Error).message);
    return [];
  }
}
