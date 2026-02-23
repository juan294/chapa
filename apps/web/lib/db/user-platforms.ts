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
  const secret = process.env.NEXTAUTH_SECRET?.trim();
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
    const { error } = await db
      .from("user_platforms")
      .upsert(
        {
          handle: handle.toLowerCase(),
          platform,
          remote_login: remoteLogin,
          access_token: encryptToken(accessToken, secret),
          refresh_token: refreshToken
            ? encryptToken(refreshToken, secret)
            : null,
          token_expires_at: expiresAt?.toISOString() ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "handle,platform" },
      );

    if (error) throw error;
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
      .select("platform, remote_login, connected_at")
      .eq("handle", handle.toLowerCase())
      .order("connected_at");

    if (error) throw error;
    if (!data) return [];

    return (data as { platform: string; remote_login: string; connected_at: string }[]).map(
      (row) => ({
        platform: row.platform as LinkedPlatform["platform"],
        remoteLogin: row.remote_login,
        connectedAt: row.connected_at,
      }),
    );
  } catch (error) {
    console.error("[db] dbGetLinkedPlatforms failed:", (error as Error).message);
    return [];
  }
}
