/**
 * Fetch a GitHub avatar URL and return it as a base64 data URI.
 * Returns undefined if the fetch fails (caller should fall back to octocat icon).
 */

const ALLOWED_AVATAR_HOSTS = new Set(["avatars.githubusercontent.com"]);

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

    const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"]);
    const rawType = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "image/png";
    const contentType = ALLOWED_TYPES.has(rawType) ? rawType : "image/png";
    const buf = await res.arrayBuffer();
    const base64 = Buffer.from(buf).toString("base64");
    return `data:${contentType};base64,${base64}`;
  } catch {
    return undefined;
  }
}
