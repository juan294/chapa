/**
 * Fetch a GitHub avatar URL and return it as a base64 data URI.
 * Returns undefined if the fetch fails (caller should fall back to octocat icon).
 */

import { cacheGet, cacheSet } from "../cache/redis";

const ALLOWED_AVATAR_HOSTS = new Set(["avatars.githubusercontent.com"]);

/** Cache TTL for avatar data URIs — matches stats TTL (6 hours). */
const AVATAR_CACHE_TTL = 21600;

/**
 * Fetch an avatar from the network (no caching).
 * Validates the host is `avatars.githubusercontent.com` and the content type
 * is an allowed image MIME type before converting to a data URI.
 */
export async function fetchAvatarBase64(
  avatarUrl: string,
): Promise<string | undefined> {
  try {
    const parsed = new URL(avatarUrl);
    if (!ALLOWED_AVATAR_HOSTS.has(parsed.hostname)) {
      return undefined;
    }
    const res = await fetch(avatarUrl, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return undefined;

    const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
    const rawType = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "image/png";
    const contentType = ALLOWED_TYPES.has(rawType) ? rawType : "image/png";
    const buf = await res.arrayBuffer();
    const base64 = Buffer.from(buf).toString("base64");
    return `data:${contentType};base64,${base64}`;
  } catch {
    return undefined;
  }
}

/**
 * Get avatar base64 data URI — cache-first, then network fetch.
 *
 * Checks Redis for a cached avatar data URI keyed by handle. On cache miss,
 * fetches from GitHub CDN, converts to base64 data URI, and caches the result
 * with the same 6h TTL used for stats data.
 *
 * @param handle - GitHub username (used for cache key)
 * @param avatarUrl - Full avatar URL from GitHub
 * @returns base64 data URI string or undefined if fetch fails
 */
export async function getAvatarBase64(
  handle: string,
  avatarUrl: string,
): Promise<string | undefined> {
  const cacheKey = `avatar:${handle.toLowerCase()}`;

  // Try cache first
  const cached = await cacheGet<string>(cacheKey);
  if (cached) return cached;

  // Fetch from network
  const dataUri = await fetchAvatarBase64(avatarUrl);
  if (!dataUri) return undefined;

  // Cache for reuse (fire-and-forget — don't block on cache write)
  void cacheSet(cacheKey, dataUri, AVATAR_CACHE_TTL);

  return dataUri;
}
