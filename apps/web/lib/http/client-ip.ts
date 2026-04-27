/**
 * Extract client IP from request headers using Vercel's trusted proxy headers.
 *
 * Priority:
 * 1. x-vercel-forwarded-for — set by Vercel's edge network, cannot be spoofed by clients.
 * 2. x-forwarded-for (rightmost hop) — the rightmost entry is the last proxy in the chain,
 *    making it harder to spoof than the leftmost entry.
 *
 * x-real-ip is intentionally not used: it is a client-controlled header on Vercel
 * and cannot be trusted.
 */
export function getClientIp(request: Request): string {
  const vercelIp = request.headers.get("x-vercel-forwarded-for");
  if (vercelIp) return vercelIp.trim();

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded.split(",");
    const last = hops[hops.length - 1];
    if (last) {
      const trimmed = last.trim();
      if (trimmed) return trimmed;
    }
  }

  return "unknown";
}
