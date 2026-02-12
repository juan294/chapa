/**
 * Fetch a GitHub avatar URL and return it as a base64 data URI.
 * Returns undefined if the fetch fails (caller should fall back to octocat icon).
 */
export async function fetchAvatarBase64(
  avatarUrl: string,
): Promise<string | undefined> {
  try {
    const res = await fetch(avatarUrl, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return undefined;

    const contentType = res.headers.get("content-type") ?? "image/png";
    const buf = await res.arrayBuffer();
    const base64 = Buffer.from(buf).toString("base64");
    return `data:${contentType};base64,${base64}`;
  } catch {
    return undefined;
  }
}
